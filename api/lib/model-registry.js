/**
 * Vercel AI Gateway model catalog + TinyModel plan–aware model selection.
 *
 * Tiers (override via env):
 *   fast      — short acks, soft rephrase, high-confidence grounded snippets
 *   balanced  — default grounded chat
 *   quality   — explain_screen, strategy meta, complex HSP questions
 *   reasoning — low-confidence routing, compare/analyze, multi-step why/how
 *   code      — architecture, protocols, stack, implementation detail
 */

var DEFAULT_TIERS = {
  fast: 'openai/gpt-4.1-nano',
  balanced: 'openai/gpt-4o-mini',
  quality: 'openai/gpt-4.1-mini',
  reasoning: 'anthropic/claude-sonnet-4-20250514',
  code: 'openai/gpt-4.1-mini'
};

var DEFAULT_GATEWAY_ORDER = ['openai', 'anthropic', 'google'];
var DEFAULT_GATEWAY_FALLBACKS = [
  'google/gemini-2.0-flash',
  'anthropic/claude-3-5-haiku-latest',
  'openai/gpt-4o-mini'
];

function parseCsv(raw, fallback) {
  if (!raw || !String(raw).trim()) return fallback.slice();
  return String(raw)
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function tierFromEnv(name, fallback) {
  var key = 'AI_COMPOSER_' + name.toUpperCase() + '_MODEL';
  return (process.env[key] || fallback).trim();
}

function loadModelCatalog() {
  var tiers = {
    fast: tierFromEnv('fast', DEFAULT_TIERS.fast),
    balanced: tierFromEnv('balanced', DEFAULT_TIERS.balanced),
    quality: tierFromEnv('quality', DEFAULT_TIERS.quality),
    reasoning: tierFromEnv('reasoning', DEFAULT_TIERS.reasoning),
    code: tierFromEnv('code', DEFAULT_TIERS.code)
  };

  // Back-compat: AI_COMPOSER_QUALITY_MODEL / FAST_MODEL override quality & fast.
  if (process.env.AI_COMPOSER_QUALITY_MODEL) {
    tiers.quality = process.env.AI_COMPOSER_QUALITY_MODEL.trim();
  }
  if (process.env.AI_COMPOSER_FAST_MODEL) {
    tiers.fast = process.env.AI_COMPOSER_FAST_MODEL.trim();
  }

  return {
    tiers: tiers,
    gatewayOrder: parseCsv(process.env.AI_GATEWAY_ORDER, DEFAULT_GATEWAY_ORDER),
    gatewayFallbackModels: parseCsv(process.env.AI_GATEWAY_FALLBACK_MODELS, DEFAULT_GATEWAY_FALLBACKS)
  };
}

function buildGatewayOptions(catalog) {
  return {
    order: catalog.gatewayOrder,
    models: catalog.gatewayFallbackModels
  };
}

function isCodeOrArchQuery(text) {
  return /\b(code|implement|typescript|javascript|python|api|endpoint|serverless|docker|gateway|composer|sidecar|tinymodel|architecture|stack|protocol|mqtt|opc|crdt|dtn|vercel|railway)\b/i.test(text) ||
    /\b(код|архитект|протокол|реализ)\b/i.test(text) ||
    /\b(代码|架构|协议|实现)\b/i.test(text);
}

function isReasoningQuery(text) {
  return /\b(compare|contrast|trade-?off|pros and cons|why|analyze|analyse|implications|strategy for|roadmap to|how would|walk me through)\b/i.test(text) ||
    /\b(сравни|почему|проанализ|последств)\b/i.test(text) ||
    /\b(比较|为什么|分析|影响)\b/i.test(text);
}

function planSignals(plan) {
  if (!plan) {
    return {
      intent: null,
      routingFallback: true,
      confidence: 0,
      margin: 0,
      classifyLabel: null,
      retrievalOverlap: 0,
      retrievalScore: 0,
      hasRetrieval: false
    };
  }
  var routing = plan.routing || {};
  var retrieval = plan.retrieval || {};
  return {
    intent: plan.intent || null,
    routingFallback: !!routing.fallback,
    confidence: typeof routing.confidence === 'number' ? routing.confidence : 0,
    margin: typeof routing.margin === 'number' ? routing.margin : 0,
    classifyLabel: routing.label || null,
    retrievalOverlap: typeof retrieval.keyword_overlap === 'number' ? retrieval.keyword_overlap : 0,
    retrievalScore: typeof retrieval.hybrid_score === 'number' ? retrieval.hybrid_score : 0,
    hasRetrieval: !!(retrieval.chunk_preview)
  };
}

/**
 * Pick gateway model tier + token budget from TinyModel plan + prompt.
 * @returns {{ tier, model, maxOutputTokens, reason, gateway }}
 */
function pickModelFromPlan(ctx) {
  var catalog = ctx.catalog || loadModelCatalog();
  var userText = String(ctx.userText || '');
  var plan = ctx.plan;
  var lane = ctx.lane || 'grounded';
  var intent = ctx.intent || 'chat';
  var signals = planSignals(plan);
  var wordCount = userText.trim().split(/\s+/).filter(Boolean).length;
  var gateway = buildGatewayOptions(catalog);
  var tier = 'balanced';
  var reason = 'default_balanced';
  var maxOutputTokens = 900;

  if (lane === 'soft' || ctx.softIntent) {
    tier = 'fast';
    reason = 'soft_intent';
    maxOutputTokens = 600;
  } else if (isCodeOrArchQuery(userText)) {
    tier = 'code';
    reason = ctx.metaQuery ? 'composer_meta_technical' : 'code_or_architecture';
    maxOutputTokens = 1200;
  } else if (intent === 'explain_screen' || ctx.metaQuery) {
    tier = 'quality';
    reason = 'explain_or_meta';
    maxOutputTokens = 1200;
  } else if (isReasoningQuery(userText) ||
      (signals.routingFallback && signals.retrievalOverlap < 0.25) ||
      (signals.confidence < 0.45 && signals.margin < 0.12)) {
    tier = 'reasoning';
    reason = signals.routingFallback ? 'tinymodel_low_confidence' : 'reasoning_query';
    maxOutputTokens = 1400;
  } else if (signals.hasRetrieval && signals.retrievalOverlap >= 0.55 && wordCount <= 14) {
    tier = 'fast';
    reason = 'high_confidence_rag_short';
    maxOutputTokens = 700;
  } else if (ctx.complexQuestion || intent === 'explain_screen') {
    tier = 'quality';
    reason = 'complex_grounded';
    maxOutputTokens = 1200;
  } else if (signals.retrievalScore >= 0.5 && signals.retrievalOverlap >= 0.35) {
    tier = 'balanced';
    reason = 'grounded_corpus';
    maxOutputTokens = 1000;
  }

  // Sci/Tech classify label often correlates with technical prompts on strategy site.
  if (signals.classifyLabel === 'Sci/Tech' && signals.confidence >= 0.55 && tier === 'balanced') {
    tier = 'code';
    reason = 'tinymodel_sci_tech';
  }

  var model = catalog.tiers[tier] || catalog.tiers.balanced;

  return {
    tier: tier,
    model: model,
    maxOutputTokens: maxOutputTokens,
    reason: reason,
    gateway: gateway,
    signals: signals
  };
}

function listCatalogForMeta() {
  var catalog = loadModelCatalog();
  return {
    tiers: catalog.tiers,
    gateway_order: catalog.gatewayOrder,
    gateway_fallback_models: catalog.gatewayFallbackModels
  };
}

module.exports = {
  loadModelCatalog: loadModelCatalog,
  buildGatewayOptions: buildGatewayOptions,
  pickModelFromPlan: pickModelFromPlan,
  planSignals: planSignals,
  listCatalogForMeta: listCatalogForMeta,
  isCodeOrArchQuery: isCodeOrArchQuery,
  isReasoningQuery: isReasoningQuery
};
