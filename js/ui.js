/* GymBoy – tiny UI toolkit: DOM builder, bottom sheets, toasts, icons */
(function (GB) {
  'use strict';

  /* ---------- DOM builder (text is always inserted as text nodes) ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  }

  function append(el, kids) {
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) append(el, kid);
      else if (kid instanceof Node) el.appendChild(kid);
      else el.appendChild(document.createTextNode(String(kid)));
    }
  }

  // Like el.replaceChildren(...kids), but skips null / false / undefined (the native method would print "null").
  function mount(el, ...kids) {
    el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
    return el;
  }

  /* ---------- SVG builder (for charts; attributes are set, never parsed as markup) ---------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ---------- icons (static, trusted markup) ---------- */
  const ICON_PATHS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>',
    history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    note: '<path d="M5 4h14v12l-5 5H5z"/><path d="M14 21v-5h5M8 9h8M8 13h4"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    share: '<path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    skip: '<path d="M5 5l9 7-9 7zM19 5v14"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a4 4 0 018 0M12 9l1.8-2"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    warn: '<path d="M12 4l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    logout: '<path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M15 8l4 4-4 4M19 12H9"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>',
    flow: '<path d="M3 9c3-5 6-5 9 0s6 5 9 0M3 15c3-5 6-5 9 0s6 5 9 0"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  };

  function icon(name, size) {
    const s = size || 22;
    const span = document.createElement('span');
    span.className = 'ico';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML =
      `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`;
    return span;
  }

  /* ---------- bottom sheets ---------- */
  const stack = [];

  function openSheet(opts) {
    const overlay = document.getElementById('overlay');
    const previousFocus = document.activeElement;
    let closed = false;

    const body = h('div', { class: 'sheet-body' }, opts.body);
    const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => ctl.locked || close() }, icon('close'));
    const head = h('div', { class: 'sheet-head' }, h('h2', null, opts.title || ''), opts.hideClose ? null : closeBtn);
    const foot = opts.footer ? h('div', { class: 'sheet-foot' }, opts.footer) : null;
    const sheet = h(
      'div',
      { class: 'sheet' + (opts.tall ? ' tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog', tabIndex: -1 },
      h('div', { class: 'grabber' }),
      head,
      body,
      foot
    );
    const scrim = h('div', { class: 'scrim', onclick: () => ctl.locked || close() });
    const wrap = h('div', { class: 'sheet-wrap' }, scrim, sheet);

    // A locked sheet ignores scrim taps, the X and Escape (used while a timer is running).
    const ctl = {
      el: sheet,
      body,
      close,
      locked: false,
      setLocked(v) {
        ctl.locked = !!v;
        closeBtn.hidden = !!v;
      },
    };
    stack.push(ctl);
    overlay.appendChild(wrap);
    document.documentElement.classList.add('modal-open');
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      if (!opts.noFocus) sheet.focus({ preventScroll: true });
    });

    function close(result) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(ctl);
      if (i !== -1) stack.splice(i, 1);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 220);
      if (!stack.length) document.documentElement.classList.remove('modal-open');
      if (previousFocus && previousFocus.focus && document.body.contains(previousFocus)) {
        try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
      if (opts.onClose) opts.onClose(result);
    }

    return ctl;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length && !stack[stack.length - 1].locked) stack[stack.length - 1].close();
  });

  function closeAllSheets() {
    stack.slice().forEach((s) => s.close());
  }

  // Promise-based confirm dialog.
  function confirmSheet(o) {
    return new Promise((resolve) => {
      let answer = false;
      const sheet = openSheet({
        title: o.title,
        hideClose: true,
        body: o.message ? h('p', { class: 'muted pad-b' }, o.message) : null,
        footer: [
          h('button', { class: 'btn ghost', type: 'button', onclick: () => sheet.close() }, o.cancelText || 'Cancel'),
          h(
            'button',
            {
              class: 'btn ' + (o.danger ? 'danger' : 'primary'),
              type: 'button',
              onclick: () => {
                answer = true;
                sheet.close();
              },
            },
            o.confirmText || 'Confirm'
          ),
        ],
        onClose: () => resolve(answer),
      });
    });
  }

  /* ---------- toasts ---------- */
  function toast(message, kind) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: 'status' }, message);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, 2200);
  }

  GB.ui = { h, svg, mount, icon, openSheet, closeAllSheets, confirmSheet, toast };
})((window.GB = window.GB || {}));
