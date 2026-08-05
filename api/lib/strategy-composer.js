/**
 * Strategy-site AI composer: TinyModel /v1/plan (control plane) + Vercel AI Gateway.
 */

var tinymodel = require('./tinymodel-client');
var composerRouter = require('./composer-router');
var wikiFallback = require('./wiki-fallback');
var freeLlm = require('./free-llm-fallback');
var strategyBriefs = require('./strategy-briefs');

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
  if (/\b(hsp|hyper\s*strategy)\b/i.test(m)) return 'architecture';
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

function isStrategyDomainQuery(text) {
  return /\b(tinymodel|sidecar|composer|hsp|hyper\s*strategy|hyperlinks|strategy site|ai core|roadmap|architecture|vercel|gateway|swap routing|guided tour|pillars?|revenue|moats?|north[\s-]?star|genesis|scale links|intellectual links|earth[\s&-]*space|founder|anriltine|phase\s*[1-4]|2040)\b/i.test(text) ||
    /\b(тайни|сайдкар|композер|архитект|дорожн|гипер\s*стратег|основател)\b/i.test(text);
}

function isHspOverviewQuery(text) {
  return /\b(hsp|hyper\s*strategy(\s*protocol)?)\b/i.test(text) &&
    (/\b(what|explain|describe|tell|about|overview|mean)\b/i.test(text) ||
      /\b(что такое|объясни|расскаж)\b/i.test(text));
}

