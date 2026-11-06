/* Tests for js/pair.js: room codes, snapshots, the scoreboard, the pairing protocol and the practice
 * partner. A fake clock and an in-memory network make every case deterministic.
 *   Run: node tests/pair.test.js
 * (The Supabase Realtime transport is exercised in tests/pair-realtime.test.js.) */
const assert = require('assert');

global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../js/store.js');
require('../js/pair.js');
const P = global.GB.pair;

let passed = 0;
const failures = [];
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}

/* ---------- helpers ---------- */
function fakeClock() {
  let t = 1_000_000;
  let nextId = 1;
  let timers = [];
  return {
    now: () => t,
    setInterval(fn, ms) {
      const id = nextId++;
      timers.push({ id, fn, ms, next: t + ms, every: true });
      return id;
    },
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.push({ id, fn, ms, next: t + ms, every: false });
      return id;
    },
    clearInterval(id) {
      timers = timers.filter((x) => x.id !== id);
    },
    clearTimeout(id) {
      timers = timers.filter((x) => x.id !== id);
    },
    advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = timers.filter((x) => x.next <= target).sort((a, b) => a.next - b.next)[0];
        if (!due) break;
        t = due.next;
        if (due.every) due.next += due.ms;
        else timers = timers.filter((x) => x.id !== due.id);
        due.fn();
      }
      t = target;
    },
  };
}

// An in-memory network: every end hears every other end. Messages are copied, like a real wire.
function hub() {
  const ends = [];
  return {
    end() {
      const e = { h: null, up: true };
      ends.push(e);
      return {
        raw: e,
        kind: 'test',
        open: async (room, h) => {
          e.h = h;
          h.onStatus('connected');
        },
        send: (msg) => {
          if (e.up) ends.forEach((o) => o !== e && o.h && o.up && Promise.resolve().then(() => o.h.onMessage(JSON.parse(JSON.stringify(msg)))));
          return Promise.resolve();
        },
        close() {
          e.h = null;
        },
      };
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};
// Move the fake clock forward in small steps, letting messages arrive in between (like real time does).
const tick = async (clock, ms) => {
  for (let left = ms; left > 0; left -= 5000) {
    clock.advance(Math.min(5000, left));
    await flush();
  }
};
const events = (ctl) => {
  const list = [];
  ctl.on((e) => list.push(e));
  return list;
};
const of = (list, type) => list.filter((e) => e.type === type);

const PLAN = { dayId: 'push', dayName: 'Push', muscles: ['chest', 'shoulders', 'triceps'], exercises: [{ name: 'Bench Press', muscle: 'chest', sets: 3 }] };
const ROOM = 'K7M2QP';

// A host and a guest, paired.
async function pairedPair(clock, h) {
  h = h || hub();
  const host = P.create({ transport: h.end(), name: 'Yash', clock, getPlan: () => PLAN });
  const guest = P.create({ transport: h.end(), name: 'Sam', clock });
  const hostEv = events(host);
  const guestEv = events(guest);
  await host.host(ROOM);
  const joined = guest.join(ROOM);
  await flush();
  const r = await joined;
  await flush();
  return { host, guest, hostEv, guestEv, r, h };
}

/* ---------- codes ---------- */
test('room codes are 6 characters with nothing easy to mix up', () => {
  for (let i = 0; i < 500; i++) {
    const c = P.makeCode();
    assert.ok(/^[A-HJKMNP-Z2-9]{6}$/.test(c), c);
  }
  assert.ok(new Set(Array.from({ length: 300 }, P.makeCode)).size > 295, 'codes should rarely repeat');
});

test('typed codes are tidied up; wrong ones are rejected', () => {
  assert.strictEqual(P.normalizeCode(' k7m-2qp '), 'K7M2QP');
  assert.strictEqual(P.normalizeCode('k7m2qp'), 'K7M2QP');
  ['', null, undefined, 'K7M2Q', 'K7M2QPX', 'K7M2Q0', 'K7M2QO', 'K7M2QI', 'K7M2Q1', 'K7M2QL', 'K7M2Q!'].forEach((x) => assert.strictEqual(P.normalizeCode(x), null, String(x)));
});

/* ---------- snapshots and the scoreboard ---------- */
const bench = { name: 'Bench Press', muscle: 'chest', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }, { w: 55, r: 10 }] };

