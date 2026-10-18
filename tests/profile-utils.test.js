/* Tests for js/profile-utils.js.   Run: node tests/profile-utils.test.js */
const assert = require('assert');
const P = require('../js/profile-utils.js');

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
const NOW = new Date(2026, 9, 17, 19, 30); // 17 Oct 2026, 19:30

test('age from a date of birth, before and after the birthday', () => {
  assert.strictEqual(P.ageFromDob('1994-10-17', NOW), 32); // birthday today
  assert.strictEqual(P.ageFromDob('1994-10-18', NOW), 31); // tomorrow
  assert.strictEqual(P.ageFromDob('2008-10-18', NOW), 17);
  assert.strictEqual(P.ageFromDob('2008-10-17', NOW), 18);
});
test('invalid dates give null', () => {
  ['', null, 'abc', '1994-13-01', '1994-02-31', '2999-01-01', '94-01-01'].forEach((d) => assert.strictEqual(P.ageFromDob(d, NOW), null, String(d)));
});

test('BMI', () => {
  assert.strictEqual(P.bmi(82.4, 178), 26.0);
  assert.strictEqual(P.bmi(70, 175), 22.9);
  assert.strictEqual(P.bmi(null, 175), null);
  assert.strictEqual(P.bmi(70, 0), null);
});

test('unit conversion round-trips closely', () => {
  assert.strictEqual(P.kgToLb(82.4), 181.7);
  assert.strictEqual(P.lbToKg(181.7), 82.4);
  assert.deepStrictEqual(P.cmToFtIn(178), { ft: 5, in: 10 });
  assert.deepStrictEqual(P.cmToFtIn(182.9), { ft: 6, in: 0 }); // 71.99 in rounds up to 6'0"
  assert.strictEqual(P.ftInToCm(5, 10), 177.8);
  assert.strictEqual(P.ftInToCm(6, 0), 182.9);
});

test('greeting by hour', () => {
  const at = (h) => P.greeting(new Date(2026, 9, 17, h));
  assert.deepStrictEqual([at(3), at(8), at(14), at(21)], ['Still up', 'Good morning', 'Good afternoon', 'Good evening']);
});

test('first name', () => {
  assert.strictEqual(P.firstName('  Yash  Joshi '), 'Yash');
  assert.strictEqual(P.firstName(''), '');
});

test('a weigh-in replaces the same day and updates the headline weight', () => {
  const p = P.emptyProfile();
  P.addWeighIn(p, 84.14, '2026-10-01');
  P.addWeighIn(p, 83.0, '2026-10-08');
  P.addWeighIn(p, 82.9, '2026-10-08'); // same day: replaced
  assert.deepStrictEqual(p.weights, [{ date: '2026-10-01', kg: 84.1 }, { date: '2026-10-08', kg: 82.9 }]);
  assert.strictEqual(p.weight_kg, 82.9);
  P.addWeighIn(p, 84.5, '2026-09-20'); // an earlier day inserted in order, headline stays the latest
  assert.strictEqual(p.weights[0].date, '2026-09-20');
  assert.strictEqual(p.weight_kg, 82.9);
});

test('weight series covers only the window', () => {
  const p = P.emptyProfile();
  ['2026-08-01', '2026-09-25', '2026-10-10'].forEach((d, i) => P.addWeighIn(p, 80 + i, d));
  assert.strictEqual(P.weightSeries(p, 30, NOW).length, 2);
});

test('goal progress: losing weight', () => {
  const p = P.emptyProfile();
  P.addWeighIn(p, 90, '2026-09-01');
  P.addWeighIn(p, 85, '2026-10-01');
  p.goal.target_weight_kg = 80;
  const g = P.goalProgress(p);
  assert.strictEqual(g.direction, 'down');
  assert.strictEqual(g.fraction, 0.5);
  assert.strictEqual(g.remaining, 5);
  assert.strictEqual(g.reached, false);
});
test('goal progress: gaining, overshooting and missing a target', () => {
  const p = P.emptyProfile();
  P.addWeighIn(p, 70, '2026-09-01');
  p.goal.target_weight_kg = 75;
  P.addWeighIn(p, 76, '2026-10-01');
  const g = P.goalProgress(p);
  assert.strictEqual(g.direction, 'up');
  assert.strictEqual(g.fraction, 1);
  assert.strictEqual(g.remaining, 0);
  assert.strictEqual(g.reached, true);
  p.goal.target_weight_kg = null;
  assert.strictEqual(P.goalProgress(p), null);
});
test('goal progress: moving the wrong way never goes below 0', () => {
  const p = P.emptyProfile();
  P.addWeighIn(p, 80, '2026-09-01');
  P.addWeighIn(p, 83, '2026-10-01');
  p.goal.target_weight_kg = 75;
  assert.strictEqual(P.goalProgress(p).fraction, 0);
});

test('gauge: value in the band sits in the middle half', () => {
  const g = P.gauge(5, 1, 9);
  assert.ok(g.pos > g.bandStart && g.pos < g.bandEnd);
  assert.ok(Math.abs(g.bandStart - 0.25) < 1e-9 && Math.abs(g.bandEnd - 0.75) < 1e-9);
});
test('gauge: below, above and invalid input', () => {
  assert.ok(P.gauge(0, 1, 9).pos < P.gauge(0, 1, 9).bandStart);
  assert.ok(P.gauge(12, 1, 9).pos > P.gauge(12, 1, 9).bandEnd);
  assert.strictEqual(P.gauge(100, 1, 9).pos, 0.98);
  assert.strictEqual(P.gauge(null, 1, 9), null);
  assert.strictEqual(P.gauge(5, 9, 1), null);
});

test('what is sent to the AI has no name, birth date or email, and gets the under-18 flag', () => {
  const p = P.emptyProfile();
  Object.assign(p, { name: 'Priya Sharma', dob: '1994-05-02', sex: 'female', height_cm: 165, weight_kg: 60 });
  p.email = 'priya@example.com';
  const out = P.profileForAI(p, NOW);
  const text = JSON.stringify(out);
  ['Priya', 'priya@', '1994', 'dob', 'name', 'email'].forEach((s) => assert.ok(!text.includes(s), s));
  assert.strictEqual(out.age, 32);
  assert.strictEqual(out.flags.under_18, false);
  p.dob = '2012-01-01';
  assert.strictEqual(P.profileForAI(p, NOW).flags.under_18, true);
});

test('the previous scan is reduced to numbers, newest first', () => {
  const mk = (created_at, weight, date) => ({ created_at, report: { scan: { measured_at: date }, metrics: [{ key: 'weight', value: weight }, { key: 'bmr', value: null }] } });
  const prev = P.previousForAI([mk('2026-08-01', 85, '2026-08-01'), mk('2026-09-02', 84.1, '2026-09-02')]);
  assert.deepStrictEqual(prev, { measured_at: '2026-09-02', metrics: [{ key: 'weight', value: 84.1 }] });
  assert.strictEqual(P.previousForAI([]), null);
});

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`All ${passed} profile-utils tests passed`);
