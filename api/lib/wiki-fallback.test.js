#!/usr/bin/env node
/**
 * Stdlib unit tests for wiki-fallback FX detection (run: node api/lib/wiki-fallback.test.js)
 */

var wiki = require('./wiki-fallback');
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

run('bare eur usd pair', function () {
  var q = wiki.detectCurrencyQuery('eur usd');
  assert.ok(q, 'expected currency query');
  assert.strictEqual(q.base, 'EUR');
  assert.deepStrictEqual(q.targets, ['USD']);
});

run('slash pair eur/usd', function () {
  var q = wiki.detectCurrencyQuery('eur/usd');
  assert.ok(q);
  assert.strictEqual(q.base, 'EUR');
  assert.deepStrictEqual(q.targets, ['USD']);
});

run('dollar to rub rate still works', function () {
  var q = wiki.detectCurrencyQuery('dollar to rub rate');
  assert.ok(q);
  assert.strictEqual(q.base, 'USD');
  assert.ok(q.targets.indexOf('RUB') >= 0);
});

run('greeting is not currency', function () {
  assert.strictEqual(wiki.detectCurrencyQuery('привет'), null);
});

run('mitochondria is not currency', function () {
  assert.strictEqual(wiki.detectCurrencyQuery('what is mitochondria'), null);
});

console.log(ok + '/' + total + ' passed');
process.exit(ok === total ? 0 : 1);
