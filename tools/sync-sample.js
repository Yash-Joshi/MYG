#!/usr/bin/env node
/* Regenerates js/sample-report.js from ai/example-output.json.   Run: node tools/sync-sample.js */
const fs = require('fs');
const path = require('path');
const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ai', 'example-output.json'), 'utf8'));
const out =
  '/* GENERATED from ai/example-output.json by tools/sync-sample.js. Do not edit by hand.\n' +
  ' * The sample report shown in demo mode, when the AI service is not connected. */\n' +
  '(function (root) {\n  var GB = (root.GB = root.GB || {});\n  GB.sampleReport = ' +
  JSON.stringify(src, null, 2).replace(/\n/g, '\n  ') +
  ';\n  if (typeof module !== "undefined" && module.exports) module.exports = GB.sampleReport;\n})(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', 'js', 'sample-report.js'), out);
console.log('wrote js/sample-report.js (' + out.length + ' bytes)');
