/**
 * Strategy-site AI composer: TinyModel /v1/plan (control plane) + Vercel AI Gateway.
 */

var tinymodel = require('./tinymodel-client');
var composerRouter = require('./composer-router');
var wikiFallback = require('./wiki-fallback');

var SECTION_HINTS = [
  { id: 'roadmap', re: /\b(roadmap|road map|phase|timeline|trillion|bootstrap)\b/i },
  { id: 'vision', re: /\b(vision|paradigm|executive|shift|summary)\b/i },
  { id: 'pillars', re: /\b(pillar|protocol|mqtt|opc|dtn|crdt|stack)\b/i },
  { id: 'earth-space', re: /\b(earth|space|market|dual|lunar|matrix)\b/i },
  { id: 'architecture', re: /\b(architecture|arch|tinymodel|transmitter|hsp|layer|sidecar|composer)\b/i },
  { id: 'revenue', re: /\b(revenue|monet|income|saas|freight)\b/i },
  { id: 'moats', re: /\b(moat|advantage|competitive|lock-in)\b/i },
  { id: 'genesis-links', re: /\b(genesis|links space|anriltine|founder|peer|replica)\b/i },
  { id: 'scale-links', re: /\b(scale|federation|planetary|1t)\b/i },
  { id: 'intellectual-links', re: /\b(intellectual|neural|synapse|brain|mind)\b/i },
  { id: 'north-star', re: /\b(north star|north-star|mission|2040|infrastructure)\b/i }
];

function extractUserMessage(input) {
  var marker = '\n\nCurrent message:\nuser: ';
  var idx = input.lastIndexOf(marker);
  if (idx >= 0) return input.slice(idx + marker.length).trim();

  var lines = input.split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    if (lines[i].indexOf('user: ') === 0) {
      return lines[i].slice(6).trim();
    }
  }
  return String(input || '').trim();
}

function detectStrategySection(text) {
  var m = String(text || '').trim();
  if (!m) return null;
  for (var i = 0; i < SECTION_HINTS.length; i++) {
    if (SECTION_HINTS[i].re.test(m)) return SECTION_HINTS[i].id;
  }
  return null;
}

function mapPlanContext(clientContext) {
  if (!clientContext || typeof clientContext !== 'object') return undefined;
  return {
    locale: clientContext.locale,
    route: clientContext.route,
    surface: clientContext.surface || 'strategy-site',
    visible_section: clientContext.visible_section,
    tour_active: clientContext.tour_active
  };
}

/** Inputs handled locally by ai-core (tour, chips, section labels) — skip sidecar plan. */
function isLocalOnlyStrategyInput(text) {
  return /\b(tour|guided tour|walk me|quick tour|overview|current section|where am i)\b/i.test(text) ||
    /\b(экскурс|обзор|текущ|где я)\b/i.test(text) ||
    /\b(导览|引导游览|概览|当前章节|我在哪)\b/i.test(text);
}

function templateNavigate(sectionId) {
  var label = sectionId.replace(/-/g, ' ');
  return 'Opening the ' + label + ' section of the strategy…';
}

function templateHspNavigate(action) {
  if (action.type === 'navigate' && action.path) {
    return (
      'That opens **' + action.path + '** inside Hyperlinks Space Program (HSP), not this strategy site. ' +
      'Use hyperlinks.space for the live app—or ask me about **Architecture** or **Roadmap** here.'
    );
  }
  if (action.type === 'feature' && action.id) {
    return (
      '**' + action.id.replace(/_/g, ' ') + '** is an in-app HSP feature. ' +
      'I can explain it from program docs, or scroll to **Architecture** on this strategy page.'
    );
  }
  return 'That action applies inside Hyperlinks Space Program.';
}

function buildRagBlock(plan) {
  if (!plan || !plan.retrieval) return '';
  var r = plan.retrieval;
  var parts = ['Grounding from Hyperlinks Space program documentation:'];
  if (r.top_title) parts.push('Topic: ' + r.top_title);
  if (r.chunk_preview) parts.push(r.chunk_preview);
  return parts.join('\n');
}

