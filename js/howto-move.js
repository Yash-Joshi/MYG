/* GymBoy – how-to instructions: conditioning (HIIT), mobility, ground flow and yoga-style moves.
 * Plain-language, general guidance. Have a coach or physio review before launch. */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});
  const D = (GB.howtoData = GB.howtoData || {});
  const add = (kind, name, dose, steps, cues, avoid, easier, harder) => {
    D[name] = { steps, cues, avoid, easier: easier || null, harder: harder || null, dose, kind };
  };
  const hiit = (name, dose, steps, cues, avoid, easier, harder) => add('conditioning', name, dose, steps, cues, avoid, easier, harder);
  const mob = (name, dose, steps, cues, avoid, easier, harder) => add('mobility', name, dose, steps, cues, avoid, easier, harder);
  const gnd = (name, dose, steps, cues, avoid, easier, harder) => add('ground', name, dose, steps, cues, avoid, easier, harder);
  const yog = (name, dose, steps, cues, avoid, easier, harder) => add('yoga', name, dose, steps, cues, avoid, easier, harder);

  /* ================= conditioning (HIIT) ================= */
  hiit('Burpees', '20 to 40 seconds of work, or 8 to 12 reps',
    ['Stand tall, then squat and place your hands on the floor.', 'Jump or step your feet back into a plank.', 'Lower your chest to the floor (optional), then push back up.', 'Jump your feet to your hands and finish with a small jump, arms overhead.'],
    ['Keep a steady rhythm', 'Land softly on the balls of your feet'],
    ['Letting your hips sag in the plank', 'Rushing until your form falls apart'],
    'Step back and forward instead of jumping, skip the push-up', 'Add a tuck jump or a push-up with a clap');
  hiit('Kettlebell Swings', '20 to 40 seconds of work, or 12 to 20 reps',
    ['Stand with your feet a little wider than your shoulders and the kettlebell a foot in front of you. Hinge and grip it with both hands.', 'Hike the bell back between your legs, then snap your hips forward to stand tall.', 'Let the bell float to chest height, then hinge back as it drops.'],
    ['Hips do the work, arms are just ropes', 'Stand fully tall at the top'],
    ['Squatting the swing instead of hinging', 'Lifting the bell with your arms or shoulders'],
    'Deadlift the weight, or use a lighter bell', 'A heavier bell, or single-arm swings');
  hiit('Battle Ropes', '20 to 40 seconds of work',
    ['Stand in a half squat, feet shoulder-width, holding an end of the rope in each hand.', 'Raise and drop your arms alternately to make waves along the rope.', 'Keep your chest up and your core braced throughout.'],
    ['Small, fast waves from your shoulders', 'Stay low and tall through your chest'],
    ['Standing straight up and just flapping your arms', 'Holding your breath'],
    'Slower waves, shorter intervals', 'Double-arm slams or jumping waves');
  hiit('Jump Rope', '30 to 60 seconds of work',
    ['Hold the handles at hip height with your elbows close to your sides.', 'Turn the rope with your wrists, not your whole arms.', 'Hop lightly on the balls of your feet, just high enough to clear the rope.'],
    ['Small hops, relaxed shoulders', 'Eyes forward'],
    ['Jumping too high', 'Big arm circles'],
    'Practise the hops without a rope', 'Double-unders or alternate-foot steps');
  hiit('Assault Bike Sprints', '10 to 30 seconds all-out, then rest',
    ['Set the seat so your knee is slightly bent at the bottom of the pedal stroke.', 'Push and pull the handles while you pedal, using your arms and legs together.', 'Sprint hard for the interval, then slow right down to recover.'],
    ['Drive with your legs, assist with your arms', 'Breathe out hard on the effort'],
    ['A seat that is too low', 'Starting at full speed before warming up'],
    'Steady pace or shorter sprints', 'Longer or harder sprints with shorter rest');
  hiit('Rowing Machine Sprints', '20 to 40 seconds of work',
    ['Sit with your shins vertical, your arms straight, and your back flat.', 'Drive with your legs first, then lean back slightly, then pull the handle to your lower ribs.', 'Return in reverse: arms out, torso forward, then bend your knees.'],
    ['Legs, then body, then arms', 'Arms away first on the way back'],
    ['Pulling with your arms before your legs push', 'Rounding your back'],
    'Lower resistance and a steady rate', 'Higher stroke rate or longer sprints');
  hiit('Ski Erg Sprints', '20 to 40 seconds of work',
    ['Stand tall with your feet hip-width, holding the handles above your head.', 'Hinge slightly at the hips and pull the handles down past your thighs, bending your knees a little.', 'Stand tall again as your arms return overhead.'],
    ['Use your hips and lats, not just your arms', 'Smooth, rhythmic pulls'],
    ['Staying stiff and only using your arms', 'Rounding your back'],
    'Lower damper setting', 'Higher damper or longer intervals');
  hiit('Treadmill Sprints', '10 to 30 seconds fast, then walk',
    ['Attach the safety clip. Start the belt slowly and warm up at a jog first.', 'Increase the speed to a hard but controlled sprint and keep your eyes forward.', 'Slow to a walk to recover, and only step off when the belt has nearly stopped.'],
    ['Light, quick steps', 'Relaxed shoulders'],
    ['Skipping the warm-up', 'Looking down at your feet'],
    'Fast jog instead of a sprint', 'Steeper incline or longer sprints');
  hiit('Sled Push', '10 to 30 seconds, or 10 to 20 metres',
    ['Grip the sled posts with straight arms and lean into it with a flat back.', 'Drive your legs forward in powerful steps, keeping your body in a straight line.', 'Keep pushing until the end of the lane.'],
    ['Low body angle, long spine', 'Push the floor away behind you'],
    ['Standing too upright', 'Rounding your back'],
    'Lighter sled load', 'Heavier sled or a longer push');
  hiit('Box Jumps', '5 to 10 reps, rest between',
    ['Stand a short stride from a sturdy box with your feet hip-width.', 'Swing your arms back, then jump up and forward onto the box.', 'Land softly in a half squat with your whole foot on the box, stand tall, then step down.'],
    ['Soft, quiet landings', 'Step down, do not jump down'],
    ['Landing with your knees collapsing in', 'Using a box too high for you'],
    'A lower box or a step-up', 'A higher box, or single-leg step-down');
  hiit('Jump Squats', '20 to 40 seconds, or 10 to 15 reps',
    ['Stand with your feet shoulder-width, then squat down with your chest up.', 'Explode up into a jump, arms swinging for momentum.', 'Land softly back into the squat.'],
    ['Land softly, knees bent', 'Knees track over your toes'],
    ['Landing with straight, stiff legs', 'Knees caving in'],
    'Bodyweight squats or a fast squat with no jump', 'Add a pause in the bottom, or hold weights');
  hiit('Mountain Climbers', '20 to 40 seconds',
    ['Start in a high plank with your hands under your shoulders.', 'Drive one knee toward your chest, then switch legs quickly.', 'Keep your hips low and level.'],
    ['Hips stay level', 'Quick, light feet'],
    ['Bouncing your hips up', 'Letting your hands drift forward'],
    'Slower pace, or hands on a bench', 'Cross-body knees, or faster pace');
  hiit('High Knees', '20 to 40 seconds',
    ['Stand tall, then run in place, lifting your knees up to hip height.', 'Pump your arms in rhythm with your legs.', 'Stay on the balls of your feet.'],
    ['Tall posture, quick feet', 'Drive your knees up, not your torso back'],
    ['Leaning backward', 'Heavy, flat-footed landings'],
    'Marching in place', 'Faster pace or a longer interval');
  hiit('Jumping Jacks', '30 to 60 seconds',
    ['Stand with your feet together and your arms by your sides.', 'Jump your feet apart while raising your arms overhead.', 'Jump back to the start.'],
    ['Light on your feet', 'Steady breathing'],
    ['Landing hard on your heels', 'Slouching'],
    'Step-out jacks without jumping', 'Add a squat at the bottom (squat jacks)');
  hiit('Skater Jumps', '20 to 40 seconds',
    ['Stand on one leg, then bound sideways to land on the other leg.', 'Let your trailing leg sweep behind you and swing your arms across.', 'Land softly and immediately bound back.'],
    ['Soft landing, knee over your toes', 'Stay low and balanced'],
    ['Landing stiff-legged', 'Bounding too far to control'],
    'Step side to side without jumping', 'Add a pause on each landing');
  hiit('Tuck Jumps', '5 to 10 reps, rest between',
    ['Stand with your feet hip-width and your arms ready.', 'Jump up and pull your knees toward your chest at the top.', 'Land softly with your knees bent, then reset.'],
    ['Jump high, land soft', 'Reset your stance between reps'],
    ['Landing with locked knees', 'Rushing without resetting'],
    'High jumps without the tuck', 'Continuous tuck jumps');
  hiit('Medicine Ball Slams', '20 to 40 seconds, or 10 to 15 reps',
    ['Stand with your feet shoulder-width and lift the ball overhead, stretching tall.', 'Slam the ball down hard in front of your feet, using your whole body.', 'Squat to pick it up and repeat.'],
    ['Use your abs and hips, not just your arms', 'Brace before you slam'],
    ['Rounding your back to pick it up', 'Slamming where it can bounce into you'],
    'A lighter ball, slower pace', 'A heavier ball or a faster pace');
  hiit('Thrusters', '20 to 40 seconds, or 8 to 12 reps',
    ['Hold dumbbells or a bar at your shoulders and squat down with your chest up.', 'Stand up powerfully and use that momentum to press the weight overhead.', 'Lower the weight back to your shoulders as you sink into the next squat.'],
    ['One smooth motion, legs drive the press', 'Core braced'],
    ['Pressing before your legs finish', 'Letting your elbows drop in the squat'],
    'Lighter weights or a goblet squat and press', 'Heavier weights or more reps');
  hiit('Dumbbell Snatch', '20 to 40 seconds, or 6 to 10 reps each side',
    ['Stand over one dumbbell with your feet shoulder-width, hinge and grip it with a flat back.', 'Drive up through your legs and pull the dumbbell close to your body, then punch it overhead.', 'Lower it under control back to the floor.'],
    ['Power comes from your legs and hips', 'Keep it close to your body'],
    ['Curling it up with your arm', 'Rounding your back'],
    'Lighter dumbbell, or start from your hips', 'Heavier weight, or alternate sides without setting down');
  hiit('Shadow Boxing', '30 to 60 seconds per round',
    ['Stand with your feet staggered and your hands up by your chin, knees soft.', 'Throw light combinations: jab, cross, hook, with quick footwork.', 'Stay relaxed and keep moving.'],
    ['Light on your feet', 'Turn your hips into each punch'],
    ['Locking out your elbows hard', 'Holding your breath'],
    'Slow combinations', 'Faster combinations, add head movement');

  /* ================= mobility ================= */
  mob('Cat-Cow', '6 to 10 slow breaths, or 30 to 60 seconds',
    ['Start on your hands and knees with your hands under your shoulders and knees under your hips.', 'Inhale: drop your belly, lift your chest and tailbone (cow).', 'Exhale: round your back toward the ceiling and tuck your chin and tailbone (cat).', 'Move slowly with your breath.'],
    ['Let your breath set the pace', 'Move through your whole spine'],
    ['Rushing', 'Forcing the end range'],
    'Do it seated on a chair', 'Add a pause at each end');
  mob("Child's Pose", 'Hold 30 to 60 seconds',
    ['Kneel on the floor with your big toes together and your knees wide.', 'Sit your hips back toward your heels and walk your hands forward.', 'Rest your forehead down and breathe into your back.'],
    ['Long exhale, let go of tension', 'Hips sink back'],
    ['Forcing your hips to your heels if it pinches your knees', 'Holding your breath'],
    'Place a cushion under your hips or between your knees and calves', 'Walk your hands to one side for a side stretch');
  mob('Thread the Needle', '30 to 45 seconds each side',
    ['Start on your hands and knees. Slide your right arm under your body, palm up, and rest your shoulder and head on the floor.', 'Sit your hips back slightly and breathe into your upper back.', 'Return and switch sides.'],
    ['Relax your neck', 'Hips stay stacked over your knees'],
    ['Forcing the twist', 'Letting your hips shift sideways'],
    'Do it with less reach, or place a cushion under your head', 'Reach the top arm overhead to open the chest');
  mob("World's Greatest Stretch", '5 to 8 reps each side, or 30 to 40 seconds each side',
    ['Step into a long lunge with your right foot forward and your left knee lifted or down. Place both hands inside your front foot.', 'Rotate your right arm up toward the ceiling, following your hand with your eyes.', 'Return the hand to the floor, then straighten your front leg to stretch the hamstring. Switch sides.'],
    ['Move slowly, breathe out as you rotate', 'Keep your back leg strong'],
    ['Rushing the rotation', 'Letting your front knee fall inward'],
    'Keep your back knee on the floor and your hand on a block', 'Hold each position for 3 slow breaths');
  mob('90/90 Hip Switch', '6 to 10 slow switches, or 45 to 60 seconds',
    ['Sit on the floor with both knees bent about 90°, both legs falling to your right.', 'Lift your knees and rotate them over to the left, bringing your other shin to the front.', 'Keep your chest tall and use your hands behind you for balance if needed.'],
    ['Sit tall through your spine', 'Move slowly and smoothly'],
    ['Slumping your back', 'Using your hands to force your knees down'],
    'Sit on a cushion, hands behind you for support', 'Switch without using your hands');
  mob('Deep Squat Hold', 'Hold 30 to 60 seconds',
    ['Stand with your feet a little wider than your shoulders, toes turned out.', 'Sit all the way down into a deep squat, keeping your heels on the floor.', 'Press your elbows against your knees and keep your chest tall.'],
    ['Heels down, chest up', 'Knees follow your toes'],
    ['Letting your heels lift (use support if so)', 'Rounding your back to force depth'],
    'Hold a post or doorframe, or sit on a low block under your hips', 'Add small hip shifts side to side');
  mob('Cossack Squat', '5 to 8 reps each side, or 30 to 40 seconds',
    ['Stand with a wide stance, toes slightly out.', 'Shift your hips to one side and sit down over that leg, keeping the other leg straight with the toes up.', 'Push back up and shift to the other side.'],
    ['Chest tall, working heel flat', 'Move smoothly from side to side'],
    ['Letting the working knee cave in', 'Dropping so low your heel lifts'],
    'Shallower range, hold onto a post', 'Hold a light weight at your chest');
  mob('Half-Kneeling Hip Flexor Stretch', 'Hold 30 to 45 seconds each side',
    ['Kneel on one knee on a cushion with your other foot flat in front of you.', 'Squeeze the glute of your back leg and tuck your pelvis under.', 'Gently shift your hips forward until you feel a stretch at the front of your back hip.'],
    ['Tuck your tailbone and tighten your glute', 'Keep your ribs down'],
    ['Arching your lower back', 'Leaning forward from your waist'],
    'Place a cushion under your back knee', 'Raise the arm on the stretching side and lean away');
  mob('Pigeon Pose', 'Hold 45 to 60 seconds each side',
    ['From hands and knees, bring your right knee forward behind your right wrist and slide your left leg straight back.', 'Lower your hips toward the floor and keep your front shin angled or parallel as comfortable.', 'Fold forward over your front leg, breathing slowly.'],
    ['Keep your hips level', 'Stop if you feel knee pain, not just a stretch'],
    ['Forcing your front shin flat if your knee complains', 'Collapsing onto one hip'],
    'Lie on your back and cross one ankle over the opposite knee (figure-4)', 'Fold forward onto your forearms');
  mob('Frog Stretch', 'Hold 30 to 60 seconds',
    ['From hands and knees, widen your knees as far as comfortable with your feet turned out and in line with your knees.', 'Lower onto your forearms and sit your hips back.', 'Breathe and relax into the stretch.'],
    ['Keep your spine long', 'Use a cushion under your knees'],
    ['Pushing into sharp pain in your groin or knees', 'Rounding your back hard'],
    'Narrow your knees and keep your hands under your shoulders', 'Lower your chest closer to the floor');
  mob('Open Book Rotation', '6 to 10 slow reps each side',
    ['Lie on your side with your knees bent at 90° and your arms straight in front of you, palms together.', 'Lift your top arm and open it up and back, following your hand with your eyes, as far as is comfortable.', 'Return slowly and repeat, then switch sides.'],
    ['Knees stay stacked and still', 'Exhale as you open'],
    ['Letting your knees slide apart', 'Forcing the arm to the floor'],
    'Place a cushion between your knees, smaller range', 'Pause at the end for a slow breath');
  mob('Shoulder CARs', '3 to 5 slow circles each direction, each arm',
    ['Stand tall and make a fist with your right hand, thumb inside.', 'Slowly draw the biggest circle you can with your arm, forward, up, back and down, keeping your torso still.', 'Reverse the direction. Repeat with the left arm.'],
    ['Slow, controlled, as big as you can', 'Keep your ribs and neck still'],
    ['Rushing the circle', 'Arching your back to cheat the range'],
    'A smaller circle, or use a wall for support', 'Squeeze your fist and tense the arm harder through the circle');
  mob('Hip CARs', '3 to 5 slow circles each direction, each leg',
    ['Stand holding onto a wall or rack and lift one knee to hip height.', 'Slowly rotate your knee out to the side, then back and down, drawing the biggest circle you can with your hip.', 'Reverse the direction, then switch legs.'],
    ['Keep your torso still', 'Slow circles, no momentum'],
    ['Leaning back or twisting to get a bigger circle', 'Rushing'],
    'Smaller circles', 'Hold the circles tense, with no support');
  mob('Wall Slides', '8 to 12 slow reps',
    ['Stand with your back, head and arms against a wall, elbows bent at 90° and the backs of your hands touching the wall.', 'Slide your arms up the wall as high as you can without your back arching or your hands leaving the wall.', 'Slide back down slowly.'],
    ['Ribs down, back stays flat', 'Keep your wrists and elbows in contact'],
    ['Arching your lower back', 'Shrugging your shoulders to your ears'],
    'Move your feet slightly away from the wall', 'Lift your arms off the wall at the end (wall angels)');
  mob('Ankle Rocks', '8 to 12 rocks each side',
    ['Face a wall in a half-kneeling position with your front foot a few inches from the wall.', 'Drive your front knee forward to touch the wall without your heel lifting.', 'Return, and move your foot back a little to make it harder.'],
    ['Heel stays flat', 'Knee tracks over your second toe'],
    ['Letting your heel lift', 'Letting your knee cave in'],
    'Foot closer to the wall', 'Foot further from the wall');
  mob('Supine Twist', 'Hold 30 to 45 seconds each side',
    ['Lie on your back and hug your knees to your chest, with your arms out to the sides.', 'Lower both knees to one side, keeping your shoulders on the floor.', 'Breathe slowly, then switch sides.'],
    ['Let gravity do the work', 'Relax your shoulders'],
    ['Forcing your knees to the floor', 'Letting your shoulder lift off'],
    'Place a cushion under your knees', 'Straighten the top leg');

  /* ================= ground / animal flow ================= */
  gnd('Beast Hold', 'Hold 20 to 40 seconds, or 5 to 8 breaths',
    ['Start on your hands and knees with your hands under your shoulders and knees under your hips.', 'Tuck your toes and lift your knees about an inch off the floor.', 'Keep your back flat and your core braced, and breathe steadily.'],
    ['Knees hover, back stays flat', 'Push the floor away through your hands'],
    ['Lifting your knees too high', 'Letting your back sag'],
    'Keep your knees on the floor, shift weight forward and back', 'Lift one hand off the floor for a shoulder tap');
  gnd('Crab Reach', '5 to 8 reps each side',
    ['Sit with your knees bent, hands behind you with fingers pointing toward your feet, and lift your hips off the floor.', 'Reach one arm up and over, rotating your torso toward the ceiling.', 'Return the hand to the floor and switch sides.'],
    ['Hips stay up', 'Follow the reaching hand with your eyes'],
    ['Letting your hips drop', 'Hunching your shoulders'],
    'Keep your hips low to the floor', 'Hold the reach for a breath, or crab walk');
  gnd('Scorpion Reach', '5 to 8 reps each side',
    ['Lie face down with your arms out to the sides in a T.', 'Bend one knee and swing your foot up and across your body toward the opposite hand, rotating your hips.', 'Return and switch sides, keeping your shoulders on the floor.'],
    ['Rotate from your hips and spine', 'Move slowly and exhale on the reach'],
    ['Forcing the foot to the floor', 'Lifting your shoulders'],
    'Smaller range of motion', 'Hold the end position for 2 breaths');
  gnd('Lizard Crawl', '4 to 6 slow steps, or 30 to 40 seconds',
    ['Start in a low plank with your hips low and your body close to the floor.', 'Step your right foot outside your right hand, then your left hand forward, then your left foot outside.', 'Keep your hips low and move slowly across the floor.'],
    ['Stay low, move smoothly', 'Breathe steadily'],
    ['Letting your hips pop up', 'Rushing'],
    'Slower, with your back knee on the floor', 'Add a hip dip at each step');
  gnd('Bear Crawl', '4 to 8 steps forward and back, or 20 to 40 seconds',
    ['Start on your hands and knees, then lift your knees an inch off the floor.', 'Move opposite hand and foot forward together in small steps, keeping your back flat.', 'Crawl for the distance, then backward or turn around.'],
    ['Back stays flat and level', 'Small, controlled steps'],
    ['Lifting your hips high', 'Taking steps so big you lose balance'],
    'Hold the position without moving', 'Crawl sideways or backward');
  gnd('Side Kick-Through', '4 to 6 reps each side',
    ['Start in a high plank, hands under your shoulders.', 'Lift your right hand, rotate your chest toward the ceiling, and sweep your left foot through under your body.', 'Return to the plank and switch sides.'],
    ['Keep a strong base on your supporting hand', 'Rotate from your chest'],
    ['Collapsing the supporting shoulder', 'Rushing the transition'],
    'Do the movement from your knees', 'Add a pause in the open position');

  /* ================= yoga-style ================= */
  yog('Mountain Pose', 'Hold 20 to 30 seconds',
    ['Stand with your feet hip-width and your weight even across both feet.', 'Lengthen your spine and let your arms hang by your sides, palms forward.', 'Breathe slowly and stand tall.'],
    ['Feel all four corners of each foot', 'Tall crown, relaxed shoulders'],
    ['Locking your knees hard', 'Tilting your pelvis'],
    'Stand with your back against a wall', 'Close your eyes to challenge balance');
  yog('Upward Salute', 'Hold 10 to 15 seconds, or 2 to 3 breaths',
    ['From mountain pose, inhale and sweep your arms out and overhead.', 'Press your palms together or keep them shoulder-width, and lift your chest slightly.', 'Reach up through your fingertips.'],
    ['Ribs stay down', 'Reach long, not back'],
    ['Over-arching your lower back', 'Shrugging your shoulders'],
    'Arms wider apart if your shoulders feel tight', 'Add a gentle backbend if comfortable');
  yog('Standing Forward Fold', 'Hold 20 to 40 seconds',
    ['From standing, exhale and hinge forward from your hips with a slight bend in your knees.', 'Let your head and arms hang, or hold opposite elbows.', 'Breathe and let your spine lengthen.'],
    ['Bend your knees as much as you need', 'Let your head hang heavy'],
    ['Locking your knees and rounding hard', 'Bouncing'],
    'Place your hands on blocks or your thighs, knees bent', 'Straighten your legs more and walk your hands toward your feet');
  yog('Half Lift', 'Hold 5 to 10 seconds, or 1 to 2 breaths',
    ['From a forward fold, inhale and lift your torso halfway up with a flat back.', 'Place your fingertips on your shins or the floor, and look forward.', 'Lengthen your spine from tailbone to crown.'],
    ['Flat back, long neck', 'Hinge from your hips'],
    ['Rounding your back', 'Craning your neck'],
    'Hands on your thighs', 'Press your fingertips lightly and lengthen more');
  yog('Low Cobra', 'Hold 15 to 30 seconds',
    ['Lie face down with your hands under your shoulders and your elbows close to your sides.', 'Press gently into your hands and lift your chest off the floor, keeping your hips down.', 'Keep your neck long and your shoulders away from your ears.'],
    ['Lift with your back muscles, not just your arms', 'Only go as high as is comfortable'],
    ['Cranking your neck back', 'Pushing up so high your lower back pinches'],
    'Rest on your forearms (sphinx)', 'Straighten your arms slightly higher');
  yog('Upward Dog', 'Hold 5 to 10 seconds, or 1 to 2 breaths',
    ['From plank or low cobra, press into your hands and straighten your arms.', 'Roll onto the tops of your feet and lift your thighs and knees off the floor.', 'Open your chest and keep your shoulders drawn down.'],
    ['Push the floor away', 'Chest open, shoulders away from ears'],
    ['Dumping into your lower back', 'Shrugging your shoulders'],
    'Stay in low cobra with your thighs on the floor', 'Lift your thighs higher with strong legs');
  yog('Downward Dog', 'Hold 20 to 40 seconds',
    ['From hands and knees, tuck your toes and lift your hips up and back, forming an inverted V.', 'Press the floor away through your hands and lengthen your spine.', 'Bend your knees as much as you need and let your head hang.'],
    ['Push your hips up and back', 'Press the floor away, ears between your arms'],
    ['Rounding your back to straighten your legs', 'Letting your shoulders sag'],
    'Bend your knees deeply, or place your hands on a wall', 'Pedal your feet, or lift one leg');
  yog('Low Lunge', 'Hold 20 to 40 seconds each side',
    ['From downward dog, step your right foot between your hands and lower your back knee to the floor.', 'Lift your torso and sweep your arms overhead, sinking your hips forward.', 'Keep your front knee over your ankle.'],
    ['Hips sink forward and down', 'Front knee stays over your ankle'],
    ['Letting your front knee drift past your toes', 'Arching your lower back'],
    'Hands on blocks or your front thigh, with a cushion under your back knee', 'Lift your back knee off the floor');
  yog('Warrior II', 'Hold 20 to 40 seconds each side',
    ['Step your feet wide, turn your front foot out and bend that knee over your ankle.', 'Extend your arms out at shoulder height and gaze over your front hand.', 'Keep your back leg straight and your torso centred over your hips.'],
    ['Front knee tracks over your second toe', 'Shoulders stay relaxed'],
    ['Letting your front knee cave in', 'Leaning forward over your front leg'],
    'A shorter stance, hands on hips', 'Sink deeper into the front knee');
  yog('Chair Pose', 'Hold 15 to 30 seconds',
    ['Stand with your feet together or hip-width and bend your knees as if sitting back into a chair.', 'Sweep your arms up by your ears and keep your weight in your heels.', 'Keep your chest lifted and your breath steady.'],
    ['Weight in your heels', 'Tailbone reaches down'],
    ['Letting your knees drift past your toes', 'Dumping into your lower back'],
    'Squat less deeply, or hands on your thighs', 'Sink lower and hold longer');
  yog('Happy Baby', 'Hold 30 to 60 seconds',
    ['Lie on your back and bend your knees toward your chest.', 'Hold the outsides of your feet (or ankles) and open your knees wide toward your armpits.', 'Gently rock side to side while breathing slowly.'],
    ['Keep your tailbone on the floor', 'Relax your shoulders'],
    ['Lifting your head and straining your neck', 'Forcing your knees down'],
    'Hold behind your thighs or use a strap around your feet', 'Straighten and press your feet into your hands');
})(typeof window !== 'undefined' ? window : globalThis);
