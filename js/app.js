/* GymBoy – app views and logic */
(function (GB) {
  'use strict';

  const { MUSCLES, ALL_MUSCLES, DAY_TYPES, EXERCISES } = GB.data;
  const { h, icon, openSheet, closeAllSheets, confirmSheet, toast } = GB.ui;
  const U = GB.util;
  const store = GB.store;

  /* =====================================================================
   * State
   * ===================================================================== */
  const state = {
    sessions: store.loadSessions(), // finished workouts
    active: store.loadActive(), // workout in progress (or null)
    settings: store.loadSettings(),
    custom: store.loadCustom(), // user-added exercises [{name, muscle}]
    extras: store.loadExtras(), // your own note/link per exercise { 'barbell squat': { note, link } }
  };

  const viewEl = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');
  const restEl = document.getElementById('rest');

  let viewTimers = [];
  let sessionCtx = null; // the open workout screen, so a partner's new exercise can appear in it
  const historyOpen = new Set(); // expanded history cards
  let historyLimit = 20;
  let currentExId = null; // the exercise you touched last (for "ten reps" with no name)

  const saveActive = () => {
    store.saveActive(state.active);
    if (state.active && state.active.pair && GB.pairUI) GB.pairUI.changed(); // keeps the partner's live view current
  };
  const saveSettings = () => store.saveSettings(state.settings);

  /* =====================================================================
   * Helpers
   * ===================================================================== */
  const convertWeight = U.convertWeight;

  function convertVolume(v, from, to) {
    if (from === to) return v;
    return from === 'lb' ? v / 2.20462 : v * 2.20462;
  }

  // Exercise library = built-in list + anything the user has typed in before.
  function library() {
    const seen = new Set();
    const out = [];
    EXERCISES.map(([name, muscle]) => ({ name, muscle }))
      .concat(state.custom)
      .forEach((e) => {
        const k = U.keyOf(e.name);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(e);
        }
      });
    return out;
  }

  function tidyName(raw) {
    let s = raw.replace(/\s+/g, ' ').trim();
    if (s && s === s.toLowerCase()) s = s.replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase());
    return s.slice(0, 60);
  }

  // A set's weight: what was typed, falling back to the grey suggestion.
  const effW = (s) => (s.w !== '' ? s.w : s.gw || '');

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const dayById = (id) => DAY_TYPES.find((d) => d.id === id);

  function musclesLabel(muscles) {
    return muscles.map((m) => MUSCLES[m] || m).join(' · ');
  }

  // Last time this exercise was logged, converted into the active unit.
  function lastSetsFor(name, unit) {
    const last = U.lastPerformance(state.sessions, name);
    if (!last) return null;
    const from = last.unit || 'kg';
    return {
      date: last.date,
      sets: last.sets.map((s) => ({ w: convertWeight(s.w, from, unit), r: s.r, t: s.t || 0 })),
    };
  }

  // The grey "last time" suggestions for a set. Timed sets suggest time, weight and reps,
  // leaving out zeros so an empty weight or rep count isn't auto-filled.
  function ghostFrom(g, timed) {
    if (!timed) return g ? { gw: String(g.w), gr: String(g.r) } : { gw: '', gr: '' };
    const pos = (n) => (n > 0 ? String(n) : '');
    return g ? { gt: pos(g.t), gw: pos(g.w), gr: pos(g.r) } : { gt: '', gw: '', gr: '' };
  }

  function blankSet(timed, g) {
    const base = timed ? { t: '', w: '', r: '', done: false } : { w: '', r: '', done: false };
    return Object.assign(base, ghostFrom(g, timed));
  }

  // A new set after `prev`, suggesting whatever `prev` has (typed, else its own suggestion).
  function nextSetAfter(prev, timed) {
    const eff = (v, g) => (v !== '' && v != null ? v : g || '');
    const set = blankSet(timed, null);
    if (prev) {
      set.gw = eff(prev.w, prev.gw);
      set.gr = eff(prev.r, prev.gr);
      if (timed) set.gt = eff(prev.t, prev.gt);
    }
    return set;
  }

  function makeExercise(name, muscle, setCount) {
    const unit = state.active.unit;
    const timed = U.isTimed({ muscle });
    const last = lastSetsFor(name, unit);
    const n = setCount || (last ? Math.min(last.sets.length, 8) : timed ? 4 : 3);
    const sets = [];
    for (let i = 0; i < n; i++) {
      const g = last ? last.sets[i] || last.sets[last.sets.length - 1] : null;
      sets.push(blankSet(timed, g));
    }
    return { id: U.uid(), name, muscle, sets };
  }

  const setIsEmpty = (s) => s.w === '' && s.r === '' && (s.t == null || s.t === '');

  // Re-point the "ghost" (grey placeholder) values of untouched sets.
  function reghost(ex) {
    const timed = U.isTimed(ex);
    const last = lastSetsFor(ex.name, state.active.unit);
    ex.sets.forEach((s, i) => {
      if (s.done || !setIsEmpty(s)) return;
      const g = last ? last.sets[i] || last.sets[last.sets.length - 1] : null;
      Object.assign(s, ghostFrom(g, timed));
    });
  }

  function startSession(day, template, push, extra) {
    state.active = {
      id: U.uid(),
      dayId: day.id,
      dayName: day.name,
      muscles: day.muscles,
      startedAt: Date.now(),
      unit: state.settings.unit,
      exercises: [],
    };
    if (template) {
      state.active.exercises = template.map((ex) => makeExercise(ex.name, ex.muscle, ex.sets.length));
    }
    if (extra) Object.assign(state.active, extra); // e.g. { pair: {...} } for a pair workout
    saveActive();
    go('session', !push);
  }

  /* =====================================================================
   * Router
   * ===================================================================== */
  const ROUTES = ['home', 'workout', 'start', 'session', 'history', 'progress', 'scan', 'report', 'welcome', 'onboarding', 'pair'];
  const TAB_ROUTES = ['home', 'workout', 'pair', 'scan', 'history', 'progress'];

  // 'report/abc123' -> { name: 'report', param: 'abc123' }
  const parseRoute = (str) => {
    const parts = String(str || '').split('/');
    return { name: parts[0], param: parts.slice(1).join('/') || null };
  };

  // The route lives in `routeState`; the URL hash mirrors it so the phone's back
  // button works. If a host blocks hash changes, navigation still works.
  const hashRoute = () => {
    try {
      const r = location.hash.replace(/^#\/?/, '');
      return ROUTES.includes(parseRoute(r).name) ? r : null;
    } catch (e) {
      return null;
    }
  };

  let routeState = hashRoute() || 'home';
  const currentRoute = () => parseRoute(routeState).name;
  const routeParam = () => parseRoute(routeState).param;

  // Logging workouts never needs an account: those screens are always open, and workouts live on
  // the device. Only the AI scan reports (which call the paid analysis service and store a profile)
  // ask for a profile, and for a sign-in once the account service is connected. The server checks
  // the sign-in again on every scan request; this gate is only there to guide people.
  const OPEN_ROUTES = ['home', 'workout', 'start', 'session', 'history', 'progress', 'pair'];

  // Where you were headed before being sent to set up an account, so you land back there.
  let returnTo = null;
  function takeReturn() {
    const r = returnTo;
    returnTo = null;
    return r;
  }

  // Where the account state says you must be (null = stay where you are).
  function accountGate(r) {
    const b = GB.backend;
    if (!b) return null;
    if (OPEN_ROUTES.includes(r)) {
      returnTo = null;
      return null;
    }
    const needsSignIn = b.mode === 'supabase' && !b.isSignedIn();
    if (r === 'welcome') return needsSignIn ? null : 'home';
    if (needsSignIn) {
      returnTo = routeState;
      return 'welcome';
    }
    if (r === 'onboarding') return null;
    if (!b.hasProfile()) {
      returnTo = routeState;
      return 'onboarding';
    }
    return null;
  }

  function go(route, replace) {
    routeState = route;
    try {
      const target = '#/' + route;
      if (location.hash !== target) {
        if (replace) location.replace(target);
        else location.hash = target;
      }
    } catch (e) { /* hash updates are best effort */ }
    render();
  }

  function render() {
    viewTimers.forEach(clearInterval);
    viewTimers = [];
    sessionCtx = null;

    const gate = accountGate(currentRoute());
    if (gate && gate !== currentRoute()) {
      if (returnTo) toast(gate === 'welcome' ? 'Sign in to use scan reports. Workouts never need an account.' : 'Quick setup first, then your scan.');
      return go(gate, true);
    }

    const r = currentRoute();
    if (r === 'session' && !state.active) return go('workout', true);
    if (r === 'start' && state.active) return go('session', true);

    // Screens from other files (js/*-screen*.js) register in GB.screens.
    const views = Object.assign({ home: viewWorkout, workout: viewWorkout, start: viewStart, session: viewSession, history: viewHistory, progress: viewProgress }, GB.screens);
    viewEl.replaceChildren(views[r](routeParam()));
    viewEl.dataset.route = r;

    const showTabs = TAB_ROUTES.includes(r);
    tabsEl.hidden = !showTabs;
    document.body.classList.toggle('has-tabs', showTabs);
    tabsEl.querySelectorAll('a').forEach((a) => {
      if (a.dataset.route === r) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    window.scrollTo(0, 0);
    updateWake();
  }

  function buildTabs() {
    const tab = (route, label, ico) => h('a', { href: '#/' + route, dataset: { route } }, icon(ico, 22), h('span', null, label));
    tabsEl.append(
      tab('home', 'Home', 'home'),
      tab('workout', 'Workout', 'bolt'),
      tab('pair', 'Pair', 'users'),
      tab('scan', 'Scan', 'camera'),
      tab('history', 'History', 'history'),
      tab('progress', 'Progress', 'chart')
    );
  }

  /* =====================================================================
   * Shared bits
   * ===================================================================== */
  function pageHeader(title, opts) {
    opts = opts || {};
    return h(
      'header',
      { class: 'page-head' },
      opts.back ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: opts.back }, icon('back')) : null,
      h('h1', null, title),
      opts.right || null
    );
  }

  const settingsButton = () =>
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', onclick: openSettings }, icon('gear'));

  function statTile(label, value, unitText) {
    return h('div', { class: 'stat' }, h('div', { class: 'num' }, h('b', null, value), unitText ? h('small', null, unitText) : null), h('span', null, label));
  }

  // Big totals shortened (27.6k, 176k) so they fit in a small stat tile or bar column.
  function fmtBig(n) {
    const v = Math.round(n);
    if (v >= 999500) return `${U.fmtNum(Math.round(v / 1e5) / 10)}M`;
    if (v >= 99950) return `${Math.round(v / 1e3)}k`;
    if (v >= 10000) return `${U.fmtNum(Math.round(v / 100) / 10)}k`;
    return U.fmtNum(v);
  }

  // A reminder, shown on Home, History and Progress, while sample workouts are loaded.
  function demoBanner() {
    const n = state.sessions.filter((s) => s.demo).length;
    if (!n) return null;
    return h(
      'div',
      { class: 'demo-banner' },
      h('span', null, `Sample data: ${plural(n, 'demo workout')}`),
      h('button', { class: 'link-btn', type: 'button', onclick: removeDemo }, 'Remove')
    );
  }

  /* =====================================================================
   * Home
   * ===================================================================== */
  function viewWorkout() {
    const unit = state.settings.unit;
    const weekStart = U.startOfWeek(Date.now());
    const week = state.sessions.filter((s) => s.endedAt >= weekStart);
    const totals = week.reduce(
      (acc, s) => {
        const st = U.stats(s);
        acc.sets += st.sets;
        acc.volume += convertVolume(st.volume, s.unit || 'kg', unit);
        return acc;
      },
      { sets: 0, volume: 0 }
    );

    const a = state.active;
    let hero;
    if (a) {
      const elapsed = h('span', null, U.fmtDuration(Date.now() - a.startedAt));
      viewTimers.push(setInterval(() => (elapsed.textContent = U.fmtDuration(Date.now() - a.startedAt)), 1000));
      const st = U.stats(a, true);
      hero = h(
        'section',
        { class: 'card hero live' },
        h('p', { class: 'eyebrow' }, h('i', { class: 'pulse' }), 'Workout in progress'),
        h('h2', null, a.dayName),
        h('p', { class: 'muted' }, elapsed, ` · ${a.exercises.length} exercise${a.exercises.length === 1 ? '' : 's'} · ${st.sets} set${st.sets === 1 ? '' : 's'} done`),
        h(
          'div',
          { class: 'row gap' },
          h('button', { class: 'btn primary grow', type: 'button', onclick: () => go('session') }, 'Resume workout'),
          h(
            'button',
            {
              class: 'btn ghost',
              type: 'button',
              onclick: async () => {
                if (await confirmSheet({ title: 'Discard this workout?', message: 'Everything you logged in this session will be lost.', confirmText: 'Discard', danger: true })) {
                  discardSession();
                  render();
                }
              },
            },
            'Discard'
          )
        )
      );
    } else {
      hero = h(
        'section',
        { class: 'card hero' },
        h('h2', null, 'Ready to train?'),
        h('p', { class: 'muted' }, 'Pick your day, add exercises, log every set.'),
        h('button', { class: 'btn primary big', type: 'button', onclick: () => go('start') }, icon('bolt', 22), 'Start workout')
      );
    }

    const recent = state.sessions.slice().sort((x, y) => y.endedAt - x.endedAt).slice(0, 3);

    return h(
      'div',
      { class: 'page' },
      h('header', { class: 'page-head home-head' }, h('div', { class: 'brand' }, h('span', { class: 'logo' }, icon('bolt', 18)), 'GYMBOY'), settingsButton()),
      demoBanner(),
      hero,
      h('h3', { class: 'section-title' }, 'This week'),
      h(
        'div',
        { class: 'stats' },
        statTile('Workouts', String(week.length)),
        statTile('Sets', String(totals.sets)),
        statTile('Volume', fmtBig(totals.volume), unit)
      ),
      h('h3', { class: 'section-title' }, 'Recent'),
      recent.length
        ? h(
            'div',
            { class: 'list' },
            recent.map((s) => {
              const st = U.stats(s);
              return h(
                'button',
                {
                  class: 'list-row',
                  type: 'button',
                  onclick: () => {
                    historyOpen.add(s.id);
                    go('history');
                  },
                },
                h('span', { class: 'lr-main' }, h('b', null, s.dayName), h('small', null, `${U.fmtDate(s.endedAt)} · ${plural(st.sets, 'set')} · ${st.volume > 0 || st.work === 0 ? `${U.fmtNum(Math.round(st.volume))} ${s.unit || 'kg'}` : `${U.fmtDuration(st.work * 1000)} work`}`)),
                icon('back', 18)
              );
            })
          )
        : h('p', { class: 'empty' }, 'No workouts yet. Your finished sessions will show up here.')
    );
  }

  /* =====================================================================
   * Start: choose the kind of day
   * ===================================================================== */
  function viewStart() {
    const tiles = DAY_TYPES.map((d) =>
      h('button', { class: 'tile', type: 'button', onclick: () => startSession(d) }, h('b', null, d.name), h('small', null, d.blurb || musclesLabel(d.muscles)))
    );
    tiles.push(h('button', { class: 'tile custom', type: 'button', onclick: openCustomDay }, h('b', null, 'Custom'), h('small', null, 'Name it, pick muscles')));

    return h('div', { class: 'page' }, pageHeader('What are we training?', { back: () => go('workout') }), h('div', { class: 'tiles' }, tiles));
  }

  function openCustomDay() {
    const selected = new Set();
    let name = '';
    const startBtn = h('button', { class: 'btn primary grow', type: 'button', disabled: true, onclick: begin }, 'Start workout');
    const chips = h(
      'div',
      { class: 'chips wrap' },
      ALL_MUSCLES.map((m) =>
        h(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-pressed': 'false',
            onclick: (e) => {
              if (selected.has(m)) selected.delete(m);
              else selected.add(m);
              e.currentTarget.setAttribute('aria-pressed', String(selected.has(m)));
              startBtn.disabled = selected.size === 0;
            },
          },
          MUSCLES[m]
        )
      )
    );
    const nameInput = h('input', {
      class: 'field',
      type: 'text',
      placeholder: 'e.g. Arms & Abs',
      maxLength: 30,
      autocomplete: 'off',
      'aria-label': 'Workout name',
      oninput: (e) => (name = e.target.value),
    });

    function begin() {
      const muscles = ALL_MUSCLES.filter((m) => selected.has(m));
      const label = name.trim() || musclesLabel(muscles).replace(/ · /g, ' + ');
      sheet.close();
      startSession({ id: 'custom', name: label.slice(0, 40), muscles });
    }

    const sheet = openSheet({
      title: 'Custom day',
      body: [h('label', { class: 'label' }, 'Name (optional)'), nameInput, h('label', { class: 'label' }, 'Muscles you are training'), chips],
      footer: startBtn,
    });
  }

  /* =====================================================================
   * Session (the logger)
   * ===================================================================== */
  // keepPair: the workout was finished, not abandoned, so the partner connection stays open for the result.
  function discardSession(keepPair) {
    if (!keepPair && state.active && state.active.pair && GB.pairUI) GB.pairUI.discarded();
    state.active = null;
    saveActive();
    stopRest();
  }

  function viewSession() {
    const a = state.active;

    const elapsed = h('span', { class: 'elapsed' }, U.fmtDuration(Date.now() - a.startedAt));
    viewTimers.push(setInterval(() => (elapsed.textContent = U.fmtDuration(Date.now() - a.startedAt)), 1000));

    const hiitDay = a.dayId === 'hiit';
    const mobilityDay = a.dayId === 'mobility';
    const timedDay = hiitDay || mobilityDay; // logged by time, so show work time instead of volume
    const sExercises = h('b', null, '0');
    const sSets = h('b', null, '0');
    const sThird = h('b', null, '0'); // volume, or work time on a HIIT day
    const list = h('div', { class: 'ex-list' });

    const ctx = {
      updateStats() {
        const st = U.stats(a, true);
        sExercises.textContent = String(a.exercises.length);
        sSets.textContent = String(st.sets);
        sThird.textContent = timedDay ? U.fmtDuration(st.work * 1000) : U.fmtNum(Math.round(st.volume));
      },
      refreshCard(ex, pop) {
        const old = list.querySelector(`[data-id="${ex.id}"]`);
        if (old) old.replaceWith(exerciseCard(ex, ctx, pop));
      },
      refreshList() {
        list.replaceChildren(...buildList());
        ctx.updateStats();
      },
    };

    function lastSameDay() {
      return state.sessions
        .filter((s) => s.dayId === a.dayId && (a.dayId !== 'custom' || s.dayName === a.dayName))
        .sort((x, y) => y.endedAt - x.endedAt)[0];
    }

    function buildList() {
      const nodes = a.exercises.map((ex) => exerciseCard(ex, ctx));
      if (!a.exercises.length) {
        const prev = lastSameDay();
        nodes.push(
          h(
            'div',
            { class: 'card empty-card' },
            h('h2', null, 'Add your first exercise'),
            h('p', { class: 'muted' }, `Choose from the ${a.dayName} list or type your own.`),
            h('button', { class: 'btn primary big', type: 'button', onclick: () => openPicker() }, icon('plus', 22), 'Add exercise'),
            prev
              ? h(
                  'button',
                  {
                    class: 'btn ghost',
                    type: 'button',
                    onclick: () => {
                      a.exercises = prev.exercises.map((ex) => makeExercise(ex.name, ex.muscle, ex.sets.length));
                      saveActive();
                      ctx.refreshList();
                    },
                  },
                  icon('repeat', 18),
                  `Copy exercises from last ${a.dayName} (${U.fmtDate(prev.endedAt, { day: 'numeric', month: 'short' })})`
                )
              : null
          )
        );
      } else {
        nodes.push(h('button', { class: 'btn add-ex', type: 'button', onclick: () => openPicker() }, icon('plus', 20), 'Add exercise'));
      }
      return nodes;
    }

    ctx.refreshList();
    sessionCtx = ctx;

    ctx.openPicker = openPicker;
    return h(
      'div',
      { class: 'page session' },
      h(
        'header',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to workouts', onclick: () => go('workout') }, icon('back')),
        h('div', { class: 'tb-title' }, h('b', null, a.dayName), elapsed),
        h('button', { class: 'icon-btn mic-top', type: 'button', 'aria-label': 'Quick log a set by voice or typing', onclick: () => openQuickLog(ctx) }, icon('mic', 22)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Workout options', onclick: openSessionMenu }, icon('more')),
        h('button', { class: 'btn primary small', type: 'button', onclick: openFinish }, 'Finish')
      ),
      h('div', { class: 'stats slim' }, h('div', { class: 'stat' }, sExercises, h('span', null, 'Exercises')), h('div', { class: 'stat' }, sSets, h('span', null, 'Sets done')), h('div', { class: 'stat' }, sThird, h('span', null, timedDay ? 'Work time' : `Volume (${a.unit})`))),
      GB.pairUI ? GB.pairUI.bar() : null,
      hiitDay ? h('button', { class: 'btn soft iv-launch', type: 'button', onclick: () => openIntervalTimer(ctx) }, icon('timer', 20), 'Interval timer') : null,
      mobilityDay ? h('button', { class: 'btn soft iv-launch', type: 'button', onclick: () => openFlows(ctx) }, icon('flow', 20), 'Guided flows') : null,
      list
    );

    function openSessionMenu() {
      const sheet = openSheet({
        title: a.dayName,
        body: h(
          'div',
          { class: 'menu' },
          menuItem('mic', 'Quick log (say or type a set)', false, () => {
            sheet.close();
            openQuickLog(ctx);
          }),
          menuItem('flow', 'Guided flows (mobility, ground, yoga)', false, () => {
            sheet.close();
            openFlows(ctx);
          }),
          menuItem('timer', 'Interval timer', false, () => {
            sheet.close();
            openIntervalTimer(ctx);
          }),
          menuItem('share', 'Share as picture', false, () => {
            const exercises = collectExercises(a, false);
            if (!exercises.length) return toast('Tick off a set first');
            sheet.close();
            GB.share.open({ dayName: a.dayName, startedAt: a.startedAt, endedAt: Date.now(), unit: a.unit, exercises });
          }),
          menuItem('trash', 'Discard workout', true, async () => {
            sheet.close();
            if (await confirmSheet({ title: 'Discard this workout?', message: 'Everything you logged in this session will be lost.', confirmText: 'Discard', danger: true })) {
              discardSession();
              go('workout', true);
              toast('Workout discarded');
            }
          })
        ),
      });
    }

    function openPicker(replaceEx) {
      pickExercise(replaceEx, (ex, isNew) => {
        ctx.refreshList();
        if (isNew) {
          const card = list.querySelector(`[data-id="${ex.id}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function menuItem(ico, label, danger, onclick) {
    return h('button', { class: 'menu-item' + (danger ? ' danger' : ''), type: 'button', onclick }, icon(ico, 20), h('span', null, label));
  }

  /* ---------- one exercise card ---------- */
  function exerciseCard(ex, ctx, popIndex) {
    const a = state.active;
    const timed = U.isTimed(ex);
    const last = lastSetsFor(ex.name, a.unit);

    const card = h('section', { class: 'card ex', dataset: { id: ex.id } });

    card.append(
      h(
        'div',
        { class: 'ex-head' },
        h(
          'button',
          { class: 'ex-title', type: 'button', 'aria-label': `${ex.name}. Tap to change exercise`, onclick: () => ctx.openPicker(ex) },
          h('span', { class: 'ex-name' }, ex.name),
          h('span', { class: 'tag' }, MUSCLES[ex.muscle] || 'Other')
        ),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `How to do ${ex.name}`, onclick: () => showHowTo(ex.name, ex.muscle) }, icon('info')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Exercise options', onclick: () => exerciseMenu(ex, ctx) }, icon('more'))
      ),
      last
        ? h('p', { class: 'last' }, h('span', { class: 'when' }, 'Last ' + U.fmtDate(last.date, { day: 'numeric', month: 'short' })), last.sets.map((s) => U.setCompact(s, timed, a.unit)).join('  ·  '))
        : h('p', { class: 'last none' }, 'First time logging this one')
    );

    const weighted = U.hasWeight(ex);
    const grid = h('div', { class: 'sets' + (timed ? ' timed' : '') + (weighted ? '' : ' noweight') });
    grid.append(
      h(
        'div',
        { class: 'set-head' },
        h('span', null, 'Set'),
        timed ? h('span', null, 'Sec') : null,
        weighted ? h('span', null, a.unit) : null,
        h('span', null, 'Reps'),
        h('span', { class: 'sr-only' }, 'Done')
      )
    );
    ex.sets.forEach((set, i) => grid.append(setRow(ex, set, i, ctx, popIndex === i)));
    card.append(grid);

    if (ex.note != null) {
      card.append(
        h('textarea', {
          class: 'note',
          rows: 2,
          placeholder: 'Notes (seat height, cues, how it felt…)',
          maxLength: 300,
          value: ex.note,
          'aria-label': `Notes for ${ex.name}`,
          oninput: (e) => {
            ex.note = e.target.value;
            saveActive();
          },
        })
      );
    }

    card.append(
      h(
        'div',
        { class: 'ex-actions' },
        h(
          'button',
          {
            class: 'btn soft',
            type: 'button',
            onclick: () => {
              ex.sets.push(nextSetAfter(ex.sets[ex.sets.length - 1], timed));
              saveActive();
              ctx.refreshCard(ex);
            },
          },
          icon('plus', 18),
          'Add set'
        ),
        h(
          'button',
          {
            class: 'btn soft',
            type: 'button',
            disabled: ex.sets.length <= 1,
            onclick: () => {
              ex.sets.pop();
              saveActive();
              ctx.refreshCard(ex);
              ctx.updateStats();
            },
          },
          icon('minus', 18),
          'Remove set'
        )
      )
    );
    return card;
  }

  function setRow(ex, set, i, ctx, pop) {
    const a = state.active;
    const timed = U.isTimed(ex);
    const weighted = U.hasWeight(ex);
    const inputs = {};

    if (timed) {
      inputs.t = h('input', {
        class: 'num',
        type: 'text',
        inputmode: 'numeric',
        enterkeyhint: 'next',
        autocomplete: 'off',
        placeholder: set.gt || '0',
        value: set.t,
        'aria-label': `Set ${i + 1} work time in seconds`,
        onfocus: (e) => e.target.select(),
        oninput: (e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          if (v !== e.target.value) e.target.value = v;
          set.t = v;
          saveActive();
          ctx.updateStats();
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (weighted ? inputs.w : inputs.r).focus();
          }
        },
      });
    }

    inputs.w = h('input', {
      class: 'num',
      type: 'text',
      inputmode: 'decimal',
      enterkeyhint: 'next',
      autocomplete: 'off',
      placeholder: set.gw || '0',
      value: set.w,
      'aria-label': `Set ${i + 1} weight in ${a.unit}${timed ? ' (optional)' : ''}`,
      onfocus: (e) => e.target.select(),
      oninput: (e) => {
        const v = U.cleanNum(e.target.value);
        if (v !== e.target.value) e.target.value = v;
        set.w = v;
        saveActive();
        ctx.updateStats();
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputs.r.focus();
        }
      },
    });

    inputs.r = h('input', {
      class: 'num',
      type: 'text',
      inputmode: 'numeric',
      enterkeyhint: 'done',
      autocomplete: 'off',
      placeholder: set.gr || '0',
      value: set.r,
      'aria-label': `Set ${i + 1} reps${timed ? ' (optional)' : ''}`,
      onfocus: (e) => e.target.select(),
      oninput: (e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (v !== e.target.value) e.target.value = v;
        set.r = v;
        saveActive();
        ctx.updateStats();
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      },
    });

    const tick = h(
      'button',
      {
        class: 'tick',
        type: 'button',
        'aria-pressed': String(set.done),
        'aria-label': set.done ? `Set ${i + 1} done. Tap to undo` : `Mark set ${i + 1} done`,
        onclick: () => toggleSet(ex, set, i, ctx, inputs),
      },
      icon('check', 22)
    );

    return h(
      'div',
      { class: 'set' + (set.done ? ' done' : '') + (pop ? ' pop' : ''), onfocusin: () => (currentExId = ex.id) },
      h('span', { class: 'set-num' }, String(i + 1)),
      inputs.t,
      weighted ? inputs.w : null,
      inputs.r,
      tick
    );
  }

  function toggleSet(ex, set, i, ctx, inputs) {
    if (set.done) {
      set.done = false;
      saveActive();
      ctx.refreshCard(ex);
      ctx.updateStats();
      return;
    }
    // Tapping the tick on an untouched row accepts the grey "last time" numbers.
    const timed = U.isTimed(ex);
    if (timed && set.t === '' && set.gt) set.t = set.gt;
    if (set.w === '' && set.gw) set.w = set.gw;
    if (set.r === '' && set.gr) set.r = set.gr;
    if (!U.hasWork(set)) {
      toast(timed ? 'Enter the time or reps first' : 'Enter the reps first');
      (timed ? inputs.t : inputs.r).focus();
      return;
    }
    set.done = true;
    currentExId = ex.id;
    // Carry what you just did forward to the sets still to do.
    for (let j = i + 1; j < ex.sets.length; j++) {
      const n = ex.sets[j];
      if (!n.done && setIsEmpty(n)) {
        n.gw = set.w;
        n.gr = set.r;
        if (timed) n.gt = set.t;
      }
    }
    saveActive();
    ctx.refreshCard(ex, i);
    ctx.updateStats();
    startRest();
  }

  function exerciseMenu(ex, ctx) {
    const a = state.active;
    const idx = a.exercises.indexOf(ex);
    const sheet = openSheet({
      title: ex.name,
      body: h(
        'div',
        { class: 'menu' },
        menuItem('info', 'How to do it', false, () => {
          sheet.close();
          showHowTo(ex.name, ex.muscle);
        }),
        menuItem('swap', 'Change exercise', false, () => {
          sheet.close();
          ctx.openPicker(ex);
        }),
        menuItem('note', ex.note != null ? 'Hide note' : 'Add note', false, () => {
          if (ex.note != null) delete ex.note;
          else ex.note = '';
          saveActive();
          sheet.close();
          ctx.refreshCard(ex);
        }),
        idx > 0
          ? menuItem('up', 'Move up', false, () => {
              a.exercises.splice(idx, 1);
              a.exercises.splice(idx - 1, 0, ex);
              saveActive();
              sheet.close();
              ctx.refreshList();
            })
          : null,
        idx < a.exercises.length - 1
          ? menuItem('down', 'Move down', false, () => {
              a.exercises.splice(idx, 1);
              a.exercises.splice(idx + 1, 0, ex);
              saveActive();
              sheet.close();
              ctx.refreshList();
            })
          : null,
        menuItem('trash', 'Remove exercise', true, async () => {
          sheet.close();
          const hasData = ex.sets.some((s) => s.done || !setIsEmpty(s));
          if (hasData && !(await confirmSheet({ title: `Remove ${ex.name}?`, message: 'Its logged sets will be deleted.', confirmText: 'Remove', danger: true }))) return;
          a.exercises = a.exercises.filter((e) => e !== ex);
          saveActive();
          ctx.refreshList();
        })
      ),
    });
  }

  /* ---------- exercise picker (dropdown + type your own) ---------- */
  function pickExercise(replaceEx, done) {
    const a = state.active;
    let filter = 'day'; // 'day' | 'all' | muscle key
    let query = '';
    let customMuscle = a.muscles[0] || 'chest';

    const list = h('div', { class: 'pick-list' });
    const chips = h('div', { class: 'chips scroll' });

    const input = h('input', {
      class: 'search',
      type: 'search',
      placeholder: 'Search, or type a new exercise…',
      autocomplete: 'off',
      autocapitalize: 'words',
      enterkeyhint: 'done',
      'aria-label': 'Search or type an exercise name',
      oninput: (e) => {
        query = e.target.value;
        renderList();
      },
      onkeydown: (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const name = tidyName(query);
        if (!name) return;
        const hit = library().find((x) => U.keyOf(x.name) === U.keyOf(name));
        choose(hit ? hit.name : name, hit ? hit.muscle : customMuscle);
      },
    });

    function renderChips() {
      const opts = [['day', a.muscles.length > 1 ? 'This day' : MUSCLES[a.muscles[0]] || 'This day']];
      if (a.muscles.length > 1) a.muscles.forEach((m) => opts.push([m, MUSCLES[m]]));
      opts.push(['all', 'Everything']);
      chips.replaceChildren(
        ...opts.map(([key, label]) =>
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              'aria-pressed': String(filter === key),
              onclick: () => {
                filter = key;
                if (key !== 'day' && key !== 'all') customMuscle = key;
                renderChips();
                renderList();
              },
            },
            label
          )
        )
      );
    }

    function choose(name, muscle) {
      name = tidyName(name);
      if (!name) return;
      if (!library().some((x) => U.keyOf(x.name) === U.keyOf(name))) {
        state.custom.push({ name, muscle });
        store.saveCustom(state.custom);
      }
      if (replaceEx) {
        const wasTimed = U.isTimed(replaceEx);
        replaceEx.name = name;
        replaceEx.muscle = muscle;
        // lifts and timed exercises log different fields, so rebuild the rows if that changed
        if (U.isTimed(replaceEx) !== wasTimed) replaceEx.sets = makeExercise(name, muscle, replaceEx.sets.length).sets;
        else reghost(replaceEx);
        saveActive();
        sheet.close();
        done(replaceEx, false);
      } else {
        const ex = makeExercise(name, muscle);
        a.exercises.push(ex);
        saveActive();
        sheet.close();
        done(ex, true);
      }
    }

    function renderList() {
      const lib = library();
      const q = U.keyOf(query);
      const inSession = new Set(a.exercises.map((e) => U.keyOf(e.name)));
      // `grouped` rows sit under a muscle heading, so only flag exercises already added.
      const row = (e, grouped) => {
        const added = inSession.has(U.keyOf(e.name));
        return h(
          'div',
          { class: 'pick-line' },
          h(
            'button',
            { class: 'pick-row', type: 'button', onclick: () => choose(e.name, e.muscle) },
            h('span', { class: 'pick-name' }, e.name),
            h('span', { class: 'pick-meta' + (added ? ' added' : '') }, added ? 'Added' : grouped ? '' : MUSCLES[e.muscle] || '')
          ),
          h('button', { class: 'pick-info', type: 'button', 'aria-label': `How to do ${e.name}`, onclick: () => showHowTo(e.name, e.muscle) }, icon('info', 18))
        );
      };
      const nodes = [];

      if (q) {
        const rank = (e) => (a.muscles.includes(e.muscle) ? 0 : 1);
        const matches = lib
          .filter((e) => U.keyOf(e.name).includes(q))
          .sort((x, y) => rank(x) - rank(y) || Number(U.keyOf(y.name).startsWith(q)) - Number(U.keyOf(x.name).startsWith(q)));
        const exact = lib.some((e) => U.keyOf(e.name) === q);
        if (!exact) {
          const select = h(
            'select',
            { class: 'select', 'aria-label': 'Muscle group for the new exercise', onchange: (e) => (customMuscle = e.target.value) },
            ALL_MUSCLES.map((m) => h('option', { value: m, selected: m === customMuscle }, MUSCLES[m]))
          );
          nodes.push(
            h(
              'div',
              { class: 'custom-add' },
              h('p', null, 'Not in the list? Add ', h('b', null, `“${tidyName(query)}”`), ' as your own exercise.'),
              h('div', { class: 'row gap' }, select, h('button', { class: 'btn primary grow', type: 'button', onclick: () => choose(query, customMuscle) }, icon('plus', 18), 'Add exercise'))
            )
          );
        }
        matches.slice(0, 60).forEach((e) => nodes.push(row(e)));
      } else {
        let muscles;
        if (filter === 'day') muscles = a.muscles;
        else if (filter === 'all') muscles = a.muscles.concat(ALL_MUSCLES.filter((m) => !a.muscles.includes(m)));
        else muscles = [filter];

        if (filter === 'day') {
          const recent = [];
          const seen = new Set();
          state.sessions
            .filter((s) => s.dayId === a.dayId)
            .sort((x, y) => y.endedAt - x.endedAt)
            .forEach((s) =>
              s.exercises.forEach((ex) => {
                const k = U.keyOf(ex.name);
                if (!seen.has(k) && recent.length < 6) {
                  seen.add(k);
                  recent.push({ name: ex.name, muscle: ex.muscle });
                }
              })
            );
          if (recent.length) {
            nodes.push(h('h3', { class: 'group' }, `Your recent ${a.dayName} exercises`));
            recent.forEach((e) => nodes.push(row(e)));
          }
        }
        muscles.forEach((m) => {
          const items = lib.filter((e) => e.muscle === m);
          if (!items.length) return;
          nodes.push(h('h3', { class: 'group' }, MUSCLES[m]));
          items.forEach((e) => nodes.push(row(e, true)));
        });
      }
      list.replaceChildren(...nodes);
    }

    renderChips();
    renderList();

    const sheet = openSheet({
      title: replaceEx ? 'Change exercise' : 'Add exercise',
      tall: true,
      noFocus: true,
      body: h('div', { class: 'picker' }, h('div', { class: 'picker-top' }, input, chips), list),
    });
    if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus(), 60);
  }

  /* ---------- finish ---------- */
  function openFinish() {
    const a = state.active;
    const doneStats = U.stats(a, true);
    let pending = 0;
    a.exercises.forEach((ex) => ex.sets.forEach((s) => !s.done && U.hasWork(s) && pending++));

    if (doneStats.sets === 0 && pending === 0) {
      toast('Tick off at least one set first');
      return;
    }

    let includePending = true;
    const total = U.stats(
      {
        exercises: a.exercises.map((ex) => ({
          sets: ex.sets.filter((s) => s.done || U.hasWork(s)).map((s) => ({ w: effW(s), r: s.r, t: s.t })),
        })),
      },
      false
    );

    const sheet = openSheet({
      title: 'Finish workout?',
      body: [
        (() => {
          const tiles = [statTile('Time', U.fmtMinutes(Date.now() - a.startedAt)), statTile('Sets', String(doneStats.sets))];
          if (doneStats.work > 0) tiles.push(statTile('Work', U.fmtDuration(doneStats.work * 1000)));
          if (doneStats.volume > 0 || doneStats.work === 0) tiles.push(statTile('Volume', U.fmtNum(Math.round(doneStats.volume)), a.unit));
          return h('div', { class: 'stats', style: `grid-template-columns: repeat(${tiles.length}, 1fr)` }, tiles);
        })(),
        pending
          ? h(
              'label',
              { class: 'check-row' },
              h('input', {
                type: 'checkbox',
                checked: true,
                onchange: (e) => (includePending = e.target.checked),
              }),
              h('span', null, `Also count ${pending} set${pending === 1 ? '' : 's'} with numbers entered that ${pending === 1 ? 'isn’t' : 'aren’t'} ticked`)
            )
          : null,
      ],
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => sheet.close() }, 'Keep going'),
        h(
          'button',
          {
            class: 'btn primary grow',
            type: 'button',
            onclick: () => {
              sheet.close();
              saveSession(includePending);
            },
          },
          'Save workout'
        ),
      ],
    });
  }

  // The live workout in its saved shape: ticked sets (and, if asked, typed-but-unticked ones).
  function collectExercises(a, includePending) {
    return a.exercises
      .map((ex) => {
        const timed = U.isTimed(ex);
        const sets = ex.sets
          .filter((s) => s.done || (includePending && U.hasWork(s)))
          .map((s) => (timed ? { t: U.toNum(s.t), w: U.toNum(effW(s)), r: U.toNum(s.r) } : { w: U.toNum(effW(s)), r: U.toNum(s.r) }))
          .filter(U.hasWork);
        const out = { name: ex.name, muscle: ex.muscle, sets };
        if (ex.note && ex.note.trim()) out.note = ex.note.trim();
        return out;
      })
      .filter((ex) => ex.sets.length);
  }

  /* ---------- pair workouts: what the partner's screens need from the logger ---------- */
  function pairSnapshot() {
    const a = state.active;
    return GB.pair.summarize(collectExercises(a, false), a.unit);
  }

  // Show a partner's new exercise in the open workout, but never while you are typing in it.
  function refreshSessionView(tries) {
    if (!sessionCtx || currentRoute() !== 'session') return;
    const el = document.activeElement;
    if (el && viewEl.contains(el) && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
      if ((tries || 0) < 10) setTimeout(() => refreshSessionView((tries || 0) + 1), 1500);
      return;
    }
    sessionCtx.refreshList();
  }

  // Exercises the partner added that you do not have yet. Returns how many were added.
  function addPartnerExercises(list) {
    const a = state.active;
    if (!a) return 0;
    let n = 0;
    list.forEach((e) => {
      if (a.exercises.some((x) => U.keyOf(x.name) === U.keyOf(e.name))) return;
      const muscle = MUSCLES[e.muscle] ? e.muscle : (a.muscles && a.muscles[0]) || 'chest';
      a.exercises.push(makeExercise(e.name, muscle, e.sets));
      n += 1;
    });
    if (n) {
      saveActive();
      refreshSessionView();
    }
    return n;
  }

  function saveSession(includePending) {
    const a = state.active;
    const exercises = collectExercises(a, includePending);

    if (!exercises.length) {
      toast('Nothing to save yet');
      return;
    }

    // Count new personal records (heaviest weight) against earlier history,
    // comparing in this session's unit.
    const before = new Map();
    state.sessions.forEach((s) =>
      s.exercises.forEach((ex) => {
        const k = U.keyOf(ex.name);
        const top = Math.max(...ex.sets.map((x) => convertWeight(x.w, s.unit || 'kg', a.unit)));
        if (!(before.get(k) >= top)) before.set(k, top);
      })
    );
    let prs = 0;
    exercises.forEach((ex) => {
      if (U.isTimed(ex)) return; // personal records are for lifts
      const prev = before.get(U.keyOf(ex.name));
      const top = Math.max(...ex.sets.map((x) => x.w));
      if (prev != null && top > prev) prs++;
    });

    const session = {
      id: a.id,
      dayId: a.dayId,
      dayName: a.dayName,
      muscles: a.muscles,
      startedAt: a.startedAt,
      endedAt: Date.now(),
      unit: a.unit,
      exercises,
    };
    if (a.pair && a.pair.peerName) session.with = a.pair.peerName;
    const withPartner = !!(a.pair && a.pair.peerId && GB.pairUI);
    state.sessions.push(session);
    store.saveSessions(state.sessions);
    if (withPartner) GB.pairUI.finished(session); // send your final numbers; the line stays open for the result
    discardSession(withPartner);
    historyOpen.clear();
    historyOpen.add(session.id);
    historyLimit = 20;
    go('history', true);
    toast(prs ? `Workout saved · ${prs} new PR${prs === 1 ? '' : 's'}!` : 'Workout saved', 'success');
    if (withPartner) GB.pairUI.showResult(session);
  }

  /* =====================================================================
   * History
   * ===================================================================== */
  function viewHistory() {
    const sorted = state.sessions.slice().sort((x, y) => y.endedAt - x.endedAt);
    const page = h('div', { class: 'page' }, pageHeader('History', { right: settingsButton() }), demoBanner());

    if (!sorted.length) {
      page.append(h('p', { class: 'empty' }, 'Nothing here yet. Finish a workout and it will be saved on this device.'));
      return page;
    }

    const list = h('div', { class: 'cards' });
    const draw = () => {
      list.replaceChildren(...sorted.slice(0, historyLimit).map(historyCard));
      if (sorted.length > historyLimit) {
        list.append(
          h(
            'button',
            {
              class: 'btn ghost',
              type: 'button',
              onclick: () => {
                historyLimit += 20;
                draw();
              },
            },
            `Show more (${sorted.length - historyLimit} older)`
          )
        );
      }
    };
    draw();
    page.append(list);
    return page;
  }

  function historyCard(s) {
    const open = historyOpen.has(s.id);
    const st = U.stats(s);
    const unit = s.unit || 'kg';

    const card = h('article', { class: 'card hist' + (open ? ' open' : '') });
    const redraw = () => card.replaceWith(historyCard(s));

    card.append(
      h(
        'button',
        {
          class: 'hist-head',
          type: 'button',
          'aria-expanded': String(open),
          onclick: () => {
            if (historyOpen.has(s.id)) historyOpen.delete(s.id);
            else historyOpen.add(s.id);
            redraw();
          },
        },
        h('span', { class: 'hh-main' }, h('b', null, s.dayName), h('small', null, U.fmtDate(s.endedAt, { weekday: 'long', day: 'numeric', month: 'short' }) + (s.with ? ` · with ${s.with}` : ''))),
        h(
          'span',
          { class: 'hh-meta' },
          h('small', null, `${plural(st.sets, 'set')} · ${st.volume > 0 || st.work === 0 ? `${U.fmtNum(Math.round(st.volume))} ${unit}` : `${U.fmtDuration(st.work * 1000)} work`}`),
          h('small', null, `${plural(s.exercises.length, 'exercise')} · ${U.fmtMinutes(s.endedAt - s.startedAt)}`)
        ),
        icon('chevron', 20)
      )
    );

    if (open) {
      card.append(
        h(
          'div',
          { class: 'hist-body' },
          s.exercises.map((ex) =>
            h(
              'div',
              { class: 'hx' },
              h('b', null, ex.name),
              h('div', { class: 'pills' }, ex.sets.map((x) => h('span', { class: 'pill' }, U.setLabel(x, U.isTimed(ex), unit)))),
              ex.note ? h('p', { class: 'hx-note' }, ex.note) : null
            )
          ),
          h(
            'div',
            { class: 'row gap' },
            h('button', { class: 'btn soft grow', type: 'button', onclick: () => GB.share.open(s) }, icon('share', 18), 'Share'),
            h(
              'button',
              {
                class: 'btn soft grow',
                type: 'button',
                onclick: () => {
                  if (state.active) return toast('Finish or discard your current workout first');
                  const day = dayById(s.dayId) || { id: s.dayId || 'custom', name: s.dayName, muscles: s.muscles || [] };
                  startSession({ id: day.id, name: s.dayName, muscles: day.muscles }, s.exercises, true);
                },
              },
              icon('repeat', 18),
              'Repeat'
            ),
            h(
              'button',
              {
                class: 'btn soft danger-text icon-only',
                type: 'button',
                'aria-label': 'Delete workout',
                onclick: async () => {
                  if (!(await confirmSheet({ title: 'Delete this workout?', message: `${s.dayName} on ${U.fmtDate(s.endedAt)} will be removed for good.`, confirmText: 'Delete', danger: true }))) return;
                  state.sessions = state.sessions.filter((x) => x.id !== s.id);
                  store.saveSessions(state.sessions);
                  historyOpen.delete(s.id);
                  render();
                  toast('Workout deleted');
                },
              },
              icon('trash', 18)
            )
          )
        )
      );
    }
    return card;
  }

  /* =====================================================================
   * Progress
   * ===================================================================== */
  function viewProgress() {
    const index = U.exerciseIndex(state.sessions);
    const page = h('div', { class: 'page' }, pageHeader('Progress', { right: settingsButton() }), demoBanner());

    if (!index.length) {
      page.append(h('p', { class: 'empty' }, 'Log a few workouts and your best sets and trends per exercise will appear here.'));
      return page;
    }

    const overview = progressOverview();
    if (overview) page.append(overview, h('h3', { class: 'section-title' }, 'Exercises'));

    const list = h('div', { class: 'list' });
    const draw = (q) => {
      const query = U.keyOf(q || '');
      const rows = index.filter((r) => U.keyOf(r.name).includes(query));
      list.replaceChildren(
        ...(rows.length
          ? rows.map((r) => {
              const lastEntry = r.entries[r.entries.length - 1];
              return h(
                'button',
                { class: 'list-row', type: 'button', onclick: () => openExerciseDetail(r) },
                h('span', { class: 'lr-main' }, h('b', null, r.name), h('small', null, `Best ${U.setLabel(r.best, r.timed, r.best.unit)} · last ${U.fmtDate(lastEntry.date, { day: 'numeric', month: 'short' })}`)),
                h('span', { class: 'tag' }, `${r.entries.length}×`)
              );
            })
          : [h('p', { class: 'empty' }, 'No exercise matches that.')])
      );
    };
    page.append(
      h('input', { class: 'search', type: 'search', placeholder: 'Search your exercises…', 'aria-label': 'Search your exercises', autocomplete: 'off', oninput: (e) => draw(e.target.value) }),
      list
    );
    draw('');
    return page;
  }

  // The last 6 calendar weeks (Monday start, ending with this week): totals, an activity
  // calendar and weekly volume bars. Returns null when nothing was logged in that window.
  function progressOverview() {
    const WEEKS = 6;
    const WEEK_MS = 7 * 86400000;
    const unit = state.settings.unit;
    const fmtDay = (d) => U.fmtDate(d, { day: 'numeric', month: 'short' });
    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    // Calendar dates are built with setDate (not +24h), so daylight-saving changes can't shift them.
    const firstStart = new Date(U.startOfWeek(Date.now()));
    firstStart.setDate(firstStart.getDate() - 7 * (WEEKS - 1));
    const firstTs = firstStart.getTime();

    const weeks = Array.from({ length: WEEKS }, () => ({ volume: 0 }));
    const days = new Map(); // day key -> { sets, names }
    const total = { workouts: 0, sets: 0, volume: 0 };

    state.sessions.forEach((s) => {
      const wi = Math.round((U.startOfWeek(s.endedAt) - firstTs) / WEEK_MS);
      if (wi < 0 || wi >= WEEKS) return;
      const st = U.stats(s);
      const vol = convertVolume(st.volume, s.unit || 'kg', unit);
      total.workouts += 1;
      total.sets += st.sets;
      total.volume += vol;
      weeks[wi].volume += vol;
      const k = dayKey(new Date(s.endedAt));
      const day = days.get(k) || { sets: 0, names: [] };
      day.sets += st.sets;
      if (!day.names.includes(s.dayName)) day.names.push(s.dayName);
      days.set(k, day);
    });
    if (!total.workouts) return null;

    /* ----- activity calendar ----- */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const cal = h(
      'div',
      { class: 'cal', role: 'img', 'aria-label': `Activity calendar for the last ${WEEKS} weeks: trained on ${plural(days.size, 'day')}` },
      h('span'),
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('span', { class: 'dow' }, d))
    );
    for (let w = 0; w < WEEKS; w++) {
      const weekStart = new Date(firstTs);
      weekStart.setDate(weekStart.getDate() + 7 * w);
      cal.append(h('span', { class: 'wk' }, fmtDay(weekStart)));
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const future = d.getTime() > todayTs;
        const day = days.get(dayKey(d));
        const level = !day ? 0 : day.sets >= 18 ? 3 : day.sets >= 10 ? 2 : 1;
        let title = U.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
        if (day) title += ` · ${day.names.join(' + ')} · ${plural(day.sets, 'set')}`;
        else if (!future) title += ' · No workout';
        cal.append(h('span', { class: 'cell' + (level ? ` lv${level}` : '') + (future ? ' future' : '') + (d.getTime() === todayTs ? ' today' : ''), title }, String(d.getDate())));
      }
    }

    /* ----- weekly volume bars ----- */
    const max = Math.max(...weeks.map((w) => w.volume));
    const labels = weeks.map((w, i) => {
      const d = new Date(firstTs);
      d.setDate(d.getDate() + 7 * i);
      return fmtDay(d);
    });
    const bars = h(
      'div',
      { class: 'bars', role: 'img', 'aria-label': `Weekly volume in ${unit}: ` + weeks.map((w, i) => `week of ${labels[i]}, ${U.fmtNum(Math.round(w.volume))}`).join('; ') },
      weeks.map((w, i) =>
        h(
          'div',
          { class: 'bar' },
          h('span', { class: 'bar-val' }, w.volume >= 100000 ? fmtBig(w.volume) : U.fmtNum(Math.round(w.volume))),
          w.volume > 0 ? h('div', { class: 'bar-fill', style: `height: ${Math.max(3, Math.round((w.volume / max) * 100))}px` }) : null,
          h('span', { class: 'bar-label' }, labels[i])
        )
      )
    );

    return h(
      'section',
      { class: 'card overview' },
      h('h3', { class: 'section-title', style: 'margin: 0 0 12px' }, `Last ${WEEKS} weeks`),
      h('div', { class: 'stats' }, statTile('Workouts', String(total.workouts)), statTile('Sets', U.fmtNum(total.sets)), statTile('Volume', fmtBig(total.volume), unit)),
      cal,
      h('h3', { class: 'section-title', style: 'margin: 18px 0 0' }, 'Weekly volume'),
      bars
    );
  }

  function sparkline(values, label) {
    const W = 300;
    const H = 90;
    const P = 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [P + (values.length === 1 ? 0.5 : i / (values.length - 1)) * (W - 2 * P), H - P - ((v - min) / span) * (H - 2 * P)]);
    const wrap = document.createElement('div');
    wrap.className = 'spark';
    wrap.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label || 'Top weight per session'}">` +
      `<polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
      pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="currentColor"/>`).join('') +
      `</svg>`;
    return wrap;
  }

  function openExerciseDetail(rec) {
    const unit = rec.best.unit;
    const recent = rec.entries.slice(-20);
    const trendTitle = rec.metric === 't' ? 'Total work time per session (s)' : rec.metric === 'r' ? 'Total reps per session' : `Top weight over time (${rec.unit})`;
    openSheet({
      title: rec.name,
      tall: true,
      body: [
        h('div', { class: 'stats' }, rec.timed ? statTile('Best set', U.setCompact(rec.best, true, unit)) : statTile(`Best set (${unit})`, `${U.fmtNum(rec.best.w)}×${rec.best.r}`), statTile('Sessions', String(rec.entries.length)), statTile('Last', U.fmtDate(rec.entries[rec.entries.length - 1].date, { day: 'numeric', month: 'short' }))),
        recent.length > 1 ? [h('h3', { class: 'section-title' }, trendTitle), sparkline(recent.map((e) => e.topN), trendTitle)] : h('p', { class: 'muted pad-b' }, 'Log this exercise again to see a trend.'),
        h('h3', { class: 'section-title' }, 'History'),
        h(
          'div',
          { class: 'list' },
          rec.entries
            .slice()
            .reverse()
            .map((e) =>
              h(
                'div',
                { class: 'hx' },
                h('b', null, U.fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })),
                h('div', { class: 'pills' }, e.sets.map((x) => h('span', { class: 'pill' }, U.setLabel(x, rec.timed, e.unit || 'kg'))))
              )
            )
        ),
      ],
    });
  }

  /* =====================================================================
   * Quick log: say or type a set ("bench press 60 kilos 8 reps")
   * ===================================================================== */
  // The exercise a bare "ten reps" applies to: the one you touched last.
  function currentExercise() {
    const a = state.active;
    const byId = a.exercises.find((e) => e.id === currentExId);
    if (byId) return byId;
    for (let i = a.exercises.length - 1; i >= 0; i--) if (a.exercises[i].sets.some((s) => s.done)) return a.exercises[i];
    return a.exercises[a.exercises.length - 1] || null;
  }

  // Turn what was understood into the concrete numbers that will be logged.
  function finalizeIntent(it) {
    const a = state.active;
    const unit = a.unit;
    const name = it.exercise.name;
    const ex = a.exercises.find((e) => U.keyOf(e.name) === U.keyOf(name)) || null;
    const muscle = ex ? ex.muscle : it.exercise.muscle;
    const timed = U.isTimed({ muscle });
    const notes = [];
    const problems = [];

    let w = null;
    if (it.weight != null) {
      w = convertWeight(it.weight, it.weightUnit || unit, unit);
      if (it.weightUnit && it.weightUnit !== unit) notes.push(`${U.fmtNum(it.weight)} ${it.weightUnit} is about ${U.fmtNum(w)} ${unit}`);
    } else if (!timed || it.sameWeight) {
      const prev = ex ? ex.sets.slice().reverse().find((s) => s.done) : null;
      const last = lastSetsFor(name, unit);
      if (prev) {
        w = U.toNum(prev.w);
        notes.push('Same weight as your last set');
      } else if (last) {
        w = last.sets[last.sets.length - 1].w;
        notes.push('Same weight as last time');
      } else if (!timed) {
        w = 0;
        notes.push('No weight heard, logging as bodyweight');
      }
    }

    let seconds = it.seconds || 0;
    if (seconds && !timed) {
      if (!(it.reps > 0)) problems.push('Seconds are only logged for HIIT exercises. Say the reps instead.');
      seconds = 0;
    }
    const reps = it.reps || 0;
    if (it.exercise.isNew) notes.push('New exercise, it will be saved to your list');

    return { name, muscle, timed, w, reps, seconds, count: it.sets || 1, inWorkout: !!ex, isNew: !!it.exercise.isNew, notes, problems };
  }

  function describeIntent(fi) {
    const unit = state.active.unit;
    const parts = [];
    if (fi.timed) {
      if (fi.seconds) parts.push(`${fi.seconds}s`);
      if (fi.w) parts.push(`${U.fmtNum(fi.w)} ${unit}`);
      if (fi.reps) parts.push(`${fi.reps} reps`);
    } else {
      parts.push(fi.w ? `${U.fmtNum(fi.w)} ${unit}` : 'Bodyweight');
      parts.push(`${fi.reps} reps`);
    }
    return (fi.count > 1 ? `${fi.count} sets · ` : '') + parts.join(' · ');
  }

  /* ---------- how-to + guided flows (the screens live in js/howto.js and js/flows.js) ---------- */
  const extrasApi = {
    get: (name) => state.extras[U.keyOf(name)] || null,
    save(name, patch) {
      const k = U.keyOf(name);
      const cur = Object.assign({}, state.extras[k] || {}, patch);
      if (!cur.note && !cur.link) delete state.extras[k];
      else state.extras[k] = cur;
      store.saveExtras(state.extras);
    },
  };

  function showHowTo(name, muscle) {
    GB.howto.open(name, muscle, { extras: extrasApi });
  }

  function openFlows(ctx) {
    if (GB.flows) GB.flows.openPicker(ctx);
    else toast('Guided flows are not available', 'error');
  }

  // Log a timed block (for example a finished flow) into the current workout, without the rest timer.
  function logTimed(ctx, name, muscle, seconds) {
    return applyQuickLog(ctx, { name, muscle, timed: true, w: null, reps: 0, seconds, count: 1, noLibrary: true }, { noRest: true });
  }

  // Add the sets to the workout; returns what's needed to undo.
  function applyQuickLog(ctx, fi, opts) {
    opts = opts || {};
    const a = state.active;
    let ex = a.exercises.find((e) => U.keyOf(e.name) === U.keyOf(fi.name));
    const before = ex ? JSON.parse(JSON.stringify(ex.sets)) : null;
    let created = false;
    if (!ex) {
      if (!fi.noLibrary && !library().some((e) => U.keyOf(e.name) === U.keyOf(fi.name))) {
        state.custom.push({ name: fi.name, muscle: fi.muscle });
        store.saveCustom(state.custom);
      }
      ex = makeExercise(fi.name, fi.muscle, 1);
      ex.sets = [];
      a.exercises.push(ex);
      created = true;
    }
    const timed = U.isTimed(ex);
    for (let n = 0; n < fi.count; n++) {
      let i = ex.sets.findIndex((s) => !s.done && setIsEmpty(s));
      if (i === -1) {
        ex.sets.push(nextSetAfter(ex.sets[ex.sets.length - 1], timed));
        i = ex.sets.length - 1;
      }
      const set = ex.sets[i];
      if (timed) {
        set.t = fi.seconds ? String(fi.seconds) : '';
        set.w = fi.w ? String(fi.w) : '';
        set.r = fi.reps ? String(fi.reps) : '';
      } else {
        set.w = String(fi.w == null ? 0 : fi.w);
        set.r = String(fi.reps);
      }
      set.done = true;
    }
    // suggest the same numbers for the sets still to do
    const done = ex.sets.filter((s) => s.done).pop();
    ex.sets.forEach((s) => {
      if (!s.done && setIsEmpty(s) && done) {
        s.gw = done.w;
        s.gr = done.r;
        if (timed) s.gt = done.t;
      }
    });
    currentExId = ex.id;
    saveActive();
    ctx.refreshList();
    const card = document.querySelector(`.card.ex[data-id="${ex.id}"]`);
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!opts.noRest) startRest();
    return { exId: ex.id, created, before };
  }

  function undoQuickLog(ctx, u) {
    const a = state.active;
    const ex = a.exercises.find((e) => e.id === u.exId);
    if (!ex) return;
    if (u.created) a.exercises = a.exercises.filter((e) => e !== ex);
    else ex.sets = u.before;
    saveActive();
    ctx.refreshList();
  }

  const MIC_ERRORS = {
    'not-allowed': 'The microphone is blocked here. Allow it in your browser settings, or tap the mic on your keyboard to dictate.',
    'service-not-allowed': 'The microphone is blocked here. Allow it in your browser settings, or tap the mic on your keyboard to dictate.',
    'no-speech': 'Didn’t hear anything. Tap the mic and try again.',
    'audio-capture': 'No microphone was found.',
    network: 'Speech recognition needs an internet connection.',
  };

  function openQuickLog(ctx) {
    const a = state.active;
    const canSpeak = GB.voice.speechSupported();
    let text = '';
    let parsed = null;
    let fi = null;
    let override = null; // an alternative exercise the user tapped
    let listener = null;
    let listening = false;
    let lastLog = null;
    let message = '';

    const parseOpts = () => {
      const cur = currentExercise();
      return {
        library: library(),
        sessionExercises: a.exercises.map((e) => ({ name: e.name, muscle: e.muscle })),
        current: cur ? { name: cur.name, muscle: cur.muscle } : null,
        defaultMuscle: a.muscles[0],
      };
    };

    const input = h('input', {
      class: 'field',
      type: 'text',
      placeholder: 'e.g. bench press 60 kilos 8 reps',
      autocomplete: 'off',
      autocapitalize: 'none',
      enterkeyhint: 'done',
      'aria-label': 'Describe the set you just did',
      oninput: (e) => {
        text = e.target.value;
        override = null;
        message = '';
        lastLog = null;
        update();
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (fi && !fi.problems.length) doLog();
        }
      },
    });

    const result = h('div', { class: 'ql-result', 'aria-live': 'polite' });
    const status = h('p', { class: 'ql-status' });
    const logBtn = h('button', { class: 'btn primary big grow', type: 'button', disabled: true, onclick: doLog }, 'Log set');
    const mic = canSpeak
      ? h('button', { class: 'mic-btn', type: 'button', 'aria-label': 'Start listening', onclick: toggleListen }, icon('mic', 32))
      : null;

    function setMicUi() {
      if (!mic) return;
      mic.classList.toggle('on', listening);
      mic.replaceChildren(icon(listening ? 'stop' : 'mic', 32));
      mic.setAttribute('aria-label', listening ? 'Stop listening' : 'Start listening');
      status.textContent = message || (listening ? 'Listening… say weight and reps' : 'Tap the mic, then say your set');
      status.classList.toggle('err', !!message && !listening);
    }

    function update() {
      parsed = text.trim() ? GB.voice.parse(text, parseOpts()) : null;
      const hasAmount = parsed && ((parsed.reps != null && parsed.reps > 0) || (parsed.seconds != null && parsed.seconds > 0));
      if (parsed && override && hasAmount) {
        parsed.exercise = { name: override.name, muscle: override.muscle, source: override.isNew ? 'new' : 'library', score: 1, exact: true, isNew: !!override.isNew };
        parsed.ok = true;
        parsed.alternatives = [];
      }
      fi = parsed && parsed.ok ? finalizeIntent(parsed) : null;
      render();
    }

    function render() {
      const kids = [];
      if (lastLog) {
        kids.push(
          h(
            'div',
            { class: 'ql-done' },
            h('span', null, icon('check', 18), h('b', null, 'Logged'), ` ${lastLog.label}`),
            h(
              'button',
              {
                class: 'link-btn',
                type: 'button',
                onclick: () => {
                  undoQuickLog(ctx, lastLog.undo);
                  lastLog = null;
                  toast('Undone');
                  update();
                },
              },
              'Undo'
            )
          )
        );
      }
      if (!text.trim()) {
        kids.push(
          h(
            'div',
            { class: 'ql-help' },
            h('b', null, 'Try saying or typing'),
            h('ul', null, h('li', null, '“bench press 60 kilos 8 reps”'), h('li', null, '“3 sets of 10 at 20 kilos”'), h('li', null, '“ten reps” (same exercise, same weight)'), h('li', null, '“burpees 40 seconds”'))
          )
        );
      } else if (!fi) {
        const why = parsed && parsed.issues.includes('no-exercise') ? 'I didn’t catch which exercise.' : 'I didn’t catch the reps.';
        kids.push(h('div', { class: 'ql-card warn' }, h('b', null, why), h('p', null, 'Include the exercise, weight and reps, like “bench press 60 kilos 8 reps”.')));
      } else {
        kids.push(
          h(
            'div',
            { class: 'ql-card' },
            h('div', { class: 'ql-head' }, h('b', { class: 'ql-ex' }, fi.name), h('span', { class: 'tag' }, fi.inWorkout ? 'In this workout' : fi.isNew ? 'New' : 'Will be added')),
            h('div', { class: 'ql-nums' }, describeIntent(fi)),
            fi.notes.map((n) => h('p', { class: 'ql-note' }, n)),
            fi.problems.map((n) => h('p', { class: 'ql-note bad' }, n)),
            parsed.alternatives.length
              ? h(
                  'div',
                  { class: 'ql-alts' },
                  h('span', null, parsed.exercise.exact ? 'Or:' : 'Not right?'),
                  parsed.alternatives.map((alt) =>
                    h(
                      'button',
                      {
                        class: 'chip',
                        type: 'button',
                        onclick: () => {
                          override = alt;
                          update();
                        },
                      },
                      alt.isNew ? `Add “${alt.name}” as new` : alt.name
                    )
                  )
                )
              : null
          )
        );
      }
      result.replaceChildren(...kids);
      logBtn.disabled = !(fi && !fi.problems.length);
      logBtn.replaceChildren(fi && fi.count > 1 ? `Log ${fi.count} sets` : 'Log set');
    }

    function doLog() {
      if (!fi || fi.problems.length) return;
      const label = `${fi.name} · ${describeIntent(fi)}`;
      const undo = applyQuickLog(ctx, fi);
      lastLog = { label, undo };
      text = '';
      input.value = '';
      override = null;
      message = '';
      update();
      setMicUi();
    }

    function startListen() {
      message = '';
      listening = true;
      lastLog = null;
      setMicUi();
      listener = GB.voice.listen({
        onInterim: (t) => {
          text = t;
          input.value = t;
          override = null;
          update();
        },
        onFinal: (t) => {
          text = t;
          input.value = t;
          override = null;
          update();
          if (state.settings.voiceAuto && fi && !fi.problems.length && parsed.confidence >= 0.75) doLog();
        },
        onError: (code) => {
          if (code === 'aborted') return;
          message = MIC_ERRORS[code] || 'Couldn’t use the microphone. You can type, or tap the mic on your keyboard.';
          setMicUi();
        },
        onEnd: () => {
          listening = false;
          setMicUi();
        },
      });
    }

    function toggleListen() {
      if (listening && listener) listener.stop();
      else startListen();
    }

    const unavailable =
      window.isSecureContext === false
        ? 'The mic button needs a secure (HTTPS) site. You can still type, or tap the mic on your keyboard to dictate.'
        : 'This browser can’t listen directly. Type the set, or tap the mic on your keyboard to dictate.';

    const sheet = openSheet({
      title: 'Quick log',
      noFocus: true,
      body: [
        mic ? h('div', { class: 'ql-mic' }, mic, status) : h('p', { class: 'muted pad-b ql-unavail' }, unavailable),
        input,
        result,
      ],
      footer: logBtn,
      onClose: () => listener && listener.abort(),
    });

    render();
    setMicUi();
    if (mic) setTimeout(startListen, 250);
    else setTimeout(() => input.focus(), 120);
    return sheet;
  }

  /* =====================================================================
   * Interval timer (HIIT): get ready, then work / rest rounds
   * ===================================================================== */
  const IV_PREP = 5; // seconds to get ready
  const IV_PRESETS = [
    { label: 'Tabata', work: 20, rest: 10, rounds: 8 },
    { label: '40 / 20', work: 40, rest: 20, rounds: 8 },
    { label: '30 / 30', work: 30, rest: 30, rounds: 10 },
    { label: '45 / 15', work: 45, rest: 15, rounds: 6 },
    { label: '60 / 30', work: 60, rest: 30, rounds: 5 },
  ];

  function tone(freq, dur, delay, vol) {
    if (!state.settings.sound || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + (delay || 0);
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }

  function buzz(pattern) {
    if (!state.settings.sound) return;
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  function openIntervalTimer(ctx) {
    const a = state.active;
    const s = state.settings;
    const cfg = { work: s.ivWork, rest: s.ivRest, rounds: s.ivRounds };
    const timedExercises = () => a.exercises.filter(U.isTimed);
    let targetId = (timedExercises().find((ex) => ex.sets.some((x) => !x.done)) || timedExercises()[0] || {}).id || '';

    const body = h('div', { class: 'iv' });
    const foot = h('div', { class: 'iv-foot' });
    let run = null; // engine state once started
    let ui = null; // live display elements

    const sheet = openSheet({
      title: 'Interval timer',
      tall: true,
      body,
      footer: foot,
      onClose: () => run && clearInterval(run.iv),
    });

    const totalSeconds = () => IV_PREP + cfg.rounds * cfg.work + Math.max(0, cfg.rounds - 1) * cfg.rest;

    /* ----- setup screen ----- */
    function renderSetup() {
      const totalEl = h('b', null, U.fmtDuration(totalSeconds() * 1000));
      const stepper = (label, key, step, min, max, suffix) => {
        const val = h('b', { class: 'step-val' }, `${cfg[key]}${suffix}`);
        const bump = (d) => () => {
          cfg[key] = Math.min(max, Math.max(min, cfg[key] + d));
          val.textContent = `${cfg[key]}${suffix}`;
          totalEl.textContent = U.fmtDuration(totalSeconds() * 1000);
        };
        return h(
          'div',
          { class: 'stepper' },
          h('span', { class: 'step-label' }, label),
          h(
            'div',
            { class: 'step-ctl' },
            h('button', { class: 'step-btn', type: 'button', 'aria-label': `Decrease ${label.toLowerCase()}`, onclick: bump(-step) }, icon('minus', 22)),
            val,
            h('button', { class: 'step-btn', type: 'button', 'aria-label': `Increase ${label.toLowerCase()}`, onclick: bump(step) }, icon('plus', 22))
          )
        );
      };

      const targets = timedExercises();
      const select = h(
        'select',
        { class: 'select', 'aria-label': 'Log finished rounds to', onchange: (e) => (targetId = e.target.value) },
        h('option', { value: '', selected: !targetId }, 'Don’t log'),
        targets.map((ex) => h('option', { value: ex.id, selected: ex.id === targetId }, ex.name))
      );

      body.replaceChildren(
        h(
          'div',
          { class: 'chips scroll' },
          IV_PRESETS.map((p) =>
            h(
              'button',
              {
                class: 'chip',
                type: 'button',
                'aria-pressed': String(cfg.work === p.work && cfg.rest === p.rest && cfg.rounds === p.rounds),
                onclick: () => {
                  Object.assign(cfg, { work: p.work, rest: p.rest, rounds: p.rounds });
                  renderSetup();
                },
              },
              p.label
            )
          )
        ),
        stepper('Work', 'work', 5, 5, 600, 's'),
        stepper('Rest', 'rest', 5, 0, 600, 's'),
        stepper('Rounds', 'rounds', 1, 1, 50, ''),
        h('p', { class: 'iv-total' }, 'Total time ', totalEl, ` · includes ${IV_PREP}s to get ready`),
        targets.length
          ? h('div', { class: 'setting' }, h('span', { class: 'sd' }, h('b', null, 'Log rounds to'), h('small', null, 'Each finished round ticks off a set')), select)
          : h('p', { class: 'muted iv-tip' }, 'Tip: add a HIIT exercise to this workout first and every finished round is logged as a set for you.')
      );
      foot.replaceChildren(h('button', { class: 'btn primary big grow', type: 'button', onclick: start }, icon('play', 20), 'Start'));
    }

    /* ----- running ----- */
    const elapsed = () => run.base + (run.paused ? 0 : Date.now() - run.resumedAt);
    const indexAt = (el) => run.phases.findIndex((p) => el < p.end);

    function start() {
      Object.assign(s, { ivWork: cfg.work, ivRest: cfg.rest, ivRounds: cfg.rounds });
      saveSettings();
      unlockAudio();

      const phases = [];
      let at = 0;
      const add = (type, sec, round) => {
        phases.push({ type, round, dur: sec * 1000, start: at, end: at + sec * 1000 });
        at += sec * 1000;
      };
      add('prep', IV_PREP);
      for (let r = 1; r <= cfg.rounds; r++) {
        add('work', cfg.work, r);
        if (r < cfg.rounds && cfg.rest > 0) add('rest', cfg.rest, r);
      }
      run = { phases, base: 0, resumedAt: Date.now(), paused: false, idx: 0, logged: 0, finished: false, beeped: '', iv: null };

      sheet.setLocked(true);
      renderRun();
      cue(phases[0]);
      run.iv = setInterval(tick, 200);
      tick();
    }

    function renderRun() {
      ui = {
        phase: h('div', { class: 'iv-phase' }),
        time: h('div', { class: 'iv-time' }),
        round: h('div', { class: 'iv-round' }),
        bar: h('div', { class: 'iv-bar-fill' }),
        next: h('div', { class: 'iv-next' }),
        logged: h('p', { class: 'iv-logged' }),
      };
      ui.panel = h('div', { class: 'iv-panel prep', role: 'timer' }, ui.phase, ui.time, ui.round, h('div', { class: 'iv-bar' }, ui.bar), ui.next);
      body.replaceChildren(ui.panel, ui.logged);

      ui.pauseBtn = h('button', { class: 'btn primary grow big', type: 'button', onclick: togglePause });
      setPauseLabel();
      foot.replaceChildren(
        h('button', { class: 'btn ghost big iv-side', type: 'button', onclick: confirmStop }, 'Stop'),
        ui.pauseBtn,
        h('button', { class: 'btn soft big iv-side', type: 'button', 'aria-label': 'Skip to next', onclick: skip }, icon('skip', 20))
      );
    }

    function setPauseLabel() {
      ui.pauseBtn.replaceChildren(icon(run.paused ? 'play' : 'pause', 20), run.paused ? 'Resume' : 'Pause');
    }

    function paint(el) {
      const p = run.phases[run.idx];
      const left = Math.max(0, Math.ceil((p.end - el) / 1000));
      const nxt = run.phases[run.idx + 1];
      ui.panel.className = `iv-panel ${p.type}${run.paused ? ' paused' : ''}`;
      ui.phase.textContent = run.paused ? 'Paused' : { prep: 'Get ready', work: 'Work', rest: 'Rest' }[p.type];
      ui.time.textContent = String(left);
      ui.round.textContent = p.type === 'prep' ? plural(cfg.rounds, 'round') : `Round ${p.round} of ${cfg.rounds}`;
      ui.next.textContent = nxt ? `Next: ${nxt.type === 'work' ? `work ${cfg.work}s` : `rest ${cfg.rest}s`}` : 'Last round. Finish strong.';
      ui.bar.style.transform = `scaleX(${Math.max(0, 1 - (el - p.start) / p.dur)})`;
      const ex = a.exercises.find((e) => e.id === targetId);
      ui.logged.textContent = run.logged && ex ? `${plural(run.logged, 'round')} logged to ${ex.name}` : '';
      return left;
    }

    function tick() {
      if (!run || run.finished) return;
      const el = elapsed();
      const idx = indexAt(el);
      const target = idx === -1 ? run.phases.length : idx;
      // Catch up if the phone was asleep: every finished work phase still counts.
      while (run.idx < target) {
        const p = run.phases[run.idx];
        if (p.type === 'work') logRound(Math.round(p.dur / 1000));
        run.idx++;
        if (run.idx === target && run.idx < run.phases.length) cue(run.phases[run.idx]);
      }
      if (idx === -1) return finish(false);
      const left = paint(el);
      const key = `${run.idx}:${left}`;
      if (!run.paused && left > 0 && left <= 3 && run.beeped !== key) {
        run.beeped = key;
        tone(660, 0.12, 0, 0.3);
      }
    }

    function cue(p) {
      if (p.type === 'work') {
        tone(880, 0.18, 0, 0.4);
        tone(1175, 0.28, 0.2, 0.4);
        buzz([200, 100, 200]);
      } else if (p.type === 'rest') {
        tone(520, 0.35, 0, 0.35);
        buzz(300);
      }
    }

    function logRound(sec) {
      const ex = a.exercises.find((e) => e.id === targetId);
      if (!ex || sec <= 0) return;
      let i = ex.sets.findIndex((x) => !x.done);
      if (i === -1) {
        ex.sets.push(nextSetAfter(ex.sets[ex.sets.length - 1], true));
        i = ex.sets.length - 1;
      }
      const set = ex.sets[i];
      if (set.t === '') set.t = String(sec);
      if (set.w === '' && set.gw) set.w = set.gw;
      set.done = true;
      run.logged += 1;
      saveActive();
      ctx.refreshCard(ex, i);
      ctx.updateStats();
    }

    function togglePause() {
      if (!run || run.finished) return;
      if (run.paused) {
        run.resumedAt = Date.now();
        run.paused = false;
      } else {
        run.base = elapsed();
        run.paused = true;
      }
      setPauseLabel();
      paint(elapsed());
    }

    function skip() {
      if (!run || run.finished) return;
      const el = elapsed();
      const idx = indexAt(el);
      if (idx === -1) return;
      const p = run.phases[idx];
      const worked = Math.round((el - p.start) / 1000);
      if (p.type === 'work' && worked >= 3) logRound(worked);
      run.base = p.end;
      run.resumedAt = Date.now();
      run.idx = idx + 1;
      if (run.idx >= run.phases.length) return finish(false);
      cue(run.phases[run.idx]);
      paint(elapsed());
    }

    async function confirmStop() {
      if (!run || run.finished) return;
      const wasPaused = run.paused;
      if (!wasPaused) togglePause();
      const yes = await confirmSheet({ title: 'End the interval timer?', message: run.logged ? 'Rounds already logged are kept.' : undefined, confirmText: 'End timer', cancelText: 'Keep going', danger: true });
      if (yes) finish(true);
      else if (!wasPaused && run && !run.finished) togglePause();
    }

    function finish(stopped) {
      if (!run || run.finished) return;
      run.finished = true;
      clearInterval(run.iv);
      sheet.setLocked(false);
      if (!stopped) {
        tone(660, 0.2, 0, 0.4);
        tone(880, 0.2, 0.22, 0.4);
        tone(1175, 0.4, 0.44, 0.4);
        buzz([300, 120, 300, 120, 500]);
      }
      const ex = a.exercises.find((e) => e.id === targetId);
      body.replaceChildren(
        h(
          'div',
          { class: 'iv-panel done' },
          h('div', { class: 'iv-phase' }, stopped ? 'Stopped' : 'Done'),
          h('div', { class: 'iv-time small' }, run.logged ? plural(run.logged, 'round') : stopped ? 'Timer ended' : 'Nice work'),
          h('div', { class: 'iv-round' }, run.logged && ex ? `logged to ${ex.name}` : 'No rounds were logged')
        )
      );
      foot.replaceChildren(h('button', { class: 'btn primary big grow', type: 'button', onclick: () => sheet.close() }, 'Close'));
    }

    renderSetup();
  }

  /* =====================================================================
   * Settings, backup, restore
   * ===================================================================== */
  // Who is signed in, and the account actions (the account itself lives in js/backend.js).
  function accountSection() {
    const b = GB.backend;
    if (!b) return null;
    if (!b.isSignedIn()) {
      const supa = b.mode === 'supabase';
      const p = b.profile();
      return h(
        'div',
        { class: 'acct' },
        h(
          'div',
          { class: 'acct-who' },
          h('span', { class: 'avatar' }, icon('user', 18)),
          h('span', { class: 'sd' }, h('b', null, supa ? 'Not signed in' : (p && p.name) || 'Guest'), h('small', null, 'Your workouts stay on this device'))
        ),
        h('p', { class: 'acct-note' }, supa ? 'Sign in to use AI scan reports. Logging workouts never needs an account.' : 'Set up a profile to see your body stats and use AI scan reports. Logging workouts never needs one.'),
        h(
          'button',
          {
            class: 'btn soft',
            type: 'button',
            onclick: () => {
              closeAllSheets();
              go(supa ? 'welcome' : p ? 'onboarding/edit' : 'onboarding');
            },
          },
          icon('user', 18),
          supa ? 'Sign in or create account' : p ? 'Edit profile' : 'Set up profile'
        )
      );
    }
    const u = b.user();
    const p = b.profile();
    return h(
      'div',
      { class: 'acct' },
      h(
        'div',
        { class: 'acct-who' },
        h('span', { class: 'avatar' }, (GB.profile.firstName((p && p.name) || u.name) || '?').slice(0, 1).toUpperCase()),
        h('span', { class: 'sd' }, h('b', null, (p && p.name) || u.name || 'You'), h('small', null, u.email || (b.mode === 'local' ? 'Demo account on this device' : '')))
      ),
      b.mode === 'local' ? h('p', { class: 'acct-note' }, 'Demo mode: your profile and reports stay on this device. Real sign-in turns on once the account service is connected.') : null,
      h(
        'div',
        { class: 'row gap' },
        h(
          'button',
          {
            class: 'btn soft grow',
            type: 'button',
            onclick: () => {
              closeAllSheets();
              go('onboarding/edit');
            },
          },
          icon('user', 18),
          'Edit profile'
        ),
        h(
          'button',
          {
            class: 'btn soft grow',
            type: 'button',
            onclick: async () => {
              await b.signOut();
              closeAllSheets();
              go('home', true);
            },
          },
          icon('logout', 18),
          'Sign out'
        )
      )
    );
  }

  function openSettings() {
    const s = state.settings;

    const restSel = h(
      'select',
      {
        class: 'select',
        'aria-label': 'Rest duration',
        onchange: (e) => {
          s.restSec = Number(e.target.value);
          saveSettings();
        },
      },
      [30, 45, 60, 90, 120, 150, 180, 240, 300].map((sec) => h('option', { value: sec, selected: sec === s.restSec }, U.fmtDuration(sec * 1000)))
    );

    const toggle = (label, key, hint, after) =>
      h(
        'label',
        { class: 'setting' },
        h('span', { class: 'sd' }, h('b', null, label), hint ? h('small', null, hint) : null),
        h(
          'span',
          { class: 'switch' },
          h('input', {
            type: 'checkbox',
            checked: !!s[key],
            onchange: (e) => {
              s[key] = e.target.checked;
              saveSettings();
              if (after) after();
            },
          }),
          h('i')
        )
      );

    const unitBtn = (u) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': String(s.unit === u),
          onclick: (e) => {
            s.unit = u;
            saveSettings();
            e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            render();
          },
        },
        u
      );

    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => importBackup(e.target.files[0]) });
    const hasDemo = state.sessions.some((x) => x.demo);

    openSheet({
      title: 'Settings',
      tall: true,
      body: h(
        'div',
        { class: 'settings' },
        accountSection(),
        h('div', { class: 'setting' }, h('span', { class: 'sd' }, h('b', null, 'Weight unit'), h('small', null, 'Used for new workouts')), h('div', { class: 'seg' }, unitBtn('kg'), unitBtn('lb'))),
        toggle('Rest timer', 'restOn', 'Starts when you tick a set', () => (s.restOn ? null : stopRest())),
        h('div', { class: 'setting' }, h('span', { class: 'sd' }, h('b', null, 'Rest length')), restSel),
        toggle('Sound & vibration', 'sound', 'When rest is over'),
        toggle('Keep screen on', 'keepAwake', 'While logging a workout', updateWake),
        toggle('Voice: log without asking', 'voiceAuto', 'Quick log adds the set as soon as it understands you'),
        toggle('Flows: read the next move aloud', 'flowSpeak', 'Handy when your phone is on the floor'),
        h('h3', { class: 'section-title' }, 'Demo data'),
        h('p', { class: 'muted pad-b' }, 'Fill the app with 40 days of workouts from a dummy lifter (Push, Pull, Legs, HIIT and more, with realistic progress) to see how history and progress look. Your own workouts are not touched, and demo data can be removed any time.'),
        h(
          'div',
          { class: 'stack' },
          hasDemo
            ? h('button', { class: 'btn soft danger-text', type: 'button', onclick: removeDemo }, icon('trash', 18), 'Remove demo data')
            : h('button', { class: 'btn soft', type: 'button', onclick: loadDemo }, icon('bolt', 18), 'Load 40-day demo data')
        ),
        h('h3', { class: 'section-title' }, 'Your data'),
        h('p', { class: 'muted pad-b' }, 'Everything is stored on this device only. Save a backup now and then, and use it to move to a new phone.'),
        h(
          'div',
          { class: 'stack' },
          h(
            'div',
            { class: 'row gap' },
            h('button', { class: 'btn soft grow', type: 'button', onclick: exportJson }, icon('download', 18), 'Download'),
            h('button', { class: 'btn soft grow', type: 'button', onclick: openCopyBackup }, icon('note', 18), 'Copy text')
          ),
          h(
            'div',
            { class: 'row gap' },
            h('button', { class: 'btn soft grow', type: 'button', onclick: () => fileInput.click() }, icon('upload', 18), 'Import file'),
            h('button', { class: 'btn soft grow', type: 'button', onclick: openPasteBackup }, icon('note', 18), 'Paste text')
          ),
          h('button', { class: 'btn soft', type: 'button', onclick: exportCsv }, icon('download', 18), 'Export spreadsheet (CSV)'),
          fileInput,
          h(
            'button',
            {
              class: 'btn soft danger-text',
              type: 'button',
              onclick: async () => {
                if (!(await confirmSheet({ title: 'Delete all data?', message: 'This removes every workout, custom exercise and setting from this device, plus your profile and scan reports, and signs you out. Export a backup first if you might want it back.', confirmText: 'Delete everything', danger: true }))) return;
                if (GB.backend) {
                  await GB.backend.deleteMyData();
                  await GB.backend.signOut();
                }
                store.clearAll();
                state.sessions = [];
                state.active = null;
                state.custom = [];
                state.extras = {};
                state.settings = store.loadSettings();
                stopRest();
                closeAllSheets();
                go('home', true);
                toast('All data deleted');
              },
            },
            icon('trash', 18),
            'Delete all data'
          )
        ),
        h('p', { class: 'fine' }, `GymBoy · ${state.sessions.length} workout${state.sessions.length === 1 ? '' : 's'} saved`)
      ),
    });
  }

  // Sample workouts are tagged `demo`, so loading or removing them never touches real ones.
  async function loadDemo() {
    const real = state.sessions.filter((s) => !s.demo);
    const demo = GB.demo.generate(40);
    state.sessions = real.concat(demo);
    store.saveSessions(state.sessions);

    // a 40-day weigh-in history too, so Home has a trend to show (tagged, so it can be removed)
    const prof = GB.backend && GB.backend.profile();
    if (prof) {
      const own = (prof.weights || []).filter((w) => !w.demo);
      const taken = new Set(own.map((w) => w.date));
      const endKg = prof.weight_kg || (own.length && own[own.length - 1].kg) || 80;
      const extra = GB.demo.generateWeights(40, endKg).filter((w) => !taken.has(w.date));
      prof.weights = own.concat(extra).sort((a, b) => a.date.localeCompare(b.date));
      await GB.backend.saveProfile(prof);
    }

    historyOpen.clear();
    closeAllSheets();
    go('progress');
    toast(`Loaded ${plural(demo.length, 'demo workout')}`, 'success');
  }

  async function removeDemo() {
    if (!(await confirmSheet({ title: 'Remove demo data?', message: 'Only the sample workouts and weigh-ins are removed. Anything you logged yourself is kept.', confirmText: 'Remove', danger: true }))) return;
    state.sessions = state.sessions.filter((s) => !s.demo);
    store.saveSessions(state.sessions);
    const prof = GB.backend && GB.backend.profile();
    if (prof && (prof.weights || []).some((w) => w.demo)) {
      prof.weights = prof.weights.filter((w) => !w.demo);
      await GB.backend.saveProfile(prof);
    }
    historyOpen.clear();
    closeAllSheets();
    render();
    toast('Demo data removed');
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  const backupText = () =>
    JSON.stringify({ app: 'gymboy', version: 1, exportedAt: new Date().toISOString(), sessions: state.sessions, custom: state.custom, extras: state.extras, settings: state.settings }, null, 2);

  function exportJson() {
    download(`gymboy-backup-${stamp()}.json`, backupText(), 'application/json');
  }

  // Works everywhere, including hosts that block file downloads.
  function openCopyBackup() {
    const text = backupText();
    const area = h('textarea', { class: 'note mono', readOnly: true, rows: 8, value: text, 'aria-label': 'Backup text', onfocus: (e) => e.target.select() });
    openSheet({
      title: 'Copy backup',
      body: [h('p', { class: 'muted' }, 'Copy this text and keep it somewhere safe, like a note or an email to yourself. To restore it, use Paste backup.'), area],
      footer: h(
        'button',
        {
          class: 'btn primary grow',
          type: 'button',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('Backup copied', 'success');
            } catch (e) {
              area.focus();
              area.select();
              toast('Selected. Press and hold to copy.');
            }
          },
        },
        'Copy to clipboard'
      ),
    });
  }

  function openPasteBackup() {
    const area = h('textarea', { class: 'note mono', rows: 8, placeholder: 'Paste your backup text here', 'aria-label': 'Backup text to import' });
    openSheet({
      title: 'Paste backup',
      body: [h('p', { class: 'muted' }, 'Workouts you already have are kept; only new ones are added.'), area],
      footer: h('button', { class: 'btn primary grow', type: 'button', onclick: () => importData(area.value) }, 'Import'),
    });
  }

  function exportCsv() {
    if (!state.sessions.length) return toast('No workouts to export yet');
    download(`gymboy-workouts-${stamp()}.csv`, U.sessionsToCsv(state.sessions), 'text/csv');
  }

  function validSession(s) {
    return (
      s &&
      typeof s.id === 'string' &&
      typeof s.endedAt === 'number' &&
      typeof s.startedAt === 'number' &&
      typeof s.dayName === 'string' &&
      Array.isArray(s.exercises) &&
      s.exercises.every((ex) => ex && typeof ex.name === 'string' && Array.isArray(ex.sets) && ex.sets.every((x) => x && Number.isFinite(x.w) && Number.isFinite(x.r) && (x.t == null || Number.isFinite(x.t))))
    );
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      importData(await file.text());
    } catch (e) {
      toast('Could not read that file', 'error');
    }
  }

  function importData(text) {
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.sessions)) throw new Error('bad');
      const have = new Set(state.sessions.map((s) => s.id));
      const incoming = data.sessions.filter((s) => validSession(s) && !have.has(s.id));
      state.sessions = state.sessions.concat(incoming);
      store.saveSessions(state.sessions);
      if (Array.isArray(data.custom)) {
        const known = new Set(library().map((e) => U.keyOf(e.name)));
        data.custom.forEach((e) => {
          if (e && typeof e.name === 'string' && typeof e.muscle === 'string' && !known.has(U.keyOf(e.name))) state.custom.push({ name: tidyName(e.name), muscle: e.muscle });
        });
        store.saveCustom(state.custom);
      }
      if (data.extras && typeof data.extras === 'object') {
        Object.keys(data.extras).slice(0, 500).forEach((k) => {
          const x = data.extras[k];
          if (!x || state.extras[k]) return;
          const note = typeof x.note === 'string' ? x.note.slice(0, 400) : '';
          const link = x.link ? GB.howto.safeLink(x.link) : null;
          if (note || link) state.extras[k] = { note, link: link || '' };
        });
        store.saveExtras(state.extras);
      }
      closeAllSheets();
      render();
      toast(incoming.length ? `Imported ${incoming.length} workout${incoming.length === 1 ? '' : 's'}` : 'Nothing new to import', incoming.length ? 'success' : '');
    } catch (e) {
      toast('That file is not a GymBoy backup', 'error');
    }
  }

  /* =====================================================================
   * Rest timer
   * ===================================================================== */
  const rest = { end: 0, total: 0, iv: null, finished: false, hideAt: 0 };
  let restTime;
  let restFill;
  let audioCtx;

  function buildRest() {
    restTime = h('span', { class: 'rest-time', 'aria-live': 'off' }, '0:00');
    restFill = h('div', { class: 'rest-fill' });
    const nudge = (sec) => () => {
      const now = Date.now();
      if (rest.finished) {
        rest.finished = false;
        rest.end = now;
        restEl.classList.remove('over');
      }
      rest.end += sec * 1000;
      rest.total = Math.max(rest.total, Math.ceil((rest.end - now) / 1000));
      restTick();
    };
    restEl.append(
      restFill,
      h(
        'div',
        { class: 'rest-row' },
        h('span', { class: 'rest-label' }, 'Rest'),
        restTime,
        h('button', { class: 'rest-btn', type: 'button', 'aria-label': 'Subtract 15 seconds', onclick: nudge(-15) }, '−15'),
        h('button', { class: 'rest-btn', type: 'button', 'aria-label': 'Add 15 seconds', onclick: nudge(15) }, '+15'),
        h('button', { class: 'rest-btn skip', type: 'button', 'aria-label': 'Skip rest', onclick: stopRest }, icon('close', 16))
      )
    );
  }

  // opts.endsAt: a rest your pair partner started (so it is not sent back to them).
  function startRest(opts) {
    if (!state.settings.restOn) return;
    const shared = !!(opts && opts.endsAt);
    rest.total = shared ? opts.total : state.settings.restSec;
    rest.end = shared ? opts.endsAt : Date.now() + rest.total * 1000;
    rest.finished = false;
    restEl.classList.remove('over');
    restEl.hidden = false;
    unlockAudio();
    clearInterval(rest.iv);
    rest.iv = setInterval(restTick, 250);
    restTick();
    if (!shared && state.active && state.active.pair && GB.pairUI) GB.pairUI.restStarted(rest.total, rest.end);
  }

  // Your partner ticked a set: start the same rest here, unless you are already resting.
  function startPairRest(total, endsAt) {
    if (rest.iv && !rest.finished) return;
    const secs = Math.min(total, Math.round((endsAt - Date.now()) / 1000)); // phone clocks can differ a little
    if (secs < 3) return;
    startRest({ total: secs, endsAt: Date.now() + secs * 1000 });
  }

  function stopRest() {
    clearInterval(rest.iv);
    rest.iv = null;
    restEl.hidden = true;
    restEl.classList.remove('over');
  }

  function restTick() {
    const msLeft = rest.end - Date.now();
    if (msLeft <= 0) {
      if (!rest.finished) {
        rest.finished = true;
        rest.hideAt = Date.now() + 6000;
        restEl.classList.add('over');
        restTime.textContent = 'Go!';
        restFill.style.transform = 'scaleX(0)';
        restAlert();
      } else if (Date.now() > rest.hideAt) {
        stopRest();
      }
      return;
    }
    restTime.textContent = U.fmtDuration(Math.ceil(msLeft / 1000) * 1000);
    restFill.style.transform = `scaleX(${Math.min(1, msLeft / (rest.total * 1000))})`;
  }

  function unlockAudio() {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* audio is optional */ }
  }

  function restAlert() {
    if (!state.settings.sound) return;
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) { /* ignore */ }
    try {
      if (!audioCtx) return;
      [0, 0.28].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = audioCtx.currentTime + offset;
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch (e) { /* ignore */ }
  }

  /* =====================================================================
   * Screen wake lock (keeps the phone awake while logging)
   * ===================================================================== */
  let wakeLock = null;

  async function updateWake() {
    const want = !!(state.settings.keepAwake && state.active && currentRoute() === 'session' && document.visibilityState === 'visible');
    if (!('wakeLock' in navigator)) return;
    try {
      if (want && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      } else if (!want && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* denied or unsupported – not critical */ }
  }

  /* =====================================================================
   * Boot
   * ===================================================================== */
  async function init() {
    buildTabs();
    buildRest();

    // Show the brand while the account service answers (instant in demo mode).
    viewEl.replaceChildren(h('div', { class: 'splash' }, h('span', { class: 'logo' }, icon('bolt', 18)), 'GYMBOY'));
    if (GB.backend) {
      try {
        await GB.backend.init();
      } catch (e) { /* stay in whatever state we have */ }
      GB.backend.onChange((ev) => {
        if (ev === 'signed_out') go('home', true);
      });
    }

    // Reopening the app mid-workout drops you straight back into it.
    if (state.active && !hashRoute()) routeState = 'session';

    // Back/forward buttons change the hash; follow them.
    window.addEventListener('hashchange', () => {
      const r = hashRoute() || 'home';
      if (r === routeState) return;
      routeState = r;
      closeAllSheets();
      render();
    });
    document.addEventListener('visibilitychange', () => {
      updateWake();
      if (document.visibilityState === 'visible' && rest.iv) restTick();
    });
    if (GB.pairUI) GB.pairUI.boot(); // pick a pair workout back up after a reload
    render();
    try {
      if (hashRoute() !== routeState) location.replace('#/' + routeState);
    } catch (e) { /* ignore */ }
    store.persistRequest();

    try {
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    } catch (e) { /* service workers unavailable here (e.g. a sandboxed frame) */ }
  }

  // What the screens in other files need from the shell.
  GB.app = { go, render, state, startSession, takeReturn, saveActive, saveSettings, pairSnapshot, addPartnerExercises, startPairRest, plural, openSettings, settingsButton, pageHeader, statTile, fmtBig, tone, buzz, unlockAudio, logTimed, showHowTo, extrasApi };

  init().catch((e) => console.error('GymBoy failed to start', e));
})((window.GB = window.GB || {}));