test('a snapshot has the totals and a short label per set', () => {
  const s = P.summarize([bench], 'kg');
  assert.strictEqual(s.sets, 3);
  assert.strictEqual(s.volKg, 1510); // 480 + 480 + 550
  assert.deepStrictEqual(s.exercises[0].sets, ['60×8', '60×8', '55×10']);
  assert.strictEqual(s.unit, 'kg');
});

test('pounds are converted so two people can be compared fairly', () => {
  const s = P.summarize([{ name: 'Bench', muscle: 'chest', sets: [{ w: 132.2772, r: 10 }] }], 'lb'); // 60 kg × 10
  assert.ok(Math.abs(s.volKg - 600) < 0.5, s.volKg);
  assert.strictEqual(s.unit, 'lb');
});

test('timed work is counted as work time', () => {
  const s = P.summarize([{ name: 'Cat-Cow', muscle: 'mobility', sets: [{ t: 60, w: 0, r: 0 }, { t: 45, w: 0, r: 0 }] }], 'kg');
  assert.strictEqual(s.work, 105);
  assert.strictEqual(s.volKg, 0);
});

test('the scoreboard: volume decides a lifting day', () => {
  const me = P.summarize([bench], 'kg');
  const them = P.summarize([{ name: 'Bench Press', muscle: 'chest', sets: [{ w: 70, r: 8 }, { w: 70, r: 8 }] }], 'kg'); // 2 sets, 1120
  const c = P.compare(me, them);
  assert.strictEqual(c.basis, 'volume');
  assert.deepStrictEqual(c.rows.map((r) => [r.key, r.lead]), [['sets', 'me'], ['volume', 'me']]);
  assert.strictEqual(c.winner, 'me');
  assert.strictEqual(P.compare(them, me).winner, 'them');
});

test('the scoreboard: work time decides a timed day, and equal scores are a draw', () => {
  const a = P.summarize([{ name: 'Plank', muscle: 'mobility', sets: [{ t: 60, w: 0, r: 0 }] }], 'kg');
  const b = P.summarize([{ name: 'Plank', muscle: 'mobility', sets: [{ t: 90, w: 0, r: 0 }] }], 'kg');
  const c = P.compare(a, b);
  assert.strictEqual(c.basis, 'work');
  assert.strictEqual(c.winner, 'them');
  assert.strictEqual(P.compare(a, a).winner, 'tie');
  assert.strictEqual(P.compare(null, null).winner, 'tie');
  assert.strictEqual(P.compare(a, null).winner, 'me');
});

test('hostile snapshots are cut down to size and cleaned', () => {
  const big = { sets: 'NaN', volKg: -5, work: 1e99, exercises: Array.from({ length: 500 }, (_, i) => ({ name: 'x'.repeat(500) + i, sets: Array.from({ length: 500 }, () => 'y'.repeat(100)) })) };
  const s = P.cleanSnap(big);
  assert.strictEqual(s.sets, 0);
  assert.strictEqual(s.volKg, 0);
  assert.strictEqual(s.work, 1e6);
  assert.strictEqual(s.exercises.length, 40);
  assert.strictEqual(s.exercises[0].name.length, 60);
  assert.strictEqual(s.exercises[0].sets.length, 40);
  assert.strictEqual(s.exercises[0].sets[0].length, 24);
  assert.strictEqual(P.cleanSnap('nope'), null);
  assert.strictEqual(P.cleanSnap(null), null);
  assert.strictEqual(P.cleanSnap({ exercises: [{ name: 'a\u0000b\nc', sets: [] }] }).exercises[0].name, 'abc');
});

