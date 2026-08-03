/**
 * Fast, on-page strategy knowledge for AI CORE when LLM quota is unavailable.
 * Covers common visitor intents: help, section briefs, founder, contact, phases.
 */

var SECTION_BRIEFS = {
  vision: {
    title: 'Vision',
    text:
      '**Vision** — Hyperlinks Space is a protocol-first control plane for industry on Earth and logistics in orbit: MQTT telemetry, OPC UA meaning, DTN for delay, CRDTs for offline merge, and TinyModel at the edge. Capital-light software on hardware you already own—not another fragile cloud spreadsheet stack.'
  },
  pillars: {
    title: 'Pillars',
    text:
      '**Five pillars** encode the operating contract: **MQTT** (live telemetry), **OPC UA** (machine semantics), **DTN** (store-and-forward across blackouts), **CRDT** (partition-tolerant merge), and **TinyModel** edge partitions (inference billed by watt-hour at the site).'
  },
  'earth-space': {
    title: 'Earth & Space',
    text:
      '**Earth & Space** — Near-term revenue lands on Earth (factories, mining, industrial SaaS). The same runtime is written for lunar ISRU, DTN relays, and freight/custody slots so Earth pilots compound into cis-lunar infrastructure instead of a rewrite.'
  },
  roadmap: {
    title: 'Roadmap',
    text:
      '**Roadmap** has four phases: (1) Protocol Bootstrap — field pilots & offline Links Space, (2) Scale Inference at the Edge — TinyModel + Task-Swap revenue, (3) Reference Standard — OEM certification & IP, (4) Cis-Lunar Infrastructure — DTN, orbit transmitter, freight slots toward $1T enterprise value.'
  },
  architecture: {
    title: 'Architecture',
    text:
      '**Architecture** — Safety-critical control runs in signed native binaries. Web/Telegram are read-only observers. **TinyModel** partitions inference; **AI Transmitter** reconciles chain/ERP/RF under delay; **HSP** is the commercial operator console funding R&D.'
  },
  revenue: {
    title: 'Revenue',
    text:
      '**Revenue** ties to the physical cycle: node SaaS, swap fees, efficiency bounties, freight/custody slots, inference watt-hours, semantic bridge seats, digital-twin hosting, and expansion/repair retainers—Earth cashflow funds the space-ready stack.'
  },
  moats: {
    title: 'Moats',
    text:
      '**Moats** — Own the protocol layer (not another AWS dashboard), patent-grade CRDT/DTN/edge partition IP, deep embedding in plant operations, and software operating leverage once nodes are enrolled.'
  },
  'genesis-links': {
    title: 'Genesis · Links Space',
    text:
      '**Genesis** — Founder **Vsevolod Ignatyev (@anriltine)** holds genesis provenance. Peer replicas merge by CRDT domain; partners are bridge nodes with scoped ACLs. No king-node UI—authority is signed merges and protocol depth.'
  },
  'scale-links': {
    title: 'Scale · $1T Links Space',
    text:
      '**$1T scale** is a federated protocol namespace: regional shards, certified OEM/sovereign bridges, edge metering, and genesis trust that decays into standards-council co-sign—not a bigger HQ.'
  },
  'intellectual-links': {
    title: 'Intellectual Links',
    text:
      '**Intellectual Links** productize the company nervous system: shared typed intent, semantic bridges, and merge-native specs. HSP, AI Transmitter, bridge seats, and TinyModel are commercial surfaces of those same links.'
  },
  'north-star': {
    title: 'North Star',
    text:
      '**North Star (to 2040)** — Coordinate industry on Earth, freight and compute in cis-lunar space, and bind both under one custody model. Milestones publish against protocol depth, not pitch-deck theater.'
  }
};

