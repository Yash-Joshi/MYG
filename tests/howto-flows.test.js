/* Content checks for the how-to instructions and guided flows.   Run: node tests/howto-flows.test.js
 * These make sure nothing in the exercise library is left without instructions, and that every
 * flow only uses moves that exist (so each move in the player has a "how to").
 */
const assert = require('assert');
globalThis.window = globalThis;
require('../js/data.js');
require('../js/howto-strength.js');
require('../js/howto-move.js');
const H = require('../js/howto.js');
const F = require('../js/flow-data.js');

const library = GB.data.EXERCISES.map(([name, muscle]) => ({ name, muscle }));
const words = (s) => s.trim().split(/\s+/).length;

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

/* ---------- how-to coverage and quality ---------- */
test('every exercise in the library has instructions', () => {
  const missing = library.filter((e) => !H.get(e.name)).map((e) => e.name);
  assert.deepStrictEqual(missing, []);
});
test('there are no instructions for exercises that do not exist', () => {
  const extra = H.names().filter((n) => !library.some((e) => e.name === n));
  assert.deepStrictEqual(extra, []);
});
test('every entry has 3 or 4 steps, cues and mistakes, all short and non-empty', () => {
  H.names().forEach((n) => {
    const i = H.get(n);
    assert.ok(i.steps.length >= 3 && i.steps.length <= 4, `${n}: ${i.steps.length} steps`);
    assert.ok(i.cues.length >= 2 && i.avoid.length >= 2, `${n}: cues/mistakes`);
    i.steps.forEach((s) => assert.ok(s.trim().length > 10 && words(s) <= 34, `${n}: step too short/long: "${s}"`));
    [...i.cues, ...i.avoid].forEach((s) => assert.ok(s.trim().length > 3 && words(s) <= 20, `${n}: "${s}"`));
    assert.ok(i.easier || i.harder, `${n}: needs an easier or harder version`);
  });
});
test('conditioning, mobility, ground and yoga entries have a suggested dose', () => {
  H.names().forEach((n) => {
    const i = H.get(n);
    if (['conditioning', 'mobility', 'ground', 'yoga'].includes(i.kind)) assert.ok(i.dose, `${n} has no dose`);
  });
});
test('each entry\'s kind matches where the exercise lives', () => {
  library.forEach((e) => {
    const k = H.get(e.name).kind;
    if (e.muscle === 'hiit') assert.strictEqual(k, 'conditioning', e.name);
    if (e.muscle === 'mobility') assert.ok(['mobility', 'ground', 'yoga'].includes(k), `${e.name}: ${k}`);
  });
});
test('instructions never tell people to push through pain', () => {
  const bad = /push through (the )?pain|no pain,? no gain|until it hurts|force (it|the)/i;
  H.names().forEach((n) => {
    const i = H.get(n);
    [...i.steps, ...i.cues, i.easier || '', i.harder || ''].forEach((s) => assert.ok(!bad.test(s), `${n}: "${s}"`));
  });
});
test('lookup ignores case and spacing, and unknown names return null', () => {
  assert.ok(H.get('  barbell squat '));
  assert.ok(H.get("WORLD'S GREATEST STRETCH"));
  assert.strictEqual(H.get('Made Up Move'), null);
});

/* ---------- demo links ---------- */
test('the demo link is a YouTube search that always works and is properly encoded', () => {
  const u = new URL(H.searchUrl("World's Greatest Stretch", 'mobility'));
  assert.strictEqual(u.origin + u.pathname, 'https://www.youtube.com/results');
  assert.strictEqual(u.searchParams.get('search_query'), "World's Greatest Stretch mobility how to");
});
test('the search wording fits the kind of movement', () => {
  const q = (name, kind) => new URL(H.searchUrl(name, kind)).searchParams.get('search_query');
  assert.ok(q('Barbell Squat', 'lift').endsWith('proper form'));
  assert.ok(q('Bear Crawl', 'ground').endsWith('animal flow tutorial'));
  assert.ok(q('Warrior II', 'yoga').endsWith('yoga tutorial'));
  assert.ok(q('Burpees', 'conditioning').endsWith('how to'));
});
test('special characters in a name cannot break out of the link', () => {
  const url = H.searchUrl('Curl & "x" <script>#', 'lift');
  const u = new URL(url);
  assert.strictEqual(u.hostname, 'www.youtube.com');
  assert.ok(!url.includes('<') && !url.includes('"') && !url.includes(' '));
  assert.strictEqual(u.searchParams.get('search_query'), 'Curl & "x" <script># proper form');
});
test('kind for exercises we have no entry for falls back to the muscle group', () => {
  assert.strictEqual(H.kindOf('My Own Stretch', 'mobility'), 'mobility');
  assert.strictEqual(H.kindOf('My Own Sprint', 'hiit'), 'conditioning');
  assert.strictEqual(H.kindOf('My Own Press', 'chest'), 'lift');
});