function isGreetingOrIdentityQuery(text) {
  var t = String(text || '').trim();
  if (!t) return false;
  if (/^(hi|hello|hey|yo|sup|привет|здравствуй(те)?|хай|добрый\s+(день|вечер|утро)|你好|您好)[!?.]*$/i.test(t)) {
    return true;
  }
  return /^(who are you|what are you|what'?s your name|your name|кто ты|как тебя зовут|ты кто)[!?.]*$/i.test(t);
}

function templateGreetingOrIdentity(text) {
  var t = String(text || '').trim();
  if (/who are you|what are you|your name|кто ты|как тебя зовут|ты кто/i.test(t)) {
    return {
      output_text:
        "I'm **AI CORE** on this Hyperlinks Strategy site. I navigate strategy sections, answer from HSP / TinyModel docs, and can fetch live FX or general facts when useful. Try **open Roadmap**, **dollar rate**, or **what is TinyModel**.",
      actions: []
    };
  }
  return {
    output_text:
      "Hi — I'm **AI CORE** for this strategy page. Ask about **Architecture**, **Roadmap**, **HSP**, live **FX rates**, or say **guided tour**.",
    actions: []
  };
}

function templateHspOverview() {
  return {
    output_text:
      '**Hyper Strategy Protocol (HSP)** is the Hyperlinks program stack this strategy page describes: ' +
      'protocol pillars (MQTT / OPC / DTN / CRDT-style sync), Earth & Space markets, the Architecture transmitter/sidecar path, ' +
      'and the roadmap toward Links Space scale. On this site, AI CORE uses **TinyModel** for HSP corpus retrieval and section navigation. ' +
      'Say **open Architecture**, **open Pillars**, or **open Roadmap** to jump to the on-page narrative.',
    actions: [{ type: 'strategy_section', sectionId: 'architecture' }]
  };
}

function wrapStructuredAnswer(plan, planUsed, planError, answer, generator, extra) {
  return {
    ok: true,
    output_text: answer.output_text,
    actions: (extra && extra.actions) || [],
    provider: answer.provider || ('tinymodel-composer+' + generator),
    mode: 'chat',
    meta: composerMeta(plan, planUsed, planError, generator, extra || {})
  };
}

async function tryFastStructuredAnswer(userText, plan, planUsed, planError) {
  if (isGreetingOrIdentityQuery(userText)) {
    var greet = templateGreetingOrIdentity(userText);
    return {
      ok: true,
      output_text: greet.output_text,
      actions: greet.actions || [],
      provider: 'tinymodel-composer',
      mode: 'chat',
      meta: composerMeta(plan, planUsed, planError, 'greeting', {
        intent: 'chat',
        lane: 'soft',
        route_reason: 'fast_greeting'
      })
    };
  }

  // Site knowledge (help, section briefs, founder, phases) before Wikipedia / FX edge cases.
  try {
    var siteBrief = strategyBriefs.answerStrategyBrief(userText);
    if (siteBrief && siteBrief.ok) {
      return wrapStructuredAnswer(plan, planUsed, planError, siteBrief, siteBrief.provider || 'strategy_briefs', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_strategy_brief',
        model: siteBrief.model
      });
    }
  } catch (eBrief) { /* continue */ }

  // Currency / FX — skip TinyModel LLM wait entirely when possible.
  try {
    var fx = await wikiFallback.answerCurrencyRate(userText);
    if (fx && fx.ok) {
      return wrapStructuredAnswer(plan, planUsed, planError, fx, 'currency_rate_fallback', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_fx',
        model: fx.model
      });
    }
  } catch (e0) { /* continue */ }

  if (isHspOverviewQuery(userText)) {
    var hsp = templateHspOverview();
    return {
      ok: true,
      output_text: hsp.output_text,
      actions: hsp.actions || [],
      provider: 'tinymodel-composer',
      mode: 'chat',
      meta: composerMeta(plan, planUsed, planError, 'hsp_overview', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_hsp_overview'
      })
    };
  }

  if (isStrategyComposerMetaQuery(userText)) {
    var metaTpl = templateStrategyComposerMeta(userText);
    return {
      ok: true,
      output_text: metaTpl.output_text,
      actions: metaTpl.actions || [],
      provider: 'tinymodel-composer',
      mode: 'chat',
      meta: composerMeta(plan, planUsed, planError, 'strategy_meta', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_strategy_meta'
      })
    };
  }

  // General knowledge only — never Wikipedia-search HSP / TinyModel phrases (returns junk).
  if (composerRouter.isGeneralKnowledgeQuery(userText) &&
      !isStrategyDomainQuery(userText) &&
      !isGreetingOrIdentityQuery(userText)) {
    try {
      var wiki = await wikiFallback.answerGeneralKnowledge(userText);
      if (wiki && wiki.ok) {
        return wrapStructuredAnswer(plan, planUsed, planError, wiki, wiki.provider || 'wikipedia_fallback', {
          intent: 'chat',
          lane: 'grounded',
          route_reason: 'fast_wikipedia',
          model: wiki.model
        });
      }
    } catch (e1) { /* continue */ }
  }

  return null;
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

  // Site briefs first (sync) — help, section summaries, founder, phases, etc.
  try {
    var siteEarly = strategyBriefs.answerStrategyBrief(userText);
    if (siteEarly && siteEarly.ok) {
      var siteWrapped = wrapStructuredAnswer(null, false, null, siteEarly, siteEarly.provider || 'strategy_briefs', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_strategy_brief',
        model: siteEarly.model
      });
      siteWrapped.mode = payload.mode || 'chat';
      return siteWrapped;
    }
  } catch (eSite) { /* continue */ }

  // Fast structured answers (FX / Wikipedia / strategy meta) before slow LLM/plan when possible.
  // Skip TinyModel plan for pure FX + general knowledge to keep chat snappy under OpenAI quota.
  var earlyFast = null;
  if (isGreetingOrIdentityQuery(userText) ||
      isHspOverviewQuery(userText) ||
      wikiFallback.detectCurrencyQuery(userText) ||
      (composerRouter.isGeneralKnowledgeQuery(userText) && !isStrategyDomainQuery(userText))) {
    earlyFast = await tryFastStructuredAnswer(userText, null, false, null);
    if (earlyFast) {
      earlyFast.mode = payload.mode || 'chat';
      return earlyFast;
    }
  }

  // Local section navigation — no TinyModel round-trip needed.
  if (isNavigationLike(userText)) {
    var localSection = detectStrategySection(userText);
    if (localSection) {
      return {
        ok: true,
        output_text: templateNavigate(localSection),
        actions: [{ type: 'strategy_section', sectionId: localSection }],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(null, false, null, 'tinymodel', {
          intent: 'navigate',
          lane: 'control',
          route_reason: 'local_section_nav'
        })
      };
    }
    return {
      ok: true,
      output_text:
        'I could not match that to a section on this page. Available: **Vision**, **Pillars**, **Earth & Space**, **Roadmap**, ' +
        '**Architecture**, **Revenue**, **Moats**, **Genesis**, **Scale**, **Intellectual Links**, **North Star**. ' +
        'Try **open Roadmap** or **open Architecture**.',
      actions: [],
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(null, false, null, 'tinymodel', {
        intent: 'navigate',
        lane: 'control',
        route_reason: 'local_section_unknown'
      })
    };
  }

  // Strategy meta / soft summaries — skip plan when Gateway is unavailable (quota path).
  if (!generators.vercelAi && isStrategyComposerMetaQuery(userText)) {
    var earlyMeta = templateStrategyComposerMeta(userText);
    return {
      ok: true,
      output_text: earlyMeta.output_text,
      actions: earlyMeta.actions || [],
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(null, false, null, 'strategy_meta', {
        intent: 'chat',
        lane: 'grounded',
        route_reason: 'fast_meta_no_plan'
      })
    };
  }

  if (!generators.vercelAi && composerRouter.isSoftIntent(userText) && isStrategyDomainQuery(userText)) {
    var earlySoftSection = detectStrategySection(userText);
    if (earlySoftSection) {
      return {
        ok: true,
        output_text:
          'Here is a brief take on **' + earlySoftSection.replace(/-/g, ' ') + '**: open that section on this page for the full narrative, ' +
          'or ask a specific question about HSP, TinyModel, Architecture, or Revenue.',
        actions: [{ type: 'strategy_section', sectionId: earlySoftSection }],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(null, false, null, 'strategy_soft', {
          intent: 'chat',
          lane: 'soft',
          route_reason: 'fast_soft_no_plan'
        })
      };
    }
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

  if (isStrategyComposerMetaQuery(userText) && !generators.vercelAi) {
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
        route_reason: callLlm ? 'prefer_meta_over_quota_llm' : 'no_gateway_configured'
      })
    };
  }

  // Soft rephrase of strategy sections — don't burn OpenAI quota / Wikipedia junk when no Gateway.
  if (!generators.vercelAi && composerRouter.isSoftIntent(userText) && isStrategyDomainQuery(userText)) {
    var softSection = detectStrategySection(userText);
    if (softSection) {
      return {
        ok: true,
        output_text:
          'Here is a brief take on **' + softSection.replace(/-/g, ' ') + '**: open that section on this page for the full narrative, ' +
          'or ask a specific question about HSP, TinyModel, Architecture, or Revenue.',
        actions: [{ type: 'strategy_section', sectionId: softSection }],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'strategy_soft', {
          intent: 'chat',
          lane: 'soft',
          route_reason: 'fast_soft_strategy'
        })
      };
    }
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
    if (isGreetingOrIdentityQuery(userText)) {
      var greetUncfg = templateGreetingOrIdentity(userText);
      return {
        ok: true,
        output_text: greetUncfg.output_text,
        actions: greetUncfg.actions || [],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'greeting', {
          intent: turnRoute.intent,
          lane: 'soft',
          route_reason: 'no_llm_greeting'
        })
      };
    }
    if (isHspOverviewQuery(userText)) {
      var hspUncfg = templateHspOverview();
      return {
        ok: true,
        output_text: hspUncfg.output_text,
        actions: hspUncfg.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'hsp_overview', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'no_llm_hsp'
        })
      };
    }
    if (composerRouter.isGeneralKnowledgeQuery(userText) &&
        !isStrategyDomainQuery(userText) &&
        !isGreetingOrIdentityQuery(userText)) {
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
    if (isGreetingOrIdentityQuery(userText)) {
      var greetNoCaller = templateGreetingOrIdentity(userText);
      return {
        ok: true,
        output_text: greetNoCaller.output_text,
        actions: greetNoCaller.actions || [],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'greeting', {
          intent: turnRoute.intent,
          lane: 'soft',
          route_reason: 'gateway_unavailable_greeting'
        })
      };
    }
    if (isHspOverviewQuery(userText)) {
      var hspNoCaller = templateHspOverview();
      return {
        ok: true,
        output_text: hspNoCaller.output_text,
        actions: hspNoCaller.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'hsp_overview', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'gateway_unavailable_hsp'
        })
      };
    }
    if (composerRouter.isGeneralKnowledgeQuery(userText) &&
        !isStrategyDomainQuery(userText) &&
        !isGreetingOrIdentityQuery(userText)) {
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

  // No Vercel Gateway: OpenAI quota is exhausted on this deploy — skip the slow fail for strategy asks.
  if (isStrategyDomainQuery(userText) && !generators.vercelAi) {
    if (retrievalOk && plan && plan.retrieval && plan.retrieval.chunk_preview) {
      var skipTitle = plan.retrieval.top_title ? '**' + plan.retrieval.top_title + '**\n\n' : '';
      return {
        ok: true,
        output_text: skipTitle + String(plan.retrieval.chunk_preview).trim(),
        actions: actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'retrieval_fast', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'skip_quota_llm'
        })
      };
    }
    try {
      var briefSkip = strategyBriefs.answerStrategyBrief(userText);
      if (!briefSkip) {
        var sid = strategyBriefs.detectSectionId(userText);
        if (sid && strategyBriefs.SECTION_BRIEFS[sid]) {
          briefSkip = {
            ok: true,
            output_text: strategyBriefs.SECTION_BRIEFS[sid].text,
            provider: 'strategy_briefs',
            model: 'site-section-brief',
            actions: [{ type: 'strategy_section', sectionId: sid }]
          };
        }
      }
      if (briefSkip && briefSkip.ok) {
        return {
          ok: true,
          output_text: briefSkip.output_text,
          actions: briefSkip.actions || actions,
          provider: 'tinymodel-composer+' + (briefSkip.provider || 'strategy_briefs'),
          mode: payload.mode || 'chat',
          meta: composerMeta(plan, planUsed, planError, 'strategy_briefs', {
            intent: turnRoute.intent,
            lane: turnRoute.lane,
            route_reason: 'skip_quota_brief'
          })
        };
      }
    } catch (eSkipBrief) { /* continue */ }
    if (template) {
      return {
        ok: true,
        output_text: template.output_text,
        actions: template.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'template', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'skip_quota_llm'
        })
      };
    }
    var skipFb = genericStrategyFallback(userText);
    return {
      ok: true,
      output_text: skipFb.output_text,
      actions: skipFb.actions || actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: composerMeta(plan, planUsed, planError, 'strategy_fallback', {
        intent: turnRoute.intent,
        lane: turnRoute.lane,
        route_reason: 'skip_quota_llm'
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
    var isQuotaError = /quota|billing|rate.limit|insufficient/i.test(String(llmResult.error || ''));

    // Wikipedia / FX only for factoid asks — creative generation goes to free LLM next.
    if (!isStrategyDomainQuery(userText) && !isGreetingOrIdentityQuery(userText) &&
        composerRouter.isGeneralKnowledgeQuery(userText)) {
      try {
        var wiki = await wikiFallback.answerGeneralKnowledge(userText);
        if (wiki && wiki.ok) {
          return {
            ok: true,
            output_text: wiki.output_text,
            actions: actions,
            provider: 'tinymodel-composer+' + (wiki.provider === 'currency_rate_fallback' ? 'fx' : 'wikipedia'),
            mode: payload.mode || 'chat',
            meta: composerMeta(plan, planUsed, planError, wiki.provider || 'wikipedia_fallback', {
              intent: turnRoute.intent,
              lane: turnRoute.lane,
              route_reason: turnRoute.routeReason,
              llm_error: llmResult.error,
              llm_provider: llmName,
              model: wiki.model
            })
          };
        }
      } catch (wikiErr) { /* continue */ }
    } else if (isGreetingOrIdentityQuery(userText)) {
      var greetFail = templateGreetingOrIdentity(userText);
      return {
        ok: true,
        output_text: greetFail.output_text,
        actions: greetFail.actions || [],
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'greeting', {
          intent: turnRoute.intent,
          lane: 'soft',
          route_reason: 'llm_fail_greeting',
          llm_error: llmResult.error
        })
      };
    } else if (isHspOverviewQuery(userText)) {
      var hspFail = templateHspOverview();
      return {
        ok: true,
        output_text: hspFail.output_text,
        actions: hspFail.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'hsp_overview', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'llm_fail_hsp',
          llm_error: llmResult.error
        })
      };
    } else if (isStrategyComposerMetaQuery(userText)) {
      var metaFail = templateStrategyComposerMeta(userText);
      return {
        ok: true,
        output_text: metaFail.output_text,
        actions: metaFail.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'strategy_meta', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: 'llm_fail_meta',
          llm_error: llmResult.error
        })
      };
    }

    if (retrievalIsRelevant(plan, userText) && plan && plan.retrieval && plan.retrieval.chunk_preview) {
      var softTitle = plan.retrieval.top_title ? '**' + plan.retrieval.top_title + '**\n\n' : '';
      return {
        ok: true,
        output_text: softTitle + String(plan.retrieval.chunk_preview).trim(),
        actions: actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: composerMeta(plan, planUsed, planError, 'retrieval_quota_fallback', {
          intent: turnRoute.intent,
          lane: turnRoute.lane,
          route_reason: turnRoute.routeReason,
          llm_error: llmResult.error,
          llm_provider: llmName
        })
      };
    }

    try {
      var briefFail = strategyBriefs.answerStrategyBrief(userText);
      if (!briefFail) {
        var sidFail = strategyBriefs.detectSectionId(userText);
        if (sidFail && strategyBriefs.SECTION_BRIEFS[sidFail]) {
          briefFail = {
            ok: true,
            output_text: strategyBriefs.SECTION_BRIEFS[sidFail].text,
            actions: [{ type: 'strategy_section', sectionId: sidFail }]
          };
        }
      }
      if (briefFail && briefFail.ok) {
        return {
          ok: true,
          output_text: briefFail.output_text,
          actions: briefFail.actions || actions,
          provider: 'tinymodel-composer+strategy_briefs',
          mode: payload.mode || 'chat',
          meta: composerMeta(plan, planUsed, planError, 'strategy_briefs', {
            intent: turnRoute.intent,
            lane: turnRoute.lane,
            route_reason: 'llm_fail_brief',
            llm_error: llmResult.error
          })
        };
      }
    } catch (eBriefFail) { /* continue */ }

    if (!isStrategyDomainQuery(userText)) {
      try {
        var free = await freeLlm.generate(userText, systemParts.filter(Boolean).join('\n\n').slice(0, 400));
        if (free && free.ok && free.output_text) {
          return {
            ok: true,
            output_text: free.output_text,
            actions: actions,
            provider: 'tinymodel-composer+free_llm',
            mode: payload.mode || 'chat',
            meta: composerMeta(plan, planUsed, planError, 'free_llm_fallback', {
              intent: turnRoute.intent,
              lane: turnRoute.lane,
              route_reason: turnRoute.routeReason,
              llm_error: llmResult.error,
              llm_provider: llmName,
              model: free.model
            })
          };
        }
      } catch (freeErr) { /* continue */ }
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

    var softError =
      'I could not reach a generative model right now' +
      (isQuotaError ? ' (cloud LLM quota exhausted)' : '') +
      '. Strategy navigation still works — try open Roadmap, guided tour, or ask about Architecture / dollar rate. ' +
      'To restore generative chat, add OpenAI credits or set AI_GATEWAY_API_KEY on Vercel.';

    var fbSoft = genericStrategyFallback(userText);
    return {
      ok: true,
      output_text: softError + (fbSoft && fbSoft.output_text ? '\n\n' + fbSoft.output_text : ''),
      actions: (fbSoft && fbSoft.actions) || actions,
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
      model_tier: modelRoute.tier || null,
      model_reason: modelRoute.model_reason || null,
      model_attempts: llmResult.model_attempts || 1,
      gateway: !!llmResult.gateway,
      gateway_fallbacks: modelRoute.gateway && modelRoute.gateway.models
    })
  };
}

module.exports = {
  extractUserMessage: extractUserMessage,
  detectStrategySection: detectStrategySection,
  composeStrategyTurn: composeStrategyTurn
};
