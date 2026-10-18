'use strict';
/* Loads the scan-report system prompt and schema from ai/ (single source of truth). */
const fs = require('fs');
const path = require('path');

const AI_DIR = path.join(__dirname, '..', 'ai');
let cache = null;

function load() {
  if (cache) return cache;
  const md = fs.readFileSync(path.join(AI_DIR, 'scan-report-prompt.md'), 'utf8');
  const a = md.indexOf('<!-- SYSTEM-PROMPT-START -->');
  const b = md.indexOf('<!-- SYSTEM-PROMPT-END -->');
  if (a === -1 || b === -1 || b < a) throw new Error('System prompt markers not found in ai/scan-report-prompt.md');
  const system = md.slice(a + '<!-- SYSTEM-PROMPT-START -->'.length, b).trim();
  const schema = JSON.parse(fs.readFileSync(path.join(AI_DIR, 'scan-report.schema.json'), 'utf8'));
  delete schema.$schema; // the API takes the schema body only
  cache = { system, schema };
  return cache;
}

module.exports = { load };
