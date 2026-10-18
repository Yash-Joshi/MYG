/* GymBoy – demo data: 40 days of workouts for a dummy lifter.
 *
 * Generated on the fly, relative to today, from a seeded random generator, so the
 * same calendar day always gets the same workout. Every session is tagged
 * `demo: true` so it can be removed without touching real workouts.
 */
(function (GB) {
  'use strict';

  const MIN = 60000;

  // mulberry32: tiny seeded PRNG
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const roundTo = (v, step) => Math.round(v / step) * step;
  const clean = (n) => Math.round(n * 100) / 100;

  // Lifts: start weight w (kg), gain per week `step`, rounded to `round` (2.5 = a pair of 1.25 kg plates); sets x reps.
  const lift = (n, m, w, step, round, sets, reps, repStep) => ({ n, m, w, step, round, sets, reps, repStep: repStep || 0 });
  // Timed (HIIT) work: seconds t (+tStep per week), optional weight w and reps r.
  const timed = (n, t, tStep, w, step, r, repStep, sets, m) => ({ n, m: m || 'hiit', timed: true, t, tStep, w, step, round: 2, r, repStep, sets });

  const PLANS = {
    push: [
      lift('Barbell Bench Press', 'chest', 60, 1.5, 2.5, 4, 8),
      lift('Overhead Press', 'shoulders', 35, 1, 2.5, 3, 8),
      lift('Incline Dumbbell Press', 'chest', 22, 0.8, 2, 3, 10),
      lift('Dumbbell Lateral Raise', 'shoulders', 8, 0.4, 1, 3, 14),
      lift('Rope Pushdown', 'triceps', 25, 1, 2.5, 3, 12),
    ],
    pull: [
      lift('Deadlift', 'back', 90, 2.5, 2.5, 3, 5),
      lift('Lat Pulldown', 'back', 50, 1.2, 2.5, 4, 10),
      lift('Seated Cable Row', 'back', 45, 1.2, 2.5, 3, 10),
      lift('Face Pull', 'back', 20, 0.6, 2.5, 3, 15),
      lift('Barbell Curl', 'biceps', 25, 1, 2.5, 3, 10),
      lift('Hammer Curl', 'biceps', 12, 0.5, 2, 3, 12),
    ],
    legs: [
      lift('Barbell Squat', 'quads', 80, 2.5, 2.5, 4, 6),
      lift('Romanian Deadlift', 'hamstrings', 70, 2, 2.5, 3, 8),
      lift('Leg Press', 'quads', 140, 5, 5, 3, 10),
      lift('Leg Extension', 'quads', 40, 1.5, 2.5, 3, 12),
      lift('Standing Calf Raise', 'calves', 60, 2, 2.5, 4, 12),
    ],
    hiit: [
      timed('Burpees', 30, 1.2, 0, 0, 10, 0.5, 6),
      timed('Kettlebell Swings', 30, 1, 14, 1.1, 20, 0.4, 6),
      timed('Battle Ropes', 30, 1.5, 0, 0, 0, 0, 5),
      timed('Assault Bike Sprints', 20, 1, 0, 0, 0, 0, 6),
    ],
    mobility: [
      timed("World's Greatest Stretch", 40, 0.6, 0, 0, 6, 0.3, 2, 'mobility'),
      timed('90/90 Hip Switch', 60, 1, 0, 0, 0, 0, 2, 'mobility'),
      timed('Cat-Cow', 45, 1, 0, 0, 0, 0, 2, 'mobility'),
      timed('Deep Squat Hold', 45, 2, 0, 0, 0, 0, 3, 'mobility'),
      timed('Open Book Rotation', 40, 1, 0, 0, 8, 0.2, 2, 'mobility'),
    ],
    'chest-triceps': [
      lift('Barbell Bench Press', 'chest', 60, 1.5, 2.5, 3, 10), // same bar weight as Push day, so the lift's trend line climbs instead of zig-zagging
      lift('Incline Barbell Bench Press', 'chest', 45, 1.2, 2.5, 3, 8),
      lift('Cable Crossover', 'chest', 15, 0.5, 2.5, 3, 12),
      lift('Skull Crushers', 'triceps', 25, 0.8, 2.5, 3, 10),
      lift('Triceps Dips', 'triceps', 0, 0, 1, 3, 8, 0.35),
    ],
    'back-biceps': [
      lift('Barbell Row', 'back', 60, 1.5, 2.5, 4, 8),
      lift('Pull-ups', 'back', 0, 0, 1, 4, 6, 0.35),
      lift('T-Bar Row', 'back', 40, 1.2, 2.5, 3, 10),
      lift('Dumbbell Curl', 'biceps', 12, 0.5, 2, 3, 10),
      lift('Preacher Curl', 'biceps', 25, 0.8, 2.5, 3, 10),
    ],
  };

  // Mon..Sat lifting and conditioning; Sunday is a mobility day
  const WEEK = { 0: 'mobility', 1: 'push', 2: 'pull', 3: 'legs', 4: 'hiit', 5: 'chest-triceps', 6: 'back-biceps' };

  const NOTES = ['Felt strong today', 'Left shoulder a bit tight', 'Slept badly, kept it controlled', 'Top set moved fast', 'Short on time, cut an accessory'];

  function generate(days, now) {
    days = days || 40;
    now = now || Date.now();
    const out = [];

    for (let back = days - 1; back >= 0; back--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - back);

      const planId = WEEK[d.getDay()];
      if (!planId) continue;
      const rand = rng(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
      if (rand() < 0.1) continue; // missed a session now and then

      const prog = (days - 1 - back) / 7; // weeks since the start of the window
      const day = GB.data.DAY_TYPES.find((x) => x.id === planId);
      const isHiit = planId === 'hiit';
      const isMobility = planId === 'mobility';

      const endedAt = Math.min(d.getTime() + (17 + rand() * 3) * 3600000, now - 15 * MIN);
      const startedAt = endedAt - Math.round(isHiit ? 30 + rand() * 12 : isMobility ? 22 + rand() * 14 : 52 + rand() * 22) * MIN;
      if (startedAt < d.getTime()) continue; // just after midnight today: too early to have trained, and it would land on yesterday

      const exercises = PLANS[planId].map((item, idx) => {
        const bad = rand() < 0.12; // an off day: back the weight off one step
        let w = roundTo(item.w + item.step * prog, item.round || 1);
        if (bad && w > (item.round || 1)) w -= item.round || 1;
        const baseReps = Math.round(item.reps + item.repStep * prog);
        const baseT = item.timed ? roundTo(item.t + item.tStep * prog, 5) : 0;

        const sets = [];
        for (let k = 0; k < item.sets; k++) {
          let reps = baseReps - (k === item.sets - 1 ? 1 : 0) - (rand() < 0.2 ? 1 : 0) + (rand() > 0.9 ? 1 : 0);
          reps = Math.max(item.reps ? 1 : 0, reps);
          if (item.timed) {
            sets.push({ t: baseT, w: item.w ? clean(w) : 0, r: item.r ? Math.max(0, reps) : 0 });
          } else {
            sets.push({ w: clean(w), r: reps });
          }
        }
        const ex = { name: item.n, muscle: item.m, sets };
        if (idx === 0 && rand() < 0.07) ex.note = NOTES[Math.floor(rand() * NOTES.length)];
        return ex;
      });

      out.push({
        id: `demo-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`,
        dayId: day.id,
        dayName: day.name,
        muscles: day.muscles,
        startedAt,
        endedAt,
        unit: 'kg',
        exercises,
        demo: true,
      });
    }
    return out;
  }

  // A slow, believable downward weight trend ending near `endKg`, a weigh-in every 1 to 3 days.
  // Today is left out: the real current weight is the user's own.
  function generateWeights(days, endKg, now) {
    days = days || 40;
    now = now || Date.now();
    const out = [];
    const drop = 3.4; // kg lost over the window
    for (let back = days - 1; back >= 1; back--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - back);
      const rand = rng(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + 7);
      if (rand() < 0.4) continue; // not every day
      const base = endKg + drop * (back / (days - 1));
      const noise = (rand() - 0.5) * 0.7;
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ date, kg: Math.round((base + noise) * 10) / 10, demo: true });
    }
    return out;
  }

  GB.demo = { generate, generateWeights };
})((window.GB = window.GB || {}));
