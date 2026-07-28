/**
 * Strategy composer router — TinyModel plan → lane → generator decision.
 * Mirrors TinyModel integrations/hsp/reference/composer.ts (Strategy subset).
 *
 * generator:
 *   tinymodel  — template ack, sidecar handshake, or direct RAG (no Gateway call)
 *   vercel_ai  — Vercel AI Gateway generateText with modelRoute
 *   openai     — legacy direct OpenAI (fallback)
 */

function defaultConfig() {
  return {
    qualityModel: (process.env.AI_COMPOSER_QUALITY_MODEL || 'openai/gpt-4o-mini').trim(),
    fastModel: (process.env.AI_COMPOSER_FAST_MODEL || 'openai/gpt-4.1-nano').trim(),
    navigateAck: (process.env.AI_COMPOSER_NAVIGATE_ACK || 'template').trim(),
    gatewayOrder: (process.env.AI_GATEWAY_ORDER || 'openai,anthropic,google')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    gatewayFallbackModels: (process.env.AI_GATEWAY_FALLBACK_MODELS ||
      'google/gemini-2.0-flash,anthropic/claude-3-5-haiku-latest')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    ragOnlyMinOverlap: Number(process.env.TINYMODEL_RAG_ONLY_MIN_OVERLAP || 0.55),
    ragOnlyMaxWords: Number(process.env.TINYMODEL_RAG_ONLY_MAX_WORDS || 14)
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
  return /\b(who is|who was|who are|what is|what was|when did|when was|where is|where was)\b/i.test(text) ||
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
  return {
    order: config.gatewayOrder,
    models: config.gatewayFallbackModels
  };
}

function pickModelRoute(intent, lane, config) {
  var gateway = buildGatewayOptions(config);
  if (lane === 'soft') {
    return { model: config.fastModel, gateway: gateway, maxOutputTokens: 600 };
  }
  if (lane === 'control') {
    if (config.navigateAck !== 'template') {
      return { model: config.navigateAck, gateway: gateway, maxOutputTokens: 120 };
    }
    return null;
  }
  if (intent === 'explain_screen' || (lane === 'grounded' && isComplexQuestion(''))) {
    return { model: config.qualityModel, gateway: gateway, maxOutputTokens: 1200 };
  }
  return { model: config.qualityModel, gateway: gateway, maxOutputTokens: 900 };
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
  if (generator === 'vercel_ai' || generator === 'transmitter' || generator === 'openai') {
    modelRoute = pickModelRoute(intent, lane, config);
    if (isComplexQuestion(userText) || intent === 'explain_screen' || ctx.metaQuery) {
      modelRoute = Object.assign({}, modelRoute, {
        model: config.qualityModel,
        maxOutputTokens: 1200
      });
    } else if (lane === 'soft') {
      modelRoute = Object.assign({}, modelRoute, {
        model: config.fastModel,
        maxOutputTokens: 600
      });
    }
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
  planNeedsGeneration: planNeedsGeneration,
  buildGatewayOptions: buildGatewayOptions
};
