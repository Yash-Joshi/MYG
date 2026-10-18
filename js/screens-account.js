/* GymBoy – Welcome (sign in / create account) and the onboarding questionnaire. */
(function (GB) {
  'use strict';
  const { h, mount, icon, openSheet } = GB.ui;
  const P = GB.profile;
  const screens = (GB.screens = GB.screens || {});

  const POLICY_VERSION = 'draft-1';
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmt1 = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

  /* ---------- shared widgets ---------- */
  // Single-choice cards: [{ value, title, desc, ico }]
  function optionCards(options, current, onPick, cols) {
    const wrap = h('div', { class: 'opts' + (cols === 3 ? ' three' : cols === 2 ? ' two' : ''), role: 'group' });
    const buttons = options.map((o) =>
      h(
        'button',
        {
          class: 'opt',
          type: 'button',
          'aria-pressed': String(o.value === current),
          onclick: () => {
            buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === o.value)));
            onPick(o.value);
          },
        },
        o.ico ? icon(o.ico, 22) : null,
        h('span', { class: 'opt-text' }, h('b', null, o.title), o.desc ? h('small', null, o.desc) : null)
      )
    );
    wrap.append(...buttons);
    return wrap;
  }

  // Chips: single choice when `multi` is false, toggles when true.
  function chipGroup(options, current, onChange, multi) {
    const sel = new Set(multi ? current || [] : current == null ? [] : [current]);
    const wrap = h('div', { class: 'chips wrap', role: 'group' });
    const buttons = options.map((o) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(sel.has(o.value)),
          onclick: () => {
            if (multi) {
              if (o.value === 'none') sel.clear();
              else sel.delete('none');
              if (sel.has(o.value)) sel.delete(o.value);
              else if (o.value !== 'none') sel.add(o.value);
              if (o.value === 'none') sel.add('none');
            } else {
              sel.clear();
              sel.add(o.value);
            }
            buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(sel.has(options[i].value))));
            onChange(multi ? Array.from(sel) : o.value);
          },
        },
        o.label
      )
    );
    wrap.append(...buttons);
    return wrap;
  }

  const labelled = (text, control, hint) => h('div', { class: 'fld' }, h('label', { class: 'label' }, text), control, hint ? h('p', { class: 'hint' }, hint) : null);

  function textInput(o) {
    return h('input', {
      class: 'field',
      type: o.type || 'text',
      id: o.id,
      value: o.value == null ? '' : o.value,
      placeholder: o.placeholder || '',
      autocomplete: o.autocomplete || 'off',
      inputmode: o.inputmode,
      maxLength: o.maxLength,
      'aria-label': o.label,
      oninput: (e) => o.onInput(e.target.value),
    });
  }

  /* ---------- legal (short, plain-language draft; needs real review before launch) ---------- */
  function openLegal() {
    openSheet({
      title: 'Privacy, in plain words',
      tall: true,
      body: [
        h('p', { class: 'muted pad-b' }, 'Draft summary. Have this reviewed before you publish the app.'),
        h('h3', { class: 'section-title' }, 'What we keep'),
        h('p', { class: 'pad-b' }, 'Your profile answers, your weigh-ins, your workouts, and the reports we create from your scans.'),
        h('h3', { class: 'section-title' }, 'Your scan photos'),
        h('p', { class: 'pad-b' }, 'Photos are shrunk on your phone, stripped of location data, and sent to an AI service to read the numbers and write your report. In this version the photos are not stored after the report is made.'),
        h('h3', { class: 'section-title' }, 'What the AI sees'),
        h('p', { class: 'pad-b' }, 'Your scan photos plus your age, sex, height, weight, goal and training answers. Not your name, email or exact birth date.'),
        h('h3', { class: 'section-title' }, 'Not medical advice'),
        h('p', { class: 'pad-b' }, 'Reports are wellness guidance. They do not diagnose anything. Talk to a doctor about health concerns.'),
        h('h3', { class: 'section-title' }, 'Your control'),
        h('p', null, 'You can delete your profile and reports any time in Settings.'),
      ],
    });
  }

  /* =====================================================================
   * Welcome
   * ===================================================================== */
  screens.welcome = function () {
    const b = GB.backend;
    const local = b.mode === 'local';
    let tab = 'signup';
    let name = '';
    let email = '';
    let password = '';
    let error = '';
    let busy = false;
    let notice = null;

    const page = h('div', { class: 'page welcome' });

    async function submit(e) {
      e.preventDefault();
      if (busy) return;
      error = '';
      if (tab === 'signup' && !name.trim()) error = 'Tell us what to call you.';
      else if (!local && !/^\S+@\S+\.\S+$/.test(email.trim())) error = 'Enter a valid email address.';
      else if (!local && password.length < 8) error = 'Use at least 8 characters for the password.';
      if (error) return draw();

      busy = true;
      draw();
      const r = tab === 'signup' || local ? await b.signUp({ name, email, password }) : await b.signIn({ email, password });
      busy = false;
      if (!r.ok) {
        error = r.error || 'That did not work. Please try again.';
        return draw();
      }
      if (r.needsConfirmation) {
        notice = `We sent a confirmation link to ${email.trim()}. Open it, then come back here and sign in.`;
        tab = 'signin';
        return draw();
      }
      GB.app.go('home', true);
    }

    async function google() {
      error = '';
      const r = await b.signInWithGoogle();
      if (!r.ok) {
        error = r.error;
        draw();
      }
    }

    const point = (ico, text) => h('li', null, h('span', { class: 'wp-ico' }, icon(ico, 20)), h('span', null, text));

    function draw() {
      const form = h(
        'form',
        { class: 'auth-card', onsubmit: submit, novalidate: true },
        local
          ? null
          : h(
              'div',
              { class: 'seg wide', role: 'tablist' },
              h('button', { type: 'button', role: 'tab', 'aria-pressed': String(tab === 'signup'), onclick: () => ((tab = 'signup'), (error = ''), draw()) }, 'Create account'),
              h('button', { type: 'button', role: 'tab', 'aria-pressed': String(tab === 'signin'), onclick: () => ((tab = 'signin'), (error = ''), draw()) }, 'Sign in')
            ),
        notice ? h('p', { class: 'form-note' }, notice) : null,
        tab === 'signup' || local ? labelled('Your name', textInput({ id: 'auth-name', label: 'Your name', value: name, placeholder: 'e.g. Yash', autocomplete: 'name', maxLength: 40, onInput: (v) => (name = v) })) : null,
        local ? labelled('Email (optional)', textInput({ id: 'auth-email', type: 'email', label: 'Email', value: email, placeholder: 'you@example.com', autocomplete: 'email', onInput: (v) => (email = v) })) : null,
        !local ? labelled('Email', textInput({ id: 'auth-email', type: 'email', label: 'Email', value: email, placeholder: 'you@example.com', autocomplete: 'email', onInput: (v) => (email = v) })) : null,
        !local ? labelled('Password', textInput({ id: 'auth-password', type: 'password', label: 'Password', value: password, placeholder: 'At least 8 characters', autocomplete: tab === 'signup' ? 'new-password' : 'current-password', onInput: (v) => (password = v) })) : null,
        error ? h('p', { class: 'form-err', role: 'alert' }, error) : null,
        h('button', { class: 'btn primary big', type: 'submit', disabled: busy }, busy ? 'One moment…' : local ? 'Get started' : tab === 'signup' ? 'Create account' : 'Sign in'),
        !local ? h('div', { class: 'or' }, h('span', null, 'or')) : null,
        !local ? h('button', { class: 'btn ghost big', type: 'button', onclick: google }, 'Continue with Google') : null,
        local ? h('p', { class: 'demo-note' }, h('b', null, 'Demo mode. '), 'Your account lives on this device only. Real sign-in switches on when the account service is connected.') : null,
        h('p', { class: 'legal' }, 'By continuing you agree to how we handle your data. ', h('button', { class: 'link-btn inline', type: 'button', onclick: openLegal }, 'Read it in plain words'))
      );

      mount(page, 
        h('div', { class: 'brand big' }, h('span', { class: 'logo' }, icon('bolt', 20)), 'GYMBOY'),
        h('h1', { class: 'hero-title' }, 'Know your body.', h('br'), h('span', null, 'Train with a plan.')),
        h(
          'ul',
          { class: 'welcome-points' },
          point('camera', 'Scan your InBody result and get a clear, visual report'),
          point('mic', 'Log every set, by voice if you like'),
          point('chart', 'See real progress, week after week')
        ),
        form
      );
    }

    draw();
    return page;
  };

  /* =====================================================================
   * Onboarding questionnaire
   * ===================================================================== */
  screens.onboarding = function (param) {
    const b = GB.backend;
    const editing = param === 'edit';
    const existing = b.profile();
    const draft = existing ? clone(existing) : P.emptyProfile();
    if (!existing) draft.name = (b.user() && b.user().name) || '';
    const originalWeight = draft.weight_kg;
    let step = 0;
    let error = '';

    const imperial = () => draft.units === 'imperial';
    const wUnit = () => (imperial() ? 'lb' : 'kg');
    const toDisplayWeight = (kg) => (kg == null ? '' : fmt1(imperial() ? P.kgToLb(kg) : kg));
    const fromDisplayWeight = (v) => {
      const n = parseFloat(String(v).replace(',', '.'));
      if (!Number.isFinite(n)) return null;
      return imperial() ? P.lbToKg(n) : Math.round(n * 10) / 10;
    };

    const page = h('div', { class: 'page wizard' });

    /* ----- step 1: about you ----- */
    function stepAbout() {
      const ft = draft.height_cm ? P.cmToFtIn(draft.height_cm) : { ft: '', in: '' };
      let ftVal = ft.ft;
      let inVal = ft.in;
      const setImperialHeight = () => (draft.height_cm = ftVal === '' && inVal === '' ? null : P.ftInToCm(ftVal, inVal));
      const age = P.ageFromDob(draft.dob);

      return {
        title: 'About you',
        subtitle: 'Used to read your scan correctly and personalise your plan.',
        validate() {
          if (!draft.name.trim()) return 'Tell us what to call you.';
          const a = P.ageFromDob(draft.dob);
          if (a == null) return 'Enter your date of birth.';
          if (a < 18) return 'GymBoy is for adults (18 and over) for now.';
          if (a > 100) return 'Check your date of birth.';
          if (!draft.sex) return 'Choose male or female. Body-composition ranges differ by sex.';
          if (!(draft.height_cm >= 120 && draft.height_cm <= 230)) return 'Enter your height.';
          if (!(draft.weight_kg >= 30 && draft.weight_kg <= 300)) return 'Enter your current weight.';
          return null;
        },
        body: [
          labelled('Your name', textInput({ id: 'ob-name', label: 'Your name', value: draft.name, autocomplete: 'name', maxLength: 40, onInput: (v) => (draft.name = v) })),
          labelled(
            'Date of birth',
            textInput({ id: 'ob-dob', type: 'date', label: 'Date of birth', value: draft.dob, autocomplete: 'bday', onInput: (v) => (draft.dob = v) }),
            age != null && age < 18 ? 'GymBoy is for adults (18 and over) for now.' : null
          ),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Sex at birth'), optionCards([{ value: 'male', title: 'Male' }, { value: 'female', title: 'Female' }], draft.sex, (v) => (draft.sex = v), 2)),
          h(
            'div',
            { class: 'fld' },
            h('label', { class: 'label' }, 'Units'),
            h(
              'div',
              { class: 'seg wide' },
              ['metric', 'imperial'].map((u) =>
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-pressed': String(draft.units === u),
                    onclick: () => {
                      draft.units = u;
                      draw();
                    },
                  },
                  u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lb, ft)'
                )
              )
            )
          ),
          imperial()
            ? h(
                'div',
                { class: 'fld' },
                h('label', { class: 'label' }, 'Height'),
                h(
                  'div',
                  { class: 'row gap' },
                  textInput({ id: 'ob-ft', label: 'Feet', value: ftVal, inputmode: 'numeric', placeholder: 'ft', onInput: (v) => ((ftVal = v.replace(/\D/g, '')), setImperialHeight()) }),
                  textInput({ id: 'ob-in', label: 'Inches', value: inVal, inputmode: 'numeric', placeholder: 'in', onInput: (v) => ((inVal = v.replace(/\D/g, '')), setImperialHeight()) })
                )
              )
            : labelled('Height (cm)', textInput({ id: 'ob-height', label: 'Height in centimetres', value: draft.height_cm == null ? '' : fmt1(draft.height_cm), inputmode: 'decimal', placeholder: 'e.g. 178', onInput: (v) => (draft.height_cm = parseFloat(v.replace(',', '.')) || null) })),
          labelled(`Current weight (${wUnit()})`, textInput({ id: 'ob-weight', label: `Current weight in ${wUnit()}`, value: toDisplayWeight(draft.weight_kg), inputmode: 'decimal', placeholder: imperial() ? 'e.g. 182' : 'e.g. 82.4', onInput: (v) => (draft.weight_kg = fromDisplayWeight(v)) })),
        ],
      };
    }

    /* ----- step 2: goal ----- */
    function stepGoal() {
      return {
        title: 'Your goal',
        subtitle: 'Pick the one that matters most right now. You can change it later.',
        validate: () => (draft.goal.primary ? null : 'Pick a goal to continue.'),
        body: [
          optionCards(
            [
              { value: 'lose_fat', ico: 'target', title: 'Lose fat', desc: 'Get leaner and keep your muscle' },
              { value: 'build_muscle', ico: 'bolt', title: 'Build muscle', desc: 'Get stronger and bigger' },
              { value: 'recomposition', ico: 'repeat', title: 'Recomposition', desc: 'Lose fat and build muscle together' },
              { value: 'general_health', ico: 'shield', title: 'General health', desc: 'Feel better and move more' },
              { value: 'performance', ico: 'chart', title: 'Performance', desc: 'Train for sport or strength' },
            ],
            draft.goal.primary,
            (v) => (draft.goal.primary = v)
          ),
          labelled(`Target weight (${wUnit()}), optional`, textInput({ id: 'ob-target', label: 'Target weight', value: toDisplayWeight(draft.goal.target_weight_kg), inputmode: 'decimal', placeholder: 'Leave empty if unsure', onInput: (v) => (draft.goal.target_weight_kg = fromDisplayWeight(v)) })),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Timeframe, optional'), chipGroup([{ value: 8, label: '8 weeks' }, { value: 12, label: '12 weeks' }, { value: 16, label: '16 weeks' }, { value: 24, label: '24 weeks' }, { value: null, label: 'No rush' }], draft.goal.weeks, (v) => (draft.goal.weeks = v), false)),
        ],
      };
    }

    /* ----- step 3: training ----- */
    function stepTraining() {
      const t = draft.training;
      return {
        title: 'Your training',
        subtitle: 'So your plan fits the time and kit you actually have.',
        validate: () => (!t.experience ? 'How experienced are you?' : !t.equipment ? 'Where do you train?' : null),
        body: [
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Experience'), optionCards([{ value: 'beginner', title: 'Beginner', desc: 'Under a year' }, { value: 'intermediate', title: 'Intermediate', desc: '1 to 3 years' }, { value: 'advanced', title: 'Advanced', desc: '3+ years' }], t.experience, (v) => (t.experience = v), 3)),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Days per week'), chipGroup([1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) })), t.days_per_week, (v) => (t.days_per_week = v), false)),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Minutes per session'), chipGroup([30, 45, 60, 75, 90].map((n) => ({ value: n, label: String(n) })), t.minutes_per_session, (v) => (t.minutes_per_session = v), false)),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Where you train'), optionCards([{ value: 'full_gym', ico: 'bolt', title: 'Full gym' }, { value: 'home_dumbbells', ico: 'home', title: 'Home with weights' }, { value: 'bodyweight_only', ico: 'user', title: 'Bodyweight only' }], t.equipment, (v) => (t.equipment = v))),
          h(
            'div',
            { class: 'fld' },
            h('label', { class: 'label' }, 'Injuries or limitations'),
            chipGroup(['Shoulder', 'Lower back', 'Knee', 'Wrist or elbow', 'Neck', 'Hip', 'None'].map((x) => ({ value: x.toLowerCase(), label: x })), t.limitations, (v) => (t.limitations = v), true),
            textInput({ id: 'ob-limits', label: 'Anything else we should know', value: t.limitations_note, placeholder: 'Anything else we should know (optional)', maxLength: 200, onInput: (v) => (t.limitations_note = v) })
          ),
        ],
      };
    }

    /* ----- step 4: daily life and food ----- */
    function stepLife() {
      const l = draft.life;
      return {
        title: 'Daily life and food',
        subtitle: 'Sleep, steps and food shape results as much as training.',
        validate: () => (!l.job_activity ? 'How active is your day?' : !l.steps_band ? 'Roughly how many steps do you take?' : !draft.food.diet ? 'Pick the diet closest to yours.' : null),
        body: [
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Your day'), optionCards([{ value: 'desk', title: 'Mostly sitting', desc: 'Desk, driving' }, { value: 'on_feet', title: 'On my feet', desc: 'Retail, teaching' }, { value: 'physical', title: 'Physical work', desc: 'Lifting, building' }], l.job_activity, (v) => (l.job_activity = v))),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Steps per day'), chipGroup([{ value: 'under_5k', label: 'Under 5k' }, { value: '5k_8k', label: '5k to 8k' }, { value: '8k_12k', label: '8k to 12k' }, { value: 'over_12k', label: 'Over 12k' }], l.steps_band, (v) => (l.steps_band = v), false)),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'Sleep per night (hours)'), chipGroup([5, 6, 7, 8, 9].map((n) => ({ value: n, label: String(n) })), l.sleep_hours, (v) => (l.sleep_hours = v), false)),
          h('div', { class: 'fld' }, h('label', { class: 'label' }, 'How you eat'), chipGroup(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other'].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) })), draft.food.diet, (v) => (draft.food.diet = v), false)),
          labelled('Allergies or foods to avoid', textInput({ id: 'ob-avoid', label: 'Allergies or foods to avoid', value: draft.food.avoid, placeholder: 'Optional', maxLength: 200, onInput: (v) => (draft.food.avoid = v) })),
        ],
      };
    }

    /* ----- step 5: health check and consent ----- */
    function stepHealth() {
      const flagRow = (key, text) =>
        h(
          'label',
          { class: 'setting' },
          h('span', { class: 'sd' }, h('b', null, text)),
          h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!draft.flags[key], onchange: (e) => (draft.flags[key] = e.target.checked) }), h('i'))
        );
      return {
        title: 'One last check',
        subtitle: 'Optional. This only helps us keep your advice safe. It is never shared.',
        validate: () => (draft.consent.scan_ai || document.getElementById('ob-consent').checked ? null : 'Please agree to the scan processing to continue.'),
        finishLabel: editing ? 'Save changes' : 'Finish',
        body: [
          h('div', { class: 'flags' }, flagRow('pregnant_or_postpartum', 'Pregnant or recently gave birth'), flagRow('eating_disorder_history', 'History of an eating disorder'), flagRow('heart_condition', 'A heart condition'), flagRow('pacemaker_or_implant', 'Pacemaker or implanted medical device'), flagRow('taking_medication_affecting_weight_or_water', 'Medication that affects weight or water')),
          h(
            'label',
            { class: 'check-row consent' },
            h('input', { type: 'checkbox', id: 'ob-consent', checked: !!draft.consent.scan_ai, onchange: () => (error = '') }),
            h('span', null, 'I agree that my scan photos are processed by an AI service to create my report. ', h('button', { class: 'link-btn inline', type: 'button', onclick: (e) => (e.preventDefault(), openLegal()) }, 'Privacy in plain words'))
          ),
        ],
      };
    }

    const steps = [stepAbout, stepGoal, stepTraining, stepLife, stepHealth];

    async function finish() {
      draft.name = draft.name.trim();
      draft.consent = { scan_ai: draft.consent.scan_ai || new Date().toISOString(), policy_version: POLICY_VERSION };
      if (!existing || draft.weight_kg !== originalWeight) P.addWeighIn(draft, draft.weight_kg, todayStr());
      const r = await b.saveProfile(draft);
      if (!r.ok) {
        error = r.error || 'Could not save your profile. Please try again.';
        return draw();
      }
      GB.app.go('home', true);
    }

    function draw() {
      const s = steps[step]();
      const last = step === steps.length - 1;
      mount(page, 
        h(
          'header',
          { class: 'wiz-head' },
          step > 0 || editing
            ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: () => (step > 0 ? ((step -= 1), (error = ''), draw()) : GB.app.go('home')) }, icon('back'))
            : h('span', { class: 'icon-btn spacer' }),
          h('div', { class: 'wiz-progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(steps.length), 'aria-valuenow': String(step + 1), 'aria-label': `Step ${step + 1} of ${steps.length}` }, h('i', { style: `width:${((step + 1) / steps.length) * 100}%` })),
          h('span', { class: 'wiz-count' }, `${step + 1}/${steps.length}`)
        ),
        h('h1', { class: 'wiz-title' }, s.title),
        h('p', { class: 'muted wiz-sub' }, s.subtitle),
        h('div', { class: 'wiz-body' }, s.body),
        error ? h('p', { class: 'form-err', role: 'alert' }, error) : null,
        h(
          'div',
          { class: 'wiz-foot' },
          h(
            'button',
            {
              class: 'btn primary big',
              type: 'button',
              onclick: () => {
                const msg = s.validate();
                if (msg) {
                  error = msg;
                  return draw();
                }
                error = '';
                if (last) finish();
                else {
                  step += 1;
                  draw();
                  window.scrollTo(0, 0);
                }
              },
            },
            last ? s.finishLabel : 'Continue'
          )
        )
      );
    }

    draw();
    return page;
  };
})((window.GB = window.GB || {}));
