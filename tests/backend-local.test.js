/* Demo (local) mode of js/backend.js: what happens when the analysis service is missing or not set up.
 *   Run: node tests/backend-local.test.js
 */
const assert = require('assert');
globalThis.window = globalThis;
require('../js/profile-utils.js');
require('../js/sample-report.js');

const replies = []; // queue of { status, body } for /api/analyze-scan
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  const u = String(url);
  if (u === '/api/config') return Promise.resolve(new Response('Not found', { status: 404 })); // static hosting: no config
  if (u === '/api/analyze-scan') {
    const r = replies.shift();
    if (r === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve(new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status }));
  }
  return realFetch(url, opts);
};
globalThis.navigator = { language: 'en-US' };
require('../js/backend.js');
const B = globalThis.GB.backend;
const profile = globalThis.GB.profile.emptyProfile();
const images = [{ media_type: 'image/jpeg', data: 'AAAA' }];

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
  await B.init();
  await test('with no config endpoint the app is in local (demo) mode', () => {
    assert.strictEqual(B.mode, 'local');
    assert.strictEqual(B.aiMode, 'demo');
  });

  const demoCases = [
    ['server says the AI is not set up', { status: 503, body: { error: 'ai_not_configured' } }],
    ['live site with no auth configured (the case that broke before)', { status: 503, body: { error: 'auth_not_configured' } }],
    ['auth provider unreachable', { status: 503, body: { error: 'auth_unavailable' } }],
    ['no /api at all (plain static hosting, 404)', { status: 404, body: 'Not found' }],
    ['method not allowed (405)', { status: 405, body: '' }],
    ['a reply that is not JSON', { status: 502, body: '<html>Bad gateway</html>' }],
    ['the network is down', 'network'],
  ];
  for (const [label, reply] of demoCases) {
    await test(`demo mode shows the sample report when: ${label}`, async () => {
      replies.push(reply);
      const r = await B.analyze({ images, profile });
      assert.strictEqual(r.ok, true, JSON.stringify(r));
      assert.strictEqual(r.meta.mock, true);
      assert.strictEqual(r.report.status, 'ok');
    });
  }

  await test('real problems are still reported, not hidden behind the sample', async () => {
    for (const [status, error] of [[422, 'refused'], [502, 'model_error'], [429, 'busy'], [400, 'bad_request']]) {
      replies.push({ status, body: { error, message: `msg ${error}` } });
      const r = await B.analyze({ images, profile });
      assert.strictEqual(r.ok, false, error);
      assert.strictEqual(r.error, error);
      assert.strictEqual(r.message, `msg ${error}`);
    }
  });

  await test('a real report from the server is passed through untouched', async () => {
    const report = JSON.parse(JSON.stringify(globalThis.GB.sampleReport));
    report.report.headline = 'From the server';
    replies.push({ status: 200, body: { report, meta: { mock: false, model: 'claude-opus-5-5' } } });
    const r = await B.analyze({ images, profile });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.report.report.headline, 'From the server');
    assert.strictEqual(r.meta.mock, false);
  });

  if (failures.length) {
    console.log(failures.join('\n'));
    console.log(`\n${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`All ${passed} backend (demo mode) tests passed`);
  process.exit(0);
})();
