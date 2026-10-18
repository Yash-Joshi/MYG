/* Tests for the voice / quick-log parser.   Run:  node tests/voice.test.js */
const assert = require('assert');
globalThis.window = globalThis;
require('../js/data.js');
const V = require('../js/voice.js');

const library = GB.data.EXERCISES.map(([name, muscle]) => ({ name, muscle }));
const ctxBase = { library, sessionExercises: [], current: null, defaultMuscle: 'chest' };
const parse = (phrase, extra) => V.parse(phrase, Object.assign({}, ctxBase, extra));

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${e.message.split('\n').join('\n    ')}`);
  }
}

/* ---------- spoken numbers ---------- */
const nums = {
  'sixty': '60',
  'sixty two point five': '62.5',
  'sixty-five and a half': '65.5',
  'one hundred and twenty': '120',
  'a hundred': '100',
  'two hundred twenty five': '225',
  'twelve': '12',
  'eight': '8',
  'forty': '40',
  'point five': 'point 5', // no leading number: left as words/digits
};
Object.entries(nums).forEach(([said, expect]) => {
  test(`numbers: "${said}"`, () => assert.strictEqual(V.wordsToDigits(said), expect));
});
test('numbers: two separate numbers stay separate', () => assert.strictEqual(V.wordsToDigits('sixty for eight'), '60 for 8'));
test('numbers: european decimal', () => assert.strictEqual(V.wordsToDigits('62,5 kilos'), '62.5 kilos'));

/* ---------- phrases ---------- */
function expectSet(phrase, want, extra) {
  test(`"${phrase}"`, () => {
    const r = parse(phrase, extra);
    if (want.ok === false) {
      assert.strictEqual(r.ok, false, `expected not ok, got ${JSON.stringify(r)}`);
      return;
    }
    assert.strictEqual(r.ok, true, `expected ok, got ${JSON.stringify(r)}`);
    if (want.name) assert.strictEqual(r.exercise.name, want.name);
    if ('weight' in want) assert.strictEqual(r.weight, want.weight, 'weight');
    if ('unit' in want) assert.strictEqual(r.weightUnit, want.unit, 'unit');
    if ('reps' in want) assert.strictEqual(r.reps, want.reps, 'reps');
    if ('sets' in want) assert.strictEqual(r.sets, want.sets, 'sets');
    if ('seconds' in want) assert.strictEqual(r.seconds, want.seconds, 'seconds');
    if (want.isNew) assert.strictEqual(r.exercise.isNew, true, 'isNew');
    if (want.muscle) assert.strictEqual(r.exercise.muscle, want.muscle, 'muscle');
    if (want.same) assert.strictEqual(r.sameWeight, true, 'sameWeight');
    if (want.bodyweight) assert.strictEqual(r.bodyweight, true, 'bodyweight');
  });
}

expectSet('bench press 60 kilos 8 reps', { name: 'Barbell Bench Press', weight: 60, unit: 'kg', reps: 8, sets: 1 });
expectSet('bench press sixty kilos eight reps', { name: 'Barbell Bench Press', weight: 60, unit: 'kg', reps: 8 });
expectSet('Bench press, 60 kg, 8 reps.', { name: 'Barbell Bench Press', weight: 60, reps: 8 });
expectSet('squat 100 for 5', { name: 'Barbell Squat', weight: 100, reps: 5 });
expectSet('a hundred kilos squat for three', { name: 'Barbell Squat', weight: 100, unit: 'kg', reps: 3 });
expectSet('3 sets of 8 at 62.5 kilos on incline dumbbell press', { name: 'Incline Dumbbell Press', sets: 3, reps: 8, weight: 62.5, unit: 'kg' });
expectSet('three sets of eight at sixty on bench press', { name: 'Barbell Bench Press', sets: 3, reps: 8, weight: 60 });
expectSet('sixty two point five kilos for eight reps deadlift', { name: 'Deadlift', weight: 62.5, reps: 8 });
expectSet('deadlift one hundred and twenty kilos five reps', { name: 'Deadlift', weight: 120, reps: 5 });
expectSet('lat pull down 55 x 10', { name: 'Lat Pulldown', weight: 55, reps: 10 });
expectSet('pull ups 8 reps bodyweight', { name: 'Pull-ups', reps: 8, weight: 0, bodyweight: true });
expectSet('pullups eight reps', { name: 'Pull-ups', reps: 8 });
expectSet('dumbbell curl 14 kg 10', { name: 'Dumbbell Curl', weight: 14, unit: 'kg', reps: 10 });
expectSet('db curl 14 kilos 10 reps', { name: 'Dumbbell Curl', weight: 14, reps: 10 });
expectSet('bench 225 pounds 5 reps', { name: 'Barbell Bench Press', weight: 225, unit: 'lb', reps: 5 });
expectSet('incline bench 50 for 10', { name: 'Incline Barbell Bench Press', weight: 50, reps: 10 });
expectSet('rdl 80 kilos 8', { name: 'Romanian Deadlift', weight: 80, reps: 8 });
expectSet('overhead press forty kilos six reps', { name: 'Overhead Press', weight: 40, reps: 6 });
expectSet('bench press 8 reps at 60', { name: 'Barbell Bench Press', weight: 60, reps: 8 });
expectSet('triceps pushdown 30 kilos 12 reps', { name: 'Triceps Pushdown', weight: 30, reps: 12 });
expectSet('leg press 140 kilos 10', { name: 'Leg Press', weight: 140, reps: 10 });
expectSet('i did sixty five and a half kilos eight reps bench press', { name: 'Barbell Bench Press', weight: 65.5, reps: 8 });

// timed / HIIT
expectSet('burpees forty seconds', { name: 'Burpees', seconds: 40 });
expectSet('kettlebell swings 30 seconds 16 kilos 20 reps', { name: 'Kettlebell Swings', seconds: 30, weight: 16, reps: 20 });
expectSet('battle ropes two minutes', { name: 'Battle Ropes', seconds: 120 });
expectSet('burpees 12 reps', { name: 'Burpees', reps: 12 });

// mobility and flow moves
expectSet("world's greatest stretch sixty seconds", { name: "World's Greatest Stretch", seconds: 60 });
expectSet('worlds greatest stretch 8 reps', { name: "World's Greatest Stretch", reps: 8 });
expectSet('cat cow 45 seconds', { name: 'Cat-Cow', seconds: 45 });
expectSet('pigeon pose forty five seconds', { name: 'Pigeon Pose', seconds: 45 });
expectSet('downward dog thirty seconds', { name: 'Downward Dog', seconds: 30 });
expectSet('bear crawl 30 seconds', { name: 'Bear Crawl', seconds: 30 });
expectSet('lateral hip opener stretch 40 seconds', { name: 'Lateral Hip Opener Stretch', seconds: 40, isNew: true, muscle: 'mobility' });

// new exercise names
expectSet('zottman curl 12 kilos 10 reps', { name: 'Zottman Curl', weight: 12, reps: 10, isNew: true, muscle: 'biceps' });
expectSet('cable woodchopper 15 kilos 12 reps', { name: 'Cable Woodchopper', weight: 15, reps: 12, isNew: true });

/* ---------- context: the exercise you are already on ---------- */
const bench = { name: 'Barbell Bench Press', muscle: 'chest' };
expectSet('ten reps', { name: 'Barbell Bench Press', reps: 10 }, { current: bench, sessionExercises: [bench] });
expectSet('same weight 9 reps', { name: 'Barbell Bench Press', reps: 9, same: true }, { current: bench, sessionExercises: [bench] });
expectSet('60 8', { name: 'Barbell Bench Press', weight: 60, reps: 8 }, { current: bench, sessionExercises: [bench] });
expectSet('62.5 kilos for 7', { name: 'Barbell Bench Press', weight: 62.5, reps: 7 }, { current: bench, sessionExercises: [bench] });

// an exercise already in the workout wins over a library exercise with the same words
const dbBench = { name: 'Dumbbell Bench Press', muscle: 'chest' };
expectSet('bench press 30 kilos 10', { name: 'Dumbbell Bench Press', weight: 30, reps: 10 }, { sessionExercises: [dbBench] });

/* ---------- things that should NOT log ---------- */
expectSet('hello there', { ok: false });
expectSet('bench press', { ok: false });
expectSet('', { ok: false });

test('no reps -> reports why', () => assert.ok(parse('bench press').issues.includes('no-reps')));
test('no exercise and no current -> reports why', () => assert.ok(parse('8 reps').issues.includes('no-exercise')));
test('an unfamiliar variation becomes a new exercise, offering the closest known one', () => {
  const r = parse('incline cable fly 15 kilos 12 reps');
  assert.ok(r.ok);
  assert.strictEqual(r.exercise.isNew, true);
  assert.strictEqual(r.exercise.name, 'Incline Cable Fly');
  assert.ok(r.alternatives.some((a) => a.name === 'Incline Dumbbell Fly'), JSON.stringify(r.alternatives));
});
test('a mishearing is matched but flagged, with "add as new" offered', () => {
  const r = parse('burpies 12 reps');
  assert.ok(r.ok);
  assert.strictEqual(r.exercise.name, 'Burpees');
  assert.strictEqual(r.exercise.exact, false);
  assert.ok(r.alternatives.some((a) => a.isNew && a.name === 'Burpies'), JSON.stringify(r.alternatives));
});
test('confidence is higher for a clean phrase than a vague one', () => {
  assert.ok(parse('bench press 60 kilos 8 reps').confidence > parse('ten reps', { current: bench }).confidence - 0.01);
  assert.ok(parse('bench press 60 kilos 8 reps').confidence >= 0.9);
});
test('speechSupported is false outside a browser', () => assert.strictEqual(V.speechSupported(), false));

/* ---------- report ---------- */
if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`All ${passed} voice parser tests passed`);
