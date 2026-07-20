#!/usr/bin/env node
/**
 * Smoke test Strategy TinyModel composer (stdlib — run from Strategy repo root).
 *
 *   node scripts/ai-composer-smoke.js
 *   node scripts/ai-composer-smoke.js --base-url http://localhost:3000
 */

var composer = require('../api/lib/strategy-composer');

var cases = [
  { name: 'local-tour-skip', input: 'Guided tour', expectLocal: true },
  { name: 'strategy-nav-roadmap', input: 'open the roadmap section', expectSection: 'roadmap' },
  { name: 'strategy-architecture', input: 'explain TinyModel sidecar composer', expectSection: 'architecture' },
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
      var result = await composer.composeStrategyTurn(payload, null);
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
      if (c.expectHsp) {
        pass = pass && /HSP|Hyperlinks Space Program|hyperlinks/i.test(result.output_text);
      }
      console.log((pass ? 'OK' : 'FAIL') + '  ' + c.name + ': ' +
        (result.output_text || result.error || '').slice(0, 80).replace(/\n/g, ' '));
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