function buildPlanContextBlock(plan) {
  if (!plan) return '';
  var lines = ['TinyModel plan summary:'];
  if (plan.intent) lines.push('- intent: ' + plan.intent);
  if (plan.route_hint) lines.push('- route_hint: ' + plan.route_hint);
  if (plan.routing) {
    lines.push(
      '- routing: fallback=' + !!plan.routing.fallback +
      (plan.routing.reason ? ', reason=' + plan.routing.reason : '')
    );
  }
  return lines.join('\n');
}

function isNavigationLike(text) {
  return /\b(open|show|go to|go|navigate|scroll|take me|visit|section|покаж|откр|перей|打开|去)\b/i.test(text);
}

function minRetrievalOverlap() {
  var n = Number(process.env.TINYMODEL_MIN_KEYWORD_OVERLAP || 0.35);
  return Number.isFinite(n) ? n : 0.35;
}

/** Reject HSP corpus chunks that do not match the user's question (common without OpenAI). */
function retrievalIsRelevant(plan, userText) {
  if (!plan || !plan.retrieval || !plan.retrieval.chunk_preview) return false;
  var r = plan.retrieval;
  var overlap = typeof r.keyword_overlap === 'number' ? r.keyword_overlap : 1;
  if (overlap < minRetrievalOverlap()) return false;

  var chunk = ((r.top_title || '') + ' ' + r.chunk_preview).toLowerCase();
  if (/\b(tinymodel|composer|sidecar|strategy site|ai core|this site)\b/i.test(userText)) {
    if (!/\b(tinymodel|composer|sidecar|architecture|transmitter|strategy|ai core|edge|partition)\b/i.test(chunk)) {
      return false;
    }
  }
  return true;
}

function isStrategyComposerMetaQuery(text) {
  return /\b(tinymodel|sidecar|composer|control plane|\/api\/ai|ai core)\b/i.test(text) &&
    (/\b(explain|what|how|describe|work|wired|flow|strategy site|this site|on this site)\b/i.test(text) ||
      /\b(на этом сайте|как работает|объясни)\b/i.test(text) ||
      /\b(这个网站|如何工作|解释)\b/i.test(text));
}

function isSidecarHandshakeQuery(text) {
  return /\b(?:sidecar\s+)?(?:ping|handshake)\b/i.test(text) &&
    (/\b(strategy|ai[\s\-]?core)\b/i.test(text) || /\bsidecar\s+ping\b/i.test(text));
}

function composeSidecarHandshake(plan) {
  var reply = (plan && (plan.reply_text ||
    (plan.retrieval && plan.retrieval.chunk_preview))) || '';
  reply = String(reply || '').trim();
  if (!reply || reply.indexOf('TM1-SIDECAR-OK') < 0) {
    return null;
  }
  return {
    ok: true,
    output_text: reply,
    actions: [],
    provider: 'tinymodel-sidecar',
    mode: 'chat',
    meta: Object.assign(composerMeta(plan, true, null, 'sidecar_handshake'), {
      sidecar_verified: true,
      handshake_token: 'TM1-SIDECAR-OK'
    })
  };
}

function strategyMetaContextBlock() {
  return [
    'Strategy site wiring (use for factual answers):',
    '- Browser AI CORE → POST /api/ai (Vercel serverless on this repo)',
    '- Composer → TinyModel HyperlinksSpace/TinyModel1 at tinymodel.hyperlinks.space via POST /v1/plan',
    '- Plan yields intent, HSP corpus retrieval, route hints; section nav returns strategy_section actions',
    '- Client scrolls with presentSection; tour/chips/section labels stay local in ai-core.js',
    '- Hybrid mode: TinyModel plan + Vercel AI generation (priority over legacy OpenAI fetch)'
  ].join('\n');
}

