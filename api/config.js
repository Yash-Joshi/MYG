'use strict';
/* GET /api/config - the public settings the browser needs. The Supabase anon key is meant to be
 * public (row-level security protects the data); the Anthropic key is never exposed. */
module.exports = function handler(req, res) {
  const env = process.env;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.end(
    JSON.stringify({
      supabaseUrl: env.SUPABASE_URL || null,
      supabaseAnonKey: env.SUPABASE_ANON_KEY || null,
      ai: !!env.ANTHROPIC_API_KEY || env.GYMBOY_MOCK_AI === '1',
      aiMock: !env.ANTHROPIC_API_KEY && env.GYMBOY_MOCK_AI === '1',
    })
  );
};
