#!/usr/bin/env node
/* GymBoy dev server – serves this folder, runs the /api functions locally, and prints the
 * address to open on your phone.
 *
 *   node dev-server.js            -> http://<your-computer-ip>:8080
 *   PORT=3000 node dev-server.js  -> custom port
 *   HOST=127.0.0.1 node dev-server.js  -> this computer only
 *
 * Settings (API keys etc.) are read from a .env file in this folder if there is one. See .env.example.
 * With no ANTHROPIC_API_KEY the app runs in demo mode (a sample report); set GYMBOY_MOCK_AI=1 to
 * have the server itself return the sample report.
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;

// minimal .env loader (KEY=VALUE per line; existing environment variables win)
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch (e) { /* no .env file: fine */ }

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 8 * 1024 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// /api/<name> runs api/<name>.js, the same files Vercel runs in production.
async function runApi(req, res, name) {
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not_found"}');
    return;
  }
  try {
    if (req.method === 'POST' || req.method === 'PUT') {
      const raw = await readBody(req);
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"bad_json"}');
        return;
      }
    }
    delete require.cache[require.resolve(file)]; // pick up edits without restarting
    await require(file)(req, res);
  } catch (e) {
    console.error(`api/${name} failed:`, e.message);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"server_error"}');
  }
}

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (rel.startsWith('/api/')) {
    runApi(req, res, rel.slice(5).replace(/\/$/, ''));
    return;
  }

  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  const first = path.relative(ROOT, file).split(path.sep)[0];

  // never serve anything outside this folder, secrets, dependencies, or the server script itself
  if (!file.startsWith(ROOT + path.sep) || path.basename(file) === 'dev-server.js' || first.startsWith('.') || first === 'node_modules') {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  const ai = process.env.ANTHROPIC_API_KEY ? 'live (ANTHROPIC_API_KEY found)' : process.env.GYMBOY_MOCK_AI === '1' ? 'sample reports (GYMBOY_MOCK_AI=1)' : 'demo (no key: the app shows a sample report)';
  console.log('\n  GymBoy is running\n');
  console.log(`  On this computer:  http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const nets = Object.values(os.networkInterfaces()).flat();
    nets
      .filter((n) => n && n.family === 'IPv4' && !n.internal)
      .forEach((n) => console.log(`  On your phone:     http://${n.address}:${PORT}   (same Wi-Fi)`));
  }
  console.log(`\n  Scan analysis:     ${ai}`);
  console.log(`  Accounts:          ${process.env.SUPABASE_URL ? 'Supabase' : 'demo mode (data stays on this device)'}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
