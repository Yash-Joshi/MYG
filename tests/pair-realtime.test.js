/* Pair workouts over Supabase Realtime, using the REAL @supabase/supabase-js client pointed at a small
 * fake Realtime server that speaks the same wire protocol (Phoenix channels, v2 serializer, binary
 * user-broadcast frames). This tests OUR usage of the library end to end: how the channel is opened,
 * what a broadcast looks like on the wire, and that two clients in one room hear each other and
 * clients in other rooms do not. It cannot prove anything about a live Supabase project.
 *   Run: node tests/pair-realtime.test.js
 */
const assert = require('assert');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

globalThis.window = globalThis;
globalThis.WebSocket = WebSocket; // Node 20 has no built-in WebSocket
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../js/store.js');
require('../js/profile-utils.js');
require('../js/sample-report.js');
require('../js/backend.js');
require('../js/pair.js');
const { createClient } = require('@supabase/supabase-js');
const P = global.GB.pair;

let passed = 0;
const failures = [];
const queue = [];
const test = (name, fn) => queue.push({ name, fn });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 3000)) {
    if (fn()) return true;
    await sleep(15);
  }
  return false;
}

/* ---------- the fake Realtime server ---------- */
const wire = { joins: [], broadcasts: [], connections: 0 };

function decodeUserBroadcastPush(buf) {
  const [kind, jl, rl, tl, el, ml, enc] = buf;
  assert.strictEqual(kind, 3, 'expected a user-broadcast push frame');
  let o = 7;
  const take = (n) => {
    const s = buf.subarray(o, o + n).toString('utf8');
    o += n;
    return s;
  };
  const joinRef = take(jl);
  const ref = take(rl);
  const topic = take(tl);
  const event = take(el);
  take(ml);
  const body = buf.subarray(o).toString('utf8');
  return { joinRef, ref, topic, event, payload: enc === 1 ? JSON.parse(body) : body };
}

function startServer() {
  const server = http.createServer((req, res) => res.writeHead(404).end());
  const wss = new WebSocketServer({ server, path: '/realtime/v1/websocket' });
  wss.on('connection', (ws) => {
    wire.connections++;
    ws.topics = new Set();
    const reply = (joinRef, ref, topic, response) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: response || {} }]));
    const relay = (topic, event, payload) => {
      wss.clients.forEach((c) => {
        if (c !== ws && c.readyState === 1 && c.topics && c.topics.has(topic)) c.send(JSON.stringify([null, null, topic, 'broadcast', { type: 'broadcast', event, payload }]));
      });
    };
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const m = decodeUserBroadcastPush(Buffer.from(data));
        wire.broadcasts.push(m);
        return relay(m.topic, m.event, m.payload);
      }
      const [joinRef, ref, topic, event, payload] = JSON.parse(data.toString());
      if (event === 'phx_join') {
        ws.topics.add(topic);
        wire.joins.push({ topic, payload });
        return reply(joinRef, ref, topic, { postgres_changes: [] });
      }
      if (event === 'phx_leave') {
        ws.topics.delete(topic);
        return reply(joinRef, ref, topic);
      }
      if (event === 'heartbeat') return reply(null, ref, 'phoenix');
      if (event === 'broadcast') {
        wire.broadcasts.push({ topic, event: payload.event, payload: payload.payload });
        return relay(topic, payload.event, payload.payload);
      }
      return undefined;
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, wss, port: server.address().port })));
}

// One person's phone: its own Supabase client, wrapped as a pair transport.
function phone(port, opts) {
  const client = createClient(`http://127.0.0.1:${port}`, 'anon-key-for-tests', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: Object.assign({}, opts),
  });
  const api = {
    channel: (name) => client.channel(name, { config: { broadcast: { self: false, ack: false } } }),
    remove: (ch) => client.removeChannel(ch),
  };
  return { client, transport: P.supabaseTransport(api) };
}

const ROOM = 'K7M2QP';
const PLAN = { dayId: 'push', dayName: 'Push', muscles: ['chest'], exercises: [{ name: 'Bench Press', muscle: 'chest', sets: 3 }] };
const bench = { name: 'Bench Press', muscle: 'chest', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }] };
const events = (ctl) => {
  const list = [];
  ctl.on((e) => list.push(e));
  return list;
};
const of = (list, type) => list.filter((e) => e.type === type);

let srv;
const phones = [];
const mk = (opts) => {
  const p = phone(srv.port, opts);
  phones.push(p);
  return p;
};

/* ---------- tests ---------- */
test('two phones pair up through Supabase Realtime and hear each other', async () => {
  const h = mk();
  const g = mk();
  const host = P.create({ transport: h.transport, name: 'Yash', getPlan: () => PLAN });
  const guest = P.create({ transport: g.transport, name: 'Sam' });
  const hostEv = events(host);
  const guestEv = events(guest);

  assert.deepStrictEqual(await host.host(ROOM), { ok: true });
  const r = await guest.join(ROOM);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.peer.name, 'Yash');
  assert.strictEqual(r.plan.dayName, 'Push');
  assert.strictEqual(host.state.status, 'paired');
  assert.strictEqual(host.state.peer.name, 'Sam');

  await host.sendSnap(P.summarize([bench], 'kg'));
  assert.ok(await until(() => of(guestEv, 'snap').length >= 1), 'the guest should see the host\'s snapshot');
  assert.strictEqual(guest.state.peerSnap.sets, 2);

  await guest.nudge('🔥');
  assert.ok(await until(() => of(hostEv, 'nudge').length === 1));
  await guest.sendPlan([{ name: 'Row', muscle: 'back', sets: 3 }]);
  assert.ok(await until(() => of(hostEv, 'plan').some((e) => e.exercises[0].name === 'Row')));
  await host.sendRest(90, Date.now() + 90000);
  assert.ok(await until(() => of(guestEv, 'rest').length === 1));

  await host.finish(P.summarize([bench], 'kg'));
  assert.ok(await until(() => of(guestEv, 'finish').length === 1));
  assert.strictEqual(guest.state.peerFinished, true);
  await guest.leave();
});

