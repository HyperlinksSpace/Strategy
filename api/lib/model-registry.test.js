#!/usr/bin/env node
/**
 * Stdlib unit tests for model-registry (run: node api/lib/model-registry.test.js)
 */

var registry = require('./model-registry');
var assert = require('assert');

function test(name, fn) {
  try {
    fn();
    console.log('OK  ' + name);
    return true;
  } catch (err) {
    console.log('FAIL ' + name + ': ' + (err && err.message ? err.message : err));
    return false;
  }
}

var ok = 0;
var total = 0;

function run(name, fn) {
  total++;
  if (test(name, fn)) ok++;
}

run('soft intent picks fast tier', function () {
  var route = registry.pickModelFromPlan({
    userText: 'summarize the roadmap in two bullets',
    lane: 'soft',
    softIntent: true,
    plan: { intent: 'chat', routing: { fallback: true, confidence: 0.4, margin: 0.1 } }
  });
  assert.strictEqual(route.tier, 'fast');
  assert.strictEqual(route.reason, 'soft_intent');
});

run('architecture query picks code tier', function () {
  var route = registry.pickModelFromPlan({
    userText: 'explain the TinyModel sidecar composer architecture on Vercel',
    lane: 'grounded',
    intent: 'chat',
    plan: { intent: 'chat', routing: { fallback: false, confidence: 0.7, margin: 0.2, label: 'Sci/Tech' } }
  });
  assert.strictEqual(route.tier, 'code');
});

run('low confidence plan picks reasoning tier', function () {
  var route = registry.pickModelFromPlan({
    userText: 'How does HSP compare to traditional freight ledgers?',
    lane: 'grounded',
    intent: 'chat',
    complexQuestion: true,
    plan: {
      intent: 'chat',
      routing: { fallback: true, confidence: 0.42, margin: 0.08, label: null },
      retrieval: { keyword_overlap: 0.1, hybrid_score: 0.3, chunk_preview: 'x' }
    }
  });
  assert.strictEqual(route.tier, 'reasoning');
});

run('composer meta technical query picks code tier', function () {
  var route = registry.pickModelFromPlan({
    userText: 'explain how TinyModel composer wires to Vercel Gateway',
    lane: 'grounded',
    intent: 'chat',
    metaQuery: true,
    plan: { intent: 'chat', routing: { fallback: false, confidence: 0.7, margin: 0.2 } }
  });
  assert.strictEqual(route.tier, 'code');
  assert.strictEqual(route.reason, 'composer_meta_technical');
});

run('high overlap short RAG picks fast tier', function () {
  var route = registry.pickModelFromPlan({
    userText: 'What is swap routing?',
    lane: 'grounded',
    intent: 'chat',
    plan: {
      intent: 'chat',
      routing: { fallback: false, confidence: 0.8, margin: 0.3 },
      retrieval: { keyword_overlap: 0.7, hybrid_score: 0.6, chunk_preview: 'Swap tokens...' }
    }
  });
  assert.strictEqual(route.tier, 'fast');
  assert.strictEqual(route.reason, 'high_confidence_rag_short');
});

console.log('model-registry: ' + ok + '/' + total);
process.exit(ok === total ? 0 : 1);
