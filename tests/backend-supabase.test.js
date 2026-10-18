/* Runs js/backend.js in 'supabase' mode using the REAL @supabase/supabase-js client, pointed at a
 * small fake server, so we can check the requests our code produces (and how it reads replies).
 * This tests OUR usage of the library; it cannot prove anything about a live Supabase project.
 *   Run: node tests/backend-supabase.test.js
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

globalThis.window = globalThis;
require('../js/profile-utils.js');
require('../js/sample-report.js');
const supabaseLib = require('@supabase/supabase-js');

const USER = { id: '11111111-1111-1111-1111-111111111111', email: 'priya@example.com', user_metadata: { name: 'Priya' }, aud: 'authenticated', role: 'authenticated', app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const session = (u) => ({ access_token: 'jwt-123', refresh_token: 'refresh-123', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: u || USER });

/* ---------- fake Supabase (auth + a tiny table store) ---------- */
const db = { profiles: [], scans: [] };
const log = [];
let confirmEmails = false;

function fakeSupabase() {
  return http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const body = raw ? JSON.parse(raw) : null;
      log.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body });
      const json = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(obj === undefined ? '' : JSON.stringify(obj));
      };
      const single = (req.headers.accept || '').includes('vnd.pgrst.object');
      const eq = (k) => (url.searchParams.get(k) || '').replace(/^eq\./, '');

      if (url.pathname === '/auth/v1/signup') return json(200, confirmEmails ? { ...USER, identities: [] } : { ...session(), ...session() });
      if (url.pathname === '/auth/v1/token') return body.password === 'right-password' ? json(200, session()) : json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      if (url.pathname === '/auth/v1/logout') return json(204);

      if (url.pathname === '/rest/v1/profiles') {
        if (req.method === 'GET') {
          const rows = db.profiles.filter((r) => r.user_id === eq('user_id')).map((r) => ({ data: r.data }));
          return single ? (rows[0] ? json(200, rows[0]) : json(406, { code: 'PGRST116' })) : json(200, rows);
        }
        if (req.method === 'POST') {
          db.profiles = db.profiles.filter((r) => r.user_id !== body.user_id).concat(body);
          return json(201);
        }
        if (req.method === 'DELETE') {
          db.profiles = db.profiles.filter((r) => r.user_id !== eq('user_id'));
          return json(204);
        }
      }
      if (url.pathname === '/rest/v1/scans') {
        if (req.method === 'GET') return json(200, db.scans.filter((r) => r.user_id === eq('user_id')).sort((a, b) => b.created_at.localeCompare(a.created_at)));
        if (req.method === 'POST') {
          const row = { id: `scan-${db.scans.length + 1}`, created_at: new Date(2026, 9, 17, 12, db.scans.length).toISOString(), ...body };
          db.scans.push(row);
          return json(201, single ? { id: row.id, created_at: row.created_at, report: row.report } : [{ id: row.id, created_at: row.created_at, report: row.report }]);
        }
        if (req.method === 'DELETE') {
          // like PostgREST: remove the rows matching every filter that was sent
          const filters = ['id', 'user_id'].filter((k) => url.searchParams.has(k));
          db.scans = db.scans.filter((r) => !(filters.length && filters.every((k) => r[k] === eq(k))));
          return json(204);
        }
      }
      return json(404, { error: 'not found in fake', path: url.pathname });
    });
  });
}