test('a partner plan is capped and sanitised', () => {
  const ex = P.cleanExercises([{ name: ' Squat ', muscle: 'quads', sets: 99 }, { name: '', sets: 3 }, { name: 'Row', sets: 'x' }, null]);
  assert.deepStrictEqual(ex, [{ name: 'Squat', muscle: 'quads', sets: 12 }, { name: 'Row', muscle: 'other', sets: 3 }]);
});

/* ---------- pairing ---------- */
test('a host opens a room and a guest joins with the code', async () => {
  const clock = fakeClock();
  const { host, guest, hostEv, r } = await pairedPair(clock);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.peer.name, 'Yash');
  assert.deepStrictEqual(r.plan, { dayId: 'push', dayName: 'Push', muscles: ['chest', 'shoulders', 'triceps'], exercises: [{ name: 'Bench Press', muscle: 'chest', sets: 3 }] });
  assert.strictEqual(host.state.status, 'paired');
  assert.strictEqual(guest.state.status, 'paired');
  assert.strictEqual(host.state.peer.name, 'Sam');
  assert.strictEqual(of(hostEv, 'peer').length, 1);
});

test('the host is waiting until someone joins', async () => {
  const host = P.create({ transport: hub().end(), name: 'Yash', clock: fakeClock() });
  const res = await host.host(ROOM);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(host.state.status, 'waiting');
});

test('a third person is turned away: a room holds exactly two', async () => {
  const clock = fakeClock();
  const { host, h } = await pairedPair(clock);
  const intruder = P.create({ transport: h.end(), name: 'Eve', clock });
  const p = intruder.join(ROOM);
  await flush();
  assert.deepStrictEqual(await p, { ok: false, reason: 'full' });
  assert.strictEqual(host.state.peer.name, 'Sam');
});

test('joining a room nobody opened gives up after 10 seconds', async () => {
  const clock = fakeClock();
  const guest = P.create({ transport: hub().end(), name: 'Sam', clock });
  const p = guest.join('ZZZZZZ');
  await flush();
  clock.advance(9000);
  await flush();
  assert.strictEqual(guest.state.status, 'joining');
  clock.advance(1500);
  assert.deepStrictEqual(await p, { ok: false, reason: 'not_found' });
  assert.strictEqual(guest.state.status, 'failed');
});

test('the guest keeps knocking while it waits', async () => {
  const clock = fakeClock();
  const h = hub();
  const guest = P.create({ transport: h.end(), name: 'Sam', clock });
  const spy = h.end();
  const heard = [];
  await spy.open(ROOM, { onMessage: (m) => heard.push(m.type), onStatus() {} });
  const p = guest.join(ROOM);
  await flush();
  clock.advance(6100);
  await flush();
  assert.ok(heard.filter((t) => t === 'hello').length >= 3, heard.join());
  clock.advance(10000);
  await p;
});

test('if the connection cannot be made, joining and hosting say so', async () => {
  const bad = { open: () => Promise.reject(new Error('nope')), send() {}, close() {} };
  const g = P.create({ transport: bad, name: 'Sam', clock: fakeClock() });
  assert.deepStrictEqual(await g.join(ROOM), { ok: false, reason: 'connection' });
  const hst = P.create({ transport: bad, name: 'Yash', clock: fakeClock() });
  assert.deepStrictEqual(await hst.host(ROOM), { ok: false, reason: 'connection' });
});