var ROADMAP_PHASES = {
  1: {
    title: 'Phase 1 — Protocol Bootstrap',
    text:
      'Deliver a capital-efficient field pilot: Rust/Zig runtime with CRDTs, MQTT, OPC UA bridge. Two paying sites and an offline-first ~50-node Links Space. Safety paths exit the web UI—native binaries only.'
  },
  2: {
    title: 'Phase 2 — Scale Inference at the Edge',
    text:
      'Production TinyModel partitions on customer gateways; Task-Swap moves work to idle nodes. First recurring revenue from edge compute and anomaly seats—target ~$1M ARR from compute + HSP swap volume.'
  },
  3: {
    title: 'Phase 3 — Set the Reference Standard',
    text:
      'Publish connector, power-bus, and neuromorphic reference designs. OEM/robotics partners implement Hyperlinks protocols to join certified Links Space; deepen patent portfolio and Tier-1 partnerships.'
  },
  4: {
    title: 'Phase 4 — Cis-Lunar Infrastructure',
    text:
      'DTN in LEO/lunar/Mars lanes; AI Transmitter on orbit; HSP node kits; freight slots, compute credits, and assay provenance fees. Hyperlinks becomes the custody ledger for mass, energy, and provenance.'
  }
};

function detectSectionId(text) {
  var m = String(text || '').toLowerCase();
  if (/\b(hsp|hyper\s*strategy|tinymodel|transmitter|sidecar|composer)\b/i.test(m) &&
      !/\b(phase|roadmap|moat|revenue|vision|pillar)\b/i.test(m)) {
    return 'architecture';
  }
  if (/\b(north\s*star|2040|mission)\b/i.test(m)) return 'north-star';
  if (/\b(intellectual|synapse|nervous system)\b/i.test(m)) return 'intellectual-links';
  if (/\b(scale|federation|1t|trillion)\b/i.test(m) && !/\bphase\b/i.test(m)) return 'scale-links';
  if (/\b(genesis|founder|anriltine|peer replica)\b/i.test(m)) return 'genesis-links';
  if (/\b(moats?|advantage|competitive|lock-?in)\b/i.test(m)) return 'moats';
  if (/\b(revenue|monet|income|saas|freight slot)\b/i.test(m)) return 'revenue';
  if (/\b(architecture|arch)\b/i.test(m)) return 'architecture';
  if (/\b(earth|space|lunar|dual market|matrix)\b/i.test(m)) return 'earth-space';
  if (/\b(pillars?|mqtt|opc|dtn|crdt)\b/i.test(m)) return 'pillars';
  if (/\b(roadmap|timeline|bootstrap)\b/i.test(m)) return 'roadmap';
  if (/\b(vision|paradigm|executive)\b/i.test(m)) return 'vision';
  return null;
}

function isCapabilitiesQuery(text) {
  var t = String(text || '').trim();
  return /^(help|commands?|capabilities)[!?.]*$/i.test(t) ||
    /\b(what can you do|how (?:do|to) (?:i )?use|what do you (?:do|support)|how does this (?:chat|ai) work)\b/i.test(t) ||
    /\b(что ты умеешь|как пользоваться|помощь)\b/i.test(t);
}

function isFounderQuery(text) {
  return /\b(who (?:founded|built|created|started)|founder|co-?founder|anriltine|vsevolod|ignatyev)\b/i.test(text) ||
    /\b(кто (?:основал|создал)|основатель)\b/i.test(text);
}

function isContactQuery(text) {
  return /\b(contact|email|e-mail|reach (?:you|out)|support|hello@)\b/i.test(text) ||
    /\b(почта|связаться|контакт)\b/i.test(text);
}

function isBriefIntent(text) {
  return /\b(summarize|summary|explain|describe|overview|brief|tell me about|what (?:is|are|about)|walk me through)\b/i.test(text) ||
    /\b(объясни|расскаж|что такое|что за|кратко|обзор)\b/i.test(text);
}

