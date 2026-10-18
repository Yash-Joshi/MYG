/* Tests for api/analyze-scan.js using the REAL Anthropic SDK pointed at a fake local server,
 * so we can inspect the exact HTTP request the SDK sends and control the "model" replies.
 *   Run: node tests/analyze-scan.test.js
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createHandler } = require('../api/analyze-scan');

const example = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/example-output.json'), 'utf8'));
const TINY_JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64').toString('base64');
const images = (n) => Array.from({ length: n }, () => ({ media_type: 'image/jpeg', data: TINY_JPEG }));
const validProfile = { name: 'Priya Sharma', email: 'priya@example.com', dob: '1994-05-02', age: 32, sex: 'male', height_cm: 178, weight_kg: 82.4, goal: { primary: 'lose_fat' }, flags: {} };

/* ---------- a fake Anthropic API ---------- */
function startFake(reply) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      seen.push({ url: req.url, headers: req.headers, body });
      const r = reply(body, seen.length);
      res.writeHead(r.status || 200, { 'Content-Type': 'application/json', 'request-id': 'req_test' });
      res.end(JSON.stringify(r.json));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: `http://127.0.0.1:${server.address().port}` })));
}
const message = (text, extra) => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
  content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 9000, output_tokens: 3100 }, ...extra,
});

async function run(handlerOpts, reqOverrides) {
  const handler = createHandler(handlerOpts);
  const req = { method: 'POST', headers: {}, body: { images: images(2), profile: validProfile, app_language: 'en', units_preference: 'metric' }, ...reqOverrides };
  let status;
  let bodyText = '';
  const res = { statusCode: 200, setHeader() {}, end(t) { bodyText = t; } };
  await handler(req, res);
  status = res.statusCode;
  return { status, json: bodyText ? JSON.parse(bodyText) : null };
}
const withFake = async (reply, fn) => {
  const fake = await startFake(reply);
  const getClient = () => new Anthropic({ apiKey: 'test-key', baseURL: fake.url, maxRetries: 0 });
  try {
    await fn({ fake, getClient });
  } finally {
    fake.server.close();
  }
};

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push(`✗ ${name}\n    ${e.message}`);
  }
}