test('messages for another room, an old version or another person are ignored', async () => {
  const clock = fakeClock();
  const { host, hostEv, h } = await pairedPair(clock);
  const spy = h.end();
  await spy.open(ROOM, { onMessage() {}, onStatus() {} });
  const snap = { sets: 9, volKg: 99, work: 0, exercises: [] };
  const peerId = host.state.peer.id;
  spy.send({ v: 1, room: 'OTHER1', from: peerId, type: 'snap', snap });
  spy.send({ v: 2, room: ROOM, from: peerId, type: 'snap', snap });
  spy.send({ v: 1, room: ROOM, from: peerId, to: 'someone-else', type: 'snap', snap });
  spy.send({ v: 1, room: ROOM, from: 'a-stranger', type: 'snap', snap });
  spy.send({ v: 1, room: ROOM, type: 'snap', snap });
  spy.send('not an object');
  await flush();
  assert.strictEqual(of(hostEv, 'snap').length, 0);
  spy.send({ v: 1, room: ROOM, from: peerId, type: 'snap', snap }); // the real thing still works
  await flush();
  assert.strictEqual(of(hostEv, 'snap').length, 1);
});

/* ---------- during the workout ---------- */
test('your snapshot shows up on the partner\'s side, cleaned', async () => {
  const { host, guest, guestEv } = await pairedPair(fakeClock());
  await host.sendSnap(P.summarize([bench], 'kg'));
  await flush();
  const got = of(guestEv, 'snap');
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].snap.sets, 3);
  assert.strictEqual(guest.state.peerSnap.volKg, 1510);
});

test('a new exercise on one side reaches the other, once', async () => {
  const { host, guest, hostEv, guestEv } = await pairedPair(fakeClock());
  await host.sendPlan([{ name: 'Squat', muscle: 'quads', sets: 4 }]);
  await guest.sendPlan([{ name: 'Row', muscle: 'back', sets: 3 }]);
  await flush();
  assert.deepStrictEqual(of(guestEv, 'plan').map((e) => e.exercises[0].name), ['Squat']);
  assert.deepStrictEqual(of(hostEv, 'plan').map((e) => e.exercises[0].name), ['Row']);
});

test('a shared rest timer: the partner gets the end time; nonsense is dropped', async () => {
  const { host, guest, guestEv, h } = await pairedPair(fakeClock());
  await host.sendRest(90, 2_000_000);
  await flush();
  assert.deepStrictEqual(of(guestEv, 'rest').map((e) => [e.total, e.end]), [[90, 2_000_000]]);
  const spy = h.end();
  await spy.open(ROOM, { onMessage() {}, onStatus() {} });
  const id = guest.state.peer.id;
  spy.send({ v: 1, room: ROOM, from: id, type: 'rest', total: 2, end: 5 }); // too short
  spy.send({ v: 1, room: ROOM, from: id, type: 'rest', total: 9000, end: 0 }); // no end time
  await flush();
  assert.strictEqual(of(guestEv, 'rest').length, 1);
});

test('nudges: only the known reactions get through', async () => {
  const { host, guest, hostEv } = await pairedPair(fakeClock());
  await guest.nudge('💪');
  await guest.nudge('<script>alert(1)</script>');
  await flush();
  assert.deepStrictEqual(of(hostEv, 'nudge').map((e) => [e.emoji, e.from]), [['💪', 'Sam']]);
  assert.ok(host);
});

test('finishing sends the final numbers but keeps listening, so your result keeps updating', async () => {
  const { host, guest, guestEv, hostEv } = await pairedPair(fakeClock());
  await host.finish(P.summarize([bench], 'kg'));
  await flush();
  const fin = of(guestEv, 'finish');
  assert.strictEqual(fin.length, 1);
  assert.strictEqual(fin[0].snap.sets, 3);
  assert.strictEqual(guest.state.peerFinished, true);
  assert.strictEqual(host.state.selfFinished, true);
  assert.strictEqual(host.state.status, 'paired', 'still connected');
  // the partner is still training: their numbers keep arriving on the finished side
  await guest.sendSnap(P.summarize([bench, bench], 'kg'));
  await flush();
  assert.strictEqual(host.state.peerSnap.sets, 6);
  await guest.finish(P.summarize([bench, bench], 'kg'));
  await flush();
  assert.strictEqual(host.state.peerFinished, true);
  // closing ends it, without a goodbye after finishing
  await host.leave();
  await flush();
  assert.strictEqual(host.state.status, 'closed');
  assert.strictEqual(of(guestEv, 'left').length, 0);
  await host.sendSnap(P.summarize([bench], 'kg')); // closed: does nothing
  await flush();
  assert.strictEqual(of(guestEv, 'snap').length, 0);
  assert.ok(hostEv);
});

