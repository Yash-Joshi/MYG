/* GymBoy – the Scan tab: camera / library, image preparation, analysis, and past reports. */
(function (GB) {
  'use strict';
  const { h, mount, icon, confirmSheet, toast } = GB.ui;
  const U = GB.util;
  const screens = (GB.screens = GB.screens || {});

  const MAX_IMAGES = 4;
  // Vercel rejects request bodies over ~4.5 MB, and base64 is ~1.33x the bytes, so keep the text under this.
  const BUDGET_CHARS = 3.9 * 1024 * 1024;
  // Largest edge and JPEG quality to try, from best to smallest, until everything fits.
  const LADDER = [[2200, 0.82], [2000, 0.76], [1800, 0.7], [1600, 0.64], [1400, 0.58], [1200, 0.52]];
  const MIN_ANALYZING_MS = 900;
  const STAGES = ['Reading your scan…', 'Checking the numbers…', 'Comparing with healthy ranges…', 'Writing your report…'];

  /* ---------- image preparation (done on the phone) ---------- */
  async function toBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        /* fall through to the <img> route */
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('cannot open image'));
      };
      img.src = url;
    });
  }

  const sizeOf = (bm) => ({ w: bm.width || bm.naturalWidth, h: bm.height || bm.naturalHeight });

  // Re-drawing onto a canvas drops all metadata (EXIF, GPS) from the photo.
  function encode(bm, maxEdge, quality) {
    const { w, h: hh } = sizeOf(bm);
    const scale = Math.min(1, maxEdge / Math.max(w, hh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(hh * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bm, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', quality);
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  }

  function encodeAll(items) {
    let last = null;
    for (const [edge, q] of LADDER) {
      const images = items.map((it) => ({ media_type: 'image/jpeg', data: encode(it.bitmap, edge, q) }));
      last = images;
      if (images.reduce((n, i) => n + i.data.length, 0) <= BUDGET_CHARS) return images;
    }
    return last; // still large: the server will say so and the user can remove a photo
  }

  function thumbnail(bm) {
    const { w, h: hh } = sizeOf(bm);
    const scale = Math.min(1, 280 / Math.max(w, hh));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(hh * scale);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* =====================================================================
   * Scan screen
   * ===================================================================== */
  screens.scan = function () {
    const app = GB.app;
    const b = GB.backend;
    const profile = b.profile();
    const needConsent = !(profile.consent && profile.consent.scan_ai);

    let picked = []; // { id, bitmap, preview, name }
    let phase = 'pick'; // 'pick' | 'analyzing'
    let outcome = null; // { kind: 'retake' | 'error', title, message }
    let consentChecked = false;
    let ctl = null;
    let stageTimer = null;
    let nextId = 1;

    const page = h('div', { class: 'page scan-page' });

    const onFiles = async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = ''; // allow choosing the same file again
      outcome = null;
      for (const file of files) {
        if (picked.length >= MAX_IMAGES) {
          toast(`You can add up to ${MAX_IMAGES} images`);
          break;
        }
        try {
          const bitmap = await toBitmap(file);
          picked.push({ id: nextId++, bitmap, preview: thumbnail(bitmap), name: file.name });
        } catch (err) {
          toast('That file could not be opened. Try a JPEG or PNG photo.', 'error');
        }
      }
      draw();
    };
    const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, id: 'scan-camera', onchange: onFiles });
    const lib = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'scan-library', onchange: onFiles });

    function removeAt(id) {
      const it = picked.find((p) => p.id === id);
      if (it && it.bitmap.close) it.bitmap.close();
      picked = picked.filter((p) => p.id !== id);
      draw();
    }

    async function analyze() {
      if (!picked.length) return;
      if (needConsent && !consentChecked) {
        outcome = { kind: 'error', title: 'One thing first', message: 'Please agree to the scan processing to continue.' };
        return draw();
      }
      if (needConsent) {
        profile.consent = { scan_ai: new Date().toISOString(), policy_version: 'draft-1' };
        await b.saveProfile(profile);
      }
      outcome = null;
      phase = 'analyzing';
      ctl = new AbortController();
      drawAnalyzing();
      const started = Date.now();

      const images = encodeAll(picked);
      const res = await b.analyze({ images, profile, signal: ctl.signal });
      const rest = MIN_ANALYZING_MS - (Date.now() - started);
      if (rest > 0) await wait(rest);
      clearInterval(stageTimer);
      if (res.error === 'cancelled') {
        phase = 'pick';
        return draw();
      }
      phase = 'pick';
      if (!res.ok) {
        outcome = { kind: 'error', title: 'Could not create your report', message: res.message };
        return draw();
      }
      const report = res.report;
      if (report.status === 'needs_better_image' || report.status === 'not_a_scan') {
        outcome = {
          kind: 'retake',
          title: report.status === 'not_a_scan' ? 'That does not look like an InBody result' : 'We could not read that clearly',
          message: report.user_message || 'Please retake the photo with the whole sheet in frame, in bright light.',
        };
        return draw();
      }
      if (res.meta && res.meta.mock) report._sample = true;
      const saved = await b.saveScan(report);
      if (!saved.ok) {
        outcome = { kind: 'error', title: 'Could not save your report', message: saved.error || 'Please try again.' };
        return draw();
      }
      picked.forEach((p) => p.bitmap.close && p.bitmap.close());
      picked = [];
      app.go('report/' + saved.scan.id);
    }

    function drawAnalyzing() {
      let i = 0;
      const text = h('p', { class: 'an-stage', 'aria-live': 'polite' }, STAGES[0]);
      clearInterval(stageTimer);
      stageTimer = setInterval(() => {
        i = Math.min(i + 1, STAGES.length - 1);
        text.textContent = STAGES[i];
      }, 7000);
      mount(page, 
        h(
          'div',
          { class: 'analyzing' },
          h('div', { class: 'an-orb' }, h('i'), h('i'), icon('spark', 34)),
          h('h2', null, 'Creating your report'),
          text,
          h('p', { class: 'muted an-note' }, 'This usually takes 20 to 40 seconds. Keep this screen open.'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => ctl && ctl.abort() }, 'Cancel')
        )
      );
    }

    function pastReports() {
      const scans = b.scans();
      if (!scans.length) return null;
      return h(
        'section',
        { class: 'past' },
        h('h3', { class: 'section-title' }, 'Your reports'),
        h(
          'div',
          { class: 'list' },
          scans.map((s) => {
            const score = s.report.report && s.report.report.score;
            return h(
              'div',
              { class: 'list-row split' },
              h(
                'button',
                { class: 'lr-open', type: 'button', onclick: () => app.go('report/' + s.id) },
                score ? h('span', { class: 'mini-score' }, h('b', null, U.fmtNum(score.value)), h('small', null, 'score')) : h('span', { class: 'mini-score' }, icon('scale', 20)),
                h('span', { class: 'lr-main' }, h('b', null, U.fmtDate(new Date(s.created_at).getTime(), { day: 'numeric', month: 'short', year: 'numeric' }) + (s.report._sample ? ' · sample' : '')), h('small', null, s.report.report.headline))
              ),
              h(
                'button',
                {
                  class: 'icon-btn',
                  type: 'button',
                  'aria-label': 'Delete report',
                  onclick: async () => {
                    if (!(await confirmSheet({ title: 'Delete this report?', message: 'It will be removed for good.', confirmText: 'Delete', danger: true }))) return;
                    await b.deleteScan(s.id);
                    draw();
                    toast('Report deleted');
                  },
                },
                icon('trash', 18)
              )
            );
          })
        )
      );
    }

    function draw() {
      const mode = b.aiMode;
      mount(page, 
        app.pageHeader('Scan your InBody', { right: app.settingsButton() }),
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'r-title' }, 'Add your result'),
          h('p', { class: 'muted pad-b' }, 'A photo of the printed sheet, or screenshots from the InBody app. Add 1 to 4 images.'),
          h('ul', { class: 'tips' }, h('li', null, 'Lay the sheet flat in bright light'), h('li', null, 'Fit the whole page in frame, with no glare'), h('li', null, 'Has two pages? Add both')),
          h('div', { class: 'row gap' }, h('button', { class: 'btn primary grow', type: 'button', onclick: () => cam.click() }, icon('camera', 20), 'Camera'), h('button', { class: 'btn soft grow', type: 'button', onclick: () => lib.click() }, icon('image', 20), 'Library')),
          picked.length
            ? h(
                'div',
                { class: 'thumbs' },
                picked.map((p, i) =>
                  h('figure', { class: 'thumb' }, h('img', { src: p.preview, alt: `Scan image ${i + 1}` }), h('button', { class: 'thumb-x', type: 'button', 'aria-label': `Remove image ${i + 1}`, onclick: () => removeAt(p.id) }, icon('close', 16)))
                )
              )
            : null
        ),
        outcome ? h('div', { class: 'card outcome ' + outcome.kind }, icon(outcome.kind === 'retake' ? 'camera' : 'warn', 22), h('div', null, h('b', null, outcome.title), h('p', null, outcome.message))) : null,
        needConsent ? h('label', { class: 'check-row consent' }, h('input', { type: 'checkbox', id: 'scan-consent', checked: consentChecked, onchange: (e) => (consentChecked = e.target.checked) }), h('span', null, 'I agree my scan photos are processed by an AI service to create my report.')) : null,
        h('button', { class: 'btn primary big', type: 'button', disabled: !picked.length, onclick: analyze }, icon('spark', 22), 'Create my report'),
        h('p', { class: 'privacy-line' }, icon('shield', 16), h('span', null, 'Photos are shrunk on your phone and stripped of location data. In this version they are not stored after the report is made.')),
        mode !== 'live' ? h('p', { class: 'demo-note' }, h('b', null, 'Demo mode. '), 'The analysis service is not connected, so you will see a sample report instead of your own numbers.') : null,
        pastReports(),
        cam,
        lib
      );
    }

    draw();
    return page;
  };
})((window.GB = window.GB || {}));
