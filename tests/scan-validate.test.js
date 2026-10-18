/* Tests for lib/scan-validate.js.   Run: node tests/scan-validate.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { recompute, statusFor, withinNormalVariation, scrub, validateShape } = require('../lib/scan-validate');

const example = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/example-output.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/scan-report.schema.json'), 'utf8'));
const get = (r, key) => r.metrics.find((m) => m.key === key);
const previous = { measured_at: '2026-09-02', metrics: [{ key: 'weight', value: 84.1 }, { key: 'body_fat_percent', value: 21.0 }, { key: 'skeletal_muscle_mass', value: 37.4 }, { key: 'visceral_fat_level', value: 7 }] };
const profile = { age: 32, sex: 'male', height_cm: 178, flags: {} };

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

test('a correct report passes through unchanged and still matches the schema', () => {
  const before = JSON.stringify(example());
  const { report, adjustments } = recompute(example(), { profile, previous });
  assert.deepStrictEqual(adjustments, []);
  assert.deepStrictEqual(report.warnings, []);
  assert.strictEqual(report.status, 'ok');
  assert.deepStrictEqual(validateShape(schema, report), []);
  assert.strictEqual(JSON.stringify(report), before, 'report should be byte-identical');
});

test('statusFor', () => {
  assert.strictEqual(statusFor(5, 1, 9), 'within');
  assert.strictEqual(statusFor(0.5, 1, 9), 'below');
  assert.strictEqual(statusFor(9.1, 1, 9), 'above');
  assert.strictEqual(statusFor(null, 1, 9), 'unknown');
  assert.strictEqual(statusFor(5, null, 9), 'unknown');
});

test('a wrong status from the model is corrected from the numbers', () => {
  const r = example();
  get(r, 'weight').status = 'above'; // 82.4 is inside 65.4 to 88.5
  get(r, 'bmi').status = 'within'; // 26.0 is above 18.5 to 25.0
  const out = recompute(r, { profile, previous });
  assert.strictEqual(get(out.report, 'weight').status, 'within');
  assert.strictEqual(get(out.report, 'bmi').status, 'above');
  assert.strictEqual(out.adjustments.length, 2);
});

test('a status is forced to unknown when there is no range', () => {
  const r = example();
  get(r, 'bmr').status = 'within';
  assert.strictEqual(get(recompute(r, { profile, previous }).report, 'bmr').status, 'unknown');
});

test('balance is recomputed from the segments, not trusted', () => {
  const r = example();
  r.segments.lean.left_leg.mass = 8.5; // right leg is 10.12: a 16% gap
  r.balance = [];
  const { report } = recompute(r, { profile, previous });
  const legs = report.balance.find((b) => b.pair === 'legs');
  assert.strictEqual(legs.diff_percent, 16.0);
  assert.strictEqual(legs.flag, 'notable');
  assert.strictEqual(report.balance.find((b) => b.pair === 'arms').flag, 'none');
});

test('trend uses the previous scan the SERVER holds, and noise is called noise', () => {
  const r = example();
  r.trend.items.find((t) => t.key === 'weight').previous = 999; // model got it wrong
  const prev = { measured_at: '2026-09-02', metrics: [{ key: 'weight', value: 82.9 }, { key: 'skeletal_muscle_mass', value: 37.4 }] };
  const { report } = recompute(r, { profile, previous: prev });
  const w = report.trend.items.find((t) => t.key === 'weight');
  assert.strictEqual(w.previous, 82.9);
  assert.strictEqual(w.delta, -0.5);
  assert.strictEqual(w.meaning, 'within_normal_variation'); // 0.5 kg < 1% of body weight
  const smm = report.trend.items.find((t) => t.key === 'skeletal_muscle_mass');
  assert.strictEqual(smm.delta, 0.7);
  assert.strictEqual(smm.meaning, 'improving');
  assert.ok(!report.trend.items.some((t) => t.key === 'body_fat_percent'), 'items without a previous value are dropped');
});

test('no previous scan means no trend', () => {
  const { report } = recompute(example(), { profile, previous: null });
  assert.strictEqual(report.trend, null);
});

test('withinNormalVariation thresholds', () => {
  assert.strictEqual(withinNormalVariation('weight', 82.4, 82.0, 82.0), true);
  assert.strictEqual(withinNormalVariation('weight', 82.4, 80.0, 80.0), false);
  assert.strictEqual(withinNormalVariation('body_fat_percent', 20.0, 19.4, 80), true);
  assert.strictEqual(withinNormalVariation('body_fat_percent', 20.0, 18.9, 80), false);
  assert.strictEqual(withinNormalVariation('skeletal_muscle_mass', 37.4, 37.8, 80), true);
});

test('arithmetic that does not add up is flagged, not silently "fixed"', () => {
  const r = example();
  get(r, 'body_fat_percent').value = 27.9; // fat mass / weight is 19.3%
  get(r, 'bmi').value = 31.2; // weight / height^2 is 26.0
  const { report } = recompute(r, { profile, previous });
  const codes = report.warnings.filter((w) => w.code === 'math_mismatch');
  assert.strictEqual(codes.length, 2);
  assert.strictEqual(get(report, 'body_fat_percent').value, 27.9, 'numbers are kept as read');
});

test('muscle larger than lean body mass is flagged', () => {
  const r = example();
  get(r, 'skeletal_muscle_mass').value = 70;
  assert.ok(recompute(r, { profile, previous }).report.warnings.some((w) => w.code === 'math_mismatch'));
});

test('a sheet that does not match the profile pauses coaching', () => {
  const r = example();
  const { report } = recompute(r, { profile: { age: 24, sex: 'female', height_cm: 165, flags: {} }, previous });
  assert.ok(report.warnings.some((w) => w.code === 'profile_mismatch'));
  assert.strictEqual(report.status, 'needs_attention');
  assert.strictEqual(report.safety.coaching_limited, true);
  assert.deepStrictEqual(report.report.focus_areas, []);
  assert.deepStrictEqual(report.report.coaching.training, []);
});

test('small age / height differences are not a mismatch', () => {
  const { report } = recompute(example(), { profile: { age: 33, sex: 'male', height_cm: 180, flags: {} }, previous });
  assert.ok(!report.warnings.some((w) => w.code === 'profile_mismatch'));
});

test('safety flags switch calorie guidance off in code', () => {
  ['eating_disorder_history', 'pregnant_or_postpartum', 'under_18', 'heart_condition'].forEach((flag) => {
    const { report } = recompute(example(), { profile: { ...profile, flags: { [flag]: true } }, previous });
    assert.strictEqual(report.safety.coaching_limited, true, flag);
    assert.strictEqual(report.safety.referral_suggested, true, flag);
    assert.strictEqual(report.report.coaching.nutrition.calorie_guidance, null, flag);
    assert.strictEqual(report.report.coaching.nutrition.protein_g_min, null, flag);
    assert.ok(report.safety.limited_reason, flag);
  });
});

test('pacemaker flag suggests a referral', () => {
  const { report } = recompute(example(), { profile: { ...profile, flags: { pacemaker_or_implant: true } }, previous });
  assert.strictEqual(report.safety.referral_suggested, true);
  assert.ok(/pacemaker/i.test(report.safety.reason));
});

test('unusual values suggest a doctor even if the model forgot to', () => {
  const r = example();
  get(r, 'ecw_tbw_ratio').value = 0.412;
  const { report } = recompute(r, { profile, previous });
  assert.strictEqual(report.safety.referral_suggested, true);
  assert.ok(/water balance/.test(report.safety.reason));
});

test('personal data is scrubbed from text but numbers, dates and units are not', () => {
  assert.strictEqual(scrub('Contact john@example.com now'), 'Contact [removed] now');
  assert.strictEqual(scrub('Call +44 7700 900123 today'), 'Call [removed] today');
  assert.strictEqual(scrub('Since 2026-09-02 your BMR is 1,812 kcal and weight 82.4 kg'), 'Since 2026-09-02 your BMR is 1,812 kcal and weight 82.4 kg');
  const r = example();
  r.report.headline = 'Well done Priya, mail priya@gym.com';
  r.report.insights[0].text = 'Reach me on 555 123 4567 8';
  const { report } = recompute(r, { profile, previous });
  assert.ok(!report.report.headline.includes('@'));
  assert.ok(report.report.insights[0].text.includes('[removed]'));
});

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`All ${passed} scan-validate tests passed`);
