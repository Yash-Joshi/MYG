/* GymBoy – static data: muscle groups, day types, exercise library */
(function (GB) {
  'use strict';

  const MUSCLES = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    calves: 'Calves',
    core: 'Core',
    hiit: 'HIIT',
    mobility: 'Mobility & Flow',
  };

  const ALL_MUSCLES = Object.keys(MUSCLES);

  // The kinds of "day" you can pick when you start a session.
  const DAY_TYPES = [
    { id: 'push', name: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
    { id: 'pull', name: 'Pull', muscles: ['back', 'biceps', 'forearms'] },
    { id: 'legs', name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    { id: 'hiit', name: 'HIIT', muscles: ['hiit'], blurb: 'Intervals · conditioning' },
    { id: 'mobility', name: 'Mobility & Flow', muscles: ['mobility'], blurb: 'Mobility · ground flow · yoga' },
    { id: 'chest-triceps', name: 'Chest + Triceps', muscles: ['chest', 'triceps'] },
    { id: 'back-biceps', name: 'Back + Biceps', muscles: ['back', 'biceps'] },
    { id: 'back-triceps', name: 'Back + Triceps', muscles: ['back', 'triceps'] },
    { id: 'chest-biceps', name: 'Chest + Biceps', muscles: ['chest', 'biceps'] },
    { id: 'chest-back', name: 'Chest + Back', muscles: ['chest', 'back'] },
    { id: 'shoulders-arms', name: 'Shoulders + Arms', muscles: ['shoulders', 'biceps', 'triceps'] },
    { id: 'arms', name: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
    { id: 'chest', name: 'Chest', muscles: ['chest'] },
    { id: 'back', name: 'Back', muscles: ['back'] },
    { id: 'shoulders', name: 'Shoulders', muscles: ['shoulders'] },
    { id: 'upper', name: 'Upper Body', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
    { id: 'full', name: 'Full Body', muscles: ALL_MUSCLES.filter((m) => m !== 'forearms' && m !== 'hiit' && m !== 'mobility') },
    { id: 'core', name: 'Abs + Core', muscles: ['core'] },
  ];

  // [exercise name, muscle group]
  const EXERCISES = [
    // Chest
    ['Barbell Bench Press', 'chest'],
    ['Incline Barbell Bench Press', 'chest'],
    ['Decline Bench Press', 'chest'],
    ['Dumbbell Bench Press', 'chest'],
    ['Incline Dumbbell Press', 'chest'],
    ['Machine Chest Press', 'chest'],
    ['Dumbbell Fly', 'chest'],
    ['Incline Dumbbell Fly', 'chest'],
    ['Cable Crossover', 'chest'],
    ['Pec Deck', 'chest'],
    ['Chest Dips', 'chest'],
    ['Push-ups', 'chest'],

    // Back
    ['Deadlift', 'back'],
    ['Pull-ups', 'back'],
    ['Chin-ups', 'back'],
    ['Lat Pulldown', 'back'],
    ['Close-Grip Lat Pulldown', 'back'],
    ['Barbell Row', 'back'],
    ['Dumbbell Row', 'back'],
    ['Seated Cable Row', 'back'],
    ['T-Bar Row', 'back'],
    ['Machine Row', 'back'],
    ['Chest-Supported Row', 'back'],
    ['Straight-Arm Pulldown', 'back'],
    ['Rack Pull', 'back'],
    ['Face Pull', 'back'],
    ['Back Extension', 'back'],

    // Shoulders
    ['Overhead Press', 'shoulders'],
    ['Dumbbell Shoulder Press', 'shoulders'],
    ['Machine Shoulder Press', 'shoulders'],
    ['Arnold Press', 'shoulders'],
    ['Dumbbell Lateral Raise', 'shoulders'],
    ['Cable Lateral Raise', 'shoulders'],
    ['Front Raise', 'shoulders'],
    ['Rear Delt Fly', 'shoulders'],
    ['Reverse Pec Deck', 'shoulders'],
    ['Upright Row', 'shoulders'],
    ['Barbell Shrug', 'shoulders'],
    ['Dumbbell Shrug', 'shoulders'],

    // Biceps
    ['Barbell Curl', 'biceps'],
    ['EZ-Bar Curl', 'biceps'],
    ['Dumbbell Curl', 'biceps'],
    ['Hammer Curl', 'biceps'],
    ['Incline Dumbbell Curl', 'biceps'],
    ['Preacher Curl', 'biceps'],
    ['Cable Curl', 'biceps'],
    ['Concentration Curl', 'biceps'],
    ['Spider Curl', 'biceps'],

    // Triceps
    ['Triceps Pushdown', 'triceps'],
    ['Rope Pushdown', 'triceps'],
    ['Overhead Triceps Extension', 'triceps'],
    ['Skull Crushers', 'triceps'],
    ['Close-Grip Bench Press', 'triceps'],
    ['Triceps Dips', 'triceps'],
    ['Bench Dips', 'triceps'],
    ['Triceps Kickback', 'triceps'],
    ['Single-Arm Cable Extension', 'triceps'],

    // Forearms
    ['Wrist Curl', 'forearms'],
    ['Reverse Wrist Curl', 'forearms'],
    ['Reverse Curl', 'forearms'],
    ["Farmer's Walk", 'forearms'],

    // Quads
    ['Barbell Squat', 'quads'],
    ['Front Squat', 'quads'],
    ['Leg Press', 'quads'],
    ['Hack Squat', 'quads'],
    ['Leg Extension', 'quads'],
    ['Bulgarian Split Squat', 'quads'],
    ['Walking Lunges', 'quads'],
    ['Goblet Squat', 'quads'],
    ['Step-ups', 'quads'],

    // Hamstrings
    ['Romanian Deadlift', 'hamstrings'],
    ['Stiff-Leg Deadlift', 'hamstrings'],
    ['Lying Leg Curl', 'hamstrings'],
    ['Seated Leg Curl', 'hamstrings'],
    ['Good Morning', 'hamstrings'],
    ['Glute-Ham Raise', 'hamstrings'],

    // Glutes
    ['Hip Thrust', 'glutes'],
    ['Glute Bridge', 'glutes'],
    ['Cable Kickback', 'glutes'],
    ['Sumo Deadlift', 'glutes'],
    ['Hip Abduction Machine', 'glutes'],

    // Calves
    ['Standing Calf Raise', 'calves'],
    ['Seated Calf Raise', 'calves'],
    ['Leg Press Calf Raise', 'calves'],

    // Core
    ['Plank', 'core'],
    ['Hanging Leg Raise', 'core'],
    ['Cable Crunch', 'core'],
    ['Ab Wheel Rollout', 'core'],
    ['Crunches', 'core'],
    ['Russian Twist', 'core'],
    ['Decline Sit-ups', 'core'],

    // HIIT / conditioning (logged by work time, with optional weight and reps)
    ['Burpees', 'hiit'],
    ['Kettlebell Swings', 'hiit'],
    ['Battle Ropes', 'hiit'],
    ['Jump Rope', 'hiit'],
    ['Assault Bike Sprints', 'hiit'],
    ['Rowing Machine Sprints', 'hiit'],
    ['Ski Erg Sprints', 'hiit'],
    ['Treadmill Sprints', 'hiit'],
    ['Sled Push', 'hiit'],
    ['Box Jumps', 'hiit'],
    ['Jump Squats', 'hiit'],
    ['Mountain Climbers', 'hiit'],
    ['High Knees', 'hiit'],
    ['Jumping Jacks', 'hiit'],
    ['Skater Jumps', 'hiit'],
    ['Tuck Jumps', 'hiit'],
    ['Medicine Ball Slams', 'hiit'],
    ['Thrusters', 'hiit'],
    ['Dumbbell Snatch', 'hiit'],
    ['Shadow Boxing', 'hiit'],

    // Mobility & flow (logged by time, optional reps; no weight)
    ['Cat-Cow', 'mobility'],
    ["Child's Pose", 'mobility'],
    ['Thread the Needle', 'mobility'],
    ["World's Greatest Stretch", 'mobility'],
    ['90/90 Hip Switch', 'mobility'],
    ['Deep Squat Hold', 'mobility'],
    ['Cossack Squat', 'mobility'],
    ['Half-Kneeling Hip Flexor Stretch', 'mobility'],
    ['Pigeon Pose', 'mobility'],
    ['Frog Stretch', 'mobility'],
    ['Open Book Rotation', 'mobility'],
    ['Shoulder CARs', 'mobility'],
    ['Hip CARs', 'mobility'],
    ['Wall Slides', 'mobility'],
    ['Ankle Rocks', 'mobility'],
    ['Supine Twist', 'mobility'],
    // ground / animal flow
    ['Beast Hold', 'mobility'],
    ['Crab Reach', 'mobility'],
    ['Scorpion Reach', 'mobility'],
    ['Lizard Crawl', 'mobility'],
    ['Bear Crawl', 'mobility'],
    ['Side Kick-Through', 'mobility'],
    // yoga-style
    ['Mountain Pose', 'mobility'],
    ['Upward Salute', 'mobility'],
    ['Standing Forward Fold', 'mobility'],
    ['Half Lift', 'mobility'],
    ['Low Cobra', 'mobility'],
    ['Upward Dog', 'mobility'],
    ['Downward Dog', 'mobility'],
    ['Low Lunge', 'mobility'],
    ['Warrior II', 'mobility'],
    ['Chair Pose', 'mobility'],
    ['Happy Baby', 'mobility'],
  ];

  GB.data = { MUSCLES, ALL_MUSCLES, DAY_TYPES, EXERCISES };
})((window.GB = window.GB || {}));
