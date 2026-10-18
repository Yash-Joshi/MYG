/* GymBoy – pure helpers for profiles, units, goal progress and report gauges (no DOM). */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  const LB_PER_KG = 2.20462;
  const round1 = (n) => Math.round(n * 10) / 10;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /* ---------- units ---------- */
  const kgToLb = (kg) => round1(kg * LB_PER_KG);
  const lbToKg = (lb) => round1(lb / LB_PER_KG);
  function cmToFtIn(cm) {
    const totalIn = cm / 2.54;
    let ft = Math.floor(totalIn / 12);
    let inch = Math.round(totalIn - ft * 12);
    if (inch === 12) {
      ft += 1;
      inch = 0;
    }
    return { ft, in: inch };
  }
  const ftInToCm = (ft, inch) => round1(((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 2.54);

  /* ---------- body numbers ---------- */
  function bmi(kg, cm) {
    if (!isNum(kg) || !isNum(cm) || cm <= 0 || kg <= 0) return null;
    return round1(kg / Math.pow(cm / 100, 2));
  }

  function ageFromDob(dob, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ''));
    if (!m) return null;
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    const birth = new Date(y, mo - 1, d);
    if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) return null; // 31 Feb etc.
    const t = now ? new Date(now) : new Date();
    if (birth > t) return null;
    let age = t.getFullYear() - y;
    if (t.getMonth() < mo - 1 || (t.getMonth() === mo - 1 && t.getDate() < d)) age -= 1;
    return age;
  }

  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

  function greeting(now) {
    const h = (now ? new Date(now) : new Date()).getHours();
    return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  /* ---------- profile shape ---------- */
  function emptyProfile() {
    return {
      version: 1,
      name: '',
      dob: '',
      sex: null,
      units: 'metric',
      height_cm: null,
      weight_kg: null,
      goal: { primary: null, target_weight_kg: null, weeks: null },
      training: { experience: null, days_per_week: 3, minutes_per_session: 60, equipment: null, limitations: [], limitations_note: '' },
      life: { job_activity: null, steps_band: null, sleep_hours: 7 },
      food: { diet: null, avoid: '' },
      flags: { pregnant_or_postpartum: false, eating_disorder_history: false, heart_condition: false, pacemaker_or_implant: false, taking_medication_affecting_weight_or_water: false },
      consent: { scan_ai: null, policy_version: null },
      weights: [],
      created_at: null,
      updated_at: null,
    };
  }

  // What may be sent to the AI: no name, no birth date, no email.
  function profileForAI(p, now) {
    const age = ageFromDob(p.dob, now);
    return {
      age,
      sex: p.sex,
      height_cm: p.height_cm,
      weight_kg: p.weight_kg,
      goal: p.goal,
      training: p.training,
      life: p.life,
      food: p.food,
      flags: Object.assign({}, p.flags, { under_18: age != null && age < 18 }),
    };
  }

  // The latest saved report, reduced to what the server needs to compute a trend.
  function previousForAI(scans) {
    const latest = (scans || [])
      .filter((s) => s && s.report && Array.isArray(s.report.metrics))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (!latest) return null;
    const metrics = latest.report.metrics.filter((m) => isNum(m.value)).map((m) => ({ key: m.key, value: m.value }));
    if (!metrics.length) return null;
    return { measured_at: latest.report.scan.measured_at || latest.created_at, metrics };
  }

  /* ---------- weight log + goal ---------- */
  function addWeighIn(profile, kg, dateStr) {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    const rest = (profile.weights || []).filter((w) => w.date !== date);
    rest.push({ date, kg: round1(kg) });
    rest.sort((a, b) => a.date.localeCompare(b.date));
    profile.weights = rest;
    // the headline weight is always the most recent weigh-in
    profile.weight_kg = rest[rest.length - 1].kg;
    return profile;
  }

  function weightSeries(profile, days, now) {
    const t = now ? new Date(now) : new Date();
    const cutoff = new Date(t.getFullYear(), t.getMonth(), t.getDate() - days).toISOString().slice(0, 10);
    return (profile.weights || []).filter((w) => w.date >= cutoff);
  }

  /**
   * How far along the goal is. start = first recorded weight, target = chosen target weight.
   * fraction is 0..1 (clamped); remaining is kg still to go in the goal's direction.
   */
  function goalProgress(profile) {
    const w = profile.weights || [];
    const target = profile.goal && profile.goal.target_weight_kg;
    if (!w.length || !isNum(target)) return null;
    const start = w[0].kg;
    const current = w[w.length - 1].kg;
    if (start === target) return { start, current, target, fraction: 1, remaining: 0, direction: 'hold', reached: true };
    const direction = target < start ? 'down' : 'up';
    const total = Math.abs(target - start);
    const done = direction === 'down' ? start - current : current - start;
    const fraction = Math.max(0, Math.min(1, done / total));
    const remaining = Math.max(0, round1(direction === 'down' ? current - target : target - current));
    return { start, current, target, fraction, remaining, direction, reached: remaining === 0 };
  }

  /* ---------- report gauges ---------- */
  // Positions a value on a bar whose "normal" band is the middle half (25% to 75%).
  function gauge(value, lo, hi) {
    if (!isNum(value) || !isNum(lo) || !isNum(hi) || hi <= lo) return null;
    const pad = (hi - lo) * 0.5;
    const min = lo - pad;
    const max = hi + pad;
    const frac = (v) => Math.max(0, Math.min(1, (v - min) / (max - min)));
    return { min, max, pos: Math.max(0.02, Math.min(0.98, frac(value))), bandStart: frac(lo), bandEnd: frac(hi) };
  }

  GB.profile = {
    LB_PER_KG, kgToLb, lbToKg, cmToFtIn, ftInToCm, bmi, ageFromDob, firstName, greeting,
    emptyProfile, profileForAI, previousForAI, addWeighIn, weightSeries, goalProgress, gauge,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GB.profile;
})(typeof window !== 'undefined' ? window : globalThis);
