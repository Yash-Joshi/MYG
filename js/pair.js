/* GymBoy – pair workouts: two people, one plan, two phones.
 *
 * No DOM in this file, so all of it is tested in node (tests/pair*.test.js).
 *
 *   makeCode / normalizeCode   the 6-character room code
 *   summarize / compare        a workout in one small snapshot; the scoreboard between two of them
 *   create()                   the session controller: join handshake, live snapshots, shared plan,
 *                              shared rest timer, nudges, finish, leave, heartbeat, reconnect
 *   supabaseTransport()        carries the messages over Supabase Realtime (Broadcast, no tables)
 *   memoryBus() + createBot()  a practice partner that runs inside the page, for demos and tests
 *
 * Trust model: a room is a Realtime Broadcast channel named after the code, and the app talks to
 * it with the project's public key, so anyone who knows the code can listen in. Only workout
 * numbers and a first name travel over it, the code is 6 characters from a 31-letter alphabet,
 * and the host's session accepts exactly one partner. Everything received is size-checked and
 * only ever drawn as text. Private channels with sign-in (row-level rules on realtime.messages)
 * are the next step if rooms ever carry anything more sensitive.
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  const V = 1;
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: nothing to mix up when typing a code
  const CODE_LEN = 6;
  const NUDGES = ['💪', '🔥', '👏', '⏱️'];
  const PING_MS = 10000;
  const STALE_MS = 35000;
  const JOIN_RETRY_MS = 2000;
  const JOIN_TIMEOUT_MS = 10000;
  const LB_PER_KG = 2.20462;

  /* =====================================================================
   * Codes and small helpers
   * ===================================================================== */
  function randomInt(n) {
    const c = root.crypto;
    if (c && c.getRandomValues) {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function makeCode() {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    return s;
  }

  // What someone typed -> a valid code, or null.
  function normalizeCode(input) {
    const s = String(input == null ? '' : input).toUpperCase().replace(/[\s-]/g, '');
    if (s.length !== CODE_LEN) return null;
    for (const ch of s) if (!ALPHABET.includes(ch)) return null;
    return s;
  }

  function newId() {
    let s = '';
    for (let i = 0; i < 12; i++) s += ALPHABET[randomInt(ALPHABET.length)].toLowerCase();
    return s;
  }

  /* ---------- everything that arrives is cleaned before it is used ---------- */
  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const num = (v, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
  };
  const cleanName = (v) => str(v, 24) || 'Partner';

  function cleanSnap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const exercises = (Array.isArray(raw.exercises) ? raw.exercises : [])
      .slice(0, 40)
      .map((e) => ({
        name: str(e && e.name, 60),
        muscle: str(e && e.muscle, 20),
        sets: (Array.isArray(e && e.sets) ? e.sets : []).slice(0, 40).map((x) => str(x, 24)),
      }))
      .filter((e) => e.name);
    return {
      sets: Math.round(num(raw.sets, 0, 9999)),
      volKg: Math.round(num(raw.volKg, 0, 1e7) * 10) / 10,
      work: Math.round(num(raw.work, 0, 1e6)),
      unit: raw.unit === 'lb' ? 'lb' : 'kg',
      exercises,
    };
  }

  function cleanExercises(raw) {
    return (Array.isArray(raw) ? raw : [])
      .slice(0, 40)
      .map((e) => ({ name: str(e && e.name, 60), muscle: str(e && e.muscle, 20) || 'other', sets: Math.round(num(e && e.sets, 1, 12)) || 3 }))
      .filter((e) => e.name);
  }

  function cleanPlan(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const muscles = (Array.isArray(raw.muscles) ? raw.muscles : []).slice(0, 12).map((m) => str(m, 20)).filter(Boolean);
    return { dayId: str(raw.dayId, 30) || 'custom', dayName: str(raw.dayName, 40) || 'Workout', muscles, exercises: cleanExercises(raw.exercises) };
  }

  /* =====================================================================
   * Snapshots and the scoreboard
   * ===================================================================== */
  // exercises: a workout in its saved shape (done sets only), as app.js collects it.
  function summarize(exercises, unit) {
    const U = GB.util;
    const u = unit === 'lb' ? 'lb' : 'kg';
    const st = U.stats({ exercises });
    return cleanSnap({
      sets: st.sets,
      volKg: u === 'lb' ? st.volume / LB_PER_KG : st.volume,
      work: st.work,
      unit: u,
      exercises: exercises.map((ex) => ({ name: ex.name, muscle: ex.muscle, sets: ex.sets.map((s) => U.setCompact(s, U.isTimed(ex), u)) })),
    });
  }

  const EMPTY = { sets: 0, volKg: 0, work: 0, unit: 'kg', exercises: [] };

  // Who is ahead, on each measure and overall. Volume decides a lifting day, work time a timed day.
  function compare(mine, theirs) {
    const a = mine || EMPTY;
    const b = theirs || EMPTY;
    const lead = (x, y, tol) => (Math.abs(x - y) <= tol ? 'tie' : x > y ? 'me' : 'them');
    const rows = [{ key: 'sets', label: 'Sets', me: a.sets, them: b.sets, lead: lead(a.sets, b.sets, 0) }];
    if (a.volKg > 0 || b.volKg > 0) rows.push({ key: 'volume', label: 'Volume', me: a.volKg, them: b.volKg, lead: lead(a.volKg, b.volKg, 0.5) });
    if (a.work > 0 || b.work > 0) rows.push({ key: 'work', label: 'Work time', me: a.work, them: b.work, lead: lead(a.work, b.work, 0) });
    const basis = rows.find((r) => r.key === 'volume') ? 'volume' : rows.find((r) => r.key === 'work') ? 'work' : 'sets';
    return { rows, basis, winner: rows.find((r) => r.key === basis).lead };
  }

  /* =====================================================================
   * The session controller
   * ===================================================================== */
  const defaultClock = () => ({
    now: () => Date.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h),
  });

  /**
   * create({ transport, id?, name, clock?, getSnap?, getPlan?, getExercises? }) -> controller
   *
   *   transport.open(room, { onMessage(msg), onStatus('connected'|'disconnected') }) -> Promise
   *   transport.send(msg) -> Promise|void      transport.close()
   *
   * Events (ctl.on(fn)): status, peer, snap, plan, rest, nudge, finish, left, stale, fresh, online.
   */
  function create(opts) {
    const clock = opts.clock || defaultClock();
    const transport = opts.transport;
    const self = { id: opts.id || newId(), name: cleanName(opts.name) };
    const listeners = [];
    const st = { role: null, room: null, status: 'idle', peer: null, peerSnap: null, peerFinished: false, peerLeft: false, peerStale: false, selfFinished: false, online: false, lastSeen: 0 };
    let pingTimer = null;
    let joinRetry = null;
    let joinTimer = null;
    let settleJoin = null;
    let everConnected = false;
    let closed = false;

    const emit = (ev) => listeners.slice().forEach((fn) => { try { fn(ev); } catch (e) { /* a listener's bug must not stop the session */ } });
    const setStatus = (status, extra) => {
      st.status = status;
      emit(Object.assign({ type: 'status', status }, extra));
    };

    function send(type, body, to) {
      if (closed || !st.room) return Promise.resolve();
      const msg = Object.assign({ v: V, room: st.room, from: self.id, type, t: clock.now() }, to ? { to } : null, body);
      try {
        return Promise.resolve(transport.send(msg)).catch(() => {});
      } catch (e) {
        return Promise.resolve();
      }
    }

    const touch = () => {
      st.lastSeen = clock.now();
      if (st.peerStale) {
        st.peerStale = false;
        emit({ type: 'fresh' });
      }
    };

    function currentPlan() {
      return (opts.getPlan && opts.getPlan()) || null;
    }

    // Tell the partner everything we know (used after joining, resuming and reconnecting).
    function sync() {
      if (!st.peer) return;
      const exercises = opts.getExercises ? opts.getExercises() : null;
      if (exercises && exercises.length) send('plan', { exercises });
      const snap = opts.getSnap ? opts.getSnap() : null;
      if (snap) send('snap', { snap });
    }

    /* ---------- incoming ---------- */
    function onHello(m) {
      if (st.role !== 'host' || st.status === 'closed') return;
      const name = cleanName(m.name);
      if (!st.peer) st.peer = { id: m.from, name };
      else if (st.peer.id !== m.from) {
        send('full', {}, m.from);
        return;
      } else st.peer.name = name;
      st.peerLeft = false;
      touch();
      send('welcome', { name: self.name, plan: currentPlan() }, m.from);
      const wasPaired = st.status === 'paired';
      setStatus('paired');
      emit({ type: 'peer', peer: Object.assign({}, st.peer), rejoin: wasPaired });
      sync();
    }

    function onWelcome(m) {
      if (st.role !== 'guest' || m.to !== self.id) return;
      const plan = cleanPlan(m.plan);
      const peer = { id: m.from, name: cleanName(m.name) };
      if (st.status === 'joining') {
        st.peer = peer;
        touch();
        setStatus('paired');
        if (settleJoin) settleJoin({ ok: true, plan, peer: Object.assign({}, peer) });
        sync();
      } else if (st.peer && st.peer.id === m.from) {
        touch();
        st.peerLeft = false;
        if (plan && plan.exercises.length) emit({ type: 'plan', exercises: plan.exercises });
        sync();
      }
    }

    function onFull(m) {
      if (st.role === 'guest' && st.status === 'joining' && m.to === self.id && settleJoin) settleJoin({ ok: false, reason: 'full' });
    }

    function onMessage(m) {
      if (closed || !m || typeof m !== 'object' || m.v !== V || m.room !== st.room || typeof m.from !== 'string' || m.from === self.id) return;
      if (m.to && m.to !== self.id) return;
      if (m.type === 'hello') return onHello(m);
      if (m.type === 'welcome') return onWelcome(m);
      if (m.type === 'full') return onFull(m);
      if (!st.peer || m.from !== st.peer.id) return; // from here on, only the paired partner is listened to
      touch();
      switch (m.type) {
        case 'snap':
        case 'ping': {
          const s = cleanSnap(m.snap);
          if (s) {
            st.peerSnap = s;
            emit({ type: 'snap', snap: s });
          }
          break;
        }
        case 'plan': {
          const ex = cleanExercises(m.exercises);
          if (ex.length) emit({ type: 'plan', exercises: ex });
          break;
        }
        case 'rest': {
          const total = Math.round(num(m.total, 0, 600));
          const end = num(m.end, 0, 1e15);
          if (total >= 5 && end > 0) emit({ type: 'rest', total, end });
          break;
        }
        case 'nudge':
          if (NUDGES.includes(m.emoji)) emit({ type: 'nudge', emoji: m.emoji, from: st.peer.name });
          break;
        case 'finish': {
          st.peerFinished = true;
          const s = cleanSnap(m.snap);
          if (s) st.peerSnap = s;
          emit({ type: 'finish', snap: st.peerSnap });
          break;
        }
        case 'bye':
          st.peerLeft = true;
          emit({ type: 'left' });
          break;
        default:
          break;
      }
    }

    function onStatus(s) {
      if (closed) return;
      if (s === 'connected') {
        const wasOnline = st.online;
        st.online = true;
        emit({ type: 'online', online: true });
        if (everConnected && !wasOnline) {
          // the connection came back: say hello again (a guest) or catch the partner up
          if (st.role === 'guest' && st.peer) send('hello', { name: self.name });
          else sync();
        }
        everConnected = true;
      } else {
        st.online = false;
        emit({ type: 'online', online: false });
      }
    }

    /* ---------- lifecycle ---------- */
    async function open(room) {
      st.room = room;
      await transport.open(room, { onMessage, onStatus });
    }

    function startPing() {
      clock.clearInterval(pingTimer);
      pingTimer = clock.setInterval(() => {
        if (!st.peer || closed) return;
        send('ping', { snap: opts.getSnap ? opts.getSnap() : null });
        if (!st.peerLeft && !st.peerStale && clock.now() - st.lastSeen > STALE_MS) {
          st.peerStale = true;
          emit({ type: 'stale' });
        }
      }, PING_MS);
    }

    function stopTimers() {
      clock.clearInterval(pingTimer);
      clock.clearInterval(joinRetry);
      clock.clearTimeout(joinTimer);
      pingTimer = joinRetry = joinTimer = null;
    }

    function teardown() {
      if (closed) return;
      closed = true;
      stopTimers();
      try {
        transport.close();
      } catch (e) { /* already closed */ }
      setStatus('closed');
    }

    // The host opens the room. o.peer is set when resuming a session that was already paired.
    async function host(room, o) {
      st.role = 'host';
      if (o && o.peer) st.peer = { id: o.peer.id, name: cleanName(o.peer.name) };
      try {
        await open(room);
      } catch (e) {
        setStatus('failed', { reason: 'connection' });
        return { ok: false, reason: 'connection' };
      }
      if (st.peer) {
        touch();
        setStatus('paired');
        sync();
      } else setStatus('waiting');
      startPing();
      return { ok: true };
    }

    // The guest asks to join; resolves with { ok, plan, peer } or { ok:false, reason: 'not_found'|'full'|'connection' }.
    function join(room) {
      st.role = 'guest';
      setStatus('joining');
      return new Promise((resolve) => {
        let settled = false;
        settleJoin = (r) => {
          if (settled) return;
          settled = true;
          settleJoin = null;
          clock.clearInterval(joinRetry);
          clock.clearTimeout(joinTimer);
          if (r.ok) startPing();
          else {
            try {
              transport.close();
            } catch (e) { /* ignore */ }
            closed = true;
            setStatus('failed', { reason: r.reason });
          }
          resolve(r);
        };
        open(room).then(
          () => {
            if (settled) return;
            const hello = () => send('hello', { name: self.name });
            hello();
            joinRetry = clock.setInterval(hello, JOIN_RETRY_MS);
            joinTimer = clock.setTimeout(() => settleJoin && settleJoin({ ok: false, reason: 'not_found' }), JOIN_TIMEOUT_MS);
          },
          () => settleJoin && settleJoin({ ok: false, reason: 'connection' })
        );
      });
    }

    // Pick a session back up after the page was closed or reloaded.
    async function resume(o) {
      st.role = o.role;
      if (o.peer) st.peer = { id: o.peer.id, name: cleanName(o.peer.name) };
      try {
        await open(o.room);
      } catch (e) {
        setStatus('failed', { reason: 'connection' });
        return { ok: false, reason: 'connection' };
      }
      if (st.peer) {
        touch();
        setStatus('paired');
        if (st.role === 'guest') send('hello', { name: self.name });
        sync();
      } else setStatus(st.role === 'host' ? 'waiting' : 'failed');
      startPing();
      return { ok: true };
    }

    /* ---------- outgoing ---------- */
    const paired = () => !!st.peer && !closed;

    async function leave() {
      if (closed) return;
      if (paired() && !st.selfFinished) await send('bye', {}); // after finishing there is nothing to say goodbye to
      teardown();
    }

    // Tell the partner your final numbers, but keep listening: your result screen keeps updating
    // until they finish too. close() ends the connection.
    async function finish(snap) {
      if (closed) return;
      st.selfFinished = true;
      if (paired()) await send('finish', { snap });
    }

    function close() {
      teardown();
    }

    return {
      self,
      get state() {
        return Object.assign({}, st, { peer: st.peer && Object.assign({}, st.peer) });
      },
      on(fn) {
        listeners.push(fn);
        return () => {
          const i = listeners.indexOf(fn);
          if (i !== -1) listeners.splice(i, 1);
        };
      },
      host,
      join,
      resume,
      leave,
      finish,
      close,
      sendSnap: (snap) => (paired() ? send('snap', { snap }) : Promise.resolve()),
      sendPlan: (exercises) => (paired() ? send('plan', { exercises }) : Promise.resolve()),
      sendRest: (total, end) => (paired() ? send('rest', { total, end }) : Promise.resolve()),
      nudge: (emoji) => (paired() && NUDGES.includes(emoji) ? send('nudge', { emoji }) : Promise.resolve()),
    };
  }

  /* =====================================================================
   * Transports
   * ===================================================================== */
  // Supabase Realtime Broadcast. `api` is GB.backend.realtime: { channel(name), remove(ch) }.
  function supabaseTransport(api) {
    let ch = null;
    return {
      kind: 'realtime',
      open(room, h) {
        return new Promise((resolve, reject) => {
          let first = true;
          try {
            ch = api.channel('gymboy-pair-' + room);
          } catch (e) {
            return reject(e);
          }
          if (!ch) return reject(new Error('Realtime is not available'));
          ch.on('broadcast', { event: 'msg' }, (m) => h.onMessage(m && m.payload));
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              h.onStatus('connected');
              if (first) {
                first = false;
                resolve();
              }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              if (first) {
                first = false;
                reject(new Error(String(status)));
              } else h.onStatus('disconnected');
            } else if (status === 'CLOSED') h.onStatus('disconnected');
          });
        });
      },
      async send(msg) {
        if (ch) await ch.send({ type: 'broadcast', event: 'msg', payload: msg });
      },
      close() {
        const c = ch;
        ch = null;
        if (!c) return;
        try {
          if (api.remove) api.remove(c);
          else c.unsubscribe();
        } catch (e) { /* ignore */ }
      },
    };
  }

  // Two ends of a private in-page wire (messages are copied, like a real network would).
  function memoryBus() {
    const ends = [null, null];
    const make = (i) => ({
      kind: 'memory',
      open(room, h) {
        ends[i] = h;
        h.onStatus('connected');
        return Promise.resolve();
      },
      send(msg) {
        const other = ends[1 - i];
        if (other) Promise.resolve().then(() => other.onMessage(JSON.parse(JSON.stringify(msg))));
        return Promise.resolve();
      },
      close() {
        ends[i] = null;
      },
    });
    return [make(0), make(1)];
  }

  /* =====================================================================
   * The practice partner: lets one person try the whole feature, no second phone needed.
   * It joins like any partner would, then logs a set every few seconds on the shared plan.
   * ===================================================================== */
  function createBot(o) {
    const clock = o.clock || defaultClock();
    const U = GB.util;
    const exercises = []; // saved shape: { name, muscle, sets:[{w,r,t}], target }
    const tickMs = o.tickMs || 7000;
    let tickTimer = null;
    let ctl = null;
    let nudged = false;

    const hash = (s) => String(s).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);

    function snapNow() {
      return summarize(exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets })), 'kg');
    }

    function adopt(list) {
      list.forEach((e) => {
        if (!exercises.some((x) => U.keyOf(x.name) === U.keyOf(e.name))) exercises.push({ name: e.name, muscle: e.muscle, sets: [], target: e.sets || 3 });
      });
    }

    function logSet() {
      const ex = exercises.find((e) => e.sets.length < e.target);
      if (!ex) return;
      const base = 20 + (hash(ex.name) % 9) * 5; // 20..60 kg, steady per exercise
      const n = ex.sets.length;
      if (U.isTimed(ex)) ex.sets.push({ t: 30 + (n % 3) * 5, w: 0, r: 0 });
      else ex.sets.push({ w: base, r: 8 + ((n + hash(ex.name)) % 4) });
      ctl.sendSnap(snapNow());
      if (!nudged && exercises.reduce((a, e) => a + e.sets.length, 0) >= 3) {
        nudged = true;
        ctl.nudge('🔥');
      }
    }

    return {
      async start(room) {
        ctl = create({ transport: o.transport, name: o.name || 'Practice partner', clock, getSnap: snapNow, getExercises: () => exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.target })) });
        ctl.on((ev) => {
          if (ev.type === 'plan') adopt(ev.exercises);
        });
        const r = await ctl.join(room);
        if (!r.ok) return r;
        if (r.plan) adopt(r.plan.exercises);
        tickTimer = clock.setInterval(logSet, tickMs);
        return r;
      },
      logSetNow: () => logSet(),
      snapshot: snapNow,
      stop() {
        clock.clearInterval(tickTimer);
        tickTimer = null;
        if (ctl) ctl.leave();
      },
    };
  }

  GB.pair = { NUDGES, CODE_LEN, makeCode, normalizeCode, newId, summarize, compare, cleanSnap, cleanExercises, cleanPlan, create, supabaseTransport, memoryBus, createBot };
})(typeof window !== 'undefined' ? window : globalThis);
