'use strict';
/* POST /api/analyze-scan
 *
 * Takes 1-4 images of an InBody result plus the user's profile, asks Claude to read it and
 * write the report, then re-checks the answer in code (lib/scan-validate.js) before returning it.
 * The Anthropic key lives only in this function's environment; the browser never sees it.
 *
 * Environment (Vercel project settings, or a local .env file):
 *   ANTHROPIC_API_KEY   required for real analysis
 *   SUPABASE_URL, SUPABASE_ANON_KEY   when set, every request must carry a valid user token
 *   GB_MODEL (default claude-opus-5-5), GB_EFFORT (default high)
 *   GB_FALLBACKS=0      turn off the server-side refusal fallback
 *   GYMBOY_MOCK_AI=1    return the bundled sample report instead of calling the API (demo / local UI work)
 */
const fs = require('fs');
const path = require('path');
const { load } = require('../lib/prompt');
const { validateShape, recompute } = require('../lib/scan-validate');

const MAX_IMAGES = 4;
const MAX_TOTAL_BASE64 = 4.2 * 1024 * 1024; // Vercel rejects request bodies above ~4.5 MB
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* ---------- input cleaning ---------- */
const clampNum = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const oneOf = (v, list) => (list.includes(v) ? v : null);

// Only what the report needs. No name, email or exact birth date ever reaches the model.
function sanitizeProfile(p) {
  p = p || {};
  const goal = p.goal || {};
  const training = p.training || {};
  const life = p.life || {};
  const food = p.food || {};
  const flags = p.flags || {};
  const text = (s, n) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
  return {
    age: clampNum(p.age, 5, 110),
    sex: oneOf(p.sex, ['male', 'female']),
    height_cm: clampNum(p.height_cm, 80, 250),
    weight_kg: clampNum(p.weight_kg, 20, 400),
    goal: {
      primary: oneOf(goal.primary, ['lose_fat', 'build_muscle', 'recomposition', 'general_health', 'performance']),
      target_weight_kg: clampNum(goal.target_weight_kg, 20, 400),
      weeks: clampNum(goal.weeks, 1, 104),
    },
    training: {
      experience: oneOf(training.experience, ['beginner', 'intermediate', 'advanced']),
      days_per_week: clampNum(training.days_per_week, 0, 7),
      minutes_per_session: clampNum(training.minutes_per_session, 10, 240),
      equipment: oneOf(training.equipment, ['full_gym', 'home_dumbbells', 'bodyweight_only']),
      limitations: Array.isArray(training.limitations) ? training.limitations.slice(0, 8).map((x) => text(x, 40)).filter(Boolean) : [],
      limitations_note: text(training.limitations_note, 200),
    },
    life: {
      job_activity: oneOf(life.job_activity, ['desk', 'on_feet', 'physical']),
      steps_band: oneOf(life.steps_band, ['under_5k', '5k_8k', '8k_12k', 'over_12k']),
      sleep_hours: clampNum(life.sleep_hours, 2, 14),
    },
    food: { diet: oneOf(food.diet, ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other']), avoid: text(food.avoid, 200) },
    flags: {
      under_18: !!flags.under_18,
      pregnant_or_postpartum: !!flags.pregnant_or_postpartum,
      eating_disorder_history: !!flags.eating_disorder_history,
      heart_condition: !!flags.heart_condition,
      pacemaker_or_implant: !!flags.pacemaker_or_implant,
      taking_medication_affecting_weight_or_water: !!flags.taking_medication_affecting_weight_or_water,
    },
  };
}

function sanitizePrevious(prev) {
  if (!prev || !Array.isArray(prev.metrics)) return null;
  const metrics = prev.metrics
    .filter((m) => m && typeof m.key === 'string' && Number.isFinite(Number(m.value)))
    .slice(0, 30)
    .map((m) => ({ key: m.key.slice(0, 40), value: Number(m.value) }));
  return metrics.length ? { measured_at: typeof prev.measured_at === 'string' ? prev.measured_at.slice(0, 40) : null, metrics } : null;
}

function checkImages(images) {
  if (!Array.isArray(images) || images.length < 1) return 'Send at least one image.';
  if (images.length > MAX_IMAGES) return `Send at most ${MAX_IMAGES} images.`;
  let total = 0;
  for (const img of images) {
    if (!img || !MEDIA_TYPES.has(img.media_type) || typeof img.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(img.data)) {
      return 'Images must be JPEG, PNG or WebP, sent as base64.';
    }
    total += img.data.length;
  }
  if (total > MAX_TOTAL_BASE64) return 'The images are too large. Use smaller photos.';
  return null;
}

/* ---------- auth ---------- */
// Verifies the user's access token with Supabase's auth server over plain HTTP. (The supabase-js
// client is built for browsers: it refuses to start on Node 20 without a WebSocket, so it is not
// used here.)
async function authenticate(req, env, fetchImpl) {
  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // No auth provider configured: fine on a developer machine, never on a live site.
    if (env.VERCEL_ENV === 'production' && env.GYMBOY_ALLOW_ANON !== '1') return { ok: false, status: 503, error: 'auth_not_configured' };
    return { ok: true, user: null };
  }
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'unauthorized' };
  try {
    const res = await (fetchImpl || fetch)(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: 'unauthorized' };
    if (!res.ok) return { ok: false, status: 503, error: 'auth_unavailable' };
    const user = await res.json();
    if (!user || !user.id) return { ok: false, status: 401, error: 'unauthorized' };
    return { ok: true, user: { id: user.id, email: user.email } };
  } catch (e) {
    return { ok: false, status: 503, error: 'auth_unavailable' };
  }
}

