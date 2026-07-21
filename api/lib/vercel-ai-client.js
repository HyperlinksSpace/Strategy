/**
 * Vercel AI SDK adapter for Strategy composer (mirrors TinyModel integrations/hsp/reference/vercel-ai-client.ts).
 */

function resolveAiProvider() {
  var raw = (process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();
  if (raw === 'openai') return 'openai';
  if (raw === 'vercel_ai' || raw === 'vercel') return 'vercel_ai';
  return 'hybrid';
}

function isVercelAiConfigured() {
  if (process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim()) return true;
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return true;
  if (process.env.AI_SDK_DEFAULT_PROVIDER && process.env.AI_SDK_DEFAULT_PROVIDER.trim()) return true;
  return false;
}

function isLegacyOpenAiConfigured() {
  return !!(process.env.OPENAI || process.env.OPENAI_API_KEY || '').trim();
}

function defaultQualityModel() {
  return (
    process.env.AI_COMPOSER_QUALITY_MODEL ||
    process.env.OPENAI_MODEL ||
    'openai/gpt-4o-mini'
  ).trim();
}

function defaultFastModel() {
  return (process.env.AI_COMPOSER_FAST_MODEL || 'openai/gpt-4.1-nano').trim();
}

function pickModelForIntent(userText, plan) {
  if (/\b(summarize|summary|rephrase|shorter|brief)\b/i.test(userText)) {
    return defaultFastModel();
  }
  if (plan && plan.retrieval && plan.retrieval.chunk_preview) {
    return defaultQualityModel();
  }
  return defaultQualityModel();
}

function buildGatewayOptions() {
  var order = (process.env.AI_GATEWAY_ORDER || 'openai,anthropic,google')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var models = (process.env.AI_GATEWAY_FALLBACK_MODELS || 'google/gemini-2.0-flash,anthropic/claude-3-5-haiku-latest')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  if (!order.length && !models.length) return undefined;
  return { order: order, models: models };
}

/**
 * Create generateText-backed caller when `ai` package is available.
 * @returns {((input: string, system: string, options?: object) => Promise<object>) | null}
 */
function createVercelAiCaller() {
  if (!isVercelAiConfigured() && resolveAiProvider() !== 'vercel_ai') {
    return null;
  }
  var generateText;
  try {
    generateText = require('ai').generateText;
  } catch (e) {
    return null;
  }
  if (typeof generateText !== 'function') return null;

  return async function callVercelAi(input, system, options) {
    options = options || {};
    var model = options.model || defaultQualityModel();
    var gateway = buildGatewayOptions();
    var params = {
      model: model,
      system: system,
      prompt: input,
      maxOutputTokens: options.maxOutputTokens || 800,
      temperature: 0.7
    };
    if (gateway) {
      params.providerOptions = { gateway: gateway };
    }
    try {
      var result = await generateText(params);
      var text = String(result.text || '').trim();
      if (!text) {
        return { ok: false, error: 'Empty response from Vercel AI.' };
      }
      return {
        ok: true,
        output_text: text,
        provider: 'vercel_ai',
        model: model,
        mode: 'chat'
      };
    } catch (err) {
      return {
        ok: false,
        error: String(err && err.message ? err.message : err)
      };
    }
  };
}

function resolveGenerationCaller(generators) {
  generators = generators || {};
  var provider = resolveAiProvider();
  if (provider === 'tinymodel') return null;
  if (provider === 'openai') return generators.openai ? { fn: generators.openai, name: 'openai' } : null;

  if (generators.vercelAi) {
    return { fn: generators.vercelAi, name: 'vercel_ai' };
  }
  if (generators.openai) {
    return { fn: generators.openai, name: 'openai' };
  }
  return null;
}

module.exports = {
  resolveAiProvider: resolveAiProvider,
  isVercelAiConfigured: isVercelAiConfigured,
  isLegacyOpenAiConfigured: isLegacyOpenAiConfigured,
  createVercelAiCaller: createVercelAiCaller,
  resolveGenerationCaller: resolveGenerationCaller,
  pickModelForIntent: pickModelForIntent,
  defaultQualityModel: defaultQualityModel
};
