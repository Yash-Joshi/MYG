/* GymBoy – persistence (localStorage) and small pure helpers */
(function (GB) {
  'use strict';

  const KEYS = {
    sessions: 'gymboy.sessions',
    active: 'gymboy.active',
    settings: 'gymboy.settings',
    custom: 'gymboy.custom',
    extras: 'gymboy.extras',
  };

  const DEFAULT_SETTINGS = {
    unit: 'kg',
    restOn: true,
    restSec: 90,
    sound: true,
    keepAwake: true,
    ivWork: 40, // interval timer
    ivRest: 20,
    ivRounds: 8,
    voiceAuto: false, // quick log: add the set without the confirm tap
    flowSpeak: false, // guided flows: read the next move aloud
    pairName: '', // the name a pair partner sees
  };

  let warned = false;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (!warned) {
        warned = true;
        GB.ui && GB.ui.toast('Could not save – browser storage is blocked or full', 'error');
      }
      return false;
    }
  }

  const store = {
    loadSessions: () => read(KEYS.sessions, []),
    saveSessions: (v) => write(KEYS.sessions, v),
    loadActive: () => read(KEYS.active, null),
    saveActive: (v) => {
      if (v == null) {
        try { localStorage.removeItem(KEYS.active); } catch (e) { /* ignore */ }
        return true;
      }
      return write(KEYS.active, v);
    },
    loadSettings: () => Object.assign({}, DEFAULT_SETTINGS, read(KEYS.settings, {})),
    saveSettings: (v) => write(KEYS.settings, v),
    loadCustom: () => read(KEYS.custom, []),
    saveCustom: (v) => write(KEYS.custom, v),
    // your own note and link per exercise: { 'barbell squat': { note, link } }
    loadExtras: () => read(KEYS.extras, {}),
    saveExtras: (v) => write(KEYS.extras, v),
    clearAll() {
      try { Object.values(KEYS).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    },
    persistRequest() {
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ }
    },
  };

  /* ---------- helpers ---------- */

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Keep only digits and one decimal point ("62,5" -> "62.5").
  function cleanNum(str) {
    let s = String(str).replace(',', '.').replace(/[^0-9.]/g, '');
    const i = s.indexOf('.');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    return s.slice(0, 7);
  }

  const toNum = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  function fmtNum(n) {
    if (!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    return rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function fmtDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (x) => String(x).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function fmtMinutes(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return `${Math.max(m, 1)} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  function fmtDate(ts, opts) {
    return new Date(ts).toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function startOfWeek(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return d.getTime();
  }

  // Stats for a session shape (saved sessions have numeric w/r; the active
  // session has string w/r plus a `done` flag – pass `onlyDone` for that).
  // HIIT / conditioning exercises are logged by work time (plus optional weight and reps).
  const TIMED_MUSCLES = ['hiit', 'mobility'];
  const isTimed = (ex) => TIMED_MUSCLES.includes(ex.muscle);
  // Mobility and flow moves have no weight, so their rows show time and reps only.
  const hasWeight = (ex) => ex.muscle !== 'mobility';

  // A set counts once it has reps, or (for timed sets) a work time.
  const hasWork = (s) => toNum(s.r) > 0 || toNum(s.t) > 0;

  function stats(session, onlyDone) {
    let sets = 0;
    let volume = 0;
    let exercises = 0;
    let work = 0; // seconds of timed work
    (session.exercises || []).forEach((ex) => {
      let any = false;
      (ex.sets || []).forEach((s) => {
        if (onlyDone && !s.done) return;
        if (!hasWork(s)) return;
        any = true;
        sets += 1;
        volume += toNum(s.w) * toNum(s.r);
        work += toNum(s.t);
      });
      if (any) exercises += 1;
    });
    return { sets, volume, exercises, work };
  }

  const fmtSec = (n) => (n >= 120 ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}` : `${fmtNum(n)}s`);

  // "60 kg × 8" for lifts; "40s · 16 kg · 12 reps" for timed sets.
  function setLabel(s, timed, unit) {
    if (!timed) return `${fmtNum(s.w)} ${unit} × ${s.r}`;
    const parts = [];
    if (s.t > 0) parts.push(fmtSec(s.t));
    if (s.w > 0) parts.push(`${fmtNum(s.w)} ${unit}`);
    if (s.r > 0) parts.push(`${s.r} reps`);
    return parts.join(' · ') || '–';
  }

  // Shorter form for the "Last time" line: "60×8" / "40s 16×12".
  function setCompact(s, timed, unit) {
    if (!timed) return `${fmtNum(s.w)}×${s.r}`;
    const parts = [];
    if (s.t > 0) parts.push(fmtSec(s.t));
    if (s.w > 0 && s.r > 0) parts.push(`${fmtNum(s.w)}×${s.r}`);
    else if (s.w > 0) parts.push(`${fmtNum(s.w)} ${unit}`);
    else if (s.r > 0) parts.push(`${s.r} reps`);
    return parts.join(' ') || '–';
  }

  const keyOf = (name) => String(name).trim().toLowerCase();

  const LB_PER_KG = 2.20462;

  // Convert a weight between kg and lb (rounded to the nearest plate-friendly step).
  function convertWeight(w, from, to) {
    if (from === to) return w;
    const v = from === 'lb' ? w / LB_PER_KG : w * LB_PER_KG;
    return to === 'kg' ? Math.round(v * 2) / 2 : Math.round(v);
  }

  // Most recent logged performance of an exercise (by name), from saved sessions.
  function lastPerformance(sessions, name) {
    const k = keyOf(name);
    let best = null;
    for (const s of sessions) {
      if (best && s.endedAt <= best.date) continue;
      const ex = s.exercises.find((e) => keyOf(e.name) === k);
      if (ex && ex.sets.length) best = { date: s.endedAt, unit: s.unit, sets: ex.sets };
    }
    return best;
  }

  // Everything ever logged, grouped by exercise (for the Progress tab).
  function exerciseIndex(sessions) {
    const map = new Map();
    const sorted = sessions.slice().sort((a, b) => a.endedAt - b.endedAt);
    for (const s of sorted) {
      for (const ex of s.exercises) {
        if (!ex.sets.length) continue;
        const k = keyOf(ex.name);
        if (!map.has(k)) map.set(k, { name: ex.name, muscle: ex.muscle, timed: isTimed(ex), entries: [] });
        const rec = map.get(k);
        rec.name = ex.name;
        rec.entries.push({ date: s.endedAt, unit: s.unit, sets: ex.sets, sessionId: s.id });
      }
    }
    map.forEach((rec) => {
      // Compare everything in the unit of the most recent entry, in case kg/lb was switched.
      const unit = rec.entries[rec.entries.length - 1].unit || 'kg';
      rec.unit = unit;
      // best set: heaviest, then most reps, then longest time
      const better = (a, b) => a.w > b.w || (a.w === b.w && (a.r > b.r || (a.r === b.r && (a.t || 0) > (b.t || 0))));
      let best = null;
      rec.entries.forEach((e) => {
        e.top = e.sets.reduce((a, s) => (better(s, a) ? s : a), e.sets[0]);
        e.topW = convertWeight(e.top.w, e.unit || 'kg', unit);
        if (!best || e.topW > best.n || (e.topW === best.n && better(e.top, best))) {
          best = { w: e.top.w, r: e.top.r, t: e.top.t || 0, unit: e.unit || 'kg', n: e.topW };
        }
      });
      rec.best = best;
      // trend metric: top weight for lifts; total work time (or total reps) for timed exercises
      if (rec.timed) {
        const sum = (e, key) => e.sets.reduce((acc, s) => acc + (s[key] || 0), 0);
        rec.metric = rec.entries.some((e) => sum(e, 't') > 0) ? 't' : 'r';
        rec.entries.forEach((e) => (e.topN = sum(e, rec.metric)));
      } else {
        rec.metric = 'w';
        rec.entries.forEach((e) => (e.topN = e.topW));
      }
    });
    return Array.from(map.values()).sort((a, b) => b.entries[b.entries.length - 1].date - a.entries[a.entries.length - 1].date);
  }

  const sessionsToCsv = (sessions) => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Date', 'Workout', 'Exercise', 'Set', 'Weight', 'Unit', 'Reps', 'Volume', 'Seconds']];
    sessions
      .slice()
      .sort((a, b) => a.endedAt - b.endedAt)
      .forEach((s) => {
        const date = new Date(s.endedAt).toISOString().slice(0, 10);
        s.exercises.forEach((ex) => {
          ex.sets.forEach((st, i) => rows.push([date, s.dayName, ex.name, i + 1, st.w, s.unit, st.r, st.w * st.r, st.t || '']));
        });
      });
    return rows.map((r) => r.map(esc).join(',')).join('\n');
  };

  GB.store = store;
  GB.util = { uid, cleanNum, toNum, fmtNum, fmtDuration, fmtMinutes, fmtDate, startOfWeek, stats, keyOf, isTimed, hasWeight, hasWork, setLabel, setCompact, convertWeight, lastPerformance, exerciseIndex, sessionsToCsv };
})((window.GB = window.GB || {}));
