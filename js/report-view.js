/* GymBoy – draws a scan report (see ai/scan-report.schema.json) as a visual page. */
(function (GB) {
  'use strict';
  const { h, svg, mount, icon, confirmSheet, toast } = GB.ui;
  const P = GB.profile;
  const U = GB.util;
  const screens = (GB.screens = GB.screens || {});

  const MASS_KEYS = new Set(['weight', 'skeletal_muscle_mass', 'body_fat_mass', 'lean_body_mass', 'total_body_water', 'dry_lean_mass', 'protein_mass', 'mineral_mass', 'body_cell_mass']);
  const GAUGE_ORDER = ['weight', 'skeletal_muscle_mass', 'body_fat_percent', 'body_fat_mass', 'bmi', 'visceral_fat_level', 'visceral_fat_area', 'total_body_water', 'ecw_tbw_ratio', 'lean_body_mass', 'bmr', 'waist_hip_ratio'];
  const STATUS_TEXT = { within: 'In range', above: 'Above range', below: 'Below range' };
  const SEGMENTS = [
    ['right_arm', 'Right arm'],
    ['left_arm', 'Left arm'],
    ['trunk', 'Trunk'],
    ['right_leg', 'Right leg'],
    ['left_leg', 'Left leg'],
  ];
  const DISCLAIMER = 'This report is wellness guidance based on your scan and your answers. It is not medical advice and does not diagnose anything. If something worries you, talk to a doctor.';

  function fmtVal(v) {
    if (v == null) return '–';
    if (Number.isInteger(v)) return U.fmtNum(v);
    return String(Number(v.toFixed(Math.abs(v) < 1 ? 3 : 2)));
  }

  /* ---------- the score ring ---------- */
  function ring(value, max, size, label) {
    const stroke = Math.max(7, Math.round(size * 0.1));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, value / (max || 100)));
    const fill = svg('circle', { class: 'ring-fill', cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c, transform: `rotate(-90 ${size / 2} ${size / 2})` });
    const apply = () => fill.setAttribute('stroke-dashoffset', String(c * (1 - frac)));
    requestAnimationFrame(() => requestAnimationFrame(apply));
    setTimeout(apply, 120); // a throttled or hidden page may skip animation frames
    return h(
      'div',
      { class: 'ring', style: `width:${size}px;height:${size}px`, role: 'img', 'aria-label': `${label || 'Score'}: ${value} out of ${max || 100}` },
      svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size }, svg('circle', { class: 'ring-track', cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke }), fill),
      h('div', { class: 'ring-text' }, h('b', null, fmtVal(value)), h('small', null, /score/i.test(label || '') ? 'score' : label || 'score'))
    );
  }

  /* ---------- a metric with its healthy range ---------- */
  function gaugeRow(m, trendItem, imperial) {
    const mass = imperial && MASS_KEYS.has(m.key);
    const conv = (v) => (v == null ? null : mass ? P.kgToLb(v) : v);
    const unit = mass ? 'lb' : m.unit === 'kg/m2' ? '' : m.unit;
    const g = m.range_source !== 'none' ? P.gauge(m.value, m.range_low, m.range_high) : null;

    const bar = g
      ? h(
          'div',
          { class: 'gauge-bar', role: 'img', 'aria-label': `${m.label} ${fmtVal(conv(m.value))}${unit ? ' ' + unit : ''}, ${STATUS_TEXT[m.status] || 'no range'}` },
          h('i', { class: 'gauge-band', style: `left:${g.bandStart * 100}%;width:${(g.bandEnd - g.bandStart) * 100}%` }),
          h('i', { class: 'gauge-mark ' + m.status, style: `left:${g.pos * 100}%` })
        )
      : null;
    const rangeText = g ? `${fmtVal(conv(m.range_low))} to ${fmtVal(conv(m.range_high))}${unit ? ' ' + unit : ''}${m.range_source === 'reference' ? ' (typical)' : ''}` : null;

    return h(
      'div',
      { class: 'gauge' },
      h('div', { class: 'gauge-top' }, h('span', { class: 'gauge-label' }, m.label), STATUS_TEXT[m.status] ? h('span', { class: 'status ' + m.status }, STATUS_TEXT[m.status]) : null),
      h('div', { class: 'gauge-val' }, h('b', null, fmtVal(conv(m.value))), unit ? h('small', null, unit) : null, trendItem ? deltaChip(trendItem, imperial) : null),
      bar,
      rangeText ? h('p', { class: 'gauge-range' }, 'Healthy range ' + rangeText) : null,
      m.note ? h('p', { class: 'gauge-note' }, m.note) : null,
      m.confidence === 'low' ? h('p', { class: 'gauge-note warnx' }, 'Hard to read in the photo. Please double-check this number.') : null
    );
  }

  function deltaChip(t, imperial) {
    const mass = imperial && MASS_KEYS.has(t.key);
    const d = mass ? P.kgToLb(Math.abs(t.delta)) : Math.abs(t.delta);
    const sign = t.delta > 0 ? '+' : t.delta < 0 ? '−' : '';
    return h('span', { class: 'delta ' + t.meaning, title: t.meaning.replace(/_/g, ' ') }, `${sign}${fmtVal(Math.round(d * 100) / 100)}`);
  }

  /* ---------- the body figure ---------- */
  function bodyFigure(segments, mode) {
    const data = segments[mode];
    const shapes = {
      right_arm: { x: 24, y: 82, w: 36, h: 112, rx: 17 },
      left_arm: { x: 160, y: 82, w: 36, h: 112, rx: 17 },
      trunk: { x: 72, y: 74, w: 76, h: 124, rx: 28 },
      right_leg: { x: 76, y: 204, w: 33, h: 150, rx: 16 },
      left_leg: { x: 111, y: 204, w: 33, h: 150, rx: 16 },
    };
    const parts = SEGMENTS.map(([key]) => {
      const seg = data[key];
      const s = shapes[key];
      const status = seg.status || 'unknown';
      return svg(
        'g',
        { class: 'seg ' + status },
        svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: s.rx }),
        seg.percent_of_ideal != null ? svg('text', { x: s.x + s.w / 2, y: s.y + s.h / 2 + 4, 'text-anchor': 'middle' }, `${Math.round(seg.percent_of_ideal)}%`) : null
      );
    });
    return svg(
      'svg',
      { viewBox: '0 0 220 366', class: 'body-svg', role: 'img', 'aria-label': `Body map, ${mode} mass by segment` },
      svg('circle', { class: 'head', cx: 110, cy: 36, r: 25 }),
      svg('rect', { class: 'neck', x: 102, y: 58, width: 16, height: 18, rx: 6 }),
      ...parts
    );
  }

  function bodySection(r, imperial) {
    const seg = r.segments;
    const modes = ['lean', 'fat'].filter((m) => seg[m]);
    if (!modes.length) return null;
    let mode = modes[0];
    const box = h('section', { class: 'card r-card' });
    function draw() {
      const data = seg[mode];
      const rows = SEGMENTS.map(([key, label]) => {
        const s = data[key];
        const mass = s.mass == null ? '–' : `${fmtVal(imperial ? P.kgToLb(s.mass) : s.mass)} ${imperial ? 'lb' : 'kg'}`;
        return h('li', null, h('span', { class: 'dot ' + (s.status || 'unknown') }), h('span', { class: 'seg-name' }, label), h('b', null, mass), h('small', null, s.percent_of_ideal != null ? `${Math.round(s.percent_of_ideal)}% of ideal` : ''));
      });
      mount(box, 
        h('div', { class: 'r-head' }, h('h2', { class: 'r-title' }, 'Body map'), modes.length > 1 ? h('div', { class: 'seg tiny' }, modes.map((m) => h('button', { type: 'button', 'aria-pressed': String(m === mode), onclick: () => ((mode = m), draw()) }, m === 'lean' ? 'Muscle' : 'Fat'))) : null),
        h('p', { class: 'muted r-sub' }, mode === 'lean' ? 'Muscle in each part of your body compared with what is ideal for you.' : 'Fat in each part of your body compared with what is ideal for you.'),
        h('div', { class: 'body-wrap' }, bodyFigure(seg, mode), h('ul', { class: 'seg-list' }, rows)),
        h('div', { class: 'seg-legend' }, h('span', null, h('i', { class: 'dot normal' }), 'Typical'), h('span', null, h('i', { class: 'dot above' }), 'Above'), h('span', null, h('i', { class: 'dot below' }), 'Below'))
      );
    }
    draw();
    return box;
  }

  /* ---------- left vs right ---------- */
  function balanceSection(r, imperial) {
    const items = (r.balance || []).filter((b) => b.left_value != null && b.right_value != null);
    if (!items.length) return null;
    const FLAG = { none: ['Even', 'ok'], mild: ['Slight gap', 'mild'], notable: ['Noticeable gap', 'bad'], unknown: ['', ''] };
    return h(
      'section',
      { class: 'card r-card' },
      h('h2', { class: 'r-title' }, 'Left and right balance'),
      items.map((b) => {
        const max = Math.max(b.left_value, b.right_value);
        const conv = (v) => (imperial ? P.kgToLb(v) : v);
        const u = imperial ? 'lb' : 'kg';
        const bar = (label, v) => h('div', { class: 'bal-row' }, h('span', null, label), h('div', { class: 'bal-track' }, h('i', { style: `width:${(v / max) * 100}%` })), h('b', null, `${fmtVal(conv(v))} ${u}`));
        const [txt, cls] = FLAG[b.flag] || FLAG.unknown;
        return h('div', { class: 'bal' }, h('div', { class: 'bal-head' }, h('b', null, b.pair === 'arms' ? 'Arms' : 'Legs'), txt ? h('span', { class: 'flagchip ' + cls }, `${txt}${b.diff_percent != null ? ` · ${b.diff_percent}%` : ''}`) : null), bar('Left', b.left_value), bar('Right', b.right_value), b.note ? h('p', { class: 'gauge-note' }, b.note) : null);
      })
    );
  }

  /* ---------- change since the last scan ---------- */
  function trendSection(r, imperial) {
    const t = r.trend;
    if (!t || !t.items.length) return null;
    const label = (key) => (r.metrics.find((m) => m.key === key) || {}).label || key;
    const MEAN = { improving: 'Improving', worsening: 'Watch', neutral: 'Changed', within_normal_variation: 'Normal variation' };
    return h(
      'section',
      { class: 'card r-card' },
      h('h2', { class: 'r-title' }, 'Since your last scan'),
      t.previous_measured_at ? h('p', { class: 'muted r-sub' }, `Compared with ${U.fmtDate(new Date(t.previous_measured_at).getTime(), { day: 'numeric', month: 'short', year: 'numeric' })}`) : null,
      h('p', { class: 'r-summary' }, t.summary),
      h(
        'ul',
        { class: 'trend-list' },
        t.items.map((it) => {
          const mass = imperial && MASS_KEYS.has(it.key);
          const c = (v) => (mass ? P.kgToLb(v) : v);
          return h('li', null, h('span', { class: 'tl-name' }, label(it.key)), h('span', { class: 'tl-vals' }, `${fmtVal(c(it.previous))} → ${fmtVal(c(it.current))}`), deltaChip(it, imperial), h('span', { class: 'mean ' + it.meaning }, MEAN[it.meaning] || ''));
        })
      )
    );
  }

  /* ---------- text sections ---------- */
  function insightsSection(r) {
    const list = r.report.insights;
    if (!list.length) return null;
    const ICO = { positive: 'check', neutral: 'spark', attention: 'warn' };
    return h('section', { class: 'r-block' }, h('h2', { class: 'r-title pad' }, 'What stands out'), h('div', { class: 'insights' }, list.map((i) => h('div', { class: 'insight ' + i.sentiment }, h('span', { class: 'ins-ico' }, icon(ICO[i.sentiment] || 'spark', 18)), h('p', null, i.text)))));
  }

  function focusSection(r) {
    const list = r.report.focus_areas;
    if (!list.length) return null;
    const AREA = { training: 'Training', nutrition: 'Nutrition', recovery: 'Recovery', lifestyle: 'Lifestyle', measurement: 'Next scan' };
    return h('section', { class: 'r-block' }, h('h2', { class: 'r-title pad' }, 'Where to focus'), list.map((f) => h('div', { class: 'card focus' }, h('span', { class: 'tag' }, AREA[f.area] || f.area), h('h3', null, f.title), h('p', { class: 'muted' }, f.why), h('p', { class: 'focus-act' }, icon('target', 18), h('span', null, f.action)))));
  }

  function coachingSection(r, limited) {
    const c = r.report.coaching;
    const n = c.nutrition;
    const lists = [
      ['Training', c.training],
      ['Recovery', c.recovery],
    ].filter(([, l]) => l && l.length);
    const hasNutrition = n.protein_g_min != null || n.calorie_guidance || (n.notes && n.notes.length);
    if (!lists.length && !hasNutrition && !c.next_scan.tips.length) return null;
    return h(
      'section',
      { class: 'card r-card' },
      h('h2', { class: 'r-title' }, 'Your plan from here'),
      limited ? h('p', { class: 'muted r-sub' }, 'Guidance is kept general for you.') : null,
      lists.map(([title, items]) => h('div', { class: 'coach' }, h('h3', null, title), h('ul', null, items.map((x) => h('li', null, x))))),
      hasNutrition
        ? h(
            'div',
            { class: 'coach' },
            h('h3', null, 'Nutrition'),
            n.protein_g_min != null && n.protein_g_max != null ? h('div', { class: 'protein' }, h('b', null, `${n.protein_g_min} to ${n.protein_g_max} g`), h('span', null, 'protein a day')) : null,
            n.calorie_guidance ? h('p', null, n.calorie_guidance) : null,
            n.notes && n.notes.length ? h('ul', null, n.notes.map((x) => h('li', null, x))) : null
          )
        : null,
      c.next_scan.tips.length || c.next_scan.suggested_in_days
        ? h('div', { class: 'coach' }, h('h3', null, 'Your next scan'), c.next_scan.suggested_in_days ? h('p', null, `Rescan in about ${c.next_scan.suggested_in_days} days.`) : null, h('ul', null, c.next_scan.tips.map((x) => h('li', null, x))))
        : null
    );
  }

  function glossarySection(r) {
    const g = r.report.glossary;
    if (!g.length) return null;
    return h('details', { class: 'card r-card details' }, h('summary', null, 'What these words mean'), h('dl', null, g.map((x) => [h('dt', null, x.term), h('dd', null, x.plain_meaning)])));
  }

  /* =====================================================================
   * The whole report
   * ===================================================================== */
  function render(record, opts) {
    opts = opts || {};
    const r = record.report;
    const profile = GB.backend.profile() || {};
    const imperial = profile.units === 'imperial';
    const when = r.scan.measured_at || record.created_at;
    const whenText = when ? U.fmtDate(new Date(when).getTime(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const metrics = r.metrics.filter((m) => m.value != null);
    const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
    const trendByKey = r.trend ? Object.fromEntries(r.trend.items.map((t) => [t.key, t])) : {};
    const gauges = GAUGE_ORDER.filter((k) => byKey[k]).map((k) => byKey[k]);
    const score = r.report.score;

    const banners = [];
    if (r._sample) banners.push(h('div', { class: 'r-banner sample' }, icon('spark', 18), h('span', null, h('b', null, 'Sample report. '), 'The analysis service is not connected yet, so this shows an example, not your numbers.')));
    if (r.status === 'needs_attention') banners.push(h('div', { class: 'r-banner warn' }, icon('warn', 18), h('span', null, 'Some details on this scan do not match your profile. Check it is your sheet.')));
    if (r.status === 'partial') banners.push(h('div', { class: 'r-banner warn' }, icon('warn', 18), h('span', null, 'Some values could not be read. The ones shown are the ones we could read clearly.')));
    if (r.safety.referral_suggested) banners.push(h('div', { class: 'r-banner care' }, icon('shield', 18), h('span', null, r.safety.reason || 'It may be worth talking to a doctor about these results.')));
    if (r.safety.coaching_limited) banners.push(h('div', { class: 'r-banner care' }, icon('shield', 18), h('span', null, r.safety.limited_reason || 'Guidance is kept general for you.')));

    const issues = r.warnings.filter((w) => w.code !== 'profile_mismatch');

    return h(
      'div',
      { class: 'report' },
      ...banners,
      h(
        'section',
        { class: 'card r-hero' },
        score ? ring(score.value, score.max || 100, 112, score.label) : h('span', { class: 'sc-ico big' }, icon('scale', 34)),
        h('div', { class: 'r-hero-text' }, h('p', { class: 'eyebrow' }, whenText + (r.scan.device_model ? ` · ${r.scan.device_model}` : '')), h('h2', null, r.report.headline))
      ),
      gauges.length ? h('section', { class: 'card r-card' }, h('h2', { class: 'r-title' }, 'Your key numbers'), h('div', { class: 'gauges' }, gauges.map((m) => gaugeRow(m, trendByKey[m.key], imperial)))) : null,
      r.segments ? bodySection(r, imperial) : null,
      balanceSection(r, imperial),
      trendSection(r, imperial),
      insightsSection(r),
      focusSection(r),
      coachingSection(r, r.safety.coaching_limited),
      glossarySection(r),
      issues.length ? h('details', { class: 'card r-card details' }, h('summary', null, `Things to double-check (${issues.length})`), h('ul', { class: 'issues' }, issues.map((w) => h('li', null, w.message)))) : null,
      h('p', { class: 'disclaimer' }, DISCLAIMER)
    );
  }

  GB.reportView = { render, ring, fmtVal };

  /* =====================================================================
   * Route: #/report/<id>
   * ===================================================================== */
  screens.report = function (id) {
    const app = GB.app;
    const record = GB.backend.scans().find((s) => s.id === id);
    const back = () => app.go('home');
    if (!record) {
      return h('div', { class: 'page' }, app.pageHeader('Report', { back }), h('p', { class: 'empty' }, 'That report could not be found. It may have been deleted.'));
    }
    return h(
      'div',
      { class: 'page report-page' },
      app.pageHeader('Your report', {
        back,
        right: h(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            'aria-label': 'Delete this report',
            onclick: async () => {
              if (!(await confirmSheet({ title: 'Delete this report?', message: 'It will be removed from your account for good.', confirmText: 'Delete', danger: true }))) return;
              const r = await GB.backend.deleteScan(record.id);
              if (!r.ok) return toast(r.error || 'Could not delete', 'error');
              toast('Report deleted');
              app.go('home', true);
            },
          },
          icon('trash', 20)
        ),
      }),
      render(record)
    );
  };
})((window.GB = window.GB || {}));
