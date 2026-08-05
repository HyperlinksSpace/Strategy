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
var transmitter = require('./lib/ai-transmitter-client');

// Hobby/Pro default is too short when TinyModel plan + LLM both run.
module.exports.config = { maxDuration: 60 };

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

/** Skip burning latency on OpenAI after account-wide quota failures. */
var openAiQuotaCooldownUntil = 0;

async function callOpenAi(input, instructions, options) {
  var apiKey = getOpenAiKey();
  if (!apiKey) {
    return { ok: false, error: 'OPENAI env is not configured on the server.' };
  }
  if (Date.now() < openAiQuotaCooldownUntil) {
    return {
      ok: false,
      error: 'OpenAI quota exhausted (cooldown). Add credits or set AI_GATEWAY_API_KEY.'
    };
  }

  var preferred = (options && options.model) ||
    (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  if (preferred.indexOf('/') >= 0) {
    preferred = preferred.split('/').pop();
  }

  var models = [];
  function addModel(id) {
    if (!id) return;
    id = String(id).trim();
    if (id.indexOf('/') >= 0) id = id.split('/').pop();
    if (id && models.indexOf(id) < 0) models.push(id);
  }
  addModel(preferred);
  addModel(process.env.OPENAI_FALLBACK_MODEL);
  addModel('gpt-4o-mini');
  addModel('gpt-4.1-nano');

  var messages = [];
  if (instructions) {
    messages.push({ role: 'system', content: instructions });
  }
  messages.push({ role: 'user', content: input });

  var openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 10000);
  if (!Number.isFinite(openAiTimeoutMs) || openAiTimeoutMs < 2000) openAiTimeoutMs = 10000;

  var lastError = null;
  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, openAiTimeoutMs) : null;
    try {
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
        }),
        signal: controller ? controller.signal : undefined
      });

      var body = await response.json().catch(function () { return null; });
      if (!response.ok) {
        lastError = body && body.error && body.error.message
          ? body.error.message
          : 'OpenAI request failed (' + response.status + ').';
        // Account-wide quota: further model attempts waste seconds and always fail.
        if (/insufficient_quota|exceeded your current quota|billing details|no credits remaining/i.test(lastError)) {
          openAiQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
          return { ok: false, error: lastError };
        }
        // Try next model on not-found / rate-limit.
        if (/rate|model|not.?found|does not exist/i.test(lastError)) {
          continue;
        }
        return { ok: false, error: lastError };
      }

      var text = body && body.choices && body.choices[0] && body.choices[0].message
        ? String(body.choices[0].message.content || '').trim()
        : '';
      if (!text) {
        lastError = 'Empty response from OpenAI.';
        continue;
      }

      openAiQuotaCooldownUntil = 0;
      return {
        ok: true,
        output_text: text,
        provider: 'openai',
        mode: 'chat',
        model: model,
        model_attempts: i + 1
      };
    } catch (err) {
      lastError = String(err && err.message ? err.message : err);
      if (/abort/i.test(lastError)) lastError = 'OpenAI timeout';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { ok: false, error: lastError || 'OpenAI unavailable' };
}

function buildGenerators() {
  var vercelCaller = vercelAi.createVercelAiCaller();
  var openai = getOpenAiKey() ? callOpenAi : null;
  var transmitterCaller = transmitter.createTransmitterCaller();
  return {
    vercelAi: vercelCaller,
    openai: openai,
    transmitter: transmitterCaller
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
        gateway_key: !!(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim()),
        gateway_provider: !!vercelAi.getGatewayProvider(),
        gateway_init_error: vercelAi.getGatewayInitError ? vercelAi.getGatewayInitError() : undefined,
        model: vercelAi.defaultQualityModel(),
        fast_model: vercelAi.defaultFastModel(),
        balanced_model: vercelAi.defaultBalancedModel(),
        catalog: vercelAi.listModelCatalog()
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
