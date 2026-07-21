/**
 * Vercel AI Gateway adapter for Strategy composer.
 * Uses @ai-sdk/gateway when AI_GATEWAY_API_KEY is set (see Vercel AI Gateway docs).
 */

var gatewayProvider = null;
var gatewayInitError = null;

function resolveAiProvider() {
  var raw = (process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();
  if (raw === 'openai') return 'openai';
  if (raw === 'vercel_ai' || raw === 'vercel') return 'vercel_ai';
  if (raw === 'tinymodel') return 'tinymodel';
  return 'hybrid';
}

function isVercelAiConfigured() {
  if (process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim()) return true;
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return true;
  if (process.env.VERCEL_OIDC_TOKEN && process.env.VERCEL_OIDC_TOKEN.trim()) return true;
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

function getGatewayProvider() {
  if (gatewayProvider !== null) return gatewayProvider;
  if (gatewayInitError) return null;

  var apiKey = (process.env.AI_GATEWAY_API_KEY || '').trim();
  if (!apiKey && !process.env.VERCEL_ENV && !process.env.VERCEL_OIDC_TOKEN) {
    gatewayProvider = null;
    return null;
  }

  try {
    var createGateway = require('@ai-sdk/gateway').createGateway;
    gatewayProvider = createGateway({
      apiKey: apiKey || process.env.VERCEL_OIDC_TOKEN
    });
    return gatewayProvider;
  } catch (err) {
    gatewayInitError = String(err && err.message ? err.message : err);
    gatewayProvider = null;
    return null;
  }
}

function resolveModelHandle(modelId, gatewayOptions) {
  var gateway = getGatewayProvider();
  if (gateway) {
    var model = gateway(modelId);
    if (gatewayOptions && gatewayOptions.order && gatewayOptions.order.length) {
      return {
        model: model,
        providerOptions: { gateway: gatewayOptions }
      };
    }
    return { model: model };
  }
  return {
    model: modelId,
    providerOptions: gatewayOptions ? { gateway: gatewayOptions } : undefined
  };
}

/**
 * Create Gateway-backed generateText caller.
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
    var modelId = options.model || defaultQualityModel();
    var gatewayOpts = options.gateway;
    var resolved = resolveModelHandle(modelId, gatewayOpts);

    var params = {
      model: resolved.model,
      system: system,
      prompt: input,
      maxTokens: options.maxOutputTokens || 800,
      temperature: 0.7
    };
    if (resolved.providerOptions) {
      params.providerOptions = resolved.providerOptions;
    }

    try {
      var result = await generateText(params);
      var text = String(result.text || '').trim();
      if (!text) {
        return { ok: false, error: 'Empty response from Vercel AI Gateway.' };
      }
      return {
        ok: true,
        output_text: text,
        provider: 'vercel_ai',
        model: modelId,
        gateway: true,
        mode: 'chat'
      };
    } catch (err) {
      return {
        ok: false,
        error: 'Gateway: ' + String(err && err.message ? err.message : err)
      };
    }
  };
}

function resolveAvailability(generators) {
  generators = generators || {};
  return {
    tinymodel: true,
    vercel_ai: !!generators.vercelAi,
    openai: !!generators.openai
  };
}

function resolveGenerationCaller(generators, turnRoute) {
  generators = generators || {};
  var provider = resolveAiProvider();
  if (provider === 'tinymodel') return null;
  if (provider === 'openai') {
    return generators.openai ? { fn: generators.openai, name: 'openai' } : null;
  }

  if (turnRoute && turnRoute.generator === 'openai' && generators.openai) {
    return { fn: generators.openai, name: 'openai' };
  }
  if (turnRoute && turnRoute.generator === 'vercel_ai' && generators.vercelAi) {
    return { fn: generators.vercelAi, name: 'vercel_ai' };
  }
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
  resolveAvailability: resolveAvailability,
  defaultQualityModel: defaultQualityModel,
  defaultFastModel: defaultFastModel,
  getGatewayProvider: getGatewayProvider
};
