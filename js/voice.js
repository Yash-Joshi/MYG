/* GymBoy – quick log by voice or typing.
 *
 * Pure parsing (no DOM) so it can be tested in Node, plus a thin wrapper around
 * the browser's speech recognition. Nothing here stores audio: speech is turned
 * into text by the browser, and the text is parsed into a set.
 *
 *   GB.voice.parse("bench press sixty kilos eight reps", { library, sessionExercises, ... })
 *   -> { ok: true, exercise: { name: 'Barbell Bench Press', ... }, weight: 60, weightUnit: 'kg', reps: 8, sets: 1, ... }
 */
(function (root) {
  'use strict';
  const GB = (root.GB = root.GB || {});

  /* =====================================================================
   * Spoken numbers -> digits ("sixty two point five" -> "62.5")
   * ===================================================================== */
  const ONES = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
  const isDigits = (t) => /^\d+(\.\d+)?$/.test(t);
  const isDigitTok = (t) => t != null && (/^\d$/.test(t) || (has(ONES, t) && ONES[t] < 10));
  const digitOf = (t) => (/^\d$/.test(t) ? t : String(ONES[t]));

  function parseNumberAt(toks, i) {
    let j = i;
    let value;

    if (isDigits(toks[j])) {
      value = parseFloat(toks[j]);
      j++;
    } else {
      let cur = 0;
      let last = null; // 'one' | 'teen' | 'ten' | 'hundred' | 'and'
      let any = false;
      if (toks[j] === 'a' && toks[j + 1] === 'hundred') {
        cur = 1;
        last = 'one';
        any = true;
        j++;
      }
      for (; j < toks.length; j++) {
        const w = toks[j];
        if (has(ONES, w)) {
          const v = ONES[w];
          if (v === 0) {
            if (any) break;
            any = true;
            last = 'one';
          } else if (last === null || last === 'hundred' || last === 'and') {
            cur += v;
            last = v >= 10 ? 'teen' : 'one';
            any = true;
          } else if (last === 'ten' && v < 10) {
            cur += v;
            last = 'one';
          } else break;
        } else if (has(TENS, w)) {
          if (last === null || last === 'hundred' || last === 'and') {
            cur += TENS[w];
            last = 'ten';
            any = true;
          } else break;
        } else if (w === 'hundred') {
          if (any && last === 'one') {
            cur *= 100;
            last = 'hundred';
          } else break;
        } else if (w === 'and' && last === 'hundred' && (has(ONES, toks[j + 1]) || has(TENS, toks[j + 1]))) {
          last = 'and';
        } else break;
      }
      if (!any) return null;
      value = cur;
    }

    // decimal tails: "... point five", "... and a half"
    if (toks[j] === 'point' && isDigitTok(toks[j + 1])) {
      let k = j + 1;
      let frac = '';
      while (k < toks.length && isDigitTok(toks[k])) {
        frac += digitOf(toks[k]);
        k++;
      }
      value = parseFloat(`${value}.${frac}`);
      j = k;
    } else if (toks[j] === 'and' && toks[j + 1] === 'a' && toks[j + 2] === 'half') {
      value += 0.5;
      j += 3;
    }
    return { value, next: j };
  }

  function wordsToDigits(input) {
    let s = String(input || '').toLowerCase();
    s = s.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2'); // 62,5 -> 62.5
    s = s.replace(/[-–—]/g, ' ');
    s = s.replace(/[^a-z0-9.@ ]/g, ' ');
    s = s.replace(/\.(?!\d)/g, ' '); // sentence dots
    const toks = s.split(/\s+/).filter(Boolean);
    const out = [];
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      const startsNumber = isDigits(t) || has(ONES, t) || has(TENS, t) || (t === 'a' && toks[i + 1] === 'hundred');
      const r = startsNumber ? parseNumberAt(toks, i) : null;
      if (r) {
        out.push(String(r.value));
        i = r.next;
      } else {
        out.push(t);
        i++;
      }
    }
    return out.join(' ');
  }

  /* =====================================================================
   * Exercise matching
   * ===================================================================== */
  const SYNONYMS = {
    db: 'dumbbell', dbs: 'dumbbell', dumbell: 'dumbbell', dumbbells: 'dumbbell',
    bb: 'barbell', barbells: 'barbell',
    kb: 'kettlebell', kettlebells: 'kettlebell',
    ohp: 'overhead press',
    rdl: 'romanian deadlift', rdls: 'romanian deadlift',
    dl: 'deadlift',
    military: 'overhead',
    pullup: 'pull up', pullups: 'pull up',
    chinup: 'chin up', chinups: 'chin up',
    pushup: 'push up', pushups: 'push up',
    situp: 'sit up', situps: 'sit up',
    skullcrusher: 'skull crusher', skullcrushers: 'skull crusher',
    tricep: 'triceps', bicep: 'biceps',
    legpress: 'leg press',
    burpee: 'burpee',
  };

  const STOPWORDS = new Set(
    ('a an the i ive im did do done just finished finish completed complete log logged add record set sets next another ' +
      'of on with at for and to by x times time rep reps repetition repetitions weight weights plus then uh um so it my ' +
      'that was were is got hit nailed performed please now kilos kilo kilograms kilogram kgs kg pounds pound lbs lb ' +
      'seconds second secs sec minutes minute mins min more again same bodyweight body no using use').split(' ')
  );

  // lower-case word tokens with synonyms expanded and simple plurals removed
  function tokens(str) {
    const base = String(str || '')
      .toLowerCase()
      .replace(/[-–—]/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const out = [];
    base.forEach((w) => {
      const exp = has(SYNONYMS, w) ? SYNONYMS[w].split(' ') : [w];
      exp.forEach((x) => out.push(stem(x)));
    });
    return out;
  }

  function stem(w) {
    return w.length >= 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') ? w.slice(0, -1) : w;
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function tokMatch(a, b) {
    if (a === b) return 1;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length >= 4 && longer.length >= 4 && lev(a, b) <= (longer.length >= 8 ? 2 : 1)) return 0.85;
    if (shorter.length >= 3 && longer.startsWith(shorter)) return 0.8;
    return 0;
  }

  // 0..1 similarity between what was said and an exercise name
  function scoreName(qTokens, name) {
    const nTokens = tokens(name);
    if (!qTokens.length || !nTokens.length) return { score: 0, coverage: 0 };
    let qSum = 0;
    qTokens.forEach((q) => {
      qSum += Math.max(...nTokens.map((n) => tokMatch(q, n)));
    });
    let nSum = 0;
    nTokens.forEach((n) => {
      nSum += Math.max(...qTokens.map((q) => tokMatch(q, n)));
    });
    const coverage = qSum / qTokens.length;
    let score = 0.7 * coverage + 0.12 * (nSum / nTokens.length);

    // "pull down" vs "pulldown", "pullups" vs "pull-ups"
    const qj = qTokens.join('');
    const nj = nTokens.join('');
    const sim = 1 - lev(qj, nj) / Math.max(qj.length, nj.length);
    if (sim >= 0.85) score = Math.max(score, 0.95 * sim + 0.05);
    return { score, coverage };
  }

  const MUSCLE_HINTS = [
    [/burpee|sprint|jump|swing|rope|climber|slam|knees|jack|thruster|snatch|shadow|sled|bike|rowing|treadmill|ski ?erg/, 'hiit'],
    [/stretch|mobility|\bcars\b|hip switch|cat.?cow|thread the needle|pigeon|child'?s pose|cobra|downward dog|upward dog|crawl|crab|beast hold|scorpion|lizard|yoga|\bpose\b|\bflow\b/, 'mobility'],
    [/curl/, 'biceps'],
    [/pushdown|push down|skull|extension|kickback|dip/, 'triceps'],
    [/squat|lunge|leg press|leg extension|step up/, 'quads'],
    [/hamstring|leg curl|good morning|romanian|stiff/, 'hamstrings'],
    [/hip thrust|glute|bridge/, 'glutes'],
    [/calf/, 'calves'],
    [/row|pull|lat |chin|deadlift|shrug/, 'back'],
    [/lateral|raise|shoulder|overhead|press up/, 'shoulders'],
    [/crunch|plank|ab wheel|sit up|twist/, 'core'],
    [/bench|fly|chest|pec|push up/, 'chest'],
  ];

  function guessMuscle(name, fallback) {
    const s = String(name).toLowerCase();
    for (const [re, m] of MUSCLE_HINTS) if (re.test(s)) return m;
    return fallback || 'chest';
  }

  function tidyName(raw) {
    let s = String(raw).replace(/\s+/g, ' ').trim();
    if (s && s === s.toLowerCase()) s = s.replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase());
    return s.slice(0, 60);
  }

  /* =====================================================================
   * Parse a phrase into a set
   * ===================================================================== */
  const WEIGHT_UNIT = '(kilograms?|kilos?|kgs?|kg|pounds?|lbs?|lb)';
  const unitOf = (u) => (/^(kilo|kg)/.test(u) ? 'kg' : 'lb');

  function parse(raw, opts) {
    opts = opts || {};
    const res = {
      raw: String(raw || ''),
      ok: false,
      exercise: null, // { name, muscle, source, score, exact, isNew }
      alternatives: [], // other possible exercises
      weight: null,
      weightUnit: null,
      reps: null,
      sets: 1,
      seconds: null,
      sameWeight: false,
      bodyweight: false,
      issues: [],
      confidence: 0,
    };

    let text = ` ${wordsToDigits(raw)} `;
    const take = (re, fn) => {
      const m = text.match(re);
      if (!m) return false;
      fn(m);
      text = text.replace(re, ' ');
      return true;
    };

    // keywords
    take(/\b(?:same weight|same|again)\b/, () => (res.sameWeight = true));
    take(/\b(?:body ?weight|no weight)\b/, () => (res.bodyweight = true));

    // 60 kilos / 135 lbs
    take(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${WEIGHT_UNIT}\\b`), (m) => {
      res.weight = parseFloat(m[1]);
      res.weightUnit = unitOf(m[2]);
    });

    // 40 seconds / 2 minutes
    take(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec)\b/, (m) => (res.seconds = parseFloat(m[1])));
    if (res.seconds == null) take(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/, (m) => (res.seconds = parseFloat(m[1]) * 60));
    if (res.seconds == null) take(/\b(\d+)\s*s\b/, (m) => (res.seconds = parseFloat(m[1])));

    // 3 sets of 8
    take(/(\d+)\s*sets?\s*(?:of|x|by|times)\s*(\d+)\b/, (m) => {
      res.sets = parseInt(m[1], 10);
      res.reps = parseInt(m[2], 10);
    });
    if (res.reps == null) {
      take(/(\d+)\s*(?:reps?|repetitions?)\b/, (m) => (res.reps = parseInt(m[1], 10)));
    }
    if (res.reps == null) take(/\breps?\s*(?:of)?\s*(\d+)\b/, (m) => (res.reps = parseInt(m[1], 10)));
    if (res.sets === 1) take(/(\d+)\s*sets?\b/, (m) => (res.sets = parseInt(m[1], 10)));

    // at 60 / with 60 / @ 60
    if (res.weight == null) {
      take(/(?:\bat\b|\bwith\b|\busing\b|@)\s*(\d+(?:\.\d+)?)/, (m) => (res.weight = parseFloat(m[1])));
    }
    // x 8 / for 8 / times 8
    if (res.reps == null) take(/\b(?:x|times|by|for)\s*(\d+)\b/, (m) => (res.reps = parseInt(m[1], 10)));

    // bare numbers: weight then reps
    const bare = [];
    text = text.replace(/\d+(?:\.\d+)?/g, (n) => {
      bare.push(parseFloat(n));
      return ' ';
    });
    if (bare.length) {
      if (res.weight == null && res.reps == null) {
        if (bare.length >= 2) {
          res.weight = bare[0];
          res.reps = Math.round(bare[1]);
        } else if (res.seconds == null) {
          res.reps = Math.round(bare[0]);
          res.issues.push('assumed-reps');
        } else {
          res.weight = bare[0];
        }
      } else if (res.weight == null) {
        res.weight = bare[0];
      } else if (res.reps == null) {
        res.reps = Math.round(bare[0]);
      }
    }
    if (res.bodyweight && res.weight == null) res.weight = 0;

    res.sets = Math.max(1, Math.min(res.sets || 1, 20));

    // what's left is the exercise
    const phrase = text
      .split(/\s+/)
      .filter((w) => w && !STOPWORDS.has(w))
      .join(' ');

    resolveExercise(res, phrase, opts);

    const hasAmount = (res.reps != null && res.reps > 0) || (res.seconds != null && res.seconds > 0);
    if (!res.exercise) res.issues.push('no-exercise');
    if (!hasAmount) res.issues.push('no-reps');
    res.ok = !!res.exercise && hasAmount;
    res.confidence = res.exercise ? Math.round((0.6 * res.exercise.score + (hasAmount ? 0.25 : 0) + (res.weight != null || res.sameWeight ? 0.15 : 0.05)) * 100) / 100 : 0;
    return res;
  }

  function resolveExercise(res, phrase, opts) {
    const session = opts.sessionExercises || [];
    const library = opts.library || [];
    const current = opts.current || null;

    if (!phrase) {
      if (current) res.exercise = { name: current.name, muscle: current.muscle, source: 'current', score: 1, exact: true, isNew: false };
      return;
    }

    const q = tokens(phrase);
    const seen = new Set();
    const cands = [];
    const push = (e, source, order, bonus) => {
      const k = String(e.name).trim().toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      const s = scoreName(q, e.name);
      cands.push({ name: e.name, muscle: e.muscle, source, order, score: Math.min(1, s.score + bonus), coverage: s.coverage });
    };
    session.forEach((e, i) => push(e, 'session', i, 0.08));
    if (current) push(current, 'session', -1, 0.1);
    library.forEach((e, i) => push(e, 'library', 1000 + i, 0));
    // Near-equal scores are ties, resolved by order: this workout's exercises first,
    // then the library's own order (so "bench" means Barbell Bench Press).
    const bucket = (c) => Math.round(c.score * 20);
    cands.sort((a, b) => bucket(b) - bucket(a) || a.order - b.order);

    const best = cands[0];
    if (best && best.score >= 0.55 && best.coverage >= 0.6) {
      const exact = best.coverage >= 0.99; // every word you said matched
      res.exercise = { name: best.name, muscle: best.muscle, source: best.source, score: exact ? 1 : Math.round(0.7 * best.coverage * 100) / 100, exact, isNew: false };
      res.alternatives = cands.filter((c) => c !== best && c.score >= 0.4).slice(0, 3).map((c) => ({ name: c.name, muscle: c.muscle, isNew: false }));
      if (!res.exercise.exact && phrase.length >= 3) {
        res.alternatives.push({ name: tidyName(phrase), muscle: guessMuscle(phrase, opts.defaultMuscle), isNew: true });
      }
      return;
    }

    if (phrase.replace(/\s/g, '').length >= 3) {
      const name = tidyName(phrase);
      res.exercise = { name, muscle: guessMuscle(phrase, opts.defaultMuscle), source: 'new', score: 0.6, exact: true, isNew: true };
      res.alternatives = cands.filter((c) => c.score >= 0.4).slice(0, 3).map((c) => ({ name: c.name, muscle: c.muscle, isNew: false }));
    }
  }

  /* =====================================================================
   * Browser speech recognition (optional)
   * ===================================================================== */
  function speechCtor() {
    return root.SpeechRecognition || root.webkitSpeechRecognition || null;
  }

  // The mic needs a secure context (HTTPS or localhost) and a browser with speech recognition.
  function speechSupported() {
    return !!speechCtor() && root.isSecureContext !== false;
  }

  /**
   * listen({ lang, onInterim(text), onFinal(text), onError(code), onEnd() }) -> { stop(), abort() }
   * Error codes follow the Web Speech API: 'not-allowed', 'service-not-allowed', 'no-speech',
   * 'audio-capture', 'network', 'unsupported'.
   */
  function listen(o) {
    const SR = speechCtor();
    if (!SR) {
      o.onError && o.onError('unsupported');
      o.onEnd && o.onEnd();
      return { stop() {}, abort() {} };
    }
    let rec;
    try {
      rec = new SR();
    } catch (e) {
      o.onError && o.onError('unsupported');
      o.onEnd && o.onEnd();
      return { stop() {}, abort() {} };
    }
    rec.lang = o.lang || (root.navigator && root.navigator.language) || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && o.onInterim) o.onInterim(interim.trim());
      if (final && o.onFinal) o.onFinal(final.trim());
    };
    rec.onerror = (e) => o.onError && o.onError(e.error || 'error');
    rec.onend = () => o.onEnd && o.onEnd();
    try {
      rec.start();
    } catch (e) {
      o.onError && o.onError('error');
      o.onEnd && o.onEnd();
    }
    return {
      stop() { try { rec.stop(); } catch (e) { /* ignore */ } },
      abort() { try { rec.abort(); } catch (e) { /* ignore */ } },
    };
  }

  GB.voice = { parse, wordsToDigits, tokens, guessMuscle, speechSupported, listen };
  if (typeof module !== 'undefined' && module.exports) module.exports = GB.voice;
})(typeof window !== 'undefined' ? window : globalThis);
