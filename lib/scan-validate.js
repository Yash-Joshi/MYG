'use strict';
/* Deterministic checks on an AI scan report.
 *
 * A structured-output schema guarantees the SHAPE of the model's JSON, not that its numbers or
 * judgements are right or safe. Everything here is plain code, so it never "hallucinates":
 *   - shape validation against ai/scan-report.schema.json
 *   - statuses, balance and trend deltas recomputed from the numbers
 *   - arithmetic sanity checks on the extracted values
 *   - the safety rules from the user's profile enforced in code (not left to the model)
 *   - personal data scrubbed from free text
 */

/* ---------- JSON-schema subset validator ---------- */
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function validateShape(schema, value, at, errs) {
  at = at || '$';
  errs = errs || [];
  if (schema.anyOf) {
    const ok = schema.anyOf.some((sub) => validateShape(sub, value, at, []).length === 0);
    if (!ok) errs.push(`${at}: matches none of anyOf`);
    return errs;
  }
  const t = typeOf(value);
  if (schema.type) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!want.some((w) => w === t || (w === 'number' && t === 'integer'))) {
      errs.push(`${at}: expected ${want.join('|')}, got ${t}`);
      return errs;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: ${JSON.stringify(value)} not in enum`);
  if (t === 'object' && schema.properties) {
    (schema.required || []).forEach((k) => {
      if (!(k in value)) errs.push(`${at}.${k}: missing`);
    });
    Object.keys(value).forEach((k) => {
      if (!(k in schema.properties)) {
        if (schema.additionalProperties === false) errs.push(`${at}.${k}: not allowed`);
      } else validateShape(schema.properties[k], value[k], `${at}.${k}`, errs);
    });
  }
  if (t === 'array' && schema.items) value.forEach((x, i) => validateShape(schema.items, x, `${at}[${i}]`, errs));
  return errs;
}

/* ---------- helpers ---------- */
const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function statusFor(value, lo, hi) {
  if (num(value) == null || num(lo) == null || num(hi) == null) return 'unknown';
  if (value < lo) return 'below';
  if (value > hi) return 'above';
  return 'within';
}

const metricMap = (report) => Object.fromEntries((report.metrics || []).map((m) => [m.key, m]));

function addWarning(report, code, message, metric_keys) {
  const exists = (report.warnings || []).some((w) => w.code === code && w.message === message);
  if (!exists) report.warnings.push({ code, message, metric_keys: metric_keys || [] });
}

/* Changes smaller than this are measurement noise (hydration, meals), not progress. */
function withinNormalVariation(key, previous, current, weightNow) {
  const d = Math.abs(current - previous);
  switch (key) {
    case 'weight':
      return d < 0.01 * (weightNow || current);
    case 'body_fat_percent':
      return d < 1;
    case 'skeletal_muscle_mass':
    case 'body_fat_mass':
    case 'lean_body_mass':
      return d < 0.5;
    case 'visceral_fat_level':
      return d < 1;
    case 'ecw_tbw_ratio':
      return d < 0.005;
    default:
      return false;
  }
}

const PHONE_RE = /\+?\d(?:[\s().-]?\d){8,}/; // 9 or more digits, optionally separated
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function scrub(text) {
  if (typeof text !== 'string') return text;
  return text.replace(EMAIL_RE, '[removed]').replace(PHONE_RE, '[removed]');
}

function scrubReportText(report) {
  const fix = (o, key) => {
    if (typeof o[key] === 'string') o[key] = scrub(o[key]);
  };
  fix(report, 'user_message');
  fix(report.scan, 'device_model');
  (report.metrics || []).forEach((m) => {
    fix(m, 'label');
    fix(m, 'note');
  });
  (report.balance || []).forEach((b) => fix(b, 'note'));
  if (report.trend) fix(report.trend, 'summary');
  const r = report.report;
  fix(r, 'headline');
  (r.insights || []).forEach((i) => fix(i, 'text'));
  (r.focus_areas || []).forEach((f) => ['title', 'why', 'action'].forEach((k) => fix(f, k)));
  ['training', 'recovery'].forEach((k) => (r.coaching[k] = (r.coaching[k] || []).map(scrub)));
  fix(r.coaching.nutrition, 'calorie_guidance');
  r.coaching.nutrition.notes = (r.coaching.nutrition.notes || []).map(scrub);
  r.coaching.next_scan.tips = (r.coaching.next_scan.tips || []).map(scrub);
  (r.glossary || []).forEach((g) => {
    fix(g, 'term');
    fix(g, 'plain_meaning');
  });
  (report.warnings || []).forEach((w) => fix(w, 'message'));
  fix(report.safety, 'reason');
  fix(report.safety, 'limited_reason');
}

/* ---------- the main entry ---------- */
/**
 * recompute(report, ctx) mutates `report` into its trustworthy form.
 *   ctx.profile  - { age, sex, height_cm, flags: {...} } (from the questionnaire, optional)
 *   ctx.previous - { measured_at, metrics: [{ key, value }] } or null
 * Returns { report, adjustments } where adjustments lists what code changed.
 */
function recompute(report, ctx) {
  ctx = ctx || {};
  const profile = ctx.profile || {};
  const flags = profile.flags || {};
  const adjustments = [];
  const m = metricMap(report);

  // 1. statuses from value vs range
  (report.metrics || []).forEach((x) => {
    if (x.range_source === 'none' || num(x.range_low) == null || num(x.range_high) == null) {
      if (x.status !== 'unknown') {
        adjustments.push(`${x.key}: status ${x.status} -> unknown (no range)`);
        x.status = 'unknown';
      }
      return;
    }
    const want = statusFor(x.value, x.range_low, x.range_high);
    if (want !== x.status) {
      adjustments.push(`${x.key}: status ${x.status} -> ${want}`);
      x.status = want;
    }
  });

  // 2. balance from the lean segments
  const lean = report.segments && report.segments.lean;
  if (lean) {
    const prevNotes = Object.fromEntries((report.balance || []).map((b) => [b.pair, b.note]));
    report.balance = [
      ['arms', lean.left_arm, lean.right_arm],
      ['legs', lean.left_leg, lean.right_leg],
    ].map(([pair, l, r]) => {
      const lv = num(l.mass);
      const rv = num(r.mass);
      let diff = null;
      let flag = 'unknown';
      if (lv != null && rv != null && Math.max(lv, rv) > 0) {
        diff = round1((Math.abs(lv - rv) / Math.max(lv, rv)) * 100);
        flag = diff < 5 ? 'none' : diff <= 10 ? 'mild' : 'notable';
      }
      return { pair, left_value: lv, right_value: rv, diff_percent: diff, flag, note: prevNotes[pair] || null };
    });
  } else if ((report.balance || []).length) {
    adjustments.push('balance cleared (no segmental lean data)');
    report.balance = [];
  }

  // 3. trend from the previous scan the SERVER holds
  const prev = ctx.previous && Array.isArray(ctx.previous.metrics) ? Object.fromEntries(ctx.previous.metrics.map((p) => [p.key, p.value])) : null;
  if (!prev) {
    if (report.trend) adjustments.push('trend cleared (no previous scan)');
    report.trend = null;
  } else if (report.trend) {
    const weightNow = m.weight && num(m.weight.value);
    report.trend.previous_measured_at = ctx.previous.measured_at || report.trend.previous_measured_at;
    report.trend.items = report.trend.items
      .filter((t) => m[t.key] && num(m[t.key].value) != null && num(prev[t.key]) != null)
      .map((t) => {
        const current = m[t.key].value;
        const previous = prev[t.key];
        const delta = Math.round((current - previous) * 1000) / 1000;
        const dp = previous !== 0 ? round1((delta / previous) * 100) : null;
        const noise = withinNormalVariation(t.key, previous, current, weightNow);
        let meaning = t.meaning;
        if (noise) meaning = 'within_normal_variation';
        else if (meaning === 'within_normal_variation') meaning = 'neutral';
        return { key: t.key, previous, current, delta, delta_percent: dp, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', meaning };
      });
  }

  // 4. arithmetic sanity checks on what was read
  const bad = (msg, keys) => addWarning(report, 'math_mismatch', msg, keys);
  if (m.weight && m.body_fat_mass && m.lean_body_mass && [m.weight, m.body_fat_mass, m.lean_body_mass].every((x) => num(x.value) != null)) {
    if (Math.abs(m.weight.value - m.body_fat_mass.value - m.lean_body_mass.value) > 1.5) {
      bad('Weight minus body fat does not match lean body mass, so a number may be misread. Please check the photo.', ['weight', 'body_fat_mass', 'lean_body_mass']);
    }
  }
  if (m.weight && m.body_fat_mass && m.body_fat_percent && [m.weight, m.body_fat_mass, m.body_fat_percent].every((x) => num(x.value) != null)) {
    if (Math.abs((m.body_fat_mass.value / m.weight.value) * 100 - m.body_fat_percent.value) > 1) {
      bad('Body fat % does not match fat mass divided by weight, so a number may be misread. Please check the photo.', ['body_fat_mass', 'body_fat_percent']);
    }
  }
  const h = num(report.scan.person && report.scan.person.height_cm) || num(profile.height_cm);
  if (m.weight && m.bmi && h && num(m.weight.value) != null && num(m.bmi.value) != null) {
    if (Math.abs(m.weight.value / Math.pow(h / 100, 2) - m.bmi.value) > 0.5) {
      bad('BMI does not match weight and height, so a number may be misread. Please check the photo.', ['weight', 'bmi']);
    }
  }
  if (m.skeletal_muscle_mass && m.lean_body_mass && num(m.skeletal_muscle_mass.value) != null && num(m.lean_body_mass.value) != null) {
    if (m.skeletal_muscle_mass.value > m.lean_body_mass.value) {
      bad('Skeletal muscle mass is higher than lean body mass, so a number may be misread. Please check the photo.', ['skeletal_muscle_mass', 'lean_body_mass']);
    }
  }

  // 5. does the sheet belong to this user?
  const p = report.scan.person || {};
  const mismatches = [];
  if (p.sex && profile.sex && p.sex !== profile.sex) mismatches.push('sex');
  if (num(p.age) != null && num(profile.age) != null && Math.abs(p.age - profile.age) > 3) mismatches.push('age');
  if (num(p.height_cm) != null && num(profile.height_cm) != null && Math.abs(p.height_cm - profile.height_cm) > 6) mismatches.push('height');
  let limited = null;
  if (mismatches.length) {
    addWarning(report, 'profile_mismatch', `The ${mismatches.join(' and ')} on this sheet does not match your profile. Is it your scan?`, []);
    if (report.status === 'ok' || report.status === 'partial') report.status = 'needs_attention';
    limited = 'This sheet does not match your profile, so coaching is paused.';
  }

  // 6. safety rules, enforced in code
  const reasons = [];
  if (flags.under_18) reasons.push('under 18');
  if (flags.pregnant_or_postpartum) reasons.push('pregnancy or postpartum');
  if (flags.eating_disorder_history) reasons.push('eating disorder history');
  if (flags.heart_condition) reasons.push('a heart condition');
  if (reasons.length) limited = `Calorie and weight-loss guidance is turned off because of ${reasons.join(', ')}.`;
  if (limited) {
    report.safety.coaching_limited = true;
    report.safety.limited_reason = limited;
    report.safety.referral_suggested = true;
    report.safety.reason = report.safety.reason || 'Please talk to a doctor or qualified professional about your goals.';
    const c = report.report.coaching;
    c.nutrition.calorie_guidance = null;
    c.nutrition.protein_g_min = null;
    c.nutrition.protein_g_max = null;
    if (mismatches.length) {
      report.report.focus_areas = [];
      c.training = [];
      c.recovery = [];
      c.nutrition.notes = [];
    }
    adjustments.push(`coaching limited: ${limited}`);
  }
  if (flags.pacemaker_or_implant && !report.safety.referral_suggested) {
    report.safety.referral_suggested = true;
    report.safety.reason = 'Body-composition scanners are generally not recommended with a pacemaker or implanted device. Please check with your clinician.';
  }
  const unusual = [];
  if (m.ecw_tbw_ratio && num(m.ecw_tbw_ratio.value) >= 0.4) unusual.push('water balance (ECW/TBW)');
  if (m.visceral_fat_level && num(m.visceral_fat_level.value) >= 15) unusual.push('visceral fat level');
  if (m.bmi && num(m.bmi.value) != null && m.bmi.value < 16) unusual.push('BMI');
  if (unusual.length && !report.safety.referral_suggested) {
    report.safety.referral_suggested = true;
    report.safety.reason = `Your ${unusual.join(' and ')} is outside the usual range. It is worth discussing with a doctor; hydration, a recent meal or hard training can also affect a scan.`;
  }

  // 7. personal data never reaches the user's report
  scrubReportText(report);

  return { report, adjustments };
}

module.exports = { validateShape, recompute, statusFor, withinNormalVariation, scrub };
