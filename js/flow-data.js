/* GymBoy – guided flows: the ready-made sequences, as plain data (no UI).
 *
 * A flow is a list of moves, each a name from the exercise library with a duration and a short cue.
 * `each: true` means "this long on the right, then the same on the left". `rounds` repeats the list.
 * The player (js/flows.js) walks through the segments this file builds.
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  const m = (ex, secs, cue, each) => ({ ex, secs, cue, each: !!each });

  const FLOWS = [
    {
      id: 'morning-reset', name: 'Morning Reset', kind: 'mobility', level: 'Easy', rounds: 1,
      blurb: 'Wake up your spine and hips in about 5 minutes.',
      moves: [
        m("Child's Pose", 30, 'Sink your hips back and breathe into your back.'),
        m('Cat-Cow', 45, 'Inhale, arch and look up. Exhale, round and tuck.'),
        m('Thread the Needle', 30, 'Slide one arm under, rest your shoulder, and breathe.', true),
        m("World's Greatest Stretch", 35, 'Rotate open, follow your hand with your eyes.', true),
        m('Deep Squat Hold', 40, 'Heels down, chest tall, elbows press your knees out.'),
        m('Standing Forward Fold', 30, 'Soft knees. Let your head hang heavy.'),
      ],
    },
    {
      id: 'hips-open', name: 'Hips Open Flow', kind: 'mobility', level: 'Medium', rounds: 1,
      blurb: 'Release tight hips and groins. Good after sitting all day.',
      moves: [
        m('90/90 Hip Switch', 60, 'Sit tall and switch sides slowly.'),
        m('Half-Kneeling Hip Flexor Stretch', 45, 'Tuck your tailbone, squeeze your back glute.', true),
        m('Cossack Squat', 40, 'Shift side to side, heel of the bent leg stays down.', true),
        m('Pigeon Pose', 60, 'Keep your hips level. Fold forward if it feels okay.', true),
        m('Frog Stretch', 60, 'Knees wide, hips back. Breathe slowly.'),
        m('Deep Squat Hold', 45, 'Use your elbows to open your knees.'),
      ],
    },
    {
      id: 'spine-shoulders', name: 'Spine & Shoulders', kind: 'mobility', level: 'Easy', rounds: 1,
      blurb: 'Free up your upper back and shoulders, great for desk days.',
      moves: [
        m('Cat-Cow', 45, 'Move through your whole spine with your breath.'),
        m('Open Book Rotation', 40, 'Open your top arm and follow it with your eyes.', true),
        m('Shoulder CARs', 40, 'Slow, big circles. Keep your ribs still.', true),
        m('Wall Slides', 45, 'Back flat to the wall. Slide up only as far as you control.'),
        m('Thread the Needle', 30, 'Relax your neck and shoulder into the floor.', true),
        m("Child's Pose", 40, 'Long exhale. Let your upper back soften.'),
      ],
    },
    {
      id: 'pre-lift', name: 'Pre-Lift Warm-up', kind: 'mobility', level: 'Easy', rounds: 1,
      blurb: 'A quick 5-minute prep before you train.',
      moves: [
        m('Cat-Cow', 30, 'Warm up your spine gently.'),
        m("World's Greatest Stretch", 30, 'Open your hips and spine together.', true),
        m('Hip CARs', 30, 'Slow circles, torso still.', true),
        m('Shoulder CARs', 30, 'As big as you can, with control.', true),
        m('Ankle Rocks', 30, 'Knee to the wall, heel stays down.', true),
        m('Deep Squat Hold', 30, 'Find your depth and breathe.'),
      ],
    },
    {
      id: 'animal-basics', name: 'Animal Flow Basics', kind: 'ground', level: 'Medium', rounds: 1,
      blurb: 'Floor-based movement that builds strength and control.',
      moves: [
        m('Beast Hold', 30, 'Knees hover, back flat, breathe steadily.'),
        m('Crab Reach', 30, 'Hips up, reach across and follow your hand.', true),
        m('Scorpion Reach', 30, 'Rotate from your hips. Go slowly.', true),
        m('Lizard Crawl', 40, 'Stay low and step smoothly.'),
        m('Bear Crawl', 40, 'Small steps, back flat.'),
        m('Side Kick-Through', 30, 'Strong base hand, rotate your chest.', true),
        m("Child's Pose", 40, 'Rest and let your breathing settle.'),
      ],
    },
    {
      id: 'ground-circuit', name: 'Ground Flow Circuit', kind: 'ground', level: 'Hard', rounds: 2,
      blurb: 'Two rounds of continuous ground movement. Builds stamina.',
      moves: [
        m('Beast Hold', 20, 'Reset your base and breathe.'),
        m('Bear Crawl', 30, 'Move with control, hips level.'),
        m('Lizard Crawl', 30, 'Keep your hips low.'),
        m('Crab Reach', 20, 'Lift your hips and reach.', true),
        m('Side Kick-Through', 20, 'Smooth transitions.', true),
        m('Scorpion Reach', 20, 'Slow and controlled.', true),
      ],
    },
    {
      id: 'sun-salutation', name: 'Sun Salutation Flow', kind: 'yoga', level: 'Easy', rounds: 3,
      blurb: 'Three rounds of a classic flowing sequence, one breath per move.',
      moves: [
        m('Mountain Pose', 10, 'Stand tall and breathe in.'),
        m('Upward Salute', 8, 'Inhale, arms up.'),
        m('Standing Forward Fold', 10, 'Exhale, fold forward with soft knees.'),
        m('Half Lift', 6, 'Inhale, flat back, look forward.'),
        m('Plank', 12, 'Step back, long line from head to heels.'),
        m('Low Cobra', 10, 'Lower down, lift your chest gently.'),
        m('Downward Dog', 25, 'Press back and lengthen. Breathe five times.'),
        m('Half Lift', 6, 'Step forward, flat back.'),
        m('Standing Forward Fold', 10, 'Exhale and fold.'),
        m('Upward Salute', 8, 'Rise up with your arms.'),
      ],
    },
    {
      id: 'warrior', name: 'Warrior Strength Flow', kind: 'yoga', level: 'Medium', rounds: 1,
      blurb: 'Standing poses that build leg strength and balance.',
      moves: [
        m('Mountain Pose', 15, 'Ground through your feet.'),
        m('Chair Pose', 20, 'Sit back, weight in your heels, arms up.'),
        m('Low Lunge', 25, 'Sink your hips forward and keep your front knee over your ankle.', true),
        m('Warrior II', 25, 'Arms wide, front knee over your second toe.', true),
        m('Downward Dog', 30, 'Press back and breathe.'),
        m("Child's Pose", 30, 'Rest and breathe slowly.'),
      ],
    },
    {
      id: 'cool-down', name: 'Cool-down & Breathe', kind: 'mobility', level: 'Easy', rounds: 1,
      blurb: 'Slow stretches to finish your session.',
      moves: [
        m("Child's Pose", 60, 'Slow breaths in through your nose, out through your mouth.'),
        m('Pigeon Pose', 45, 'Relax your hips toward the floor.', true),
        m('Supine Twist', 40, 'Let gravity do the work. Keep your shoulders down.', true),
        m('Happy Baby', 45, 'Rock gently side to side.'),
      ],
    },
  ];

  const KIND_LABEL = { mobility: 'Mobility', ground: 'Ground flow', yoga: 'Yoga-style' };
  const PREP_SECONDS = 5;

  /**
   * The segments the player walks through, in order. A move marked `each` becomes two segments
   * (Right, then Left). `step` counts moves within a round, `steps` is how many there are.
   */
  function segments(flow) {
    const out = [];
    const rounds = flow.rounds || 1;
    for (let r = 1; r <= rounds; r++) {
      flow.moves.forEach((mv, i) => {
        const sides = mv.each ? ['Right', 'Left'] : [null];
        sides.forEach((side) => out.push({ ex: mv.ex, secs: mv.secs, side, cue: mv.cue, step: i + 1, steps: flow.moves.length, round: r, rounds }));
      });
    }
    return out;
  }

  // seconds of actual movement (no get-ready countdown)
  const moveSeconds = (flow) => segments(flow).reduce((n, s) => n + s.secs, 0);
  const totalSeconds = (flow) => moveSeconds(flow) + PREP_SECONDS;
  const minutes = (flow) => Math.round(moveSeconds(flow) / 60);

  GB.flowData = { FLOWS, KIND_LABEL, PREP_SECONDS, segments, moveSeconds, totalSeconds, minutes, byId: (id) => FLOWS.find((f) => f.id === id) || null };
  if (typeof module !== 'undefined' && module.exports) module.exports = GB.flowData;
})(typeof window !== 'undefined' ? window : globalThis);