(async () => {
  await test('happy path: 200 and a report that passes the checks', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      const out = await run({ getClient, env: {} });
      assert.strictEqual(out.status, 200, JSON.stringify(out.json));
      assert.strictEqual(out.json.report.status, 'ok');
      assert.strictEqual(out.json.meta.mock, false);
      assert.strictEqual(out.json.meta.usage.output_tokens, 3100);
      assert.strictEqual(fake.seen.length, 1);
    }));

  await test('the request the SDK actually sends is what we intend', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      await run({ getClient, env: {} });
      const { body, headers, url } = fake.seen[0];
      assert.ok(url.startsWith('/v1/messages'), url);
      assert.strictEqual(body.model, 'claude-opus-5-5');
      assert.strictEqual(body.max_tokens, 16000);
      assert.strictEqual(body.output_config.effort, 'high');
      assert.strictEqual(body.output_config.format.type, 'json_schema');
      assert.ok(body.output_config.format.schema.properties.report, 'schema attached');
      assert.ok(!('$schema' in body.output_config.format.schema), 'no $schema keyword');
      assert.ok(!('thinking' in body), 'thinking is left at the model default');
      assert.ok(!('temperature' in body) && !('top_p' in body), 'no sampling params');
      assert.ok(body.system.startsWith('You are the analysis engine inside GymBoy'));
      const content = body.messages[0].content;
      assert.strictEqual(content.length, 3, '2 images + 1 text block');
      assert.deepStrictEqual(content.slice(0, 2).map((b) => b.type), ['image', 'image'], 'images come first');
      assert.strictEqual(content[0].source.type, 'base64');
      assert.strictEqual(content[0].source.media_type, 'image/jpeg');
      assert.strictEqual(content[2].type, 'text');
      assert.ok((headers['anthropic-beta'] || '').includes('server-side-fallback-2026-07-01'), 'fallback beta header');
      assert.strictEqual(body.fallbacks, 'default');
      assert.ok(headers['x-api-key'] === 'test-key');
    }));

  await test('personal details never reach the model', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      await run({ getClient, env: {} });
      const text = fake.seen[0].body.messages[0].content[2].text;
      ['Priya', 'priya@example.com', '1994-05-02', 'dob', 'email', 'name'].forEach((s) => assert.ok(!text.includes(s), `leaked: ${s}`));
      const sent = JSON.parse(text.slice(text.indexOf('{')));
      assert.strictEqual(sent.profile.age, 32);
      assert.strictEqual(sent.profile.goal.primary, 'lose_fat');
      assert.strictEqual(sent.images, 2);
      assert.strictEqual(sent.previous_scan, null);
    }));

  await test('model and effort can be changed from the environment', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      await run({ getClient, env: { GB_MODEL: 'claude-sonnet-5-5', GB_EFFORT: 'medium', GB_FALLBACKS: '0' } });
      const { body, headers } = fake.seen[0];
      assert.strictEqual(body.model, 'claude-sonnet-5-5');
      assert.strictEqual(body.output_config.effort, 'medium');
      assert.ok(!('fallbacks' in body) && !(headers['anthropic-beta'] || '').includes('fallback'));
    }));

  await test('if the fallback parameters are rejected (400) it retries once without them', () =>
    withFake((body) => (body.fallbacks ? { status: 400, json: { type: 'error', error: { type: 'invalid_request_error', message: 'unknown parameter' } } } : { json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      const out = await run({ getClient, env: {} });
      assert.strictEqual(out.status, 200);
      assert.strictEqual(fake.seen.length, 2);
      assert.ok('fallbacks' in fake.seen[0].body && !('fallbacks' in fake.seen[1].body));
    }));

  await test('a refusal becomes a friendly 422', () =>
    withFake(() => ({ json: message('', { stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category: null, explanation: 'x' } }) }), async ({ getClient }) => {
      const out = await run({ getClient, env: {} });
      assert.strictEqual(out.status, 422);
      assert.strictEqual(out.json.error, 'refused');
    }));

  await test('a truncated answer is a 502, not a broken report', () =>
    withFake(() => ({ json: message('{"schema_ver', { stop_reason: 'max_tokens' }) }), async ({ getClient }) => {
      const out = await run({ getClient, env: {} });
      assert.strictEqual(out.status, 502);
      assert.strictEqual(out.json.error, 'incomplete');
    }));

  await test('non-JSON output is a 502', () =>
    withFake(() => ({ json: message('Sorry, I cannot read this.') }), async ({ getClient }) => {
      assert.strictEqual((await run({ getClient, env: {} })).status, 502);
    }));

  await test('JSON with the wrong shape is a 502', () =>
    withFake(() => ({ json: message(JSON.stringify({ ...example(), status: 'great' })) }), async ({ getClient }) => {
      assert.strictEqual((await run({ getClient, env: {} })).json.error, 'bad_output');
    }));

  await test('upstream 429 and 500 become clean errors without leaking details', () =>
    withFake((body, n) => ({ status: n === 1 ? 429 : 500, json: { type: 'error', error: { type: 'rate_limit_error', message: 'secret internal detail' } } }), async ({ getClient }) => {
      const a = await run({ getClient, env: {} });
      assert.strictEqual(a.status, 429);
      assert.ok(!JSON.stringify(a.json).includes('secret'));
      const b = await run({ getClient, env: { GB_FALLBACKS: '0' } });
      assert.strictEqual(b.status, 502);
      assert.ok(!JSON.stringify(b.json).includes('secret'));
    }));

  await test('the model is not trusted: wrong statuses are corrected before returning', () => {
    const bad = example();
    bad.metrics.find((m) => m.key === 'weight').status = 'above';
    return withFake(() => ({ json: message(JSON.stringify(bad)) }), async ({ getClient }) => {
      const out = await run({ getClient, env: {} });
      assert.strictEqual(out.json.report.metrics.find((m) => m.key === 'weight').status, 'within');
      assert.ok(out.json.meta.adjustments.some((a) => a.includes('weight')));
    });
  });

  await test('safety flags from the profile are enforced even if the model ignored them', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ getClient }) => {
      const out = await run({ getClient, env: {} }, { body: { images: images(1), profile: { ...validProfile, flags: { eating_disorder_history: true } } } });
      assert.strictEqual(out.json.report.safety.coaching_limited, true);
      assert.strictEqual(out.json.report.report.coaching.nutrition.calorie_guidance, null);
    }));

  await test('the previous scan sent by the app is passed to the model and used for the trend', () =>
    withFake(() => ({ json: message(JSON.stringify(example())) }), async ({ fake, getClient }) => {
      const previous_scan = { measured_at: '2026-09-02', metrics: [{ key: 'weight', value: 83.0 }, { key: 'skeletal_muscle_mass', value: 37.0 }, { key: 'junk', value: 'x' }] };
      const out = await run({ getClient, env: {} }, { body: { images: images(1), profile: validProfile, previous_scan } });
      const sent = JSON.parse(fake.seen[0].body.messages[0].content[1].text.split('\n').slice(1).join('\n'));
      assert.strictEqual(sent.previous_scan.metrics.length, 2, 'invalid entries dropped');
      const w = out.json.report.trend.items.find((t) => t.key === 'weight');
      assert.strictEqual(w.previous, 83.0);
      assert.strictEqual(w.delta, -0.6);
    }));

  /* ---------- input checks (no model call is made) ---------- */
  const noCall = { getClient: () => { throw new Error('model must not be called'); }, env: {} };
  await test('only POST is allowed', async () => assert.strictEqual((await run(noCall, { method: 'GET' })).status, 405));
  await test('no images is a 400', async () => assert.strictEqual((await run(noCall, { body: { images: [] } })).status, 400));
  await test('more than 4 images is a 400', async () => assert.strictEqual((await run(noCall, { body: { images: images(5) } })).status, 400));
  await test('wrong media type is a 400', async () => assert.strictEqual((await run(noCall, { body: { images: [{ media_type: 'application/pdf', data: 'AAAA' }] } })).status, 400));
  await test('data that is not base64 is a 400', async () => assert.strictEqual((await run(noCall, { body: { images: [{ media_type: 'image/png', data: 'not base64 !!' }] } })).status, 400));
  await test('oversized payload is a 400', async () => {
    const big = [{ media_type: 'image/jpeg', data: 'A'.repeat(4.3 * 1024 * 1024) }];
    assert.strictEqual((await run(noCall, { body: { images: big } })).status, 400);
  });

  /* ---------- auth ---------- */
  await test('when Supabase is configured, a request without a token is 401', async () => {
    const out = await run({ ...noCall, env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' } });
    assert.strictEqual(out.status, 401);
  });
  await test('a live site with no auth configured refuses (503) unless explicitly allowed', async () => {
    assert.strictEqual((await run({ ...noCall, env: { VERCEL_ENV: 'production' } })).status, 503);
  });
  await test('an injected authenticator can reject', async () => {
    const out = await run({ ...noCall, authenticate: async () => ({ ok: false, status: 401, error: 'unauthorized' }) });
    assert.strictEqual(out.status, 401);
  });

  /* ---------- verifying the user's token with Supabase (plain HTTP) ---------- */
  const { authenticate } = require('../api/analyze-scan');
  const authEnv = { SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_ANON_KEY: 'anon-key' };
  const withAuthFake = async (status, body, fn) => {
    const seen = [];
    const fetchImpl = async (url, opts) => (seen.push({ url, headers: opts.headers }), new Response(JSON.stringify(body), { status }));
    await fn(fetchImpl, seen);
  };
  await test('a valid token is checked against /auth/v1/user with the anon key', () =>
    withAuthFake(200, { id: 'u-1', email: 'a@b.co' }, async (fetchImpl, seen) => {
      const r = await authenticate({ headers: { authorization: 'Bearer good-token' } }, authEnv, fetchImpl);
      assert.deepStrictEqual(r, { ok: true, user: { id: 'u-1', email: 'a@b.co' } });
      assert.strictEqual(seen[0].url, 'https://proj.supabase.co/auth/v1/user');
      assert.strictEqual(seen[0].headers.Authorization, 'Bearer good-token');
      assert.strictEqual(seen[0].headers.apikey, 'anon-key');
    }));
  await test('a rejected token is 401', () =>
    withAuthFake(401, { msg: 'invalid JWT' }, async (fetchImpl) => {
      assert.deepStrictEqual(await authenticate({ headers: { authorization: 'Bearer bad' } }, authEnv, fetchImpl), { ok: false, status: 401, error: 'unauthorized' });
    }));
  await test('a reply without a user id is 401', () =>
    withAuthFake(200, {}, async (fetchImpl) => {
      assert.strictEqual((await authenticate({ headers: { authorization: 'Bearer t' } }, authEnv, fetchImpl)).status, 401);
    }));
  await test('Supabase being down is a 503, not a misleading 401', async () => {
    const down = async () => { throw new Error('ECONNREFUSED'); };
    assert.deepStrictEqual(await authenticate({ headers: { authorization: 'Bearer t' } }, authEnv, down), { ok: false, status: 503, error: 'auth_unavailable' });
    await withAuthFake(500, {}, async (fetchImpl) => assert.strictEqual((await authenticate({ headers: { authorization: 'Bearer t' } }, authEnv, fetchImpl)).status, 503));
  });
  await test('no Authorization header is 401 before any network call', async () => {
    const never = async () => { throw new Error('should not be called'); };
    assert.strictEqual((await authenticate({ headers: {} }, authEnv, never)).status, 401);
  });
  await test('this works on Node 20 (the supabase-js client would not start there)', () => {
    assert.ok(!require('fs').readFileSync(path.join(__dirname, '../api/analyze-scan.js'), 'utf8').includes('createClient'));
  });

  /* ---------- no API key: mock mode vs not configured ---------- */
  await test('no key and no mock flag: 503 ai_not_configured', async () => {
    const out = await run({ env: {} });
    assert.strictEqual(out.status, 503);
    assert.strictEqual(out.json.error, 'ai_not_configured');
  });
  await test('mock mode returns the bundled sample, marked as a mock', async () => {
    const out = await run({ env: { GYMBOY_MOCK_AI: '1' } });
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.json.meta.mock, true);
    assert.strictEqual(out.json.report.status, 'ok');
  });

  if (failures.length) {
    console.log(failures.join('\n'));
    console.log(`\n${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`All ${passed} analyze-scan tests passed`);
})();