/* ---------- harness ---------- */
let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${e.stack ? e.message : e}`);
  }
}

(async () => {
  const server = fakeSupabase();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // our /api calls are answered here; everything else goes to the real fetch (-> the fake server)
  const apiCalls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u === '/api/config') return Promise.resolve(new Response(JSON.stringify({ supabaseUrl: base, supabaseAnonKey: 'anon-key', ai: true, aiMock: false }), { status: 200 }));
    if (u === '/api/analyze-scan') {
      apiCalls.push({ headers: opts.headers, body: JSON.parse(opts.body) });
      return Promise.resolve(new Response(JSON.stringify({ report: globalThis.GB.sampleReport, meta: { mock: false } }), { status: 200 }));
    }
    return realFetch(url, opts);
  };
  globalThis.WebSocket = globalThis.WebSocket || class {}; // the browser client expects one (Node 20 has none)
  globalThis.supabase = supabaseLib; // what the CDN <script> would provide in a browser
  globalThis.navigator = { language: 'en-GB' };

  require('../js/backend.js');
  const B = globalThis.GB.backend;
  await B.init();

  await test('config from /api/config switches the backend to supabase mode', () => {
    assert.strictEqual(B.mode, 'supabase');
    assert.strictEqual(B.aiMode, 'live');
    assert.strictEqual(B.isSignedIn(), false);
  });

  await test('sign up sends the name as metadata and signs the user in', async () => {
    const r = await B.signUp({ email: 'priya@example.com', password: 'right-password', name: 'Priya' });
    assert.deepStrictEqual(r, { ok: true });
    const call = log.find((c) => c.path === '/auth/v1/signup');
    assert.strictEqual(call.body.email, 'priya@example.com');
    assert.strictEqual(call.body.data.name, 'Priya');
    assert.strictEqual(call.headers.apikey, 'anon-key');
    assert.strictEqual(B.user().id, USER.id);
    assert.strictEqual(B.user().name, 'Priya');
    assert.strictEqual(B.hasProfile(), false, 'new user has no profile yet');
  });

  await test('saving the profile upserts one row keyed by the user id', async () => {
    const profile = globalThis.GB.profile.emptyProfile();
    Object.assign(profile, { name: 'Priya', height_cm: 165, weight_kg: 60 });
    const r = await B.saveProfile(profile);
    assert.strictEqual(r.ok, true);
    const post = log.filter((c) => c.method === 'POST' && c.path === '/rest/v1/profiles').pop();
    assert.strictEqual(post.body.user_id, USER.id);
    assert.strictEqual(post.body.data.name, 'Priya');
    assert.ok(/merge-duplicates/.test(post.headers.prefer || ''), 'upsert header: ' + post.headers.prefer);
    assert.strictEqual(B.hasProfile(), true);
    assert.strictEqual(db.profiles.length, 1);
  });

  await test('saving a scan inserts it for this user and returns the new record', async () => {
    const report = JSON.parse(JSON.stringify(globalThis.GB.sampleReport));
    const r = await B.saveScan(report);
    assert.strictEqual(r.ok, true, r.error);
    assert.strictEqual(r.scan.id, 'scan-1');
    const post = log.filter((c) => c.method === 'POST' && c.path === '/rest/v1/scans').pop();
    assert.strictEqual(post.body.user_id, USER.id);
    assert.strictEqual(post.body.measured_at, report.scan.measured_at);
    assert.strictEqual(B.scans().length, 1);
  });

  await test('analyze sends the access token and a privacy-trimmed profile', async () => {
    const profile = globalThis.GB.profile.emptyProfile();
    Object.assign(profile, { name: 'Priya Sharma', dob: '1994-05-02', sex: 'female', height_cm: 165, weight_kg: 60, units: 'imperial' });
    const r = await B.analyze({ images: [{ media_type: 'image/jpeg', data: 'AAAA' }], profile });
    assert.strictEqual(r.ok, true);
    const call = apiCalls[0];
    assert.strictEqual(call.headers.Authorization, 'Bearer jwt-123');
    assert.strictEqual(call.body.units_preference, 'imperial');
    assert.strictEqual(call.body.app_language, 'en');
    const text = JSON.stringify(call.body.profile);
    ['Priya', 'dob', '1994'].forEach((s) => assert.ok(!text.includes(s), `leaked ${s}`));
    assert.ok(call.body.previous_scan && call.body.previous_scan.metrics.length > 3, 'previous scan comes from the saved report');
  });

  await test('sign out clears everything in memory', async () => {
    await B.signOut();
    assert.strictEqual(B.isSignedIn(), false);
    assert.strictEqual(B.profile(), null);
    assert.strictEqual(B.scans().length, 0);
    assert.ok(log.some((c) => c.path === '/auth/v1/logout'));
  });

  await test('sign in with the wrong password returns a readable error', async () => {
    const r = await B.signIn({ email: 'priya@example.com', password: 'nope' });
    assert.strictEqual(r.ok, false);
    assert.ok(/invalid/i.test(r.error), r.error);
    assert.strictEqual(B.isSignedIn(), false);
  });

  await test('signing back in loads the saved profile and reports', async () => {
    const r = await B.signIn({ email: 'priya@example.com', password: 'right-password' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(B.hasProfile(), true);
    assert.strictEqual(B.profile().height_cm, 165);
    assert.strictEqual(B.scans().length, 1);
    const read = log.filter((c) => c.method === 'GET' && c.path === '/rest/v1/scans').pop();
    assert.strictEqual(read.query.user_id, `eq.${USER.id}`);
    assert.ok(/created_at\.desc/.test(read.query.order || ''), 'newest first');
  });

  await test('deleting a report removes it for this user only', async () => {
    const id = B.scans()[0].id;
    assert.strictEqual((await B.deleteScan(id)).ok, true);
    const del = log.filter((c) => c.method === 'DELETE' && c.path === '/rest/v1/scans').pop();
    assert.strictEqual(del.query.id, `eq.${id}`);
    assert.strictEqual(del.query.user_id, `eq.${USER.id}`);
    assert.strictEqual(B.scans().length, 0);
    assert.strictEqual(db.scans.length, 0);
  });

  await test('delete my data removes the profile and reports rows', async () => {
    await B.saveScan(JSON.parse(JSON.stringify(globalThis.GB.sampleReport)));
    await B.deleteMyData();
    assert.strictEqual(db.profiles.length, 0);
    assert.strictEqual(db.scans.length, 0);
    assert.strictEqual(B.profile(), null);
  });

  await test('an email that needs confirming reports that instead of signing in', async () => {
    confirmEmails = true;
    // sign-up when the server returns a user but no session
    const r = await B.signUp({ email: 'new@example.com', password: 'right-password', name: 'New' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.needsConfirmation, true);
    confirmEmails = false;
  });

  server.close();
  if (failures.length) {
    console.log(failures.join('\n'));
    console.log(`\n${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`All ${passed} backend (supabase mode) tests passed`);
  process.exit(0);
})();
