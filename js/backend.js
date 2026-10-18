/* GymBoy – accounts, profile and scan storage.
 *
 * One interface, two implementations:
 *   'local'     – works with no server setup. The account, profile and reports live in this
 *                 browser only ("demo mode").
 *   'supabase'  – real sign-in and a database, switched on automatically when /api/config
 *                 reports a Supabase URL and anon key (set as environment variables on Vercel).
 *
 * The screens only ever talk to GB.backend, so they don't care which one is active.
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  const KEYS = { user: 'gymboy.user', profile: 'gymboy.profile', scans: 'gymboy.scans' };
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  let cfg = { supabaseUrl: null, supabaseAnonKey: null, ai: false, aiMock: false };
  let mode = 'local';
  let sb = null;
  let user = null;
  let profile = null;
  let scans = [];
  const listeners = [];
  let lastError = null;

  /* ---------- tiny helpers ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function read(key, fallback) {
    try {
      const raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      lastError = 'Could not save on this device (storage is blocked or full).';
      return false;
    }
  }
  function remove(key) {
    try { root.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  async function fetchJson(url, opts, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl && ms ? setTimeout(() => ctl.abort(), ms) : null;
    try {
      const res = await fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}));
      const json = await res.json().catch(() => null);
      return { res, json };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('script failed to load'));
      document.head.appendChild(s);
    });
  }

  const notify = (event) => listeners.slice().forEach((fn) => { try { fn(event); } catch (e) { /* ignore */ } });

  /* ---------- start up ---------- */
  async function init() {
    try {
      const { res, json } = await fetchJson('/api/config', {}, 3000);
      if (res.ok && json && typeof json === 'object') cfg = Object.assign(cfg, json);
    } catch (e) { /* no server config (static hosting, offline): stay local */ }

    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      try {
        if (!root.supabase) await loadScript(SUPABASE_JS);
        sb = root.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
        });
        mode = 'supabase';
      } catch (e) {
        sb = null;
        mode = 'local';
      }
    }

    if (mode === 'supabase') {
      const { data } = await sb.auth.getSession();
      await adopt(data && data.session);
      // keep this callback synchronous (supabase-js warns against awaiting inside it)
      sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          user = null;
          profile = null;
          scans = [];
          notify('signed_out');
        }
      });
    } else {
      user = read(KEYS.user, null);
      profile = read(KEYS.profile, null);
      scans = read(KEYS.scans, []);
    }
  }

  // Pull the signed-in user's profile and reports into memory.
  async function adopt(session) {
    if (!session || !session.user) {
      user = null;
      profile = null;
      scans = [];
      return;
    }
    const u = session.user;
    user = { id: u.id, email: u.email || '', name: (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || '' };
    const p = await sb.from('profiles').select('data').eq('user_id', u.id).maybeSingle();
    if (p.error) lastError = p.error.message;
    profile = p.data ? p.data.data : null;
    const s = await sb.from('scans').select('id, created_at, report').eq('user_id', u.id).order('created_at', { ascending: false });
    if (s.error) lastError = s.error.message;
    scans = s.data || [];
  }

  /* ---------- accounts ---------- */
  async function signUp(o) {
    if (mode === 'local') {
      user = { id: uid(), email: (o.email || '').trim(), name: (o.name || '').trim() };
      write(KEYS.user, user);
      return { ok: true };
    }
    const { data, error } = await sb.auth.signUp({ email: o.email, password: o.password, options: { data: { name: o.name || '' } } });
    if (error) return { ok: false, error: error.message };
    if (!data.session) return { ok: true, needsConfirmation: true };
    await adopt(data.session);
    return { ok: true };
  }

  async function signIn(o) {
    if (mode === 'local') return { ok: !!user };
    const { data, error } = await sb.auth.signInWithPassword({ email: o.email, password: o.password });
    if (error) return { ok: false, error: error.message };
    await adopt(data.session);
    return { ok: true };
  }

  async function signInWithGoogle() {
    if (mode !== 'supabase') return { ok: false, error: 'Google sign-in needs the account service.' };
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: root.location.origin + root.location.pathname } });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function signOut() {
    if (mode === 'supabase' && sb) await sb.auth.signOut();
    if (mode === 'local') remove(KEYS.user); // the demo account; its profile and reports stay until deleted
    user = null;
    if (mode === 'supabase') {
      profile = null;
      scans = [];
    }
    notify('signed_out');
  }

  /* ---------- profile ---------- */
  async function saveProfile(p) {
    p.updated_at = new Date().toISOString();
    if (!p.created_at) p.created_at = p.updated_at;
    if (mode === 'local') {
      profile = clone(p);
      return { ok: write(KEYS.profile, profile) };
    }
    const { error } = await sb.from('profiles').upsert({ user_id: user.id, data: p, updated_at: p.updated_at });
    if (error) return { ok: false, error: error.message };
    profile = clone(p);
    return { ok: true };
  }

  /* ---------- scan reports ---------- */
  async function saveScan(report) {
    if (mode === 'local') {
      const rec = { id: uid(), created_at: new Date().toISOString(), report };
      scans = [rec].concat(scans);
      write(KEYS.scans, scans);
      return { ok: true, scan: rec };
    }
    const { data, error } = await sb
      .from('scans')
      .insert({ user_id: user.id, report, measured_at: report.scan && report.scan.measured_at ? report.scan.measured_at : null })
      .select('id, created_at, report')
      .single();
    if (error) return { ok: false, error: error.message };
    scans = [data].concat(scans);
    return { ok: true, scan: data };
  }

  async function deleteScan(id) {
    if (mode === 'supabase') {
      const { error } = await sb.from('scans').delete().eq('id', id).eq('user_id', user.id);
      if (error) return { ok: false, error: error.message };
    }
    scans = scans.filter((s) => s.id !== id);
    if (mode === 'local') write(KEYS.scans, scans);
    return { ok: true };
  }

  // Removes the profile and reports. (Deleting the sign-in account itself needs a server-side admin call.)
  async function deleteMyData() {
    if (mode === 'supabase') {
      await sb.from('scans').delete().eq('user_id', user.id);
      await sb.from('profiles').delete().eq('user_id', user.id);
    } else {
      remove(KEYS.profile);
      remove(KEYS.scans);
    }
    profile = null;
    scans = [];
    return { ok: true };
  }

  /* ---------- AI analysis ---------- */
  /**
   * analyze({ images: [{media_type, data}], profile, signal }) -> { ok, report, meta } | { ok:false, error, message }
   * In demo (local) mode, if the analysis service is not reachable or not set up, the bundled
   * sample report is returned, marked meta.mock = true.
   */
  async function analyze(o) {
    const body = {
      images: o.images,
      profile: GB.profile.profileForAI(o.profile),
      previous_scan: GB.profile.previousForAI(scans),
      app_language: ((root.navigator && root.navigator.language) || 'en').slice(0, 2),
      units_preference: o.profile.units === 'imperial' ? 'imperial' : 'metric',
    };
    const headers = { 'Content-Type': 'application/json' };
    if (mode === 'supabase') {
      const { data } = await sb.auth.getSession();
      if (data && data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
    }

    const demo = (reason) => ({ ok: true, report: clone(GB.sampleReport), meta: { mock: true, reason } });
    let res;
    let json;
    try {
      ({ res, json } = await fetchJson('/api/analyze-scan', { method: 'POST', headers, body: JSON.stringify(body), signal: o.signal }, 90000));
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, error: 'cancelled', message: 'Cancelled.' };
      if (mode === 'local') return demo('unreachable');
      return { ok: false, error: 'network', message: 'Could not reach the analysis service. Check your connection and try again.' };
    }
    if (res.ok && json && json.report) return { ok: true, report: json.report, meta: json.meta || {} };
    const code = json && json.error;
    // Demo mode: if the analysis service is missing or not set up (no key, no accounts on a live site), show the sample.
    const notSetUp = ['ai_not_configured', 'auth_not_configured', 'auth_unavailable'].includes(code);
    if (mode === 'local' && (!json || notSetUp || res.status === 404 || res.status === 405)) return demo(code || 'unavailable');
    return { ok: false, error: code || 'failed', message: (json && json.message) || 'Something went wrong. Please try again.' };
  }

  GB.backend = {
    init,
    get mode() { return mode; },
    get config() { return cfg; },
    get lastError() { return lastError; },
    // 'live' = real AI, 'mock' = server returns the sample, 'demo' = no analysis service (sample shown)
    get aiMode() { return cfg.ai && !cfg.aiMock ? 'live' : cfg.aiMock ? 'mock' : 'demo'; },
    user: () => user,
    profile: () => profile,
    scans: () => scans.slice(),
    isSignedIn: () => !!user,
    hasProfile: () => !!(profile && profile.created_at),
    onChange: (fn) => listeners.push(fn),
    signUp, signIn, signInWithGoogle, signOut,
    saveProfile, saveScan, deleteScan, deleteMyData, analyze,
  };
})(typeof window !== 'undefined' ? window : globalThis);
