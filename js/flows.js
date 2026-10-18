/* GymBoy – guided flows: pick a flow, see its moves, and follow it with a timer and cues.
 * The flows themselves are plain data in js/flow-data.js. */
(function (GB) {
  'use strict';
  const { h, mount, icon, openSheet, closeAllSheets, toast } = GB.ui;
  const D = GB.flowData;
  const U = GB.util;

  const LEVEL_CLASS = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  const moveCount = (flow) => flow.moves.length;

  function speak(text) {
    try {
      if (!GB.app.state.settings.flowSpeak || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = navigator.language || 'en-US';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }
  const stopSpeaking = () => {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  };

  /* =====================================================================
   * Picker: all flows, filterable
   * ===================================================================== */
  function openPicker(ctx) {
    let filter = 'all';
    const chips = h('div', { class: 'chips scroll' });
    const list = h('div', { class: 'flow-list' });

    function draw() {
      mount(
        chips,
        [['all', 'All'], ['mobility', 'Mobility'], ['ground', 'Ground flow'], ['yoga', 'Yoga-style']].map(([key, label]) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === key), onclick: () => ((filter = key), draw()) }, label)
        )
      );
      mount(
        list,
        D.FLOWS.filter((f) => filter === 'all' || f.kind === filter).map((f) =>
          h(
            'button',
            { class: 'flow-card', type: 'button', onclick: () => openDetail(f, ctx) },
            h('span', { class: 'fc-top' }, h('b', null, f.name), h('span', { class: 'tag' }, D.KIND_LABEL[f.kind])),
            h('span', { class: 'fc-blurb' }, f.blurb),
            h('span', { class: 'fc-meta' }, h('span', null, `${D.minutes(f)} min`), h('span', null, `${moveCount(f)} moves${f.rounds > 1 ? ` × ${f.rounds} rounds` : ''}`), h('span', { class: 'lvl ' + (LEVEL_CLASS[f.level] || '') }, f.level))
          )
        )
      );
    }
    draw();

    return openSheet({
      title: 'Guided flows',
      tall: true,
      body: [h('p', { class: 'muted pad-b' }, 'Pick a flow and the app guides you move by move with a timer. Your time is logged when you finish.'), chips, list],
    });
  }

  /* =====================================================================
   * Detail: what is in the flow, then start it
   * ===================================================================== */
  function openDetail(flow, ctx) {
    const segs = D.segments(flow);
    const howto = (name) => GB.app.showHowTo(name, 'mobility');
    const steps = flow.moves.map((mv, i) =>
      h(
        'li',
        null,
        h('span', { class: 'fd-name' }, mv.ex),
        h('span', { class: 'fd-time' }, mv.each ? `${mv.secs} s each side` : `${mv.secs} s`),
        h('button', { class: 'pick-info', type: 'button', 'aria-label': `How to do ${mv.ex}`, onclick: () => howto(mv.ex) }, icon('info', 18))
      )
    );
    const sheet = openSheet({
      title: flow.name,
      tall: true,
      body: [
        h('p', { class: 'pad-b' }, flow.blurb),
        h('div', { class: 'stats' }, GB.app.statTile('Time', `${D.minutes(flow)} min`), GB.app.statTile('Moves', String(moveCount(flow))), GB.app.statTile(flow.rounds > 1 ? 'Rounds' : 'Level', flow.rounds > 1 ? String(flow.rounds) : flow.level)),
        h('h3', { class: 'section-title' }, flow.rounds > 1 ? `Each round (${flow.rounds} rounds)` : 'The moves'),
        h('ol', { class: 'fd-list' }, steps),
        h('p', { class: 'ht-safety' }, 'Move within a comfortable range. Ease off or skip a move if anything hurts.'),
      ],
      footer: h(
        'button',
        {
          class: 'btn primary big grow',
          type: 'button',
          onclick: () => {
            closeAllSheets();
            openPlayer(flow, ctx);
          },
        },
        icon('play', 20),
        `Start · ${mmss(D.totalSeconds(flow))}`
      ),
    });
    return sheet;
  }

  /* =====================================================================
   * Player
   * ===================================================================== */
  function openPlayer(flow, ctx) {
    const app = GB.app;
    const segs = D.segments(flow);
    const phases = [{ kind: 'prep', start: 0, end: D.PREP_SECONDS * 1000 }];
    let at = D.PREP_SECONDS * 1000;
    segs.forEach((sg, i) => {
      phases.push(Object.assign({ kind: 'move', i, start: at, end: at + sg.secs * 1000 }, sg));
      at += sg.secs * 1000;
    });

    const run = { base: 0, resumedAt: Date.now(), paused: false, idx: 0, workedMs: 0, finished: false, iv: null, beeped: '' };
    const ui = {
      step: h('p', { class: 'fl-step' }),
      name: h('h2', { class: 'fl-name' }),
      side: h('span', { class: 'fl-side' }),
      time: h('div', { class: 'fl-time' }),
      cue: h('p', { class: 'fl-cue' }),
      bar: h('div', { class: 'iv-bar-fill' }),
      next: h('p', { class: 'fl-next' }),
    };
    ui.panel = h('div', { class: 'iv-panel fl-panel prep', role: 'timer' }, ui.step, ui.name, ui.side, ui.time, ui.cue, h('div', { class: 'iv-bar' }, ui.bar), ui.next);
    ui.pauseBtn = h('button', { class: 'btn primary grow big', type: 'button', onclick: togglePause });
    ui.infoBtn = h('button', { class: 'btn soft big iv-side', type: 'button', 'aria-label': 'How to do this move', onclick: showHowTo }, icon('info', 20));
    const foot = h('div', { class: 'iv-foot fl-foot' });
    const body = h('div', { class: 'iv fl' }, ui.panel);

    const sheet = openSheet({
      title: flow.name,
      tall: true,
      noFocus: true,
      body,
      footer: foot,
      onClose: () => {
        clearInterval(run.iv);
        stopSpeaking();
      },
    });
    sheet.setLocked(true);

    const elapsed = () => run.base + (run.paused ? 0 : Date.now() - run.resumedAt);
    const indexAt = (el) => phases.findIndex((p) => el < p.end);
    const phaseTitle = (p) => (p.kind === 'prep' ? 'Get ready' : p.ex);

    function setPauseLabel() {
      mount(ui.pauseBtn, icon(run.paused ? 'play' : 'pause', 20), run.paused ? 'Resume' : 'Pause');
    }

    function buildFoot() {
      mount(foot, h('button', { class: 'btn ghost big iv-side', type: 'button', onclick: confirmStop }, 'Stop'), ui.pauseBtn, ui.infoBtn, h('button', { class: 'btn soft big iv-side', type: 'button', 'aria-label': 'Skip to next move', onclick: skip }, icon('skip', 20)));
      setPauseLabel();
    }

    function paint(el) {
      const p = phases[run.idx];
      const left = Math.max(0, Math.ceil((p.end - el) / 1000));
      const nxt = phases[run.idx + 1];
      ui.panel.className = `iv-panel fl-panel ${p.kind === 'prep' ? 'prep' : 'work'}${run.paused ? ' paused' : ''}`;
      if (p.kind === 'prep') {
        ui.step.textContent = `${moveCount(flow)} moves · ${D.minutes(flow)} min`;
        ui.name.textContent = 'Get ready';
        ui.side.textContent = '';
        ui.cue.textContent = `First up: ${phases[1].ex}${phases[1].side ? `, ${phases[1].side.toLowerCase()} side` : ''}`;
      } else {
        ui.step.textContent = `Move ${p.step} of ${p.steps}${p.rounds > 1 ? ` · Round ${p.round} of ${p.rounds}` : ''}`;
        ui.name.textContent = p.ex;
        ui.side.textContent = p.side ? `${p.side} side` : '';
        ui.cue.textContent = p.cue;
      }
      ui.side.hidden = !ui.side.textContent;
      ui.time.textContent = run.paused ? 'Paused' : String(left);
      ui.time.classList.toggle('small', run.paused);
      ui.next.textContent = nxt ? `Next: ${nxt.ex}${nxt.side ? ` (${nxt.side.toLowerCase()} side)` : ''}` : 'Last move. Nice and slow.';
      ui.bar.style.transform = `scaleX(${Math.max(0, 1 - (el - p.start) / (p.end - p.start))})`;
      return left;
    }

    function cue(p) {
      if (p.kind === 'move') {
        app.tone(660, 0.14, 0, 0.3);
        app.tone(880, 0.22, 0.16, 0.3);
        app.buzz(120);
        speak(`${p.ex}${p.side ? `, ${p.side.toLowerCase()} side` : ''}`);
      } else {
        speak(`Get ready. First up, ${phases[1].ex}`);
      }
    }

    function tick() {
      if (run.finished) return;
      const el = elapsed();
      const idx = indexAt(el);
      const target = idx === -1 ? phases.length : idx;
      while (run.idx < target) {
        const p = phases[run.idx];
        if (p.kind === 'move') run.workedMs += p.end - p.start;
        run.idx += 1;
        if (run.idx === target && run.idx < phases.length) cue(phases[run.idx]);
      }
      if (idx === -1) return finish(false);
      const left = paint(el);
      const key = `${run.idx}:${left}`;
      if (!run.paused && left > 0 && left <= 3 && run.beeped !== key) {
        run.beeped = key;
        app.tone(520, 0.1, 0, 0.22);
      }
    }

    function togglePause() {
      if (run.finished) return;
      if (run.paused) {
        run.resumedAt = Date.now();
        run.paused = false;
      } else {
        run.base = elapsed();
        run.paused = true;
        stopSpeaking();
      }
      setPauseLabel();
      paint(elapsed());
    }

    function skip() {
      if (run.finished) return;
      const el = elapsed();
      const idx = indexAt(el);
      if (idx === -1) return;
      const p = phases[idx];
      if (p.kind === 'move') run.workedMs += Math.max(0, Math.min(el - p.start, p.end - p.start));
      run.base = p.end;
      run.resumedAt = Date.now();
      run.idx = idx + 1;
      if (run.idx >= phases.length) return finish(false);
      cue(phases[run.idx]);
      paint(elapsed());
    }

    // the exact time you moved for (skipped and paused time is not counted)
    function workedSeconds() {
      let ms = run.workedMs;
      const p = phases[Math.min(run.idx, phases.length - 1)];
      if (!run.finished && p && p.kind === 'move') ms += Math.max(0, Math.min(elapsed() - p.start, p.end - p.start));
      return Math.round(ms / 1000);
    }

    function showHowTo() {
      const p = phases[Math.min(run.idx, phases.length - 1)];
      const name = p.kind === 'prep' ? phases[1].ex : p.ex;
      if (!run.paused) togglePause();
      GB.howto.open(name, 'mobility', { extras: app.extrasApi });
    }

    function logAndClose(logIt) {
      if (logIt) {
        const secs = workedSeconds();
        if (secs > 0) app.logTimed(ctx, flow.name, 'mobility', secs);
      }
      endRun();
    }

    function endRun() {
      clearInterval(run.iv);
      stopSpeaking();
      run.finished = true;
      sheet.setLocked(false);
      sheet.close();
    }

    function confirmStop() {
      if (run.finished) return;
      if (!run.paused) togglePause();
      const worked = workedSeconds();
      if (worked < 10) {
        const s = openSheet({
          title: 'End this flow?',
          hideClose: true,
          body: h('p', { class: 'muted pad-b' }, 'You have only just started, so nothing will be logged.'),
          footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => s.close() }, 'Keep going'), h('button', { class: 'btn danger grow', type: 'button', onclick: () => (s.close(), endRun()) }, 'End flow')],
        });
        return;
      }
      const s = openSheet({
        title: 'End this flow?',
        hideClose: true,
        body: h('p', { class: 'muted pad-b' }, `You moved for ${mmss(worked)}. Log it to your workout?`),
        footer: h(
          'div',
          { class: 'stack wide' },
          h('button', { class: 'btn primary big', type: 'button', onclick: () => (s.close(), logAndClose(true)) }, `Log ${mmss(worked)} and end`),
          h('button', { class: 'btn ghost big', type: 'button', onclick: () => (s.close(), logAndClose(false)) }, 'End without logging'),
          h('button', { class: 'btn ghost big', type: 'button', onclick: () => s.close() }, 'Keep going')
        ),
      });
    }

    function finish() {
      if (run.finished) return;
      clearInterval(run.iv);
      run.finished = true;
      stopSpeaking();
      sheet.setLocked(false);
      const secs = Math.round(run.workedMs / 1000);
      if (secs > 0) app.logTimed(ctx, flow.name, 'mobility', secs);
      app.tone(660, 0.2, 0, 0.3);
      app.tone(880, 0.2, 0.22, 0.3);
      app.tone(1175, 0.4, 0.44, 0.3);
      app.buzz([200, 100, 200]);
      speak('Flow complete');
      mount(
        body,
        h(
          'div',
          { class: 'iv-panel done' },
          h('div', { class: 'iv-phase' }, 'Flow complete'),
          h('div', { class: 'iv-time small' }, mmss(secs)),
          h('div', { class: 'iv-round' }, secs > 0 ? `${flow.name} is logged to your workout` : 'Nothing to log')
        )
      );
      mount(foot, h('button', { class: 'btn primary big grow', type: 'button', onclick: () => sheet.close() }, 'Done'));
    }

    app.unlockAudio();
    buildFoot();
    paint(0);
    cue(phases[0]);
    run.iv = setInterval(tick, 200);
    tick();
    return sheet;
  }

  GB.flows = { openPicker, openDetail, openPlayer };
})((window.GB = window.GB || {}));
