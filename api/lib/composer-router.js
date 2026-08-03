/**
 * Strategy composer router — TinyModel plan → lane → generator → Vercel model tier.
 */

var modelRegistry = require('./model-registry');

function defaultConfig() {
  var catalog = modelRegistry.loadModelCatalog();
  return {
    qualityModel: catalog.tiers.quality,
    fastModel: catalog.tiers.fast,
    balancedModel: catalog.tiers.balanced,
    reasoningModel: catalog.tiers.reasoning,
    codeModel: catalog.tiers.code,
    navigateAck: (process.env.AI_COMPOSER_NAVIGATE_ACK || 'template').trim(),
    gatewayOrder: catalog.gatewayOrder,
    gatewayFallbackModels: catalog.gatewayFallbackModels,
    ragOnlyMinOverlap: Number(process.env.TINYMODEL_RAG_ONLY_MIN_OVERLAP || 0.55),
    ragOnlyMaxWords: Number(process.env.TINYMODEL_RAG_ONLY_MAX_WORDS || 14),
    catalog: catalog
  };
}

function resolveIntent(userText, plan) {
  if (plan && plan.intent === 'navigate') return 'navigate';
  if (plan && plan.intent === 'explain_screen') return 'explain_screen';
  if (plan && plan.intent === 'strategy_handshake') return 'strategy_handshake';
  return (plan && plan.intent) || 'chat';
}

function isSoftIntent(text) {
  return /\b(summarize|summary|rephrase|reformulate|shorter|brief version)\b/i.test(text);
}

function isComplexQuestion(text) {
  return isGeneralKnowledgeQuery(text) ||
    /\b(explain|why|how|compare|describe|difference|what is|walk me through|tell me about)\b/i.test(text) ||
    /\b(объясни|расскаж|что такое|как работает|кто такой|кто такая)\b/i.test(text) ||
    /\b(解释|介绍|是什么|如何|是谁)\b/i.test(text);
}

function isGeneralKnowledgeQuery(text) {
  return /\b(who is|who was|who are|what is|what was|when did|when was|when is|where is|where was)\b/i.test(text) ||
    /\b(кто такой|кто такая|кто был|что такое|когда|где находится)\b/i.test(text) ||
    /\b(是谁|什么是|什么时候|在哪里)\b/i.test(text);
}

