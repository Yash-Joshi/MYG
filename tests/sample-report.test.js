/* The bundled demo report must equal ai/example-output.json.   Run: node tests/sample-report.test.js
 * If this fails: node tools/sync-sample.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sample = require('../js/sample-report.js');
const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/example-output.json'), 'utf8'));
assert.deepStrictEqual(sample, example, 'js/sample-report.js is out of date. Run: node tools/sync-sample.js');
console.log('All 1 sample-report tests passed');
