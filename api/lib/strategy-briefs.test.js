#!/usr/bin/env node
var briefs = require('./strategy-briefs');
var assert = require('assert');

function run(name, fn) {
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
function test(name, fn) { total++; if (run(name, fn)) ok++; }

test('help capabilities', function () {
  var a = briefs.answerStrategyBrief('what can you do');
  assert.ok(a && a.ok);
  assert.ok(a.output_text.indexOf('AI CORE') >= 0);
});

test('summarize vision', function () {
  var a = briefs.answerStrategyBrief('summarize vision');
  assert.ok(a && a.ok);
  assert.strictEqual(a.actions[0].sectionId, 'vision');
});

test('phase 2', function () {
  var a = briefs.answerStrategyBrief('phase 2');
  assert.ok(a && a.ok);
  assert.ok(/Phase 2/i.test(a.output_text));
});

test('founder', function () {
  var a = briefs.answerStrategyBrief('who founded hyperlinks');
  assert.ok(a && a.ok);
  assert.ok(/anriltine/i.test(a.output_text));
});

test('contact', function () {
  var a = briefs.answerStrategyBrief('contact email');
  assert.ok(a && a.ok);
  assert.ok(/hello@hyperlinks\.space/i.test(a.output_text));
});

test('moats brief', function () {
  var a = briefs.answerStrategyBrief('what are the moats');
  assert.ok(a && a.ok);
  assert.strictEqual(a.actions[0].sectionId, 'moats');
});

test('non-match returns null', function () {
  assert.strictEqual(briefs.answerStrategyBrief('what is mitochondria'), null);
});

console.log(ok + '/' + total + ' passed');
process.exit(ok === total ? 0 : 1);