test('close() ends the connection without saying goodbye', async () => {
  const { host, guestEv } = await pairedPair(fakeClock());
  host.close();
  await flush();
  assert.strictEqual(host.state.status, 'closed');
  assert.strictEqual(of(guestEv, 'left').length, 0);
});

test('leaving tells the partner', async () => {
  const { host, guest, guestEv } = await pairedPair(fakeClock());
  await host.leave();
  await flush();
  assert.strictEqual(of(guestEv, 'left').length, 1);
  assert.strictEqual(guest.state.peerLeft, true);
  assert.strictEqual(host.state.status, 'closed');
});

/* ---------- staying connected ---------- */
test('two phones that are both alive keep pinging, so neither is ever flagged stale', async () => {
  const clock = fakeClock();
  const { hostEv, guestEv } = await pairedPair(clock);
  await tick(clock, 120000);
  assert.strictEqual(of(hostEv, 'stale').length, 0);
  assert.strictEqual(of(guestEv, 'stale').length, 0);
});

test('a partner that goes silent is flagged stale, then fresh again when it returns', async () => {
  const clock = fakeClock();
  const h = hub();
  const hostT = h.end();
  const guestT = h.end();
  const host = P.create({ transport: hostT, name: 'Yash', clock, getPlan: () => PLAN });
  const guest = P.create({ transport: guestT, name: 'Sam', clock });
  const hostEv = events(host);
  await host.host(ROOM);
  const joined = guest.join(ROOM);
  await flush();
  await joined;
  await tick(clock, 30000);
  assert.strictEqual(of(hostEv, 'stale').length, 0);
  guestT.raw.up = false; // the guest's phone drops off the network
  await tick(clock, 50000);
  assert.strictEqual(of(hostEv, 'stale').length, 1);
  guestT.raw.up = true;
  await tick(clock, 15000);
  assert.strictEqual(of(hostEv, 'fresh').length, 1);
  assert.strictEqual(host.state.peerStale, false);
});

test('a guest who reloads comes back with the same id and is let straight in', async () => {
  const clock = fakeClock();
  const h = hub();
  const host = P.create({ transport: h.end(), name: 'Yash', clock, getPlan: () => PLAN });
  const hostEv = events(host);
  await host.host(ROOM);
  const g1 = P.create({ transport: h.end(), name: 'Sam', clock, id: 'guest-id-1' });
  const j = g1.join(ROOM);
  await flush();
  await j;
  const g2 = P.create({ transport: h.end(), name: 'Sam', clock, id: 'guest-id-1' }); // the page reloaded
  g1.leave();
  const guestEv = events(g2);
  const res = await g2.resume({ role: 'guest', room: ROOM, peer: { id: host.self.id, name: 'Yash' } });
  await flush();
  assert.strictEqual(res.ok, true);
  assert.strictEqual(g2.state.status, 'paired');
  const peers = of(hostEv, 'peer');
  assert.strictEqual(peers.length, 2);
  assert.strictEqual(peers[1].rejoin, true);
  assert.ok(of(guestEv, 'plan').length >= 1, 'the host re-sends the plan');
});

