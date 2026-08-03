#!/usr/bin/env node
/**
 * Smoke test Strategy TinyModel composer (stdlib — run from Strategy repo root).
 *
 *   node scripts/ai-composer-smoke.js
 *   node scripts/ai-composer-smoke.js --base-url http://localhost:3000
 */

var composer = require('../api/lib/strategy-composer');
var composerRouter = require('../api/lib/composer-router');

function mockVercelCaller() {
  return async function (input, system, options) {
    return {
      ok: true,
      output_text: 'Gateway mock: ' + String(input).slice(0, 40),
      provider: 'vercel_ai',
      model: (options && options.model) || 'openai/gpt-4o-mini',
      gateway: true,
      mode: 'chat'
    };
  };
}

var cases = [
  { name: 'local-tour-skip', input: 'Guided tour', expectLocal: true },
  { name: 'router-nav-template', input: 'open the roadmap section', expectGenerator: 'tinymodel', expectSection: 'roadmap' },
  { name: 'router-complex-gateway', input: 'explain how TinyModel composer wires to Vercel Gateway', expectGenerator: 'vercel_ai', expectModelTier: 'code', expectNoSection: true, mockGateway: true },
  { name: 'strategy-architecture', input: 'open the architecture section', expectSection: 'architecture' },
  { name: 'strategy-tinymodel-explain', input: 'explain TinyModel sidecar composer', expectNoSection: true, expectMatch: /TinyModel|composer|\/api\/ai|sidecar/i },
  {
    name: 'strategy-sidecar-handshake',
    input: 'sidecar ping strategy ai core',
    expectNoSection: true,
    expectMatch: /TM1-SIDECAR-OK/,
    expectProvider: 'tinymodel-sidecar'
  },
  { name: 'router-soft-fast', input: 'summarize the roadmap briefly', expectGenerator: 'vercel_ai', expectModelTier: 'fast', expectNoSection: true, mockGateway: true },
  { name: 'strategy-general-hsp', input: 'How does HSP swap routing work across multiple ledgers?', expectNoSection: true },
  { name: 'hsp-nav-swap', input: 'open swap page', expectHsp: true }
];

async function runLocal() {
  console.log('==> Local composer (TinyModel sidecar + optional OpenAI)');
  var ok = 0;
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    var payload = {
      input: c.input,
      mode: 'chat',
      context: { source: 'strategy-site', locale: 'en', surface: 'ai-core' },
      instructions: 'You are AI CORE on the strategy site.'
    };
    try {
      var generators = {};
      if (c.mockGateway) {
        generators.vercelAi = mockVercelCaller();
      }
      var result = await composer.composeStrategyTurn(payload, generators);
      if (c.expectLocal) {
        var pass = !result.ok && result.error === 'local_only_intent';
        console.log((pass ? 'OK' : 'FAIL') + '  ' + c.name + ': defer=' + (result.meta && result.meta.defer));
        if (pass) ok++;
        continue;
      }
      var pass = !!(result.ok && result.output_text);
      if (c.expectSection) {
        pass = pass && result.actions && result.actions[0] &&
          result.actions[0].sectionId === c.expectSection;
      }
      if (c.expectNoSection) {
        pass = pass && (!result.actions || !result.actions.length);
      }
      if (c.expectHsp) {
        pass = pass && /HSP|Hyperlinks Space Program|hyperlinks/i.test(result.output_text);
      }
      if (c.expectMatch) {
        pass = pass && c.expectMatch.test(result.output_text);
      }
      if (c.expectProvider) {
        pass = pass && result.provider === c.expectProvider;
      }
      if (c.expectGenerator) {
        pass = pass && result.meta && result.meta.generator === c.expectGenerator;
      }
      if (c.expectModelTier) {
        pass = pass && result.meta && result.meta.model_tier === c.expectModelTier;
      }
      console.log((pass ? 'OK' : 'FAIL') + '  ' + c.name + ': ' +
        (result.meta && result.meta.generator ? result.meta.generator + ' · ' : '') +
        (result.meta && result.meta.model_tier ? result.meta.model_tier + ' · ' : '') +
        (result.output_text || result.error || '').slice(0, 70).replace(/\n/g, ' '));
      if (pass) ok++;
    } catch (err) {
      console.log('FAIL  ' + c.name + ': ' + err.message);
    }
  }
  console.log('Local composer: ' + ok + '/' + cases.length);
  return ok === cases.length ? 0 : 1;
}

async function runHttp(baseUrl) {
  console.log('==> HTTP ' + baseUrl + '/api/ai');
  var payload = {
    input: 'what is TinyModel composer on this strategy site',
    mode: 'chat',
    context: { source: 'strategy-site', locale: 'en' }
  };
  var res = await fetch(baseUrl.replace(/\/$/, '') + '/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  var body = await res.json();
  if (!res.ok || !body.ok || !body.output_text) {
    console.error('FAIL', res.status, body);
    return 1;
  }
  if (!/TinyModel|composer|\/api\/ai|sidecar/i.test(body.output_text)) {
    console.error('FAIL irrelevant reply:', body.output_text.slice(0, 160).replace(/\n/g, ' '));
    return 1;
  }
  console.log('OK', body.provider, body.output_text.slice(0, 120).replace(/\n/g, ' '));
  if (body.meta && body.meta.tinymodel) {
    console.log('   tinymodel intent:', body.meta.tinymodel.intent);
  }
  return 0;
}

async function main() {
  var baseIdx = process.argv.indexOf('--base-url');
  if (baseIdx >= 0 && process.argv[baseIdx + 1]) {
    process.exit(await runHttp(process.argv[baseIdx + 1]));
  }
  process.exit(await runLocal());
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