test('what goes over the wire: one channel per room, broadcast without echo, JSON messages', async () => {
  const topics = wire.joins.map((j) => j.topic);
  assert.ok(topics.includes(`realtime:gymboy-pair-${ROOM}`), topics.join());
  const join = wire.joins.find((j) => j.topic === `realtime:gymboy-pair-${ROOM}`);
  assert.strictEqual(join.payload.config.broadcast.self, false);
  const msgs = wire.broadcasts.filter((b) => b.topic === `realtime:gymboy-pair-${ROOM}`);
  assert.ok(msgs.length > 5);
  assert.ok(msgs.every((m) => m.event === 'msg'), 'one broadcast event name');
  const hello = msgs.find((m) => m.payload.type === 'hello');
  assert.deepStrictEqual(Object.keys(hello.payload).sort(), ['from', 'name', 'room', 't', 'type', 'v']);
  assert.strictEqual(hello.payload.room, ROOM);
  assert.ok(!JSON.stringify(msgs).includes('anon-key'), 'the key never travels in a message');
  // messages carry only workout data: no profile, email or scan fields
  assert.ok(!/email|password|scan|profile|dob/i.test(JSON.stringify(msgs)));
});

test('a third phone in the same room is told it is full', async () => {
  const [a, b, c] = [mk(), mk(), mk()];
  const room = 'FULL22';
  const host = P.create({ transport: a.transport, name: 'Yash', getPlan: () => PLAN });
  const guest = P.create({ transport: b.transport, name: 'Sam' });
  await host.host(room);
  assert.strictEqual((await guest.join(room)).ok, true);
  const intruder = P.create({ transport: c.transport, name: 'Eve' });
  assert.deepStrictEqual(await intruder.join(room), { ok: false, reason: 'full' });
  await host.leave();
  await guest.leave();
});

test('rooms are separate: a guest with the wrong code never reaches the host', async () => {
  const h = mk();
  const g = mk();
  const host = P.create({ transport: h.transport, name: 'Yash', getPlan: () => PLAN });
  await host.host('ROOMAA');
  let now = 5_000_000;
  const timers = [];
  const clock = {
    now: () => now,
    setInterval: (fn, ms) => timers.push({ fn, ms, next: now + ms, every: true }) && timers.length,
    clearInterval() {},
    setTimeout: (fn, ms) => timers.push({ fn, ms, next: now + ms }) && timers.length,
    clearTimeout() {},
  };
  const guest = P.create({ transport: g.transport, name: 'Sam', clock });
  const p = guest.join('ROOMBB');
  await sleep(300);
  now += 10500;
  timers.filter((t) => !t.every).forEach((t) => t.fn());
  assert.deepStrictEqual(await p, { ok: false, reason: 'not_found' });
  assert.strictEqual(host.state.status, 'waiting');
  await host.leave();
});

test('if Realtime cannot be reached, joining says "connection" instead of hanging', async () => {
  const dead = http.createServer();
  await new Promise((r) => dead.listen(0, '127.0.0.1', r));
  const port = dead.address().port;
  await new Promise((r) => dead.close(r)); // nothing is listening any more
  const bad = phone(port, { timeout: 1200 });
  phones.push(bad);
  const guest = P.create({ transport: bad.transport, name: 'Sam' });
  const r = await guest.join('NOONE2');
  assert.deepStrictEqual(r, { ok: false, reason: 'connection' });
});

test('GB.backend.realtime is switched off in demo mode', () => {
  assert.strictEqual(global.GB.backend.realtime.available, false);
  assert.strictEqual(global.GB.backend.realtime.channel('x'), null);
  assert.doesNotThrow(() => global.GB.backend.realtime.remove({}));
});

/* ---------- run ---------- */
(async () => {
  srv = await startServer();
  for (const { name, fn } of queue) {
    try {
      await fn();
      passed++;
    } catch (e) {
      failures.push(`✗ ${name}\n    ${e.stack ? e.stack.split('\n').slice(0, 4).join('\n    ') : e.message}`);
    }
  }
  for (const p of phones) {
    try {
      await p.client.removeAllChannels();
      p.client.realtime.disconnect();
    } catch (e) { /* ignore */ }
  }
  srv.wss.clients.forEach((c) => c.terminate());
  srv.server.close();
  if (failures.length) {
    console.error(failures.join('\n'));
    console.error(`\n${failures.length} failed, ${passed} passed`);
    process.exit(1);
  }
  console.log(`All ${passed} pair (realtime) tests passed`);
  process.exit(0);
})();