/* ---------- the handler ---------- */
function createHandler(deps) {
  deps = deps || {};
  const env = deps.env || process.env;

  const getClient =
    deps.getClient ||
    (() => {
      const Anthropic = require('@anthropic-ai/sdk');
      return new Anthropic({ maxRetries: 1, timeout: 55000 });
    });

  const send = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'method_not_allowed' });
    }

    const auth = await (deps.authenticate || authenticate)(req, env);
    if (!auth.ok) return send(res, auth.status, { error: auth.error });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const problem = checkImages(body.images);
    if (problem) return send(res, 400, { error: 'bad_request', message: problem });

    const profile = sanitizeProfile(body.profile);
    const previous = sanitizePrevious(body.previous_scan);

    // No key: serve the bundled sample only when explicitly asked to (local UI work / demos).
    if (!env.ANTHROPIC_API_KEY && !deps.getClient) {
      if (env.GYMBOY_MOCK_AI === '1') {
        const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ai', 'example-output.json'), 'utf8'));
        return send(res, 200, { report: sample, meta: { mock: true } });
      }
      return send(res, 503, { error: 'ai_not_configured', message: 'The analysis service is not set up yet.' });
    }

    const { system, schema } = load();
    const userText =
      'Scan inputs (JSON):\n' +
      JSON.stringify({
        images: body.images.length,
        app_language: typeof body.app_language === 'string' ? body.app_language.slice(0, 12) : 'en',
        units_preference: body.units_preference === 'imperial' ? 'imperial' : 'metric',
        profile,
        previous_scan: previous,
      });

    const params = {
      model: env.GB_MODEL || 'claude-opus-5-5',
      max_tokens: 16000,
      system,
      messages: [
        {
          role: 'user',
          content: [
            ...body.images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
            { type: 'text', text: userText },
          ],
        },
      ],
      output_config: { effort: env.GB_EFFORT || 'high', format: { type: 'json_schema', schema } },
    };

    let response;
    try {
      const client = getClient();
      const useFallbacks = env.GB_FALLBACKS !== '0';
      try {
        response = useFallbacks
          ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
          : await client.messages.create(params);
      } catch (e) {
        // If the refusal-fallback parameters are rejected, retry the plain request once.
        if (useFallbacks && e && e.status === 400) response = await client.messages.create(params);
        else throw e;
      }
    } catch (e) {
      const status = e && e.status;
      console.error('analyze-scan: model call failed', status || '', e && e.message);
      if (status === 429) return send(res, 429, { error: 'busy', message: 'Lots of people are scanning right now. Try again in a minute.' });
      return send(res, 502, { error: 'model_error', message: 'The analysis did not finish. Please try again.' });
    }

    if (response.stop_reason === 'refusal') {
      return send(res, 422, { error: 'refused', message: 'The analysis service could not process these images. Try a clearer photo of the result sheet.' });
    }
    if (response.stop_reason === 'max_tokens') {
      return send(res, 502, { error: 'incomplete', message: 'The report was cut off. Please try again.' });
    }

    const block = (response.content || []).find((b) => b.type === 'text');
    let report;
    try {
      report = JSON.parse(block.text);
    } catch (e) {
      console.error('analyze-scan: response was not JSON');
      return send(res, 502, { error: 'bad_output', message: 'The report could not be read. Please try again.' });
    }
    const shapeErrors = validateShape(schema, report);
    if (shapeErrors.length) {
      console.error('analyze-scan: schema errors', shapeErrors.slice(0, 5));
      return send(res, 502, { error: 'bad_output', message: 'The report could not be read. Please try again.' });
    }

    const { report: checked, adjustments } = recompute(report, { profile, previous });
    return send(res, 200, {
      report: checked,
      meta: { mock: false, model: response.model, usage: response.usage || null, adjustments },
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.sanitizeProfile = sanitizeProfile;
module.exports.authenticate = authenticate;
module.exports.sanitizePrevious = sanitizePrevious;