test('a host who reloads keeps the same partner', async () => {
  const clock = fakeClock();
  const h = hub();
  const guest = P.create({ transport: h.end(), name: 'Sam', clock, id: 'g-1' });
  const guestEv = events(guest);
  const host1 = P.create({ transport: h.end(), name: 'Yash', clock, id: 'h-1', getPlan: () => PLAN });
  await host1.host(ROOM);
  const j = guest.join(ROOM);
  await flush();
  await j;
  host1.leave();
  const host2 = P.create({ transport: h.end(), name: 'Yash', clock, id: 'h-1', getPlan: () => PLAN, getSnap: () => P.summarize([bench], 'kg') });
  await host2.host(ROOM, { peer: { id: 'g-1', name: 'Sam' } });
  await flush();
  assert.strictEqual(host2.state.status, 'paired');
  assert.ok(of(guestEv, 'snap').length >= 1, 'the guest hears from the resumed host');
  const stranger = P.create({ transport: h.end(), name: 'Eve', clock });
  const p = stranger.join(ROOM);
  await flush();
  assert.strictEqual((await p).reason, 'full');
});

test('when the connection drops and returns, the guest says hello again and the host re-syncs', async () => {
  const clock = fakeClock();
  const h = hub();
  const guestT = h.end();
  const host = P.create({ transport: h.end(), name: 'Yash', clock, getPlan: () => PLAN, getExercises: () => [{ name: 'Bench Press', muscle: 'chest', sets: 3 }] });
  const hostEv = events(host);
  const guest = P.create({ transport: guestT, name: 'Sam', clock });
  await host.host(ROOM);
  const j = guest.join(ROOM);
  await flush();
  await j;
  const before = of(hostEv, 'peer').length;
  const cb = guestT.raw.h;
  cb.onStatus('disconnected');
  cb.onStatus('connected');
  await flush();
  assert.strictEqual(of(hostEv, 'peer').length, before + 1);
});

/* ---------- the practice partner ---------- */
test('the practice partner joins, adopts the plan and logs sets as time passes', async () => {
  const clock = fakeClock();
  const [a, b] = P.memoryBus();
  const exercises = [{ name: 'Bench Press', muscle: 'chest', sets: 3 }, { name: 'Overhead Press', muscle: 'shoulders', sets: 2 }];
  const host = P.create({ transport: a, name: 'Yash', clock, getPlan: () => Object.assign({}, PLAN, { exercises }), getExercises: () => exercises });
  const hostEv = events(host);
  await host.host(ROOM);
  const bot = P.createBot({ transport: b, clock, tickMs: 7000 });
  const started = bot.start(ROOM);
  await flush();
  const r = await started;
  assert.strictEqual(r.ok, true);
  assert.strictEqual(host.state.peer.name, 'Practice partner');
  clock.advance(7000 * 5);
  await flush();
  const snap = host.state.peerSnap;
  assert.strictEqual(snap.sets, 5);
  assert.deepStrictEqual(snap.exercises.map((e) => [e.name, e.sets.length]), [['Bench Press', 3], ['Overhead Press', 2]]);
  assert.ok(snap.volKg > 0);
  assert.ok(of(hostEv, 'nudge').length === 1, 'cheers you on once');
  // the plan grows: the bot picks the new exercise up and does it next
  exercises.push({ name: 'Lateral Raise', muscle: 'shoulders', sets: 3 });
  await host.sendPlan(exercises);
  await flush();
  clock.advance(7000 * 2);
  await flush();
  assert.deepStrictEqual(host.state.peerSnap.exercises.map((e) => e.name), ['Bench Press', 'Overhead Press', 'Lateral Raise']);
  assert.strictEqual(host.state.peerSnap.sets, 7);
  bot.stop();
  await flush();
  assert.strictEqual(of(hostEv, 'left').length, 1);
});

/* ---------- run ---------- */
(async () => {
  for (const { name, fn } of queue) {
    try {
      await fn();
      passed++;
    } catch (e) {
      failures.push(`✗ ${name}\n    ${e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e.message}`);
    }
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    console.error(`\n${failures.length} failed, ${passed} passed`);
    process.exit(1);
  }
  console.log(`All ${passed} pair tests passed`);
})();
