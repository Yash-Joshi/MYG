/* GymBoy – how-to instructions: strength exercises.
 * Plain-language, general guidance. Have a coach or physio review before launch. */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});
  const D = (GB.howtoData = GB.howtoData || {});
  const add = (name, steps, cues, avoid, easier, harder, extra) => {
    D[name] = Object.assign({ steps, cues, avoid, easier: easier || null, harder: harder || null, dose: null, kind: 'lift' }, extra || {});
  };

  /* ---------------- chest ---------------- */
  add('Barbell Bench Press',
    ['Lie back with your eyes under the bar, feet flat on the floor, shoulder blades pulled together and down.', 'Grip just wider than your shoulders, unrack, and lower the bar to your mid-chest with your elbows about 45° from your sides.', 'Press the bar up until your arms are straight, keeping your wrists over your elbows.'],
    ['Shoulder blades stay pinched the whole set', 'Feet planted, drive them into the floor'],
    ['Bouncing the bar off your chest', 'Flaring your elbows out to 90°'],
    'Dumbbell bench press or push-ups', 'Pause for a second on the chest, or add weight');
  add('Incline Barbell Bench Press',
    ['Set the bench to about 30°. Lie back, shoulder blades pulled together, feet flat.', 'Unrack the bar over your upper chest and lower it to just below your collarbone.', 'Press straight up until your arms lock out.'],
    ['Keep your chest up', 'Bar path is a slight arc, not a straight line'],
    ['Setting the bench too steep (it turns into a shoulder press)', 'Lifting your hips off the bench'],
    'Incline dumbbell press with lighter weight', 'Slow 3-second lowering');
  add('Decline Bench Press',
    ['Lie on a decline bench with your feet secured and shoulder blades pulled together.', 'Unrack the bar and lower it to your lower chest under control.', 'Press back up until your arms are straight.'],
    ['Control the bar on the way down', 'Elbows about 45° from your body'],
    ['Letting the bar drift toward your face', 'Lowering too fast with a heavy load'],
    'Flat dumbbell press', 'Add weight with a spotter');
  add('Dumbbell Bench Press',
    ['Sit with the dumbbells on your thighs, then lie back and kick them up to chest height.', 'Lower the dumbbells until your upper arms are about level with the bench, elbows about 45° from your sides.', 'Press up and slightly inward until your arms are straight.'],
    ['Wrists stacked over elbows', 'Shoulder blades pinched and down'],
    ['Letting the dumbbells drift far apart', 'Dropping them too deep and straining your shoulders'],
    'Push-ups or a machine press', 'Slow lowering, or a single-arm version');
  add('Incline Dumbbell Press',
    ['Set the bench to about 30° and sit with the dumbbells on your thighs, then lie back.', 'Lower the dumbbells to the sides of your upper chest, elbows about 45° from your body.', 'Press up until your arms are straight, bringing the dumbbells together over your chest.'],
    ['Keep your chest tall', 'Press in a gentle arc'],
    ['A bench angle above 45°', 'Arching your lower back off the bench'],
    'Lighter dumbbells or a machine press', 'Pause at the bottom for a second');
  add('Machine Chest Press',
    ['Adjust the seat so the handles line up with the middle of your chest.', 'Sit back with your shoulder blades against the pad and grip the handles.', 'Press forward until your arms are nearly straight, then return slowly.'],
    ['Back stays against the pad', 'Smooth, controlled return'],
    ['A seat set too high or low', 'Letting the weight stack slam between reps'],
    'Lower the weight and slow down', 'Slower lowering or a pause at the end');
  add('Dumbbell Fly',
    ['Lie on a flat bench holding dumbbells over your chest, palms facing each other, elbows slightly bent.', 'Open your arms in a wide arc until you feel a stretch across your chest.', 'Squeeze to bring the dumbbells back together over your chest, keeping the same elbow bend.'],
    ['Think "hug a big tree"', 'Keep the elbow bend fixed'],
    ['Straightening your arms (turns it into a press)', 'Going so heavy you lose control'],
    'Lighter weights or a cable crossover', 'Slow, 3-second opening');
  add('Incline Dumbbell Fly',
    ['Set the bench to about 30° and lie back with dumbbells over your chest, palms facing each other.', 'With a slight bend in your elbows, open your arms wide until you feel the stretch.', 'Bring the dumbbells back together in the same arc.'],
    ['Stay light and controlled', 'Elbows slightly bent throughout'],
    ['Lowering past shoulder level', 'Using momentum to swing up'],
    'Light weights or a pec deck', 'Pause in the stretched position');
  add('Cable Crossover',
    ['Set the pulleys high and stand in the middle with one foot forward, leaning slightly forward.', 'With a soft bend in your elbows, pull the handles down and together in front of your hips.', 'Squeeze your chest, then let the handles return slowly until you feel a stretch.'],
    ['Lead with your elbows, not your hands', 'Keep your chest up'],
    ['Using your body to swing the weight', 'Bending and straightening your elbows'],
    'Pec deck machine', 'Pause with your hands together for 2 seconds');
  add('Pec Deck',
    ['Adjust the seat so the handles are at chest height and sit with your back against the pad.', 'Bring the handles together in front of your chest with a soft elbow bend.', 'Return slowly until you feel a gentle stretch, without letting your shoulders roll forward.'],
    ['Shoulder blades stay back on the pad', 'Squeeze at the middle'],
    ['Going so far back your shoulders strain', 'Letting the weights crash down'],
    'Lighter weight, shorter range', 'Pause at the squeeze');
  add('Chest Dips',
    ['Hold the dip bars with straight arms and lean your torso forward, knees bent behind you.', 'Lower until your upper arms are about parallel to the floor, elbows flaring slightly.', 'Press back up until your arms are straight.'],
    ['Lean forward to hit the chest', 'Stay in control at the bottom'],
    ['Dropping so low that your shoulders strain', 'Swinging your legs for momentum'],
    'Assisted dip machine or bench dips', 'Add a weight belt');
  add('Push-ups',
    ['Start in a plank with your hands slightly wider than your shoulders and your body in one straight line.', 'Lower your chest toward the floor, elbows about 45° from your sides.', 'Push the floor away until your arms are straight.'],
    ['Squeeze your glutes and abs', 'Whole body moves as one piece'],
    ['Sagging hips or a piking back', 'Flaring elbows straight out to the sides'],
    'Hands on a bench or knees on the floor', 'Feet raised, or a slow tempo');

  /* ---------------- back ---------------- */
  add('Deadlift',
    ['Stand with the bar over the middle of your feet, hip-width stance. Hinge down and grip the bar just outside your legs.', 'Pull your chest up, tighten your back, and take a big belly breath.', 'Push the floor away, keeping the bar against your legs, and stand tall.', 'Lower by hinging your hips back first, then bending your knees once the bar passes them.'],
    ['Bar stays touching your legs', 'Push the floor away rather than pulling with your back'],
    ['Rounding your lower back', 'Jerking the bar off the floor'],
    'Trap-bar or Romanian deadlift with lighter weight', 'Add weight gradually, or pause below the knee');
  add('Pull-ups',
    ['Hang from the bar with an overhand grip a little wider than your shoulders, arms straight, shoulders pulled down.', 'Pull your elbows down toward your ribs until your chin clears the bar.', 'Lower slowly until your arms are fully straight again.'],
    ['Lead with your chest', 'Control the lowering'],
    ['Kipping or swinging', 'Stopping short of full arm extension'],
    'Assisted pull-ups, or a band, or lat pulldown', 'Add a weight belt or slow the lowering');
  add('Chin-ups',
    ['Hang from the bar with an underhand, shoulder-width grip, arms straight.', 'Pull yourself up until your chin is over the bar, keeping your chest tall.', 'Lower under control to straight arms.'],
    ['Squeeze your shoulder blades down', 'Do not shrug up to your ears'],
    ['Swinging your legs', 'Cutting the range of motion short'],
    'Assisted chin-ups or an easier grip', 'Add weight or pause at the top');
  add('Lat Pulldown',
    ['Sit with your thighs under the pad and grip the bar wider than your shoulders.', 'Lean back slightly and pull the bar to your upper chest, driving your elbows down and back.', 'Let the bar rise under control until your arms are straight.'],
    ['Think "elbows to your back pockets"', 'Chest up'],
    ['Pulling the bar behind your neck', 'Leaning way back and swinging'],
    'Lighter weight with a slower pull', 'Pause at the chest for a second');
  add('Close-Grip Lat Pulldown',
    ['Attach a close or neutral-grip handle and sit with your thighs secured.', 'Lean back slightly and pull the handle to your upper chest, elbows tight to your sides.', 'Return slowly to a full stretch.'],
    ['Elbows travel down and slightly back', 'Keep your torso steady'],
    ['Using body swing to move the weight', 'Shrugging your shoulders'],
    'Lighter weight', 'Slow 3-second return');
  add('Barbell Row',
    ['Hinge at the hips with a flat back, knees soft, holding the bar just below your knees.', 'Pull the bar toward your lower ribs, driving your elbows back.', 'Lower under control until your arms are straight.'],
    ['Torso stays at the same angle', 'Squeeze your shoulder blades together'],
    ['Standing up as you pull', 'Rounding your lower back'],
    'Chest-supported row or dumbbell row', 'Pause at the top, or add weight');
  add('Dumbbell Row',
    ['Place one knee and hand on a bench, with a flat back and the dumbbell hanging from your free hand.', 'Pull the dumbbell toward your hip, keeping your elbow close to your body.', 'Lower slowly until your arm is straight.'],
    ['Pull with your elbow, not your hand', 'Hips and shoulders stay square'],
    ['Twisting your torso to lift', 'Shrugging your shoulder up'],
    'Lighter dumbbell or a seated cable row', 'Pause at the top');
  add('Seated Cable Row',
    ['Sit with your feet on the plates, knees slightly bent, and grip the handle with a tall, flat back.', 'Pull the handle to your lower ribs, squeezing your shoulder blades together.', 'Return slowly until your arms are straight, without rounding forward.'],
    ['Sit tall throughout', 'Elbows pass close to your sides'],
    ['Rocking your torso back and forth', 'Shrugging as you pull'],
    'Lighter weight', 'Pause for 2 seconds at the squeeze');
  add('T-Bar Row',
    ['Straddle the bar, hinge forward with a flat back, and grip the handles.', 'Pull the weight toward your chest, leading with your elbows.', 'Lower slowly until your arms are straight.'],
    ['Keep your chest up and back flat', 'Squeeze at the top'],
    ['Heaving the weight with your hips', 'Rounding your back'],
    'Chest-supported T-bar row', 'Add weight or pause at the top');
  add('Machine Row',
    ['Adjust the seat and chest pad so you can reach the handles with straight arms.', 'Pull the handles toward your torso, squeezing your shoulder blades together.', 'Return slowly to a full stretch.'],
    ['Chest stays on the pad', 'Pull with your back, not your arms'],
    ['Leaning back to cheat the weight', 'Shrugging'],
    'Lighter weight', 'Slow lowering');
  add('Chest-Supported Row',
    ['Lie face down on an incline bench with the dumbbells or bar hanging down.', 'Pull your elbows up and back, squeezing your shoulder blades.', 'Lower under control to a full stretch.'],
    ['Chest stays glued to the bench', 'Think elbows to the ceiling'],
    ['Lifting your chest off the pad', 'Using momentum'],
    'Lighter weights', 'Pause at the top');
  add('Straight-Arm Pulldown',
    ['Stand facing a high cable with a bar or rope, hinge slightly, and keep your arms nearly straight.', 'Sweep the bar down in an arc to your thighs, using your lats.', 'Let it rise back up slowly until you feel a stretch.'],
    ['Arms stay long, almost straight', 'Imagine pushing the bar down with your armpits'],
    ['Bending your elbows into a pushdown', 'Swinging with your hips'],
    'Lighter weight', 'Pause at the bottom for a second');
  add('Rack Pull',
    ['Set the bar on safety pins at knee height. Grip just outside your legs with a flat back.', 'Pull your chest up, tighten, then push your hips forward to stand tall.', 'Lower the bar under control back to the pins.'],
    ['Bar stays close to your legs', 'Finish by squeezing your glutes'],
    ['Leaning back at the top', 'Letting the bar crash onto the pins'],
    'Lighter weight or a higher pin setting', 'Add weight gradually');
  add('Face Pull',
    ['Set a rope at face height. Hold the ends with your thumbs back and step away, arms straight.', 'Pull the rope toward your face, splitting the ends apart and driving your elbows high and wide.', 'Return slowly with control.'],
    ['Elbows high, hands pulling apart', 'Squeeze your rear shoulders'],
    ['Going too heavy and leaning back', 'Pulling down to your chest'],
    'Lighter weight', 'Pause for 2 seconds at the back');
  add('Back Extension',
    ['Set the pad just below your hips and cross your arms over your chest.', 'Hinge forward from the hips with a flat back until you feel your hamstrings stretch.', 'Squeeze your glutes to come back up to a straight line, no further.'],
    ['Move from the hips', 'Stop when your body forms a straight line'],
    ['Over-arching your lower back at the top', 'Swinging up with momentum'],
    'Bodyweight, shorter range', 'Hold a plate to your chest');

  /* ---------------- shoulders ---------------- */
  add('Overhead Press',
    ['Hold the bar at your collarbone with your hands just outside your shoulders. Squeeze your glutes and brace your abs.', 'Press the bar straight up, moving your head back slightly so it clears your face.', 'Lock out overhead with the bar over your mid-foot, then lower back to your collarbone.'],
    ['Ribs down, do not lean back', 'Bar travels in a straight line'],
    ['Arching your lower back', 'Pressing the bar out in front of you'],
    'Dumbbell shoulder press or a machine', 'Push press or a pause at the top');
  add('Dumbbell Shoulder Press',
    ['Sit with a back pad and hold the dumbbells at shoulder height, palms forward.', 'Press them up until your arms are straight, bringing them close together overhead.', 'Lower slowly to shoulder height.'],
    ['Core braced, ribs down', 'Wrists stacked over elbows'],
    ['Arching your back', 'Flaring the dumbbells far out to the sides'],
    'Lighter dumbbells or a machine press', 'Standing version, or a slower lowering');
  add('Machine Shoulder Press',
    ['Adjust the seat so the handles start at shoulder height.', 'Press up until your arms are nearly straight.', 'Lower slowly back to the start.'],
    ['Back against the pad', 'Smooth press, do not slam the stack'],
    ['Shrugging as you press', 'Over-arching your back'],
    'Lower the weight', 'Slow lowering');
  add('Arnold Press',
    ['Sit holding dumbbells at chest height with your palms facing you.', 'As you press up, rotate your palms to face forward at the top.', 'Reverse the rotation as you lower the dumbbells back to your chest.'],
    ['Rotate smoothly, do not rush', 'Keep your core tight'],
    ['Going too heavy to rotate cleanly', 'Leaning back'],
    'Light dumbbells', 'Pause at the top');
  add('Dumbbell Lateral Raise',
    ['Stand with a dumbbell in each hand at your sides and a slight bend in your elbows.', 'Raise your arms out to the sides until they are about shoulder height.', 'Lower slowly under control.'],
    ['Lead with your elbows', 'Pour the water out of a jug at the top'],
    ['Swinging the weights up', 'Shrugging your shoulders'],
    'Lighter weights, or lean slightly on a bench', 'Pause at the top, or use cables');
  add('Cable Lateral Raise',
    ['Stand sideways to a low cable and hold the handle with your far hand, elbow slightly bent.', 'Raise your arm out and up to shoulder height.', 'Lower slowly, keeping tension on the cable.'],
    ['Slow and smooth', 'Do not lean away'],
    ['Using body momentum', 'Raising higher than shoulder height'],
    'Lighter weight', 'Pause at the top');
  add('Front Raise',
    ['Stand holding dumbbells in front of your thighs, palms facing you.', 'Raise one or both arms straight in front of you to about shoulder height.', 'Lower slowly.'],
    ['Ribs down, no leaning back', 'Arms stay nearly straight'],
    ['Swinging the weights', 'Lifting above shoulder height'],
    'Lighter weight, or alternate arms', 'Slow lowering');
  add('Rear Delt Fly',
    ['Hinge forward with a flat back, holding light dumbbells under your chest, elbows slightly bent.', 'Raise your arms out to the sides until they are about level with your back.', 'Lower slowly.'],
    ['Lead with your elbows', 'Squeeze your shoulder blades gently'],
    ['Using heavy weights and swinging', 'Rounding your back'],
    'Lighter weights, or chest-supported on a bench', 'Pause at the top');
  add('Reverse Pec Deck',
    ['Sit facing the pad with your chest against it and hold the handles with straight-ish arms.', 'Pull the handles out and back in a wide arc until your arms are in line with your shoulders.', 'Return slowly.'],
    ['Chest stays on the pad', 'Think about spreading your arms wide'],
    ['Shrugging your shoulders', 'Using too much weight'],
    'Lighter weight', 'Pause at the back');
  add('Upright Row',
    ['Hold a bar or dumbbells in front of your thighs with a shoulder-width grip.', 'Pull up toward your chest, leading with your elbows, stopping around chest height.', 'Lower slowly.'],
    ['Elbows stay higher than your hands', 'Stop before your shoulders feel pinched'],
    ['Pulling above chest height if it pinches', 'Swinging your body'],
    'Wider grip or a lateral raise', 'Slow lowering');
  add('Barbell Shrug',
    ['Stand holding a barbell in front of your thighs with arms straight.', 'Lift your shoulders straight up toward your ears.', 'Hold for a second, then lower slowly.'],
    ['Straight up, no rolling', 'Arms stay straight'],
    ['Rolling your shoulders', 'Bending your elbows'],
    'Dumbbell shrugs', 'Pause for 2 seconds at the top');
  add('Dumbbell Shrug',
    ['Stand with a dumbbell in each hand at your sides, arms straight.', 'Shrug your shoulders straight up toward your ears.', 'Hold briefly, then lower slowly.'],
    ['Think "shoulders to ears"', 'Keep your head neutral'],
    ['Rolling your shoulders', 'Using momentum'],
    'Lighter weight', 'Hold longer at the top');

  /* ---------------- biceps ---------------- */
  add('Barbell Curl',
    ['Stand holding a barbell at your thighs with an underhand, shoulder-width grip and your elbows at your sides.', 'Curl the bar up toward your shoulders without moving your elbows forward.', 'Lower slowly to straight arms.'],
    ['Elbows pinned to your sides', 'Stand tall'],
    ['Swinging your hips to lift', 'Letting your elbows drift forward'],
    'Dumbbell or cable curls', 'Slow 3-second lowering');
  add('EZ-Bar Curl',
    ['Hold an EZ-bar on the angled grips, elbows at your sides.', 'Curl up toward your shoulders.', 'Lower slowly until your arms are straight.'],
    ['Elbows stay still', 'Squeeze at the top'],
    ['Leaning back to swing the bar', 'Rushing the lowering'],
    'Lighter weight', 'Slower lowering');
  add('Dumbbell Curl',
    ['Stand with a dumbbell in each hand, palms facing forward, elbows at your sides.', 'Curl the dumbbells up toward your shoulders.', 'Lower slowly to straight arms.'],
    ['Elbows stay at your sides', 'Do not swing'],
    ['Using your back to swing the weights', 'Cutting the range short'],
    'Lighter dumbbells or seated', 'Alternate arms slowly, or add a pause');
  add('Hammer Curl',
    ['Stand holding dumbbells with your palms facing each other, elbows at your sides.', 'Curl the dumbbells up, keeping your thumbs pointing up.', 'Lower slowly.'],
    ['Neutral grip the whole time', 'Elbows stay still'],
    ['Swinging', 'Letting your wrists bend'],
    'Lighter weight', 'Cross-body hammer curl, or a slower tempo');
  add('Incline Dumbbell Curl',
    ['Sit back on a bench set to about 60° with the dumbbells hanging at your sides.', 'Curl up without moving your upper arms forward.', 'Lower slowly to a full stretch.'],
    ['Elbows stay behind your body', 'Feel the stretch at the bottom'],
    ['Letting your shoulders roll forward', 'Going too heavy'],
    'Lighter dumbbells', 'Pause at the bottom stretch');
  add('Preacher Curl',
    ['Rest your upper arms on the preacher pad and hold the bar with an underhand grip.', 'Curl up until your forearms are near vertical.', 'Lower slowly until your arms are nearly straight, without locking out hard.'],
    ['Upper arms stay on the pad', 'Control the bottom'],
    ['Dropping the weight at the bottom', 'Lifting your elbows off the pad'],
    'Lighter weight or a machine', 'Slow 3-second lowering');
  add('Cable Curl',
    ['Stand facing a low cable with a straight or EZ attachment, elbows at your sides.', 'Curl up toward your shoulders.', 'Lower slowly, keeping tension on the cable.'],
    ['Constant tension on the biceps', 'Do not lean back'],
    ['Swinging your body', 'Letting the weight stack rest between reps'],
    'Lighter weight', 'Pause at the top');
  add('Concentration Curl',
    ['Sit on a bench with your elbow braced against your inner thigh, holding a dumbbell at arm length.', 'Curl the dumbbell up toward your shoulder.', 'Lower slowly.'],
    ['Elbow stays fixed on your thigh', 'Squeeze at the top'],
    ['Swinging your torso', 'Using too heavy a weight'],
    'Lighter weight', 'Pause at the top');
  add('Spider Curl',
    ['Lie chest-down on an incline bench with your arms hanging straight down, holding dumbbells or a bar.', 'Curl up without your upper arms moving back.', 'Lower slowly to straight arms.'],
    ['Arms hang straight down', 'Squeeze at the top'],
    ['Using momentum', 'Lifting your chest off the bench'],
    'Lighter weights', 'Pause at the top');

  /* ---------------- triceps ---------------- */
  add('Triceps Pushdown',
    ['Stand facing a high cable with a bar or short handle, elbows tucked at your sides.', 'Push down until your arms are straight, squeezing your triceps.', 'Let the handle rise slowly until your forearms are about parallel to the floor.'],
    ['Elbows pinned to your sides', 'Only your forearms move'],
    ['Leaning over the bar and using your bodyweight', 'Letting your elbows flare'],
    'Lighter weight', 'Slow return, or single-arm version');
  add('Rope Pushdown',
    ['Hold a rope attachment on a high cable with your elbows tucked.', 'Push down and spread the rope ends apart at the bottom.', 'Return slowly until your forearms are about parallel to the floor.'],
    ['Spread the rope at the bottom', 'Elbows stay still'],
    ['Swinging your torso', 'Letting your elbows drift forward'],
    'Lighter weight', 'Pause at the bottom');
  add('Overhead Triceps Extension',
    ['Hold one dumbbell with both hands overhead, arms straight.', 'Lower the dumbbell behind your head by bending your elbows, keeping them pointing forward.', 'Straighten your arms to return.'],
    ['Elbows point at the ceiling', 'Keep your ribs down'],
    ['Flaring your elbows wide', 'Arching your lower back'],
    'Lighter weight, or a cable rope version', 'Single-arm, or a slower lowering');
  add('Skull Crushers',
    ['Lie on a bench holding an EZ-bar or dumbbells over your chest, arms straight.', 'Bend only at the elbows to lower the weight toward your forehead.', 'Straighten your arms to return.'],
    ['Upper arms stay still', 'Lower with control'],
    ['Letting your elbows flare out', 'Going too heavy'],
    'Lighter weight or cable extensions', 'Slower lowering');
  add('Close-Grip Bench Press',
    ['Lie on a bench and grip the bar shoulder-width, a little narrower than a regular bench press.', 'Lower the bar to your lower chest with your elbows close to your sides.', 'Press up until your arms are straight.'],
    ['Elbows tuck close', 'Wrists straight'],
    ['Using a grip so narrow it strains your wrists', 'Flaring your elbows'],
    'Push-ups with hands under your shoulders', 'Add weight or pause on the chest');
  add('Triceps Dips',
    ['Hold the dip bars with straight arms and keep your torso upright.', 'Lower until your upper arms are about parallel to the floor, elbows pointing back.', 'Press up until your arms are straight.'],
    ['Torso stays upright for triceps', 'Elbows point behind you'],
    ['Leaning forward (shifts to chest)', 'Dropping so low your shoulders strain'],
    'Assisted dip machine or bench dips', 'Add a weight belt');
  add('Bench Dips',
    ['Sit on a bench edge with your hands beside your hips and your legs out in front.', 'Slide your hips off the bench and lower by bending your elbows to about 90°.', 'Press back up until your arms are straight.'],
    ['Keep your hips close to the bench', 'Elbows point straight back'],
    ['Going so low your shoulders strain', 'Letting your shoulders roll forward'],
    'Bend your knees and keep your feet close', 'Feet elevated, or add weight on your lap');
  add('Triceps Kickback',
    ['Hinge forward with a flat back, upper arm tucked against your side and a dumbbell in your hand.', 'Straighten your arm backward until it is in line with your torso.', 'Return slowly to a 90° bend.'],
    ['Upper arm stays still', 'Squeeze at full extension'],
    ['Swinging the weight', 'Dropping your elbow'],
    'Lighter weight or a cable', 'Pause at the squeeze');
  add('Single-Arm Cable Extension',
    ['Stand facing a high cable and hold the handle with one hand, elbow tucked at your side.', 'Push down until your arm is straight.', 'Return slowly.'],
    ['Elbow stays pinned', 'Smooth and slow'],
    ['Leaning your whole body on it', 'Letting your elbow drift'],
    'Lighter weight', 'Pause at the bottom');

  /* ---------------- forearms ---------------- */
  add('Wrist Curl',
    ['Sit and rest your forearms on your thighs, palms up, holding a barbell or dumbbells with your wrists hanging off your knees.', 'Curl your wrists up toward the ceiling.', 'Lower slowly to a full stretch.'],
    ['Only your wrists move', 'Slow and controlled'],
    ['Lifting your forearms off your thighs', 'Using heavy weight with quick reps'],
    'Lighter weight', 'Slower tempo');
  add('Reverse Wrist Curl',
    ['Rest your forearms on your thighs, palms facing down, holding light weights with your wrists hanging off your knees.', 'Lift the back of your hands up toward the ceiling.', 'Lower slowly.'],
    ['Use a light weight', 'Move only your wrists'],
    ['Going too heavy', 'Jerky movements'],
    'Very light weight', 'Slower lowering');
  add('Reverse Curl',
    ['Hold a bar with an overhand grip at your thighs, elbows at your sides.', 'Curl up toward your shoulders, keeping your wrists straight.', 'Lower slowly.'],
    ['Wrists stay straight', 'Elbows pinned'],
    ['Swinging your body', 'Letting your wrists bend'],
    'Lighter weight or an EZ-bar', 'Slow lowering');
  add("Farmer's Walk",
    ['Pick up a heavy weight in each hand and stand tall with your shoulders back.', 'Walk with short, steady steps for the distance or time.', 'Set the weights down under control.'],
    ['Tall posture, ribs down', 'Squeeze the handles hard'],
    ['Leaning to one side', 'Rushing with long strides'],
    'Lighter weights', 'Heavier weights or a longer carry');

  /* ---------------- quads ---------------- */
  add('Barbell Squat',
    ['Set the bar on your upper back, grip it firmly, and step back with your feet shoulder-width apart, toes slightly out.', 'Take a big breath, brace your abs, and sit down and back, keeping your knees tracking over your toes.', 'Go as deep as you can with a flat back, then drive up through your whole foot.'],
    ['Chest up, brace before every rep', 'Knees follow your toes'],
    ['Heels lifting off the floor', 'Your knees collapsing inward'],
    'Goblet squat or box squat', 'Pause at the bottom, or add weight');
  add('Front Squat',
    ['Rest the bar on your front shoulders with your elbows high (or use crossed-arm grip).', 'Sit straight down between your knees, keeping your torso upright.', 'Drive up, keeping your elbows high.'],
    ['Elbows stay high', 'Stay tall through your chest'],
    ['Letting your elbows drop', 'Your torso folding forward'],
    'Goblet squat', 'Pause at the bottom');
  add('Leg Press',
    ['Sit with your back flat on the pad and place your feet shoulder-width on the platform.', 'Lower the platform until your knees are about 90°, without your lower back lifting.', 'Press up without locking your knees.'],
    ['Lower back stays on the pad', 'Push through your whole foot'],
    ['Locking your knees at the top', 'Going so deep your hips curl up'],
    'Lighter weight, shorter range', 'Slow lowering or a pause');
  add('Hack Squat',
    ['Stand on the platform with your back against the pad and feet shoulder-width.', 'Lower until your thighs are about parallel or a bit deeper.', 'Press up without locking out hard.'],
    ['Back stays flat on the pad', 'Knees track over your toes'],
    ['Locking your knees', 'Letting your heels lift'],
    'Lighter weight', 'Pause at the bottom');
  add('Leg Extension',
    ['Sit with the pad on your lower shins and your knees lined up with the machine pivot.', 'Straighten your legs until they are almost fully extended.', 'Lower slowly.'],
    ['Squeeze your quads at the top', 'Control the way down'],
    ['Kicking the weight up with momentum', 'Slamming the stack down'],
    'Lighter weight, one leg at a time', 'Pause for 2 seconds at the top');
  add('Bulgarian Split Squat',
    ['Stand a stride in front of a bench and rest the top of your back foot on it.', 'Lower straight down until your front thigh is about parallel.', 'Drive up through your front foot.'],
    ['Torso upright, front foot flat', 'Control the descent'],
    ['Standing too close to the bench', 'Letting your front knee cave in'],
    'Bodyweight, or a split squat without the bench', 'Hold dumbbells, or a slower lowering');
  add('Walking Lunges',
    ['Stand tall and step forward into a long stride.', 'Lower your back knee toward the floor, keeping your torso upright.', 'Push through your front foot and step into the next lunge.'],
    ['Long enough stride that your front knee stays over your ankle', 'Stay tall'],
    ['Short steps that jam your knee forward', 'Rushing without control'],
    'Reverse lunges in place', 'Hold dumbbells');
  add('Goblet Squat',
    ['Hold a dumbbell or kettlebell against your chest with both hands.', 'Sit straight down between your knees, elbows inside your thighs, keeping your chest up.', 'Stand back up through your whole foot.'],
    ['Chest up, weight close to your body', 'Elbows push your knees out'],
    ['Heels lifting', 'Folding forward'],
    'Squat to a box', 'Heavier weight, or a pause at the bottom');
  add('Step-ups',
    ['Stand in front of a sturdy box or bench and place one whole foot on top.', 'Drive through that foot to stand tall on the box.', 'Lower slowly back down and repeat on the same leg, then switch.'],
    ['Push through the top foot, not the back one', 'Stand fully tall at the top'],
    ['Pushing off the back leg', 'A box so high your form breaks'],
    'A lower step', 'Hold dumbbells or use a higher box');

  /* ---------------- hamstrings ---------------- */
  add('Romanian Deadlift',
    ['Stand holding a bar or dumbbells at your thighs, knees slightly bent.', 'Push your hips straight back, sliding the weight down your legs with a flat back, until you feel a hamstring stretch.', 'Drive your hips forward to stand tall.'],
    ['Hips go back, not down', 'Weight stays close to your legs'],
    ['Rounding your back', 'Bending your knees into a squat'],
    'Lighter weight or a dumbbell version', 'Heavier, or a slow lowering');
  add('Stiff-Leg Deadlift',
    ['Stand holding the weight with your knees only slightly bent.', 'Hinge forward at the hips with a flat back until you feel a deep hamstring stretch.', 'Stand back up by driving your hips forward.'],
    ['Flat back, long spine', 'Feel the stretch in your hamstrings'],
    ['Rounding your lower back', 'Going lower than your flexibility allows'],
    'Romanian deadlift with a bit more knee bend', 'Slower lowering');
  add('Lying Leg Curl',
    ['Lie face down with the pad just above your heels and your hips pressed into the bench.', 'Curl your heels toward your glutes.', 'Lower slowly to straight legs.'],
    ['Hips stay down', 'Slow lowering'],
    ['Lifting your hips', 'Swinging the weight'],
    'Lighter weight, one leg', 'Slow 3-second lowering');
  add('Seated Leg Curl',
    ['Sit with the pad above your heels and the thigh pad snug.', 'Curl your heels down and back under the seat.', 'Return slowly.'],
    ['Back against the pad', 'Control the return'],
    ['Jerking the weight', 'Letting the stack crash'],
    'Lighter weight', 'Pause at the bottom');
  add('Good Morning',
    ['Stand with a bar on your upper back and your knees slightly bent.', 'Push your hips back, hinging forward with a flat back until your torso is near parallel to the floor.', 'Drive your hips forward to stand tall.'],
    ['Hips back, spine long', 'Light weight first'],
    ['Rounding your back', 'Going heavy too soon'],
    'Bodyweight, or a Romanian deadlift', 'Heavier gradually');
  add('Glute-Ham Raise',
    ['Set up on the machine with your feet locked in and your thighs on the pad.', 'Lower your torso down under control with a straight body.', 'Curl back up using your hamstrings and glutes.'],
    ['Body stays in one line', 'Squeeze your glutes'],
    ['Folding at the hips', 'Using your arms to push up'],
    'Use a band for help, or hamstring curls', 'Hold a plate to your chest');

  /* ---------------- glutes ---------------- */
  add('Hip Thrust',
    ['Sit with your upper back against a bench and a bar or dumbbell across your hips, feet flat and knees bent.', 'Drive through your heels to lift your hips until your body is in a straight line from shoulders to knees.', 'Squeeze your glutes, then lower slowly.'],
    ['Chin tucked, ribs down', 'Squeeze at the top'],
    ['Over-arching your lower back at the top', 'Pushing through your toes'],
    'Glute bridge, bodyweight', 'Add weight, or pause at the top');
  add('Glute Bridge',
    ['Lie on your back with your knees bent and feet flat, hip-width apart.', 'Press through your heels to lift your hips until your body forms a straight line.', 'Squeeze your glutes at the top, then lower slowly.'],
    ['Heels push the floor away', 'Ribs down'],
    ['Over-arching your lower back', 'Pushing with your toes'],
    'Smaller range of motion', 'Single-leg bridge, or add weight');
  add('Cable Kickback',
    ['Attach an ankle strap to a low cable and face the machine, holding it for balance.', 'Kick your leg straight back, squeezing your glute.', 'Return slowly without letting your torso swing.'],
    ['Move from your hip, not your lower back', 'Squeeze at the top'],
    ['Arching your back to lift higher', 'Swinging the weight'],
    'Lighter weight', 'Pause at the top');
  add('Sumo Deadlift',
    ['Stand with a wide stance, toes pointed out, and grip the bar inside your legs.', 'Pull your chest up, push your knees out, and brace your abs.', 'Push the floor away and stand tall, keeping the bar against your legs.'],
    ['Knees track over your toes', 'Chest up, hips close to the bar'],
    ['Letting your knees cave in', 'Rounding your back'],
    'Lighter weight or a kettlebell sumo deadlift', 'Add weight gradually');
  add('Hip Abduction Machine',
    ['Sit upright with the pads on the outside of your knees.', 'Press your knees out and apart against the pads.', 'Return slowly with control.'],
    ['Sit tall', 'Slow, controlled return'],
    ['Using momentum', 'Slamming the pads together'],
    'Lighter weight', 'Pause at the widest point');

  /* ---------------- calves ---------------- */
  add('Standing Calf Raise',
    ['Stand with the balls of your feet on a step or machine platform and your heels hanging off.', 'Lower your heels for a full stretch.', 'Rise as high as you can onto your toes, pause, then lower slowly.'],
    ['Full stretch at the bottom', 'Pause at the top'],
    ['Bouncing through the reps', 'Short range of motion'],
    'Both feet on the floor, bodyweight', 'Single-leg, or add weight');
  add('Seated Calf Raise',
    ['Sit with the pads on your lower thighs and the balls of your feet on the platform.', 'Lower your heels for a full stretch.', 'Press up onto your toes, pause, then lower slowly.'],
    ['Full stretch, full squeeze', 'Slow tempo'],
    ['Bouncing at the bottom', 'Partial reps'],
    'Lighter weight', 'Pause for 2 seconds at the top');
  add('Leg Press Calf Raise',
    ['Sit in the leg press with your feet low on the platform and legs almost straight, heels hanging off.', 'Lower your heels for a stretch.', 'Press through the balls of your feet, pause, then return slowly.'],
    ['Do not lock your knees', 'Full range'],
    ['Letting your knees bend and straighten', 'Bouncing'],
    'Lighter weight', 'Slow tempo or single-leg');

  /* ---------------- core ---------------- */
  add('Plank',
    ['Rest on your forearms with your elbows under your shoulders and your legs straight behind you.', 'Squeeze your glutes and abs so your body is in one straight line.', 'Hold, breathing steadily.'],
    ['Imagine pulling your elbows toward your toes', 'Neutral neck'],
    ['Sagging or piking your hips', 'Holding your breath'],
    'Plank on your knees, or hands on a bench', 'Longer holds, or lift one foot', { dose: 'Hold 20 to 60 seconds', kind: 'core' });
  add('Hanging Leg Raise',
    ['Hang from a bar with straight arms and your shoulders pulled down.', 'Raise your legs (or knees) up in front of you, curling your pelvis toward your ribs.', 'Lower slowly without swinging.'],
    ['Curl your pelvis up, not just your legs', 'Control the swing'],
    ['Swinging for momentum', 'Letting your shoulders shrug up'],
    'Bent-knee raises', 'Straight legs up to the bar');
  add('Cable Crunch',
    ['Kneel facing a high cable holding a rope beside your head.', 'Curl your ribs toward your pelvis, rounding your spine.', 'Return slowly without letting your hips move.'],
    ['Hips stay still', 'Crunch with your abs, not your arms'],
    ['Pulling with your arms', 'Sitting back onto your heels'],
    'Lighter weight, or floor crunches', 'Pause at the bottom');
  add('Ab Wheel Rollout',
    ['Kneel with the wheel under your shoulders and brace your abs.', 'Roll forward slowly as far as you can keep your back flat.', 'Pull the wheel back by squeezing your abs.'],
    ['Ribs down, glutes tight', 'Go only as far as you can control'],
    ['Letting your lower back sag', 'Going too far too soon'],
    'Rollouts against a wall, or a plank', 'Rollouts from your feet');
  add('Crunches',
    ['Lie on your back with your knees bent and your hands by your head.', 'Curl your shoulders off the floor, exhaling as you crunch.', 'Lower slowly.'],
    ['Small, controlled curl', 'Exhale at the top'],
    ['Pulling on your neck', 'Using momentum'],
    'Dead bug or reduced range', 'Hold a weight, or slow the lowering');
  add('Russian Twist',
    ['Sit with your knees bent and lean back slightly, with a long spine.', 'Rotate your torso from side to side, tapping or moving a weight beside each hip.', 'Keep your chest up the whole time.'],
    ['Rotate from your ribs, not just your arms', 'Chest stays tall'],
    ['Rounding your back', 'Rushing the reps'],
    'Feet on the floor', 'Lift your feet or hold a weight');
  add('Decline Sit-ups',
    ['Lock your feet on a decline bench and cross your arms over your chest.', 'Curl up until your torso is upright.', 'Lower slowly to just above the bench.'],
    ['Curl up one vertebra at a time', 'Controlled lowering'],
    ['Yanking on your neck', 'Dropping back fast'],
    'Flat-bench sit-ups', 'Hold a plate to your chest');
})(typeof window !== 'undefined' ? window : globalThis);