function detectRoadmapPhase(text) {
  var m = String(text || '').match(/\bphase\s*([1-4]|one|two|three|four)\b/i);
  if (!m) {
    if (/\bprotocol bootstrap\b/i.test(text)) return 1;
    if (/\b(scale inference|task-?swap)\b/i.test(text)) return 2;
    if (/\breference standard\b/i.test(text)) return 3;
    if (/\b(cis-?lunar|phase four)\b/i.test(text)) return 4;
    return null;
  }
  var raw = m[1].toLowerCase();
  var map = { one: 1, two: 2, three: 3, four: 4 };
  return map[raw] || Number(raw);
}

function isCompareEarthSpace(text) {
  return /\bcompar(e|ing|ison)\b/i.test(text) && /\bearth\b/i.test(text) && /\bspace\b/i.test(text);
}

function isSwapRoutingQuery(text) {
  return /\b(swap routing|settlement|multi-?ledger|escrow)\b/i.test(text);
}

function isNorthStarMilestoneQuery(text) {
  return /\b2040\b/.test(text) || /\bnorth\s*star\b/i.test(text);
}

function templateCapabilities() {
  return {
    ok: true,
    output_text:
      "I'm **AI CORE** on this strategy page. I can:\n" +
      '• **Navigate** — open Vision, Pillars, Earth & Space, Roadmap, Architecture, Revenue, Moats, Genesis, Scale, Intellectual Links, North Star\n' +
      '• **Brief** — summarize / explain any section (e.g. “summarize Vision”, “what are the moats”)\n' +
      '• **Tour** — say **guided tour** for all eleven sections\n' +
      '• **HSP / TinyModel** — architecture and how this chat is wired\n' +
      '• **Live FX** — “dollar to rub”, “eur usd”, “bitcoin price”\n' +
      '• **General facts** — “what is mitochondria”, “capital of France”\n' +
      '• **Founder / contact** — @anriltine · hello@hyperlinks.space · https://hyperlinks.space',
    provider: 'strategy_briefs',
    model: 'site-capabilities',
    actions: []
  };
}

function templateFounder() {
  return {
    ok: true,
    output_text:
      'Hyperlinks Space is founded by **Vsevolod Ignatyev (@anriltine)** — technical genesis node: daily commits, signed merges, protocol depth. ' +
      'See **Genesis · Links Space** on this page for how peer replicas and bridge ACLs work (no king-node org chart).\n\n' +
      'Contact: [hello@hyperlinks.space](mailto:hello@hyperlinks.space) · [hyperlinks.space](https://hyperlinks.space)',
    provider: 'strategy_briefs',
    model: 'site-founder',
    actions: [{ type: 'strategy_section', sectionId: 'genesis-links' }]
  };
}

function templateContact() {
  return {
    ok: true,
    output_text:
      '**Contact Hyperlinks Space**\n' +
      '• Email: [hello@hyperlinks.space](mailto:hello@hyperlinks.space)\n' +
      '• Product: [https://hyperlinks.space](https://hyperlinks.space)\n' +
      '• This page: strategy briefing for the $1T protocol arc\n\n' +
      'Ask **open Genesis** for founder topology, or **guided tour** for the full document.',
    provider: 'strategy_briefs',
    model: 'site-contact',
    actions: []
  };
}

function templateSectionBrief(sectionId) {
  var brief = SECTION_BRIEFS[sectionId];
  if (!brief) return null;
  return {
    ok: true,
    output_text: brief.text + '\n\nSay **open ' + brief.title + '** to jump there, or ask a follow-up.',
    provider: 'strategy_briefs',
    model: 'site-section-brief',
    actions: [{ type: 'strategy_section', sectionId: sectionId }]
  };
}

function templatePhase(n) {
  var phase = ROADMAP_PHASES[n];
  if (!phase) return null;
  return {
    ok: true,
    output_text: '**' + phase.title + '**\n\n' + phase.text + '\n\nOpening **Roadmap** for the full four-phase arc.',
    provider: 'strategy_briefs',
    model: 'site-roadmap-phase',
    actions: [{ type: 'strategy_section', sectionId: 'roadmap' }]
  };
}

