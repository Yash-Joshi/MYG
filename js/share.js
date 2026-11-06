/* GymBoy – share a workout as a picture (WhatsApp, Telegram, Messages…).
 *
 * model()     turns a saved workout into the numbers and lines the picture shows (pure, tested).
 * render()    draws that on a canvas and returns a PNG.
 * open()      shows a preview with Share / Save / Copy. The picture is made before the buttons
 *             appear, so tapping Share goes straight to the phone's share sheet.
 *
 * The picture holds the workout only: no name, email or account details.
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  /* =====================================================================
   * What the picture says
   * ===================================================================== */
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // "60×8" repeated three times becomes one pill with a "×3" badge.
  function collapse(labels) {
    const out = [];
    labels.forEach((text) => {
      const last = out[out.length - 1];
      if (last && last.text === text) last.count += 1;
      else out.push({ text, count: 1 });
    });
    return out;
  }

  function model(session) {
    const U = GB.util;
    const unit = session.unit || 'kg';
    const st = U.stats(session);
    const showVolume = st.volume > 0 || st.work === 0;

    const minutes = session.startedAt && session.endedAt ? session.endedAt - session.startedAt : 0;
    const when = session.endedAt || Date.now();
    const subtitle = [U.fmtDate(when, { weekday: 'long', day: 'numeric', month: 'long' })];
    if (minutes > 0) subtitle.push(U.fmtMinutes(minutes));
    if (session.with) subtitle.push(`with ${String(session.with).slice(0, 24)}`);

    return {
      title: session.dayName || 'Workout',
      subtitle: subtitle.join(' · '),
      unit,
      tiles: [
        { label: 'Exercises', value: String(st.exercises) },
        { label: 'Sets', value: String(st.sets) },
        showVolume ? { label: `Volume (${unit})`, value: U.fmtNum(Math.round(st.volume)) } : { label: 'Work time', value: U.fmtDuration(st.work * 1000) },
      ],
      rows: (session.exercises || [])
        .filter((ex) => ex.sets && ex.sets.length)
        .map((ex) => {
          const timed = U.isTimed(ex);
          return { name: ex.name, unit: timed ? '' : unit, pills: collapse(ex.sets.map((s) => U.setCompact(s, timed, unit))) };
        }),
    };
  }

  const slug = (s) => String(s || 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workout';

  function fileName(session) {
    const d = new Date(session.endedAt || Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    return `gymboy-${slug(session.dayName)}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.png`;
  }

  // The message that travels with the picture where the chat app keeps it.
  function caption(m) {
    const sets = m.tiles[1].value;
    const third = m.tiles[2];
    return `${m.title}: ${plural(Number(sets), 'set')} · ${third.value} ${third.label.startsWith('Volume') ? m.unit : ''}`.trim();
  }

  /* =====================================================================
   * Drawing (browser only)
   * ===================================================================== */
  const W = 1080;
  const PAD = 64;
  const MIN_H = 1080; // never shorter than a square
  const MAX_H = 2400; // long workouts are cut off with "+ N more" so the picture stays shareable
  const FOOTER_H = 130;
  const C = { bg: '#0e1013', card: '#171a1f', card2: '#20252c', line: '#2b313a', text: '#f2f4f6', muted: '#8d97a5', accent: '#c8ff3e', ink: '#10130a' };
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const font = (weight, px) => `${weight} ${px}px ${FONT}`;

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function spaced(ctx, px) {
    try { ctx.letterSpacing = px ? `${px}px` : '0px'; } catch (e) { /* not supported: draw without it */ }
  }

  function text(ctx, str, x, y, f, color, align, tracking) {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    spaced(ctx, tracking || 0);
    ctx.fillText(str, x, y);
    spaced(ctx, 0);
  }

  // Cut a string with "…" so it fits `max` pixels in the current font.
  function fit(ctx, str, max) {
    if (ctx.measureText(str).width <= max) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }

  function bolt(ctx, x, y, size, color) {
    const p = [[13, 2], [4, 14], [11, 14], [10, 22], [19, 10], [12, 10]];
    const k = size / 24;
    ctx.beginPath();
    p.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * k, y + py * k) : ctx.moveTo(x + px * k, y + py * k)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Draws everything above the footer and returns where the content ends.
  function paint(ctx, m) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, MAX_H);
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 780);
    glow.addColorStop(0, 'rgba(200,255,62,0.16)');
    glow.addColorStop(1, 'rgba(200,255,62,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 900);

    let y = PAD;
    // brand
    roundRect(ctx, PAD, y, 64, 64, 18, C.accent);
    bolt(ctx, PAD + 14, y + 14, 36, C.ink);
    text(ctx, 'GYMBOY', PAD + 86, y + 45, font(900, 34), C.text, 'left', 3);
    y += 64 + 60;

    // title, shrunk until it fits on one line
    let size = 100;
    ctx.font = font(900, size);
    while (ctx.measureText(m.title).width > W - 2 * PAD && size > 56) {
      size -= 4;
      ctx.font = font(900, size);
    }
    const title = fit(ctx, m.title, W - 2 * PAD);
    y += size * 0.82;
    text(ctx, title, PAD, y, font(900, size), C.text);
    y += 22;

    ctx.font = font(600, 38);
    y += 38;
    text(ctx, fit(ctx, m.subtitle, W - 2 * PAD), PAD, y, font(600, 38), C.muted);
    y += 52;

    // three headline numbers
    const gap = 24;
    const tw = (W - 2 * PAD - 2 * gap) / 3;
    const th = 184;
    m.tiles.forEach((t, i) => {
      const x = PAD + i * (tw + gap);
      roundRect(ctx, x, y, tw, th, 28, C.card, C.line);
      ctx.font = font(900, 72);
      const v = fit(ctx, t.value, tw - 48);
      text(ctx, v, x + 26, y + 98, font(900, 72), i === 2 ? C.accent : C.text);
      text(ctx, t.label.toUpperCase(), x + 26, y + 152, font(700, 25), C.muted, 'left', 1.5);
    });
    y += th + 60;

    // the exercises
    const limit = MAX_H - FOOTER_H - 20;
    const pillH = 64;
    let shown = 0;
    for (const row of m.rows) {
      // measure how tall this exercise is before drawing it
      ctx.font = font(800, 32);
      let lines = 1;
      let x = PAD;
      const widths = row.pills.map((p) => {
        ctx.font = font(800, 32);
        const base = ctx.measureText(p.text).width;
        ctx.font = font(800, 28);
        const badge = p.count > 1 ? ctx.measureText(` ×${p.count}`).width : 0;
        return base + badge + 44;
      });
      widths.forEach((w) => {
        if (x + w > W - PAD && x > PAD) {
          lines += 1;
          x = PAD;
        }
        x += w + 14;
      });
      const rowH = 44 + 26 + lines * pillH + (lines - 1) * 14 + 46;
      const reserve = shown < m.rows.length - 1 ? 80 : 0; // room for the "+ N more" line
      if (y + rowH + reserve > limit) break;

      ctx.font = font(800, 44);
      const unitW = row.unit ? 90 : 0;
      text(ctx, fit(ctx, row.name, W - 2 * PAD - unitW), PAD, y + 40, font(800, 44), C.text);
      if (row.unit) text(ctx, row.unit, W - PAD, y + 38, font(700, 28), C.muted, 'right');

      let px = PAD;
      let py = y + 44 + 26;
      row.pills.forEach((p, i) => {
        const w = widths[i];
        if (px + w > W - PAD && px > PAD) {
          px = PAD;
          py += pillH + 14;
        }
        roundRect(ctx, px, py, w, pillH, 32, C.card2);
        text(ctx, p.text, px + 22, py + 43, font(800, 32), C.text);
        if (p.count > 1) {
          ctx.font = font(800, 32);
          const off = ctx.measureText(p.text).width;
          text(ctx, ` ×${p.count}`, px + 22 + off, py + 42, font(800, 28), C.accent);
        }
        px += w + 14;
      });
      y += rowH;
      shown += 1;
    }
    if (shown < m.rows.length) {
      text(ctx, `+ ${plural(m.rows.length - shown, 'more exercise')}`, PAD, y + 34, font(700, 32), C.muted);
      y += 70;
    }
    return y;
  }

  function footer(ctx, h) {
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, h - FOOTER_H, W - 2 * PAD, 2);
    text(ctx, 'Logged with', PAD, h - 50, font(600, 30), C.muted);
    ctx.font = font(600, 30);
    const off = ctx.measureText('Logged with ').width;
    text(ctx, 'GymBoy', PAD + off, h - 50, font(900, 30), C.accent);
  }

  // -> Promise<Blob> (PNG)
  function render(m) {
    return new Promise((resolve, reject) => {
      try {
        const big = document.createElement('canvas');
        big.width = W;
        big.height = MAX_H;
        const ctx = big.getContext('2d');
        const endY = paint(ctx, m);
        const h = Math.min(MAX_H, Math.max(MIN_H, Math.ceil(endY + FOOTER_H)));
        footer(ctx, h);
        const out = document.createElement('canvas');
        out.width = W;
        out.height = h;
        out.getContext('2d').drawImage(big, 0, 0, W, h, 0, 0, W, h);
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be made.'))), 'image/png');
      } catch (e) {
        reject(e);
      }
    });
  }

  /* =====================================================================
   * The preview sheet
   * ===================================================================== */
  async function open(session) {
    const { h, icon, openSheet, toast } = GB.ui;
    const m = model(session);
    let blob;
    try {
      blob = await render(m);
    } catch (e) {
      toast('Could not make the picture on this device');
      return;
    }
    const name = fileName(session);
    const file = new File([blob], name, { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const nav = root.navigator || {};
    const canShare = !!(nav.share && nav.canShare && nav.canShare({ files: [file] }));
    const canCopy = !!(nav.clipboard && nav.clipboard.write && root.ClipboardItem);

    function save() {
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Picture saved');
    }

    async function shareNow() {
      try {
        await nav.share({ files: [file], title: `GymBoy: ${m.title}`, text: caption(m) });
      } catch (e) {
        if (e && e.name === 'AbortError') return; // closed the share sheet: nothing to report
        toast('Could not open sharing. Use Save instead.');
      }
    }

    async function copy() {
      try {
        await nav.clipboard.write([new root.ClipboardItem({ 'image/png': blob })]);
        toast('Copied. Paste it into a chat.', 'success');
      } catch (e) {
        toast('Could not copy. Use Save instead.');
      }
    }

    const btn = (cls, ico, label, fn) => h('button', { class: `btn ${cls}`, type: 'button', onclick: fn }, icon(ico, 20), label);
    const footerBtns = canShare
      ? [btn('soft', 'download', 'Save', save), canCopy ? btn('soft', 'copy', 'Copy', copy) : null, btn('primary grow', 'share', 'Share', shareNow)]
      : [canCopy ? btn('soft', 'copy', 'Copy', copy) : null, btn('primary grow', 'download', 'Save picture', save)];

    openSheet({
      title: 'Share workout',
      tall: true,
      body: [
        h('img', { class: 'share-preview', src: url, alt: `Picture of your ${m.title} workout: ${caption(m)}` }),
        h('p', { class: 'muted share-note' }, canShare ? 'Tap Share to send it on WhatsApp, Telegram, Messages and more. The picture shows only your workout.' : 'Save the picture, or copy it and paste it into a chat. It shows only your workout.'),
      ],
      footer: footerBtns,
      onClose: () => URL.revokeObjectURL(url),
    });
  }

  GB.share = { model, fileName, caption, collapse, render, open };
})(typeof window !== 'undefined' ? window : globalThis);