function templateStrategyComposerMeta(userText) {
  var actions = [];
  if (isNavigationLike(userText) && detectStrategySection(userText) === 'architecture') {
    actions = [{ type: 'strategy_section', sectionId: 'architecture' }];
  }
  var openHint = actions.length
    ? 'Opening **Architecture** for the on-page stack diagram.'
    : 'Say **open Architecture** to see the stack diagram on this page.';

  return {
    output_text:
      'On this strategy site, AI CORE chat posts to **POST /api/ai** (Vercel serverless). ' +
      'The composer calls **TinyModel** (`HyperlinksSpace/TinyModel1` at tinymodel.hyperlinks.space) via **POST /v1/plan** ' +
      'for intent classification, HSP corpus retrieval, and route hints. ' +
      'Section navigation returns `strategy_section` actions; the browser scrolls with `presentSection`. ' +
      'Hybrid mode enriches replies with OpenAI when configured; otherwise template + retrieval grounding is used. ' +
      openHint,
    actions: actions
  };
}

function genericStrategyFallback(userText) {
  var sectionId = detectStrategySection(userText);
  if (sectionId && !isNavigationLike(userText)) {
    return {
      output_text:
        'I can open **' + sectionId.replace(/-/g, ' ') + '** on this strategy page—say "open ' +
        sectionId.replace(/-/g, ' ') + '". Or try **guided tour**, **Architecture**, or ask about HSP, TinyModel, or the roadmap.',
      actions: []
    };
  }
  return {
    output_text:
      'I can navigate strategy sections (Vision, Pillars, Roadmap, Architecture, Revenue, Moats, …), ' +
      'run a **guided tour**, or answer from TinyModel + HSP docs. Try "open Roadmap" or "explain TinyModel sidecar composer".',
    actions: []
  };
}

function composerMeta(plan, planUsed, planError, generator, extra) {
  var meta = {
    composer: 'strategy',
    plan_used: planUsed,
    plan_error: planError,
    generator: generator || undefined,
    tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : { error: planError || 'plan_unavailable' }
  };
  if (extra) {
    Object.keys(extra).forEach(function (k) { meta[k] = extra[k]; });
  }
  return meta;
}

function strategyActionsFromPlan(plan, userText) {
  var sectionId = detectStrategySection(userText);
  if (sectionId && isNavigationLike(userText)) {
    return [{ type: 'strategy_section', sectionId: sectionId }];
  }

  if (plan && plan.intent === 'navigate' && plan.actions && plan.actions.length) {
    if (/\b(tinymodel|sidecar|composer|transmitter)\b/i.test(userText) && isNavigationLike(userText)) {
      return [{ type: 'strategy_section', sectionId: 'architecture' }];
    }
  }

  return [];
}

function composeTemplate(plan, userText, actions) {
  if (actions.length && actions[0].type === 'strategy_section') {
    return {
      output_text: templateNavigate(actions[0].sectionId),
      actions: actions
    };
  }

  if (plan && plan.intent === 'navigate' && plan.actions && plan.actions.length) {
    return {
      output_text: templateHspNavigate(plan.actions[0]),
      actions: []
    };
  }

  if (plan && retrievalIsRelevant(plan, userText)) {
    var title = plan.retrieval.top_title ? '**' + plan.retrieval.top_title + '**\n\n' : '';
    return {
      output_text: title + plan.retrieval.chunk_preview.trim(),
      actions: actions
    };
  }

  return null;
}