/* ---------- links people type in themselves ---------- */
test('safeLink accepts normal web links and tidies them', () => {
  assert.strictEqual(H.safeLink('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  assert.strictEqual(H.safeLink('youtube.com/watch?v=abc'), 'https://youtube.com/watch?v=abc');
  assert.strictEqual(H.safeLink('  http://example.com/a b  '), 'http://example.com/a%20b');
});
test('safeLink rejects anything that is not a plain web link', () => {
  ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/x', 'file:///etc/passwd', 'vbscript:x', '', null, undefined, 'not a link', 'localhost', 'a'.repeat(500), 'https://'].forEach((bad) => assert.strictEqual(H.safeLink(bad), null, String(bad).slice(0, 30)));
});

/* ---------- flows ---------- */
test('there are flows for mobility, ground flow and yoga', () => {
  const kinds = new Set(F.FLOWS.map((f) => f.kind));
  ['mobility', 'ground', 'yoga'].forEach((k) => assert.ok(kinds.has(k), k));
  assert.ok(F.FLOWS.length >= 8);
});
test('flow ids and names are unique', () => {
  assert.strictEqual(new Set(F.FLOWS.map((f) => f.id)).size, F.FLOWS.length);
  assert.strictEqual(new Set(F.FLOWS.map((f) => f.name)).size, F.FLOWS.length);
});
test('every move in every flow exists in the library and has instructions', () => {
  F.FLOWS.forEach((f) =>
    f.moves.forEach((mv) => {
      assert.ok(library.some((e) => e.name === mv.ex), `${f.name}: "${mv.ex}" is not in the exercise library`);
      assert.ok(H.get(mv.ex), `${f.name}: "${mv.ex}" has no how-to`);
    })
  );
});
test('every move has a sensible duration and a short cue', () => {
  F.FLOWS.forEach((f) =>
    f.moves.forEach((mv) => {
      assert.ok(mv.secs >= 5 && mv.secs <= 120, `${f.name} / ${mv.ex}: ${mv.secs}s`);
      assert.ok(mv.cue && mv.cue.length <= 110, `${f.name} / ${mv.ex}: cue`);
    })
  );
});
test('each flow is between 3 and 12 minutes of movement', () => {
  F.FLOWS.forEach((f) => {
    const mins = F.moveSeconds(f) / 60;
    assert.ok(mins >= 3 && mins <= 12, `${f.name}: ${mins.toFixed(1)} min`);
  });
});
test('segments: "each" moves become right then left, and rounds repeat', () => {
  const morning = F.byId('morning-reset');
  const segs = F.segments(morning);
  const needle = segs.filter((s) => s.ex === 'Thread the Needle');
  assert.deepStrictEqual(needle.map((s) => s.side), ['Right', 'Left']);
  assert.ok(segs.filter((s) => s.ex === 'Cat-Cow').every((s) => s.side === null));
  const sun = F.byId('sun-salutation');
  assert.strictEqual(F.segments(sun).length, sun.moves.length * 3);
  assert.strictEqual(F.segments(sun).filter((s) => s.round === 3).length, sun.moves.length);
});
test('segment numbering is consistent', () => {
  F.FLOWS.forEach((f) => {
    F.segments(f).forEach((s) => {
      assert.ok(s.step >= 1 && s.step <= s.steps && s.round >= 1 && s.round <= s.rounds);
      assert.strictEqual(s.steps, f.moves.length);
    });
  });
});
test('total time = movement + the get-ready countdown', () => {
  const f = F.byId('pre-lift');
  assert.strictEqual(F.totalSeconds(f), F.moveSeconds(f) + F.PREP_SECONDS);
  // 30 + 60 + 60 + 60 + 60 + 30
  assert.strictEqual(F.moveSeconds(f), 300);
  assert.strictEqual(F.minutes(f), 5);
});
test('byId finds a flow and returns null for an unknown one', () => {
  assert.strictEqual(F.byId('warrior').name, 'Warrior Strength Flow');
  assert.strictEqual(F.byId('nope'), null);
});

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`All ${passed} how-to and flow tests passed`);
