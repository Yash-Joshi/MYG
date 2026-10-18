/* GymBoy – "How to" for every exercise: written steps, a demo link, and your own note and link.
 *
 * The data lives in js/howto-strength.js and js/howto-move.js (GB.howtoData). This file is the
 * lookup, the link helpers (pure, tested in Node) and the bottom sheet that shows it.
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  const key = (name) => String(name || '').trim().toLowerCase();
  let index = null;

  function lookup() {
    if (!index) {
      index = new Map();
      Object.keys(GB.howtoData || {}).forEach((n) => index.set(key(n), { name: n, info: GB.howtoData[n] }));
    }
    return index;
  }

  /** The written instructions for an exercise, or null when we have none. */
  function get(name) {
    const hit = lookup().get(key(name));
    return hit ? hit.info : null;
  }

  const names = () => Array.from(lookup().values()).map((h) => h.name);

  // what kind of movement this is, from the entry or (for unknown exercises) the muscle group
  function kindOf(name, muscle) {
    const info = get(name);
    if (info && info.kind) return info.kind;
    if (muscle === 'mobility') return 'mobility';
    if (muscle === 'hiit') return 'conditioning';
    if (muscle === 'core') return 'core';
    return 'lift';
  }

  const SEARCH_SUFFIX = {
    lift: 'proper form',
    core: 'proper form',
    conditioning: 'how to',
    mobility: 'mobility how to',
    ground: 'animal flow tutorial',
    yoga: 'yoga tutorial',
  };

  /** A YouTube search for the exercise. It can never go stale, because it is a search, not a video. */
  function searchUrl(name, kind) {
    const q = `${String(name).trim()} ${SEARCH_SUFFIX[kind] || SEARCH_SUFFIX.lift}`;
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  }

  /** Accepts only web links people typed in themselves; returns a clean https/http URL or null. */
  function safeLink(raw) {
    let s = String(raw || '').trim();
    if (!s || s.length > 400) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  const KIND_LABEL = { lift: 'Strength', core: 'Core', conditioning: 'Conditioning', mobility: 'Mobility', ground: 'Ground flow', yoga: 'Yoga-style' };

  /**
   * Opens the sheet. opts.extras = { get(name) -> {note, link} | null, save(name, patch) } adds the
   * "Your note and link" section (the app passes its own storage in).
   */
  function open(name, muscle, opts) {
    opts = opts || {};
    const { h, icon, openSheet, toast } = GB.ui;
    const info = get(name);
    const kind = kindOf(name, muscle);
    const demoUrl = searchUrl(name, kind);

    const chips = [h('span', { class: 'tag' }, KIND_LABEL[kind] || 'Exercise')];
    if (info && info.dose) chips.push(h('span', { class: 'tag dose' }, info.dose));

    const body = [h('div', { class: 'ht-tags' }, chips)];

    if (info) {
      body.push(
        h('h3', { class: 'section-title' }, 'How to do it'),
        h('ol', { class: 'ht-steps' }, info.steps.map((s) => h('li', null, s))),
        info.cues.length ? [h('h3', { class: 'section-title' }, 'Key cues'), h('ul', { class: 'ht-list good' }, info.cues.map((c) => h('li', null, c)))] : null,
        info.avoid.length ? [h('h3', { class: 'section-title' }, 'Common mistakes'), h('ul', { class: 'ht-list bad' }, info.avoid.map((c) => h('li', null, c)))] : null,
        info.easier || info.harder
          ? h('div', { class: 'ht-levels' }, info.easier ? h('div', null, h('small', null, 'Easier'), h('p', null, info.easier)) : null, info.harder ? h('div', null, h('small', null, 'Harder'), h('p', null, info.harder)) : null)
          : null
      );
    } else {
      body.push(h('p', { class: 'ht-none' }, 'We do not have written steps for this one yet. Tap "Watch a demo" to see how it is done, and add your own note below.'));
    }

    // your own note and link (saved on this device)
    if (opts.extras) {
      const saved = opts.extras.get(name) || {};
      const linkOut = h('div', { class: 'ht-mylink' });
      const showLink = (url) => {
        linkOut.replaceChildren(...(url ? [h('a', { class: 'btn soft', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('link', 18), 'Open your link')] : []));
      };
      showLink(saved.link ? safeLink(saved.link) : null);
      const note = h('textarea', {
        class: 'note',
        rows: 3,
        maxLength: 400,
        placeholder: 'Your cues, a reminder, or what worked for you…',
        'aria-label': `Your note for ${name}`,
        value: saved.note || '',
        onchange: (e) => opts.extras.save(name, { note: e.target.value.trim() }),
      });
      const link = h('input', {
        class: 'field',
        type: 'url',
        inputmode: 'url',
        autocomplete: 'off',
        autocapitalize: 'none',
        placeholder: 'Paste a video link (optional)',
        'aria-label': `Your video link for ${name}`,
        value: saved.link || '',
        onchange: (e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            opts.extras.save(name, { link: '' });
            return showLink(null);
          }
          const url = safeLink(raw);
          if (!url) return toast('That does not look like a web link', 'error');
          e.target.value = url;
          opts.extras.save(name, { link: url });
          showLink(url);
        },
      });
      body.push(h('h3', { class: 'section-title' }, 'Your note and link'), note, h('div', { class: 'ht-linkrow' }, link), linkOut);
    }

    body.push(h('p', { class: 'ht-safety' }, 'General guidance, not medical advice. Move within a comfortable range and stop if you feel sharp pain. Ask a coach if you are unsure.'));

    return openSheet({
      title: name,
      tall: true,
      body,
      onClose: opts.onClose,
      footer: h('a', { class: 'btn primary big grow', href: demoUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('play', 20), 'Watch a demo'),
    });
  }

  GB.howto = { get, names, kindOf, searchUrl, safeLink, open };
  if (typeof module !== 'undefined' && module.exports) module.exports = GB.howto;
})(typeof window !== 'undefined' ? window : globalThis);
