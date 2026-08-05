/**
 * Vercel AI Gateway adapter for Strategy composer.
 * Uses AI SDK generateText + createGateway when AI_GATEWAY_API_KEY is set.
 */

var modelRegistry = require('./model-registry');

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
  // Only treat Gateway as available when an explicit key is present.
  // VERCEL_ENV alone is not enough — generateText then hangs/fails and breaks AI CORE chat.
  if (process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_API_KEY.trim()) return true;
  if (process.env.VERCEL_OIDC_TOKEN && process.env.VERCEL_OIDC_TOKEN.trim() &&
      process.env.AI_GATEWAY_USE_OIDC === '1') {
    return true;
  }
  return false;
}

function isLegacyOpenAiConfigured() {
  return !!(process.env.OPENAI || process.env.OPENAI_API_KEY || '').trim();
}

function defaultQualityModel() {
  return modelRegistry.loadModelCatalog().tiers.quality;
}

function defaultFastModel() {
  return modelRegistry.loadModelCatalog().tiers.fast;
}

function defaultBalancedModel() {
  return modelRegistry.loadModelCatalog().tiers.balanced;
}

function buildModelFallbackChain(primaryModel, gatewayOpts) {
  var chain = [];
  var seen = {};
  function add(id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    chain.push(id);
  }
  add(primaryModel);
  if (gatewayOpts && gatewayOpts.models) {
    gatewayOpts.models.forEach(add);
  }
  var catalog = modelRegistry.loadModelCatalog();
  Object.keys(catalog.tiers).forEach(function (tier) {
    if (catalog.tiers[tier] !== primaryModel) add(catalog.tiers[tier]);
  });
  return chain;
}

function loadAiSdk() {
  try {
    return require('ai');
  } catch (err) {
    gatewayInitError = 'require(ai) failed: ' + String(err && err.message ? err.message : err);
    return null;
  }
}

function getGatewayProvider() {
  if (gatewayProvider !== null) return gatewayProvider;
  if (gatewayInitError) return null;

  var apiKey = (process.env.AI_GATEWAY_API_KEY || '').trim();
  if (!apiKey && !(process.env.AI_GATEWAY_USE_OIDC === '1' && process.env.VERCEL_OIDC_TOKEN)) {
    gatewayInitError = 'No AI_GATEWAY_API_KEY (and OIDC not enabled)';
    return null;
  }

  var ai = loadAiSdk();
  if (!ai) return null;

  try {
    // Prefer createGateway from `ai` (CJS-friendly). Fall back to @ai-sdk/gateway.
    var createGateway = typeof ai.createGateway === 'function'
      ? ai.createGateway
      : require('@ai-sdk/gateway').createGateway;
    gatewayProvider = createGateway({
      apiKey: apiKey || undefined
    });
    gatewayInitError = null;
    return gatewayProvider;
  } catch (err) {
    gatewayInitError = String(err && err.message ? err.message : err);
    gatewayProvider = null;
    return null;
  }
}

function getGatewayInitError() {
  return gatewayInitError;
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
  // AI SDK 5+ routes provider/model strings through Gateway when AI_GATEWAY_API_KEY is set.
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

  var ai = loadAiSdk();
  if (!ai || typeof ai.generateText !== 'function') return null;
  var generateText = ai.generateText;

  return async function callVercelAi(input, system, options) {
    options = options || {};
    var modelId = options.model || defaultQualityModel();
    var gatewayOpts = options.gateway;
    var models = buildModelFallbackChain(modelId, gatewayOpts);
    var lastError = null;

    for (var i = 0; i < models.length; i++) {
      var tryModel = models[i];
      var resolved = resolveModelHandle(tryModel, gatewayOpts);
      var params = {
        model: resolved.model,
        system: system,
        prompt: input,
        // AI SDK 5+: maxOutputTokens (maxTokens is ignored / removed)
        maxOutputTokens: options.maxOutputTokens || 800,
        temperature: 0.7
      };
      if (resolved.providerOptions) {
        params.providerOptions = resolved.providerOptions;
      }

      try {
        var result = await generateText(params);
        var text = String(result.text || '').trim();
        if (!text) {
          lastError = 'Empty response from Vercel AI Gateway.';
          continue;
        }
        return {
          ok: true,
          output_text: text,
          provider: 'vercel_ai',
          model: tryModel,
          model_attempts: i + 1,
          gateway: true,
          mode: 'chat'
        };
      } catch (err) {
        lastError = String(err && err.message ? err.message : err);
        // Try next model in cascade (quota, model_not_found, provider outage).
      }
    }

    return {
      ok: false,
      error: 'Gateway: ' + (lastError || 'all models failed')
    };
  };
}

function resolveAvailability(generators) {
  generators = generators || {};
  return {
    tinymodel: true,
    vercel_ai: !!generators.vercelAi,
    openai: !!generators.openai,
    transmitter: !!generators.transmitter
  };
}

function resolveGenerationCaller(generators, turnRoute) {
  generators = generators || {};
  var provider = resolveAiProvider();
  if (provider === 'tinymodel') return null;
  if (provider === 'openai') {
    return generators.openai ? { fn: generators.openai, name: 'openai' } : null;
  }

  if (turnRoute && turnRoute.generator === 'transmitter' && generators.transmitter) {
    return { fn: generators.transmitter, name: 'ai_transmitter' };
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
  if (generators.transmitter) {
    return { fn: generators.transmitter, name: 'ai_transmitter' };
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
  defaultBalancedModel: defaultBalancedModel,
  getGatewayProvider: getGatewayProvider,
  getGatewayInitError: getGatewayInitError,
  listModelCatalog: modelRegistry.listCatalogForMeta
};
