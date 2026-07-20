/**
 * Strategy-site AI composer: TinyModel /v1/plan (control plane) + OpenAI (generation).
 */

var tinymodel = require('./tinymodel-client');

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
    surface: clientContext.surface || 'strategy-site'
  };
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

function strategyActionsFromPlan(plan, userText) {
  var sectionId = detectStrategySection(userText);
  if (sectionId) {
    return [{ type: 'strategy_section', sectionId: sectionId }];
  }

  if (plan && plan.intent === 'navigate' && plan.actions && plan.actions.length) {
    var arch = detectStrategySection('architecture tinymodel');
    if (/\b(tinymodel|sidecar|composer|transmitter)\b/i.test(userText)) {
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

  if (plan && plan.retrieval && plan.retrieval.chunk_preview) {
    var title = plan.retrieval.top_title ? '**' + plan.retrieval.top_title + '**\n\n' : '';
    return {
      output_text: title + plan.retrieval.chunk_preview.trim(),
      actions: actions
    };
  }

  return null;
}

async function composeStrategyTurn(payload, callOpenAi) {
  var input = typeof payload.input === 'string' ? payload.input.trim() : '';
  var instructions = typeof payload.instructions === 'string' ? payload.instructions : '';
  var userText = extractUserMessage(input);
  var provider = (process.env.AI_PROVIDER || 'hybrid').trim().toLowerCase();

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
  var template = composeTemplate(plan, userText, actions);
  if (template && (!callOpenAi || provider === 'tinymodel')) {
    return {
      ok: true,
      output_text: template.output_text,
      actions: template.actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: {
        composer: 'strategy',
        plan_used: planUsed,
        plan_error: planError,
        tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : { error: planError || 'plan_unavailable' }
      }
    };
  }

  if (template && provider === 'hybrid' && actions.length) {
    return {
      ok: true,
      output_text: template.output_text,
      actions: actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      meta: {
        composer: 'strategy',
        plan_used: planUsed,
        generator: 'template',
        tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : null
      }
    };
  }

  if (!callOpenAi) {
    var fallback = template || {
      output_text: 'TinyModel plan is unavailable and OPENAI is not configured on this server.',
      actions: actions
    };
    return {
      ok: !!template,
      output_text: fallback.output_text,
      actions: fallback.actions || actions,
      provider: 'tinymodel-composer',
      mode: payload.mode || 'chat',
      error: template ? undefined : 'AI not configured',
      meta: {
        composer: 'strategy',
        plan_used: planUsed,
        plan_error: planError,
        tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : { error: planError || 'plan_unavailable' }
      }
    };
  }

  var systemParts = [];
  if (instructions) systemParts.push(instructions);
  systemParts.push(
    'You are wired to TinyModel (HyperlinksSpace/TinyModel1) as control-plane composer for this strategy site. ' +
    'Prefer concise executive answers. When plan suggests HSP in-app navigation, clarify it applies to hyperlinks.space; ' +
    'offer relevant strategy sections (Vision, Architecture, Roadmap, etc.) when helpful.'
  );
  systemParts.push(buildPlanContextBlock(plan));
  var rag = buildRagBlock(plan);
  if (rag) systemParts.push(rag);

  var openAi = await callOpenAi(input, systemParts.filter(Boolean).join('\n\n'));
  if (!openAi.ok) {
    if (template) {
      return {
        ok: true,
        output_text: template.output_text,
        actions: template.actions || actions,
        provider: 'tinymodel-composer',
        mode: payload.mode || 'chat',
        meta: {
          composer: 'strategy',
          plan_used: planUsed,
          openai_error: openAi.error,
          generator: 'template_fallback',
          tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : null
        }
      };
    }
    return openAi;
  }

  return {
    ok: true,
    output_text: openAi.output_text,
    actions: actions,
    provider: 'tinymodel-composer+openai',
    mode: payload.mode || 'chat',
    meta: {
      composer: 'strategy',
      plan_used: planUsed,
      generator: 'openai',
      openai_model: openAi.model,
      tinymodel: plan ? tinymodel.buildMetaTinyModel(plan) : { error: planError || 'plan_unavailable' }
    }
  };
}

module.exports = {
  extractUserMessage: extractUserMessage,
  detectStrategySection: detectStrategySection,
  composeStrategyTurn: composeStrategyTurn
};