async function composeStrategyTurn(payload, generators) {
  var vercelAi = require('./vercel-ai-client');
  generators = generators || {};
  var input = typeof payload.input === 'string' ? payload.input.trim() : '';
  var instructions = typeof payload.instructions === 'string' ? payload.instructions : '';
  var userText = extractUserMessage(input);
  var provider = (process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();
  var llm = vercelAi.resolveGenerationCaller(generators);
  var callLlm = llm ? llm.fn : null;
  var llmName = llm ? llm.name : null;

  if (isLocalOnlyStrategyInput(userText)) {
    return {
      ok: false,
      error: 'local_only_intent',
      provider: 'strategy-local',
      mode: payload.mode || 'chat',
      meta: { composer: 'strategy', defer: 'local', reason: 'tour_or_chip_intent' }
    };
  }

  var plan = null;
  var planUsed = false;
  var planError = null;

  if (provider !== 'openai') {
    try {
      plan = await tinymodel.planRequest(userText, {
        context: mapPlanContext(payload.context)
      });
      planUsed = true;
    } catch (err) {
      planError = String(err && err.message ? err.message : err);
    }
  }

  var actions = strategyActionsFromPlan(plan, userText);

  if (plan && (plan.intent === 'strategy_handshake' || isSidecarHandshakeQuery(userText))) {
    var handshake = composeSidecarHandshake(plan);
    if (handshake) {
      handshake.mode = payload.mode || 'chat';
      return handshake;
    }
    if (isSidecarHandshakeQuery(userText)) {
      return {
        ok: true,
        output_text:
          'Sidecar handshake failed: TinyModel plan did not return TM1-SIDECAR-OK. ' +
          (planError ? ('Error: ' + planError) : 'Redeploy tinymodel.hyperlinks.space and retry "sidecar ping".'),
        actions: [],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'sidecar_handshake_failed')
      };
    }
  }

  if (isStrategyComposerMetaQuery(userText) && !callLlm && !generators.vercelAi) {
    var metaTplOnly = templateStrategyComposerMeta(userText);
    return {
      ok: true,
      output_text: metaTplOnly.output_text,
      actions: metaTplOnly.actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'strategy_meta', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'no_gateway_configured'
      })
    };
  }

  var template = composeTemplate(plan, userText, actions);
  var retrievalOk = !!(plan && retrievalIsRelevant(plan, userText));
  var availability = vercelAi.resolveAvailability(generators);
  var turnRoute = composerRouter.composeTurnRoute({
    userText: userText,
    plan: plan,
    actions: actions,
    hasTemplate: !!template,
    retrievalOk: retrievalOk,
    handshake: false,
    metaQuery: isStrategyComposerMetaQuery(userText),
    availability: availability
  });

  llm = vercelAi.resolveGenerationCaller(generators, turnRoute);
  callLlm = llm ? llm.fn : null;
  llmName = llm ? llm.name : null;

  if (turnRoute.generator === 'tinymodel' && template) {
    return {
      ok: true,
      output_text: template.output_text,
      actions: template.actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'tinymodel', {
        intent: turnRoute.intent,
        lane: turnRoute.lane,
        route_reason: turnRoute.routeReason,
        model: null
      })
    };
  }

  if (turnRoute.generator === 'tinymodel' && !template) {
    var noLlmTpl = genericStrategyFallback(userText);
    return {
      ok: true,
      output_text: noLlmTpl.output_text,
      actions: noLlmTpl.actions || actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'strategy_fallback', {
        intent: turnRoute.intent,
        lane: turnRoute.lane,
        route_reason: turnRoute.routeReason
      })
    };
  }

  if (turnRoute.generator === 'unconfigured') {
    if (composerRouter.isGeneralKnowledgeQuery(userText)) {
      try {
        var wikiOnly = await wikiFallback.answerGeneralKnowledge(userText);
        if (wikiOnly && wikiOnly.ok) {
          return {
            ok: true,
            output_text: wikiOnly.output_text,
            actions: actions,
            provider: 'tinymodel-composer+wikipedia',
            mode: payload.mode || 'chat',
            meta: composerMeta(plan, planUsed, planError, 'wikipedia_fallback', {
              intent: turnRoute.intent,
              lane: turnRoute.lane,
              route_reason: 'no_llm_configured'
            })
          };
        }
      } catch (e) { /* fall through */ }
    }
    var unconfiguredText =
      'General chat needs an LLM on this deploy. Set **OPENAI** or **AI_GATEWAY_API_KEY** on Vercel ' +
      '(TinyModel still handles section navigation and the sidecar handshake).';
    return {
      ok: true,
      error: 'ai_not_configured',
      output_text: unconfiguredText,
      actions: [],
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'unconfigured', {
        intent: turnRoute.intent,
        lane: turnRoute.lane,
        route_reason: turnRoute.routeReason
      })
    };
  }

  if (!callLlm) {
    if (composerRouter.isGeneralKnowledgeQuery(userText)) {
      try {
        var wikiNoCaller = await wikiFallback.answerGeneralKnowledge(userText);
        if (wikiNoCaller && wikiNoCaller.ok) {
          return {
            ok: true,
            output_text: wikiNoCaller.output_text,
            actions: actions,
            provider: 'tinymodel-composer+wikipedia',
            mode: payload.mode || 'chat',
            meta: composerMeta(plan, planUsed, planError, 'wikipedia_fallback', {
              intent: turnRoute.intent,
              lane: turnRoute.lane,
              route_reason: 'gateway_unavailable'
            })
          };
        }
      } catch (e2) { /* fall through */ }
    }
    var noLlm = template || genericStrategyFallback(userText);
    return {
      ok: true,
      output_text: noLlm.output_text,
      actions: noLlm.actions || actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, template ? 'template' : 'strategy_fallback', {
        intent: turnRoute.intent,
        lane: turnRoute.lane,
        route_reason: 'gateway_unavailable'
      })
    };
  }

  var systemParts = [];
  if (instructions) systemParts.push(instructions);
  systemParts.push(
    'You are wired to TinyModel (HyperlinksSpace/TinyModel1) as control-plane composer for this strategy site. ' +
    'Prefer concise executive answers. When plan suggests HSP in-app navigation, clarify it applies to hyperlinks.space; ' +
    'offer relevant strategy sections (Vision, Architecture, Roadmap, etc.) when helpful.'
  );
  systemParts.push(strategyMetaContextBlock());
  systemParts.push(buildPlanContextBlock(plan));
  var rag = buildRagBlock(plan);
  if (rag && retrievalOk) systemParts.push(rag);

  var modelRoute = turnRoute.modelRoute || {};
  var llmResult = await callLlm(
    input,
    systemParts.filter(Boolean).join('\n\n'),
    {
      model: modelRoute.model || vercelAi.defaultQualityModel(),
      maxOutputTokens: modelRoute.maxOutputTokens || 900,
      gateway: modelRoute.gateway
    }
  );
  if (!llmResult.ok) {
    if (composerRouter.isGeneralKnowledgeQuery(userText)) {
      try {
        var wiki = await wikiFallback.answerGeneralKnowledge(userText);
        if (wiki && wiki.ok) {
          return {
            ok: true,
            output_text: wiki.output_text,
            actions: actions,
            provider: 'tinymodel-composer+wikipedia',
            mode: payload.mode || 'chat',
            meta: composerMeta(plan, planUsed, planError, 'wikipedia_fallback', {
              intent: turnRoute.intent,
              lane: turnRoute.lane,
              route_reason: turnRoute.routeReason,
              llm_error: llmResult.error,
              llm_provider: llmName,
              model: wiki.model
            })
          };
        }
      } catch (wikiErr) {
        // fall through to template / explicit error
      }
    }

    if (template) {
      return {
        ok: true,
        output_text: template.output_text,
        actions: template.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'template_fallback', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: turnRoute.routeReason,
          llm_error: llmResult.error,
          llm_provider: llmName,
          model: modelRoute.model
        })
      };
    }

    if (composerRouter.isGeneralKnowledgeQuery(userText) || composerRouter.planNeedsGeneration(plan, userText, retrievalOk)) {
      return {
        ok: true,
        output_text:
          'I could not generate an answer right now (' +
          String(llmResult.error || 'llm_unavailable') +
          '). Strategy navigation still works — try **open Roadmap** or **guided tour**.',
        actions: actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'llm_error', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: turnRoute.routeReason,
          llm_error: llmResult.error,
          llm_provider: llmName,
          model: modelRoute.model
        })
      };
    }

    var fb = genericStrategyFallback(userText);
    return {
      ok: true,
      output_text: fb.output_text,
      actions: fb.actions || actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'strategy_fallback', {
        llm_error: llmResult.error
      })
    };
  }

  return {
    ok: true,
    output_text: llmResult.output_text,
    actions: actions,
    provider: llmName === 'vercel_ai' ? 'tinymodel-composer+vercel_ai' : 'tinymodel-composer+openai',
    mode: payload.mode || 'chat',
    meta: composerMeta(plan, planUsed, planError, llmName, {
      intent: turnRoute.intent,
      lane: turnRoute.lane,
      route_reason: turnRoute.routeReason,
      model: llmResult.model || modelRoute.model,
      gateway: !!llmResult.gateway
    })
  };
}

module.exports = {
  extractUserMessage: extractUserMessage,
  detectStrategySection: detectStrategySection,
  composeStrategyTurn: composeStrategyTurn
};
