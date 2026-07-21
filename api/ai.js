/**
 * Strategy site AI gateway (Vercel serverless).
 * Composer: TinyModel POST /v1/plan → Vercel AI SDK generateText (hybrid priority).
 *
 * Env (Vercel project):
 *   TINYMODEL_API_URL       — default https://tinymodel.hyperlinks.space
 *   AI_PROVIDER             — hybrid (default) | vercel_ai | openai | tinymodel
 *   AI_GATEWAY_API_KEY      — Vercel AI Gateway (or use Vercel OIDC on deploy)
 *   AI_COMPOSER_QUALITY_MODEL — e.g. openai/gpt-4o-mini
 *   OPENAI / OPENAI_API_KEY — legacy direct OpenAI fallback
 */

var composer = require('./lib/strategy-composer');
var tinymodel = require('./lib/tinymodel-client');
var vercelAi = require('./lib/vercel-ai-client');

var CORS_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?hyperlinks\.space$/i,
  /^https:\/\/[a-z0-9-]+\.github\.io$/i,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

function allowOrigin(req) {
  var origin = String(req.headers.origin || '');
  if (!origin) return '';
  return CORS_PATTERNS.some(function (re) { return re.test(origin); }) ? origin : '';
}

function applyCors(req, res) {
  var origin = allowOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getOpenAiKey() {
  return (process.env.OPENAI || process.env.OPENAI_API_KEY || '').trim();
}

async function callOpenAi(input, instructions, options) {
  var apiKey = getOpenAiKey();
  if (!apiKey) {
    return { ok: false, error: 'OPENAI env is not configured on the server.' };
  }

  var model = (options && options.model) ||
    (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  if (model.indexOf('/') >= 0) {
    model = model.split('/').pop();
  }
  var messages = [];
  if (instructions) {
    messages.push({ role: 'system', content: instructions });
  }
  messages.push({ role: 'user', content: input });

  var response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: (options && options.maxOutputTokens) || 800
    })
  });

  var body = await response.json().catch(function () { return null; });
  if (!response.ok) {
    var message = body && body.error && body.error.message
      ? body.error.message
      : 'OpenAI request failed (' + response.status + ').';
    return { ok: false, error: message };
  }

  var text = body && body.choices && body.choices[0] && body.choices[0].message
    ? String(body.choices[0].message.content || '').trim()
    : '';
  if (!text) {
    return { ok: false, error: 'Empty response from OpenAI.' };
  }

  return { ok: true, output_text: text, provider: 'openai', mode: 'chat', model: model };
}

function buildGenerators() {
  var vercelCaller = vercelAi.createVercelAiCaller();
  var openai = getOpenAiKey() ? callOpenAi : null;
  return {
    vercelAi: vercelCaller,
    openai: openai
  };
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    var generators = buildGenerators();
    return res.status(200).json({
      ok: true,
      ai: true,
      source: 'strategy-site',
      composer: process.env.AI_PROVIDER || 'hybrid',
      configured: !!(generators.vercelAi || generators.openai),
      vercel_ai: {
        configured: !!generators.vercelAi,
        gateway: vercelAi.isVercelAiConfigured(),
        model: vercelAi.defaultQualityModel()
      },
      openai_legacy: {
        configured: !!generators.openai
      },
      tinymodel: {
        url: tinymodel.tinymodelBaseUrl(),
        configured: true
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  var payload = readBody(req);
  if (!payload) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  var input = typeof payload.input === 'string' ? payload.input.trim() : '';
  if (!input) {
    return res.status(400).json({ ok: false, error: "Field 'input' (string) is required." });
  }

  var provider = (process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();

  if (provider === 'openai') {
    var instructions = typeof payload.instructions === 'string' ? payload.instructions : '';
    var legacy = await callOpenAi(input, instructions);
    return res.status(legacy.ok ? 200 : 500).json(legacy);
  }

  var result = await composer.composeStrategyTurn(payload, buildGenerators());
  return res.status(result.ok ? 200 : 500).json(result);
};
