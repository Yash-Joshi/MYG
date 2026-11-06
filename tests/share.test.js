/* Tests for js/share.js (what the workout picture says).   Run: node tests/share.test.js
 * The drawing itself needs a browser canvas and is checked there; this covers the numbers, the
 * wording and the file name, which are the parts that can be wrong without anyone noticing. */
const assert = require('assert');

// js/store.js expects a browser: give it just enough of one.
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../js/store.js');
require('../js/share.js');
const S = global.GB.share;

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${e.message}`);
  }
}

const T0 = new Date(2026, 9, 17, 18, 0).getTime();
const lift = {
  id: 'a',
  dayName: 'Push',
  unit: 'kg',
  startedAt: T0,
  endedAt: T0 + 52 * 60000,
  exercises: [
    { name: 'Bench Press', muscle: 'chest', sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }, { w: 60, r: 8 }, { w: 55, r: 10 }] },
    { name: 'Overhead Press', muscle: 'shoulders', sets: [{ w: 40, r: 6 }] },
  ],
};

test('headline numbers for a lifting day', () => {
  const m = S.model(lift);
  assert.strictEqual(m.title, 'Push');
  assert.deepStrictEqual(m.tiles.map((t) => t.label), ['Exercises', 'Sets', 'Volume (kg)']);
  assert.strictEqual(m.tiles[0].value, '2');
  assert.strictEqual(m.tiles[1].value, '5');
  // 3×60×8 + 55×10 + 40×6 = 1440 + 550 + 240
  assert.strictEqual(m.tiles[2].value.replace(/\D/g, ''), '2230');
});

test('subtitle has the date and how long it took', () => {
  const m = S.model(lift);
  assert.ok(m.subtitle.includes('17'), m.subtitle);
  assert.ok(m.subtitle.includes('52 min'), m.subtitle);
});

test('identical sets collapse into one pill with a count', () => {
  const m = S.model(lift);
  assert.deepStrictEqual(m.rows[0].pills, [{ text: '60×8', count: 3 }, { text: '55×10', count: 1 }]);
  assert.deepStrictEqual(m.rows[1].pills, [{ text: '40×6', count: 1 }]);
  assert.strictEqual(m.rows[0].unit, 'kg');
});

test('only equal neighbours are merged', () => {
  assert.deepStrictEqual(S.collapse(['a', 'b', 'a']).map((p) => p.count), [1, 1, 1]);
  assert.deepStrictEqual(S.collapse([]), []);
});

test('a timed day shows work time instead of volume, with no weight unit on the rows', () => {
  const m = S.model({ dayName: 'Mobility & Flow', unit: 'kg', startedAt: T0, endedAt: T0 + 20 * 60000, exercises: [{ name: 'Cat-Cow', muscle: 'mobility', sets: [{ t: 60, w: 0, r: 0 }, { t: 60, w: 0, r: 0 }] }] });
  assert.strictEqual(m.tiles[2].label, 'Work time');
  assert.strictEqual(m.tiles[2].value, '2:00');
  assert.strictEqual(m.rows[0].unit, '');
  assert.deepStrictEqual(m.rows[0].pills, [{ text: '60s', count: 2 }]);
});

test('pounds are labelled as pounds', () => {
  const m = S.model(Object.assign({}, lift, { unit: 'lb' }));
  assert.strictEqual(m.tiles[2].label, 'Volume (lb)');
  assert.strictEqual(m.rows[0].unit, 'lb');
});

test('exercises with no sets are left out', () => {
  const m = S.model(Object.assign({}, lift, { exercises: lift.exercises.concat([{ name: 'Empty', muscle: 'chest', sets: [] }]) }));
  assert.strictEqual(m.rows.length, 2);
});

test('a live workout with no end time still works (uses now, no duration)', () => {
  const m = S.model({ dayName: 'Legs', unit: 'kg', exercises: [{ name: 'Squat', muscle: 'quads', sets: [{ w: 100, r: 5 }] }] });
  assert.ok(m.subtitle.length > 0);
  assert.ok(!m.subtitle.includes('min'));
});

test('file name is safe and readable', () => {
  assert.strictEqual(S.fileName(lift), 'gymboy-push-2026-10-17.png');
  assert.ok(/^gymboy-mobility-flow-\d{4}-\d{2}-\d{2}\.png$/.test(S.fileName({ dayName: 'Mobility & Flow', endedAt: T0 })));
  assert.ok(/^gymboy-workout-/.test(S.fileName({ dayName: '###', endedAt: T0 })));
  assert.ok(!/[\\/:*?"<>|\s]/.test(S.fileName({ dayName: 'a/b:c "d"', endedAt: T0 })));
});

test('the caption is short and says what happened', () => {
  const c = S.caption(S.model(lift));
  assert.ok(c.startsWith('Push: 5 sets · ') && c.endsWith(' kg'), c);
  assert.ok(S.caption(S.model({ dayName: 'HIIT', unit: 'kg', exercises: [{ name: 'Burpees', muscle: 'hiit', sets: [{ t: 40, w: 0, r: 0 }] }] })).includes('0:40'));
});

test('the picture never carries the name or contact details', () => {
  const m = JSON.stringify(S.model(Object.assign({}, lift, { userName: 'Yash', email: 'a@b.c' })));
  assert.ok(!m.includes('Yash') && !m.includes('a@b.c'));
});

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`All ${passed} share-picture tests passed`);
