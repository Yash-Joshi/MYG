/* GymBoy – pair workouts, the screens: the Pair tab, the bar inside a workout, the scoreboard sheet
 * and the result. The rules and messages live in js/pair.js; the logger itself stays in js/app.js.
 *
 * Two ways in:
 *   - live (two phones, room code): needs the account service (Supabase Realtime)
 *   - practice partner: a pretend partner in this page, so the feature can be tried alone
 */
(function (GB) {
  'use strict';
  const { h, mount, icon, openSheet, confirmSheet, toast } = GB.ui;
  const P = GB.pair;
  const U = GB.util;
  const screens = (GB.screens = GB.screens || {});
  const app = () => GB.app;

  const LB_PER_KG = 2.20462;
  const PRACTICE_NAMES = ['Sam', 'Alex', 'Jordan', 'Riley'];

  let cur = null; // { ctl, bot, bus, practice, planKey }
  const redraw = []; // functions that refresh whatever pair UI is on screen
  let pushTimer = null;

  const refreshUi = () => redraw.slice().forEach((fn) => fn());
  const live = () => !!(GB.backend && GB.backend.realtime && GB.backend.realtime.available);
  const active = () => (app() && app().state.active) || null;
  const pairMeta = () => {
    const a = active();
    return a && a.pair ? a.pair : null;
  };
  const tidyName = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  const toUnit = (kg, unit) => (unit === 'lb' ? kg * LB_PER_KG : kg);
  const showCode = (code) => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : '');
  const inviteLink = (code) => `${location.origin}${location.pathname}#/pair/join/${code}`;

  function planFrom(a) {
    return { dayId: a.dayId, dayName: a.dayName, muscles: a.muscles || [], exercises: a.exercises.map((ex) => ({ name: ex.name, muscle: ex.muscle, sets: ex.sets.length })) };
  }
  const planKey = (a) => a.exercises.map((e) => U.keyOf(e.name)).join('|');

  function myName() {
    const s = app().state.settings;
    const p = GB.backend && GB.backend.profile && GB.backend.profile();
    return tidyName(s.pairName) || tidyName(p && GB.profile.firstName(p.name)) || '';
  }
  function rememberName(name) {
    const s = app().state.settings;
    if (s.pairName !== name) {
      s.pairName = name;
      app().saveSettings();
    }
  }

  /* =====================================================================
   * The connection: start, resume, and react to what the partner does
   * ===================================================================== */
  // The controller asks for these whenever it needs to catch the partner up.
  function newController(transport, id, name) {
    return P.create({
      transport,
      id,
      name,
      getSnap: () => (cur && cur.finalSnap) || (active() ? app().pairSnapshot() : null),
      getPlan: () => (active() ? planFrom(active()) : null),
      getExercises: () => (active() ? planFrom(active()).exercises : []),
    });
  }

  function detach(leave) {
    clearTimeout(pushTimer);
    const c = cur;
    cur = null;
    if (!c) return;
    if (c.bot) c.bot.stop();
    if (leave) c.ctl.leave();
    else c.ctl.close();
    refreshUi();
  }

  function onEvent(e) {
    const a = active();
    const meta = pairMeta();
    const st = cur && cur.ctl.state;
    const who = (st && st.peer && st.peer.name) || 'Your partner';
    switch (e.type) {
      case 'peer':
        if (meta) {
          meta.peerId = e.peer.id;
          meta.peerName = e.peer.name;
          app().saveActive();
        }
        if (!e.rejoin) {
          toast(`${e.peer.name} joined`, 'success');
          app().buzz([80, 60, 80]);
        }
        break;
      case 'plan': {
        if (!a || !cur) break;
        const n = app().addPartnerExercises(e.exercises);
        cur.planKey = planKey(a);
        if (n) toast(`${who} added ${n === 1 ? 'an exercise' : `${n} exercises`}`);
        break;
      }
      case 'rest':
        app().startPairRest(e.total, e.end);
        break;
      case 'nudge':
        toast(`${e.from}: ${e.emoji}`);
        app().buzz(120);
        break;
      case 'finish':
        toast(`${who} finished their workout`);
        break;
      case 'left':
        toast(`${who} left the session`);
        break;
      default:
    }
    refreshUi();
  }

  async function attach() {
    const a = active();
    const meta = a && a.pair;
    if (!meta || (cur && cur.ctl.state.room)) return;
    const practice = !!meta.practice;
    const bus = practice ? P.memoryBus() : null;
    const ctl = newController(practice ? bus[0] : P.supabaseTransport(GB.backend.realtime), meta.selfId, meta.name);
    cur = { ctl, bot: null, bus, practice, planKey: planKey(a), finalSnap: null };
    ctl.on(onEvent);
    refreshUi();
    const peer = meta.peerId ? { id: meta.peerId, name: meta.peerName } : null;
    const res = meta.role === 'host' ? await ctl.host(meta.room, { peer }) : await ctl.resume({ role: 'guest', room: meta.room, peer });
    if (!res.ok) {
      refreshUi();
      return;
    }
    if (practice && !peer) {
      const bot = P.createBot({ transport: bus[1], name: PRACTICE_NAMES[Math.floor(Math.random() * PRACTICE_NAMES.length)] });
      cur.bot = bot;
      setTimeout(() => cur && cur.bot === bot && bot.start(meta.room), 1500);
    }
    push();
  }

  // Send the partner our latest numbers (and any exercise we added), at most a few times a second.
  function changed() {
    if (!cur || !pairMeta()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 300);
    refreshUi();
  }
  function push() {
    const a = active();
    if (!cur || !a || !a.pair) return;
    cur.ctl.sendSnap(app().pairSnapshot());
    const key = planKey(a);
    if (key !== cur.planKey) {
      cur.planKey = key;
      const plan = planFrom(a);
      cur.ctl.sendPlan(plan.exercises);
    }
  }

  function restStarted(total, end) {
    if (cur) cur.ctl.sendRest(total, end);
  }

  // At app start: pick a pair workout back up after a reload.
  function boot() {
    const meta = pairMeta();
    if (!meta) return;
    if (meta.practice || !live()) {
      // the practice partner does not survive a reload, and a real one needs the service
      delete active().pair;
      app().saveActive();
      return;
    }
    attach();
  }

  // The workout was discarded (not finished): tell the partner and let go.
  function discarded() {
    detach(true);
  }

  // The workout was saved: send the final numbers, and keep the line open for the result screen.
  function finished(session) {
    if (!cur) return;
    cur.finalSnap = P.summarize(session.exercises, session.unit);
    cur.ctl.finish(cur.finalSnap);
  }

  /* =====================================================================
   * Starting
   * ===================================================================== */
  function startWith(day, template, name, extra) {
    rememberName(name);
    app().startSession(day, template, false, { pair: Object.assign({ selfId: P.newId(), name }, extra) });
  }

  async function startHosting(day, name) {
    startWith(day, null, name, { room: P.makeCode(), role: 'host', peerId: null, peerName: null, practice: false });
    await attach();
  }

  async function startPractice(day, name) {
    startWith(day, null, name, { room: P.makeCode(), role: 'host', peerId: null, peerName: null, practice: true });
    await attach();
  }

  const JOIN_ERRORS = {
    not_found: 'No session with that code. Check it, and make sure your partner has started theirs.',
    full: 'That session already has two people.',
    connection: 'Could not connect. Check your internet and try again.',
  };

  async function joinRoom(codeText, name) {
    const code = P.normalizeCode(codeText);
    if (!code) return { ok: false, message: 'That code does not look right. It is 6 letters and numbers.' };
    const ctl = newController(P.supabaseTransport(GB.backend.realtime), P.newId(), name);
    const res = await ctl.join(code);
    if (!res.ok) return { ok: false, message: JOIN_ERRORS[res.reason] || 'Could not join. Please try again.' };

    const plan = res.plan || { dayId: 'custom', dayName: 'Workout', muscles: [], exercises: [] };
    const day = GB.data.DAY_TYPES.find((d) => d.id === plan.dayId) || { id: plan.dayId, name: plan.dayName, muscles: plan.muscles };
    cur = { ctl, bot: null, bus: null, practice: false, planKey: '', finalSnap: null };
    ctl.on(onEvent);
    const template = plan.exercises.map((e) => ({ name: e.name, muscle: GB.data.MUSCLES[e.muscle] ? e.muscle : (day.muscles && day.muscles[0]) || 'chest', sets: new Array(e.sets).fill(0) }));
    startWith({ id: day.id, name: plan.dayName || day.name, muscles: day.muscles || [] }, template, name, { room: code, role: 'guest', peerId: res.peer.id, peerName: res.peer.name, practice: false });
    cur.planKey = planKey(active());
    push();
    return { ok: true };
  }

  /* =====================================================================
   * The scoreboard
   * ===================================================================== */
  function scoreboard(mine, theirs, peerName, unit) {
    const cmp = P.compare(mine, theirs);
    const fmt = {
      sets: (v) => String(v),
      volume: (kg) => U.fmtNum(Math.round(toUnit(kg, unit))),
      work: (s) => U.fmtDuration(s * 1000),
    };
    const label = { sets: 'Sets', volume: `Volume (${unit})`, work: 'Work time' };
    return h(
      'div',
      { class: 'sb' },
      h('div', { class: 'sb-head' }, h('b', null, 'You'), h('b', null, peerName)),
      cmp.rows.map((r) => {
        const total = r.me + r.them;
        const pct = total > 0 ? Math.round((r.me / total) * 100) : 50;
        return h(
          'div',
          { class: 'sb-row' },
          h('div', { class: 'sb-vals' }, h('span', { class: 'sb-v' + (r.lead === 'me' ? ' lead' : '') }, fmt[r.key](r.me)), h('small', null, label[r.key]), h('span', { class: 'sb-v' + (r.lead === 'them' ? ' lead' : '') }, fmt[r.key](r.them))),
          h('div', { class: 'sb-bar', role: 'img', 'aria-label': `${label[r.key]}: you ${fmt[r.key](r.me)}, ${peerName} ${fmt[r.key](r.them)}` }, h('i', { style: `width:${pct}%` }))
        );
      })
    );
  }

  const EMPTY = { sets: 0, volKg: 0, work: 0, exercises: [] };
  const mySnapshot = () => (active() ? app().pairSnapshot() : EMPTY);

  function verdict(cmp, peerName) {
    const how = { volume: 'on weight lifted', work: 'on time worked', sets: 'on sets completed' }[cmp.basis];
    if (cmp.winner === 'tie') return { big: "It's a draw", small: `Dead level ${how}.` };
    return cmp.winner === 'me' ? { big: 'You win!', small: `Ahead ${how}.` } : { big: `${peerName} wins`, small: `Ahead ${how}. Rematch?` };
  }

  /* =====================================================================
   * The bar inside a workout
   * ===================================================================== */
  function barState() {
    const meta = pairMeta();
    const st = cur && cur.ctl.state;
    if (!meta) return null;
    if (!st || st.status === 'idle') return { dot: 'wait', title: 'Connecting…', sub: '' };
    const peerName = (st.peer && st.peer.name) || meta.peerName || 'Partner';
    const practice = cur.practice ? 'Practice partner · ' : '';
    if (st.status === 'failed') return { dot: 'bad', title: 'Not connected', sub: 'Tap to retry' };
    if (st.status === 'joining') return { dot: 'wait', title: 'Connecting…', sub: '' };
    if (st.status === 'waiting') return { dot: 'wait', title: `Waiting for a partner`, sub: cur.practice ? 'Your practice partner is joining…' : `Code ${showCode(meta.room)} · tap to invite` };
    if (!st.online) return { dot: 'wait', title: 'Reconnecting…', sub: '' };
    if (st.peerLeft) return { dot: 'bad', title: `${peerName} left`, sub: 'You can keep going on your own' };
    const mine = mySnapshot();
    const theirs = st.peerSnap || EMPTY;
    const sub = `You ${mine.sets} · ${peerName} ${theirs.sets} sets`;
    if (st.peerFinished) return { dot: 'ok', title: `${peerName} finished`, sub };
    if (st.peerStale) return { dot: 'wait', title: `${peerName} may be offline`, sub };
    return { dot: 'ok', title: `${practice}With ${peerName}`, sub };
  }

  function bar() {
    if (!pairMeta()) return null;
    let seen = false;
    const el = h('button', { class: 'pair-bar', type: 'button', onclick: openPairSheet });
    function draw() {
      if (el.isConnected) seen = true;
      else if (seen) {
        const i = redraw.indexOf(draw);
        if (i !== -1) redraw.splice(i, 1);
        return;
      }
      const s = barState();
      if (!s) return;
      mount(el, h('span', { class: 'pb-dot ' + s.dot }), h('span', { class: 'pb-text' }, h('b', null, s.title), s.sub ? h('small', null, s.sub) : null), icon('chevron', 18));
    }
    redraw.push(draw);
    draw();
    return el;
  }

  /* =====================================================================
   * The pair sheet: code, scoreboard, partner's sets, cheers, leave
   * ===================================================================== */
  function openPairSheet() {
    const meta = pairMeta();
    if (!meta) return;
    const body = h('div', { class: 'pair-sheet' });
    let sheet;

    async function retry() {
      detach(false);
      await attach();
    }

    async function shareInvite() {
      const text = `Join my ${active() ? active().dayName : ''} workout on GymBoy. Code: ${showCode(meta.room)}`;
      const url = inviteLink(meta.room);
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Train with me on GymBoy', text, url });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast('Invite copied. Paste it into a chat.', 'success');
      } catch (e) {
        toast(`Code: ${showCode(meta.room)}`);
      }
    }

    function draw() {
      const m = pairMeta();
      if (!m) {
        if (sheet) sheet.close();
        return;
      }
      const st = cur && cur.ctl.state;
      const s = barState() || { dot: 'wait', title: '', sub: '' };
      const unit = active().unit;
      const peerName = (st && st.peer && st.peer.name) || m.peerName || 'Partner';
      const parts = [];

      parts.push(h('div', { class: 'ps-status' }, h('span', { class: 'pb-dot ' + s.dot }), h('span', null, h('b', null, s.title), s.sub ? h('small', null, s.sub) : null)));

      if (!st || st.status === 'failed') {
        parts.push(h('p', { class: 'muted' }, 'The connection to your partner dropped. Your workout is safe and keeps working.'), h('button', { class: 'btn primary', type: 'button', onclick: retry }, 'Retry'));
      } else if (st.status === 'waiting' && !cur.practice) {
        parts.push(
          h('div', { class: 'ps-code', 'aria-label': `Room code ${m.room.split('').join(' ')}` }, showCode(m.room)),
          h('p', { class: 'muted ps-hint' }, 'Your partner opens GymBoy, taps Pair, and enters this code, or opens your invite link.'),
          h('div', { class: 'row gap' }, h('button', { class: 'btn primary grow', type: 'button', onclick: shareInvite }, icon('share', 20), 'Send invite'))
        );
      } else if (st.status === 'waiting') {
        parts.push(h('p', { class: 'muted' }, 'Your practice partner will join in a moment.'));
      } else {
        const mine = mySnapshot();
        const theirs = st.peerSnap || EMPTY;
        parts.push(h('h3', { class: 'section-title' }, 'Scoreboard'), scoreboard(mine, theirs, peerName, unit));
        if (theirs.exercises.length) {
          parts.push(
            h('h3', { class: 'section-title' }, `${peerName}'s sets`),
            theirs.exercises.map((ex) => h('div', { class: 'hx' }, h('b', null, ex.name), h('div', { class: 'pills' }, ex.sets.map((l) => h('span', { class: 'pill' }, l)))))
          );
        } else {
          parts.push(h('p', { class: 'muted' }, `${peerName} has not ticked a set yet.`));
        }
        if (!st.peerLeft) {
          parts.push(
            h('h3', { class: 'section-title' }, 'Cheer them on'),
            h('div', { class: 'nudges' }, P.NUDGES.map((emo) => h('button', { class: 'nudge-btn', type: 'button', 'aria-label': `Send ${emo}`, onclick: () => (cur.ctl.nudge(emo), toast(`Sent ${emo}`)) }, emo)))
          );
        }
      }

      parts.push(
        h(
          'button',
          {
            class: 'btn ghost danger-text ps-leave',
            type: 'button',
            onclick: async () => {
              if (!(await confirmSheet({ title: 'Leave the pair session?', message: 'Your workout carries on by itself. Your partner is told you left.', confirmText: 'Leave', danger: true }))) return;
              leaveSession();
            },
          },
          'Leave pair session'
        )
      );
      mount(body, parts);
    }

    redraw.push(draw);
    sheet = openSheet({
      title: cur && cur.practice ? 'Pair workout (practice)' : 'Pair workout',
      tall: true,
      body,
      onClose: () => {
        const i = redraw.indexOf(draw);
        if (i !== -1) redraw.splice(i, 1);
      },
    });
    draw();
  }

  // Keep the workout, drop the partner.
  function leaveSession() {
    const a = active();
    if (a) {
      delete a.pair;
      app().saveActive();
    }
    detach(true);
    GB.ui.closeAllSheets();
    if (app()) app().render();
  }

  /* =====================================================================
   * The result, after you save a pair workout
   * ===================================================================== */
  function showResult(session) {
    if (!cur) return;
    const c = cur;
    const body = h('div', { class: 'pair-sheet' });
    const mine = P.summarize(session.exercises, session.unit);
    function draw() {
      const st = c.ctl.state;
      const theirs = st.peerSnap || EMPTY;
      const name = (st.peer && st.peer.name) || session.with || 'Partner';
      const cmp = P.compare(mine, theirs);
      const v = verdict(cmp, name);
      const waiting = !st.peerFinished && !st.peerLeft && st.status !== 'closed';
      mount(
        body,
        h('div', { class: 'pr-verdict' }, h('h2', null, v.big), h('p', { class: 'muted' }, v.small)),
        scoreboard(mine, theirs, name, session.unit),
        waiting ? h('p', { class: 'muted ps-hint' }, `${name} is still training. Their numbers update here until they finish.`) : null
      );
    }
    redraw.push(draw);
    draw();
    openSheet({
      title: 'Pair result',
      body,
      footer: h('button', { class: 'btn primary big grow', type: 'button', onclick: () => GB.ui.closeAllSheets() }, 'Done'),
      onClose: () => {
        const i = redraw.indexOf(draw);
        if (i !== -1) redraw.splice(i, 1);
        if (cur === c) detach(true);
      },
    });
  }

  /* =====================================================================
   * The Pair tab
   * ===================================================================== */
  screens.pair = function (param) {
    const a = app();
    const state = a.state;
    const page = h('div', { class: 'page pair-page' }, a.pageHeader('Train together', { right: a.settingsButton() }));
    const run = active();

    if (run && run.pair) {
      const st = cur && cur.ctl.state;
      page.append(
        h(
          'section',
          { class: 'card hero live' },
          h('p', { class: 'eyebrow' }, h('i', { class: 'pulse' }), 'Pair workout in progress'),
          h('h2', null, run.dayName),
          h('p', { class: 'muted' }, st && st.peer ? `With ${st.peer.name}` : run.pair.peerName ? `With ${run.pair.peerName}` : `Waiting for a partner · code ${showCode(run.pair.room)}`),
          h('button', { class: 'btn primary big', type: 'button', onclick: () => a.go('session') }, 'Resume workout')
        )
      );
      return page;
    }
    if (run) {
      page.append(h('section', { class: 'card hero live' }, h('p', { class: 'eyebrow' }, 'Workout in progress'), h('h2', null, run.dayName), h('p', { class: 'muted' }, 'Finish or discard it to start a pair workout.'), h('button', { class: 'btn primary big', type: 'button', onclick: () => a.go('session') }, 'Resume workout')));
      return page;
    }

    const canLive = live();
    const joinPrefill = param && param.indexOf('join/') === 0 ? P.normalizeCode(param.slice(5)) || '' : '';
    const counts = {};
    state.sessions.forEach((s) => (counts[s.dayId] = (counts[s.dayId] || 0) + 1));
    const days = GB.data.DAY_TYPES;
    let dayId = days.slice().sort((x, y) => (counts[y.id] || 0) - (counts[x.id] || 0))[0].id;
    let name = myName();
    let code = joinPrefill;
    let error = '';
    let busy = '';

    const body = h('div');
    page.append(body);

    const pickDay = () => days.find((d) => d.id === dayId) || days[0];
    const nameOk = () => {
      name = tidyName(name);
      if (!name) {
        error = 'Add the name your partner will see.';
        draw();
        return false;
      }
      return true;
    };

    async function doStart(practice) {
      if (!nameOk()) return;
      error = '';
      busy = practice ? 'practice' : 'start';
      draw();
      try {
        await (practice ? startPractice : startHosting)(pickDay(), name);
      } catch (e) {
        error = 'Could not start. Please try again.';
        busy = '';
        draw();
      }
    }

    async function doJoin() {
      if (!nameOk()) return;
      error = '';
      busy = 'join';
      draw();
      const r = await joinRoom(code, name);
      if (!r.ok) {
        error = r.message;
        busy = '';
        draw();
      }
    }

    function draw() {
      mount(
        body,
        h('p', { class: 'muted pair-intro' }, 'Train with a friend. You each log your own sets, see each other live, share the rest timer and finish with a scoreboard.'),
        !canLive
          ? h('div', { class: 'notice' }, h('b', null, 'Demo mode. '), 'Pairing two phones needs the live service (Supabase), which is not connected here yet. You can try the whole thing now with a practice partner.')
          : null,
        h('label', { class: 'label', for: 'pair-name' }, 'Your name in the session'),
        h('input', { class: 'field', id: 'pair-name', type: 'text', value: name, maxlength: '24', autocomplete: 'given-name', placeholder: 'e.g. Yash', oninput: (e) => (name = e.target.value) }),
        error ? h('p', { class: 'form-err', role: 'alert' }, error) : null,

        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'Start a session'),
          h('label', { class: 'label', for: 'pair-day' }, 'Workout'),
          h('select', { class: 'select', id: 'pair-day', onchange: (e) => (dayId = e.target.value) }, days.map((d) => h('option', { value: d.id, selected: d.id === dayId }, d.name))),
          h('button', { class: 'btn primary big', type: 'button', disabled: !canLive || !!busy, onclick: () => doStart(false) }, icon('user', 22), busy === 'start' ? 'Starting…' : 'Start and invite a partner'),
          h('button', { class: 'btn ghost', type: 'button', disabled: !!busy, onclick: () => doStart(true) }, icon('spark', 20), busy === 'practice' ? 'Starting…' : 'Try with a practice partner')
        ),

        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card-title' }, 'Join a partner'),
          h('label', { class: 'label', for: 'pair-code' }, 'Code from your partner'),
          h('input', {
            class: 'field code-field',
            id: 'pair-code',
            type: 'text',
            value: code,
            maxlength: '8',
            autocapitalize: 'characters',
            autocomplete: 'off',
            spellcheck: 'false',
            placeholder: 'K7M 2QP',
            oninput: (e) => (code = e.target.value),
          }),
          h('button', { class: 'btn primary big', type: 'button', disabled: !canLive || !!busy, onclick: doJoin }, busy === 'join' ? 'Joining…' : 'Join session')
        ),
        h('p', { class: 'muted pair-fine' }, 'Only your first name, exercise names and set numbers are shared, and only while you train together. Nothing from your profile or scans.')
      );
    }

    draw();
    return page;
  };

  GB.pairUI = { boot, changed, restStarted, bar, discarded, finished, showResult, leaveSession };
})((window.GB = window.GB || {}));
