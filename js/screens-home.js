/* GymBoy – the new Home: your body today, your latest scan, your next workout. */
(function (GB) {
  'use strict';
  const { h, svg, icon, openSheet, toast } = GB.ui;
  const P = GB.profile;
  const U = GB.util;
  const screens = (GB.screens = GB.screens || {});

  const fmt1 = (n) => (Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1));
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const TIPS = {
    lose_fat: ['Protein at every meal keeps you full and protects muscle while you lose fat.', 'Walk after meals. Ten minutes helps more than it sounds.', 'A weekly average of your weight tells the truth. One morning does not.'],
    build_muscle: ['Add a little weight or one rep each week. Small steps add up fast.', 'Aim to sleep 7 to 9 hours. Muscle is built while you rest.', 'Eat enough. Muscle needs fuel as well as training.'],
    recomposition: ['Lift heavy, eat plenty of protein and keep sleep steady. Patience wins here.', 'Judge progress in 4-week blocks, not day to day.', 'Rescan every 4 weeks under the same conditions.'],
    general_health: ['Move a little every day. Consistency beats intensity.', 'Strength training twice a week protects your joints and bones.', 'Drink water, get daylight, sleep on a schedule.'],
    performance: ['Train the skill first, when you are fresh.', 'Recovery is part of the plan. Plan rest like you plan sessions.', 'Track the lifts that matter and change one thing at a time.'],
  };

  /* ---------- small pieces ---------- */
  function countUp(el, to, decimals) {
    const text = (n) => (decimals ? n.toFixed(1) : String(Math.round(n)));
    if (reduceMotion()) {
      el.textContent = text(to);
      return;
    }
    const from = to * 0.92;
    const t0 = performance.now();
    const dur = 700;
    el.textContent = text(from);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = text(from + (to - from) * eased);
      if (t < 1 && el.isConnected !== false) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function trendLine(points, w, hgt) {
    // points: [{ kg }] in order; scaled to the box
    const vals = points.map((p) => p.kg);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const pad = 6;
    const xy = vals.map((v, i) => [pad + (vals.length === 1 ? 0.5 : i / (vals.length - 1)) * (w - 2 * pad), hgt - pad - ((v - min) / span) * (hgt - 2 * pad)]);
    const last = xy[xy.length - 1];
    return svg(
      'svg',
      { viewBox: `0 0 ${w} ${hgt}`, class: 'bh-spark', role: 'img', 'aria-label': 'Weight trend, last 30 days' },
      svg('polyline', { points: xy.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      svg('circle', { cx: last[0].toFixed(1), cy: last[1].toFixed(1), r: '4.5', fill: 'currentColor' })
    );
  }

  /* ---------- "log today's weight" ---------- */
  function openWeighIn(profile, afterSave) {
    const imperial = profile.units === 'imperial';
    const unit = imperial ? 'lb' : 'kg';
    let value = profile.weight_kg == null ? '' : fmt1(imperial ? P.kgToLb(profile.weight_kg) : profile.weight_kg);
    let err = '';
    const errEl = h('p', { class: 'form-err', role: 'alert' });
    const input = h('input', {
      class: 'field big-num',
      id: 'weighin',
      type: 'text',
      inputmode: 'decimal',
      value,
      autocomplete: 'off',
      'aria-label': `Today's weight in ${unit}`,
      onfocus: (e) => e.target.select(),
      oninput: (e) => (value = e.target.value),
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
      },
    });
    async function save() {
      const n = parseFloat(String(value).replace(',', '.'));
      const kg = imperial ? P.lbToKg(n) : n;
      if (!Number.isFinite(n) || kg < 30 || kg > 300) {
        errEl.textContent = 'Enter a weight between 30 and 300 kg.';
        return;
      }
      P.addWeighIn(profile, kg, new Date().toISOString().slice(0, 10));
      const r = await GB.backend.saveProfile(profile);
      if (!r.ok) {
        errEl.textContent = r.error || 'Could not save.';
        return;
      }
      sheet.close();
      toast('Weight logged', 'success');
      afterSave();
    }
    const sheet = openSheet({
      title: "Today's weight",
      body: [h('p', { class: 'muted pad-b' }, 'Weigh in the morning, before eating, for the most comparable number.'), h('div', { class: 'big-num-wrap' }, input, h('span', { class: 'bn-unit' }, unit)), errEl],
      footer: h('button', { class: 'btn primary big grow', type: 'button', onclick: save }, 'Save'),
      noFocus: true,
    });
    setTimeout(() => input.focus(), 150);
  }

  function openBmiInfo(bmi) {
    openSheet({
      title: `BMI ${fmt1(bmi)}`,
      body: [
        h('p', { class: 'pad-b' }, 'BMI is weight divided by height squared. It is a rough screening number and cannot tell muscle from fat, so a strong, lean person can still show a high BMI.'),
        h('p', { class: 'muted' }, 'A body scan gives you the real split: muscle, fat and where they are. Scan your InBody result to see yours.'),
      ],
      footer: h('button', { class: 'btn primary big grow', type: 'button', onclick: () => (document.querySelector('.sheet-wrap') && GB.ui.closeAllSheets(), GB.app.go('scan')) }, icon('camera', 20), 'Scan now'),
    });
  }

  /* =====================================================================
   * Home
   * ===================================================================== */
  screens.home = function () {
    const app = GB.app;
    const b = GB.backend;
    const profile = b.profile();
    const user = b.user();
    const scans = b.scans();
    const state = app.state;
    const imperial = profile.units === 'imperial';
    const unit = imperial ? 'lb' : 'kg';
    const dispW = (kg) => (imperial ? P.kgToLb(kg) : kg);

    /* --- hero: your body today --- */
    const weight = profile.weight_kg;
    const weightEl = h('span', { class: 'bh-num' }, weight == null ? '–' : fmt1(dispW(weight)));
    if (weight != null) countUp(weightEl, dispW(weight), true);

    const series = P.weightSeries(profile, 30);
    const windowPts = series.length >= 2 ? series : profile.weights.length >= 2 ? profile.weights : [];
    let deltaLine = h('p', { class: 'bh-delta muted' }, 'Log your weight to start your trend.');
    if (windowPts.length >= 2) {
      const d = windowPts[windowPts.length - 1].kg - windowPts[0].kg;
      const dd = Math.round(dispW(Math.abs(d)) * 10) / 10;
      deltaLine = h('p', { class: 'bh-delta' }, h('b', null, d === 0 ? 'No change' : `${d < 0 ? '−' : '+'}${fmt1(dd)} ${unit}`), h('span', { class: 'muted' }, series.length >= 2 ? ' in the last 30 days' : ' since you started'));
    }

    const heightText = profile.height_cm ? (imperial ? `${P.cmToFtIn(profile.height_cm).ft}′${P.cmToFtIn(profile.height_cm).in}″` : `${fmt1(profile.height_cm)} cm`) : '–';
    const bmi = P.bmi(profile.weight_kg, profile.height_cm);
    const prog = P.goalProgress(profile);

    const hero = h(
      'section',
      { class: 'card body-hero' },
      h('div', { class: 'bh-top' }, h('p', { class: 'eyebrow' }, 'Your body today'), h('button', { class: 'btn small soft', type: 'button', onclick: () => openWeighIn(profile, () => app.render()) }, icon('scale', 18), 'Log weight')),
      h(
        'div',
        { class: 'bh-main' },
        h('div', { class: 'bh-weight' }, weightEl, h('span', { class: 'bh-unit' }, unit)),
        h('div', { class: 'bh-chips' }, h('span', { class: 'bh-chip' }, h('small', null, 'Height'), h('b', null, heightText)), bmi != null ? h('button', { class: 'bh-chip tap', type: 'button', onclick: () => openBmiInfo(bmi), 'aria-label': `BMI ${fmt1(bmi)}. Tap to learn more` }, h('small', null, 'BMI'), h('b', null, fmt1(bmi))) : null)
      ),
      deltaLine,
      windowPts.length >= 2 ? trendLine(windowPts, 300, 64) : null,
      prog
        ? h(
            'div',
            { class: 'goal' },
            h('div', { class: 'goal-row' }, h('span', null, `${fmt1(dispW(prog.start))} ${unit}`), h('b', null, prog.reached ? 'Goal reached!' : `${fmt1(dispW(prog.remaining))} ${unit} to go`), h('span', null, `${fmt1(dispW(prog.target))} ${unit}`)),
            h('div', { class: 'goal-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(prog.fraction * 100)), 'aria-label': 'Progress to your goal weight' }, h('i', { style: `width:${Math.max(3, Math.round(prog.fraction * 100))}%` }))
          )
        : null
    );

    /* --- latest scan, or the invitation to take the first one --- */
    let scanCard;
    const latest = scans[0];
    if (latest && latest.report) {
      const r = latest.report;
      const score = r.report && r.report.score;
      scanCard = h(
        'section',
        { class: 'card scan-card' },
        h('p', { class: 'eyebrow' }, 'Latest scan'),
        h(
          'div',
          { class: 'sc-row' },
          score ? GB.reportView.ring(score.value, score.max || 100, 84, score.label) : h('span', { class: 'sc-ico' }, icon('camera', 30)),
          h('div', { class: 'sc-text' }, h('h2', null, r.report.headline || 'Your scan report'), h('p', { class: 'muted' }, U.fmtDate(new Date(latest.created_at).getTime(), { day: 'numeric', month: 'short', year: 'numeric' }), r.status === 'partial' ? ' · some values unreadable' : ''))
        ),
        h('div', { class: 'row gap' }, h('button', { class: 'btn primary grow', type: 'button', onclick: () => app.go('report/' + latest.id) }, 'View report'), h('button', { class: 'btn soft', type: 'button', onclick: () => app.go('scan') }, icon('camera', 18), 'New scan'))
      );
    } else {
      scanCard = h(
        'section',
        { class: 'card scan-cta' },
        h('span', { class: 'sc-ico big' }, icon('camera', 34)),
        h('h2', null, 'Scan your first InBody'),
        h('p', { class: 'muted' }, 'Take a photo of your result sheet. In under a minute you get a visual report of your muscle, fat and balance.'),
        h('button', { class: 'btn primary big', type: 'button', onclick: () => app.go('scan') }, icon('camera', 22), 'Scan now')
      );
    }

    /* --- today's workout --- */
    const weekStart = U.startOfWeek(Date.now());
    const week = state.sessions.filter((s) => s.endedAt >= weekStart).length;
    const lastSession = state.sessions.slice().sort((x, y) => y.endedAt - x.endedAt)[0];
    const workoutCard = state.active
      ? h('section', { class: 'card hero live' }, h('p', { class: 'eyebrow' }, h('i', { class: 'pulse' }), 'Workout in progress'), h('h2', null, state.active.dayName), h('button', { class: 'btn primary big', type: 'button', onclick: () => app.go('session') }, 'Resume workout'))
      : h(
          'section',
          { class: 'card wk-card' },
          h('div', { class: 'wk-text' }, h('h2', null, 'Ready to train?'), h('p', { class: 'muted' }, week ? `${app.plural(week, 'workout')} this week` : 'No workouts yet this week', lastSession ? ` · last: ${lastSession.dayName}` : '')),
          h('button', { class: 'btn primary', type: 'button', onclick: () => app.go('start') }, icon('bolt', 20), 'Start')
        );

    /* --- one thing worth knowing --- */
    let insight = null;
    if (latest && latest.report && latest.report.report && latest.report.report.insights && latest.report.report.insights.length) {
      const list = latest.report.report.insights;
      const pick = list.find((i) => i.sentiment === 'attention') || list[0];
      insight = h('section', { class: 'card tip ' + pick.sentiment }, h('p', { class: 'eyebrow' }, icon('spark', 16), 'From your scan'), h('p', { class: 'tip-text' }, pick.text));
    } else {
      const tips = TIPS[profile.goal && profile.goal.primary] || TIPS.general_health;
      insight = h('section', { class: 'card tip neutral' }, h('p', { class: 'eyebrow' }, icon('spark', 16), 'Today'), h('p', { class: 'tip-text' }, tips[dayOfYear() % tips.length]));
    }

    return h(
      'div',
      { class: 'page home2' },
      h('header', { class: 'page-head home-head' }, h('div', { class: 'hello' }, h('small', null, P.greeting()), h('b', null, P.firstName(profile.name || (user && user.name)) || 'Welcome')), app.settingsButton()),
      hero,
      scanCard,
      workoutCard,
      insight
    );
  };
})((window.GB = window.GB || {}));
