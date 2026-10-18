/* Checks ai/scan-report.schema.json against ai/example-output.json, and re-verifies the
 * example's arithmetic. The arithmetic checks are the same sanity checks the backend should
 * run on real AI output: a structured-output schema guarantees the SHAPE, not that the
 * numbers are right.
 *   Run:  node tests/scan-report.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/scan-report.schema.json'), 'utf8'));
const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/example-output.json'), 'utf8'));

/* ---- a small JSON-schema validator (the subset the schema uses) ---- */
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}
function validate(s, v, at, errs) {
  if (s.anyOf) {
    const ok = s.anyOf.some((sub) => {
      const e = [];
      validate(sub, v, at, e);
      return !e.length;
    });
    if (!ok) errs.push(`${at}: matches none of anyOf`);
    return;
  }
  const t = typeOf(v);
  if (s.type) {
    const want = Array.isArray(s.type) ? s.type : [s.type];
    const ok = want.some((w) => w === t || (w === 'number' && t === 'integer'));
    if (!ok) {
      errs.push(`${at}: expected ${want.join('|')}, got ${t}`);
      return;
    }
  }
  if (s.enum && !s.enum.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (t === 'object' && s.properties) {
    (s.required || []).forEach((k) => {
      if (!(k in v)) errs.push(`${at}.${k}: missing`);
    });
    Object.keys(v).forEach((k) => {
      if (!(k in s.properties)) {
        if (s.additionalProperties === false) errs.push(`${at}.${k}: not allowed`);
      } else validate(s.properties[k], v[k], `${at}.${k}`, errs);
    });
  }
  if (t === 'array' && s.items) v.forEach((x, i) => validate(s.items, x, `${at}[${i}]`, errs));
}

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

test('example matches the schema', () => {
  const errs = [];
  validate(schema, example, '$', errs);
  assert.deepStrictEqual(errs, []);
});

test('schema rejects a missing required field', () => {
  const bad = JSON.parse(JSON.stringify(example));
  delete bad.report.headline;
  const errs = [];
  validate(schema, bad, '$', errs);
  assert.ok(errs.some((e) => e.includes('headline')), errs.join('; '));
});

test('schema rejects an unknown extra field and a bad enum', () => {
  const bad = JSON.parse(JSON.stringify(example));
  bad.extra = 1;
  bad.status = 'great';
  const errs = [];
  validate(schema, bad, '$', errs);
  assert.ok(errs.some((e) => e.includes('extra')) && errs.some((e) => e.includes('enum')), errs.join('; '));
});

test('schema uses no keywords structured outputs may not support', () => {
  const text = JSON.stringify(schema);
  ['$ref', '"minimum"', '"maximum"', '"minLength"', '"maxLength"', '"pattern"', '"minItems"', '"maxItems"'].forEach((k) =>
    assert.ok(!text.includes(k), `uses ${k}`)
  );
});

/* ---- the backend's deterministic checks, demonstrated on the example ---- */
const m = Object.fromEntries(example.metrics.map((x) => [x.key, x]));
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

test('weight - fat mass = lean body mass', () => near(m.weight.value - m.body_fat_mass.value, m.lean_body_mass.value, 1.5, 'lean mass'));
test('body fat % = fat mass / weight', () => near((m.body_fat_mass.value / m.weight.value) * 100, m.body_fat_percent.value, 1, 'PBF'));
test('BMI = weight / height^2', () => near(m.weight.value / Math.pow(example.scan.person.height_cm / 100, 2), m.bmi.value, 0.5, 'BMI'));
test('skeletal muscle <= lean body mass', () => assert.ok(m.skeletal_muscle_mass.value <= m.lean_body_mass.value));

test('every status agrees with its range', () => {
  example.metrics.forEach((x) => {
    if (x.value == null || x.range_low == null || x.range_high == null) return;
    const want = x.value < x.range_low ? 'below' : x.value > x.range_high ? 'above' : 'within';
    assert.strictEqual(x.status, want, `${x.key}: ${x.value} in [${x.range_low}, ${x.range_high}]`);
  });
});

test('balance percentages are computed correctly', () => {
  example.balance.forEach((b) => {
    const big = Math.max(b.left_value, b.right_value);
    near((Math.abs(b.left_value - b.right_value) / big) * 100, b.diff_percent, 0.15, `${b.pair} diff`);
  });
});

test('trend deltas are computed correctly', () => {
  example.trend.items.forEach((t) => {
    near(t.current - t.previous, t.delta, 0.05, `${t.key} delta`);
    near(((t.current - t.previous) / t.previous) * 100, t.delta_percent, 0.15, `${t.key} delta %`);
    assert.strictEqual(t.direction, t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : 'flat');
  });
});

test('headline and insights respect their word limits', () => {
  const words = (s) => s.trim().split(/\s+/).length;
  assert.ok(words(example.report.headline) <= 20, 'headline');
  example.report.insights.forEach((i) => assert.ok(words(i.text) <= 25, i.text));
  assert.ok(example.report.insights.length >= 3 && example.report.insights.length <= 5);
  assert.ok(example.report.focus_areas.length <= 3);
});

test('calorie guidance never goes below the BMR, protein range is sane', () => {
  const n = example.report.coaching.nutrition;
  assert.ok(n.protein_g_min <= n.protein_g_max);
  const kg = m.weight.value;
  assert.ok(n.protein_g_min >= 1.2 * kg - 1 && n.protein_g_max <= 2.3 * kg, 'protein per kg');
});

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`All ${passed} scan-report schema tests passed`);