function planNeedsGeneration(plan, userText, retrievalOk) {
  if (isGeneralKnowledgeQuery(userText)) return true;
  if (plan && plan.routing && plan.routing.fallback && !retrievalOk) return true;
  if (plan && plan.intent === 'chat' && !retrievalOk) return true;
  return false;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function buildGatewayOptions(config) {
  return modelRegistry.buildGatewayOptions(config.catalog || modelRegistry.loadModelCatalog());
}

function pickModelRoute(intent, lane, config, ctx) {
  ctx = ctx || {};
  if (lane === 'control') {
    if (config.navigateAck !== 'template') {
      return {
        model: config.navigateAck,
        gateway: buildGatewayOptions(config),
        maxOutputTokens: 120,
        tier: 'fast',
        model_reason: 'navigate_ack_model'
      };
    }
    return null;
  }

  var picked = modelRegistry.pickModelFromPlan({
    userText: ctx.userText || '',
    plan: ctx.plan,
    lane: lane,
    intent: intent,
    metaQuery: ctx.metaQuery,
    complexQuestion: ctx.complexQuestion,
    softIntent: ctx.softIntent || isSoftIntent(ctx.userText || '')
  });

  return {
    model: picked.model,
    gateway: picked.gateway,
    maxOutputTokens: picked.maxOutputTokens,
    tier: picked.tier,
    model_reason: picked.reason,
    tinymodel_signals: picked.signals
  };
}

/**
 * Decide if TinyModel can answer alone (template or corpus RAG) without Gateway.
 */
function canAnswerWithTinyModelOnly(ctx) {
  var userText = ctx.userText;
  var plan = ctx.plan;
  var actions = ctx.actions || [];
  var template = ctx.template;
  var retrievalOk = ctx.retrievalOk;

  if (ctx.handshake) return { yes: true, reason: 'sidecar_handshake' };
  if (actions.length && template) return { yes: true, reason: 'strategy_section_nav' };
  if (plan && plan.intent === 'navigate' && template) return { yes: true, reason: 'hsp_navigate_template' };

  if (planNeedsGeneration(plan, userText, retrievalOk)) {
    return { yes: false, reason: 'general_or_offtopic_needs_generation' };
  }

  if (retrievalOk && plan && plan.retrieval) {
    if (isComplexQuestion(userText)) {
      return { yes: false, reason: 'complex_question_needs_gateway' };
    }
    if (ctx.metaQuery) {
      return { yes: false, reason: 'composer_meta_needs_gateway' };
    }
    var overlap = typeof plan.retrieval.keyword_overlap === 'number'
      ? plan.retrieval.keyword_overlap
      : 0;
    if (overlap >= ctx.config.ragOnlyMinOverlap && wordCount(userText) <= ctx.config.ragOnlyMaxWords) {
      return { yes: true, reason: 'high_confidence_rag' };
    }
    if (plan.intent === 'chat' && plan.routing && plan.routing.fallback &&
        overlap >= ctx.config.ragOnlyMinOverlap && !isSoftIntent(userText)) {
      return { yes: true, reason: 'rag_fallback_chat' };
    }
  }

  return { yes: false, reason: 'needs_generation' };
}

/**
 * Compose routing decision for one turn.
 * @returns {object} turn plan with generator, lane, modelRoute, tinymodelOnly, reason
 */
function composeTurnRoute(ctx) {
  var config = ctx.config || defaultConfig();
  var userText = ctx.userText;
  var plan = ctx.plan;
  var actions = ctx.actions || [];
  var availability = ctx.availability || {};
  var intent = resolveIntent(userText, plan);
  var lane = 'grounded';
  var generator = 'vercel_ai';

  if (intent === 'navigate' || intent === 'strategy_handshake') {
    lane = 'control';
  } else if (isSoftIntent(userText)) {
    lane = 'soft';
  } else if (intent === 'explain_screen') {
    lane = 'grounded';
  }

  var tinymodelCheck = canAnswerWithTinyModelOnly({
    userText: userText,
    plan: plan,
    actions: actions,
    template: ctx.hasTemplate,
    retrievalOk: ctx.retrievalOk,
    handshake: ctx.handshake,
    metaQuery: ctx.metaQuery,
    config: config
  });

  if (tinymodelCheck.yes) {
    generator = 'tinymodel';
  } else if (availability.vercel_ai) {
    generator = 'vercel_ai';
  } else if (availability.openai) {
    generator = 'openai';
  } else if (availability.transmitter) {
    generator = 'transmitter';
  } else {
    generator = 'unconfigured';
  }

  var modelRoute = null;
  var routeCtx = {
    userText: userText,
    plan: plan,
    metaQuery: ctx.metaQuery,
    complexQuestion: isComplexQuestion(userText),
    softIntent: isSoftIntent(userText)
  };
  if (generator === 'vercel_ai' || generator === 'transmitter' || generator === 'openai') {
    modelRoute = pickModelRoute(intent, lane, config, routeCtx);
  }

  return {
    intent: intent,
    lane: lane,
    generator: generator,
    modelRoute: modelRoute,
    tinymodelOnly: generator === 'tinymodel',
    routeReason: tinymodelCheck.reason,
    config: config
  };
}

module.exports = {
  defaultConfig: defaultConfig,
  resolveIntent: resolveIntent,
  composeTurnRoute: composeTurnRoute,
  canAnswerWithTinyModelOnly: canAnswerWithTinyModelOnly,
  isComplexQuestion: isComplexQuestion,
  isGeneralKnowledgeQuery: isGeneralKnowledgeQuery,
  isSoftIntent: isSoftIntent,
  planNeedsGeneration: planNeedsGeneration,
  buildGatewayOptions: buildGatewayOptions,
  pickModelRoute: pickModelRoute
};