function templateCompareEarthSpace() {
  return {
    ok: true,
    output_text:
      '**Earth vs Space (same stack)**\n' +
      '• **Earth (near-term):** smart factories, mining/energy, industrial SaaS — EMI, mixed PLCs, uptime SLAs; per-node SaaS + swap fees.\n' +
      '• **Space (horizon):** lunar ISRU, DTN relays, freight & custody slots — light delay, radiation, no always-on backhaul; sovereign lane contracts.\n' +
      'One runtime from day one so Earth revenue funds cis-lunar readiness instead of a fork.',
    provider: 'strategy_briefs',
    model: 'site-compare',
    actions: [{ type: 'strategy_section', sectionId: 'earth-space' }]
  };
}

function templateSwapRouting() {
  return {
    ok: true,
    output_text:
      'On the live product, **settlement & swap routing** across integrated ledgers (plus escrow deal rooms and AI Transmitter alerts) already ships at [hyperlinks.space](https://hyperlinks.space). ' +
      'This strategy page frames that commercial surface (**HSP**) as the funder of the industrial protocol stack—see **Architecture** and **Revenue**.',
    provider: 'strategy_briefs',
    model: 'site-swap',
    actions: [{ type: 'strategy_section', sectionId: 'architecture' }]
  };
}

function templateTourDefer() {
  return {
    ok: true,
    output_text:
      'Start the **guided tour** from the chip above the input (or say “guided tour” in the browser). ' +
      'I’ll walk all eleven sections from Vision through North Star.',
    provider: 'strategy_briefs',
    model: 'site-tour-hint',
    actions: [{ type: 'start_tour' }]
  };
}

/**
 * @returns {null|{ok:boolean,output_text:string,provider:string,model:string,actions:Array}}
 */
function answerStrategyBrief(userText) {
  var text = String(userText || '').trim();
  if (!text) return null;

  // Pure navigation ("open Revenue") is handled by the composer nav path.
  if (/\b(open|show|go to|navigate|scroll|take me|visit|покаж|откр|перей|打开|去)\b/i.test(text) &&
      !isBriefIntent(text) &&
      !isCapabilitiesQuery(text) &&
      !isFounderQuery(text) &&
      !isContactQuery(text)) {
    return null;
  }

  if (isCapabilitiesQuery(text)) return templateCapabilities();
  if (isFounderQuery(text)) return templateFounder();
  if (isContactQuery(text)) return templateContact();
  if (isCompareEarthSpace(text)) return templateCompareEarthSpace();
  if (isSwapRoutingQuery(text)) return templateSwapRouting();

  if (/\b(guided tour|quick tour|walk me through (?:the )?site)\b/i.test(text)) {
    return templateTourDefer();
  }

  var phase = detectRoadmapPhase(text);
  if (phase) return templatePhase(phase);

  if (isNorthStarMilestoneQuery(text) && (isBriefIntent(text) || /\b(when|milestone|mission)\b/i.test(text))) {
    return templateSectionBrief('north-star');
  }

  var sectionId = detectSectionId(text);
  if (sectionId && (isBriefIntent(text) || /^(what are the|what is the)\b/i.test(text))) {
    return templateSectionBrief(sectionId);
  }

  // Bare “moats” / “revenue” style asks with light verbs
  if (sectionId && /\b(about|moats?|revenue|architecture|vision|pillars?|roadmap)\b/i.test(text) &&
      text.split(/\s+/).length <= 8) {
    return templateSectionBrief(sectionId);
  }

  return null;
}

module.exports = {
  answerStrategyBrief: answerStrategyBrief,
  detectSectionId: detectSectionId,
  isCapabilitiesQuery: isCapabilitiesQuery,
  SECTION_BRIEFS: SECTION_BRIEFS
};
