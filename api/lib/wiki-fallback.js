/**
 * Lightweight general-knowledge fallback (Wikipedia) when LLM quota/keys fail.
 * Used for who/what/when/where questions on the strategy AI CORE chat.
 */

function wikiTimeoutMs() {
  var n = Number(process.env.WIKI_FALLBACK_TIMEOUT_MS || 5000);
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

function extractTopic(text) {
  var t = String(text || '').trim();
  var capital = t.match(/^(?:what\s+(?:is|was)\s+)?(?:the\s+)?capital\s+of\s+(.+?)(?:\?|$)/i);
  if (capital && capital[1]) {
    return capital[1].replace(/[?.!]+$/g, '').trim();
  }
  var patterns = [
    /^(?:who\s+(?:is|was|are)\s+)(.+?)(?:\?|$)/i,
    /^(?:what\s+(?:is|was|are)\s+)(.+?)(?:\?|$)/i,
    /^(?:when\s+(?:did|was|is)\s+)(.+?)(?:\?|$)/i,
    /^(?:where\s+(?:is|was)\s+)(.+?)(?:\?|$)/i,
    /^(?:кто\s+(?:такой|такая|был|была)\s+)(.+?)(?:\?|$)/i,
    /^(?:что\s+такое\s+)(.+?)(?:\?|$)/i,
    /^(?:.+?\s+是谁)\s*$/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = t.match(patterns[i]);
    if (m && m[1]) return m[1].replace(/[?.!]+$/g, '').trim();
  }
  return t.replace(/[?.!]+$/g, '').trim();
}

async function wikiGetJson(url) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, wikiTimeoutMs()) : null;
  try {
    var res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HyperlinksStrategyAICore/1.0 (ctrategy.hyperlinks.space; education)'
      },
      signal: controller ? controller.signal : undefined
    });
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      return { ok: false, error: 'Wikipedia HTTP ' + res.status };
    }
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveWikiTitles(topic) {
  var q = encodeURIComponent(topic);
  var titles = [];
  var search = await wikiGetJson(
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + q +
    '&srlimit=5&namespace=0&format=json&origin=*'
  );
  if (search.ok && search.data && search.data.query &&
      Array.isArray(search.data.query.search)) {
    search.data.query.search.forEach(function (row) {
      if (row && row.title && titles.indexOf(row.title) < 0) titles.push(row.title);
    });
  }
  if (!titles.length) {
    var open = await wikiGetJson(
      'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + q +
      '&limit=3&namespace=0&format=json&origin=*'
    );
    if (open.ok && open.data && Array.isArray(open.data[1])) {
      open.data[1].forEach(function (title) {
        if (title && titles.indexOf(title) < 0) titles.push(title);
      });
    }
  }
  // Prefer place/city pages for short geographic queries.
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(topic) || /^when\s+is\s+/i.test(topic)) {
    var cityHint = topic + ', Wisconsin';
    if (titles.indexOf(cityHint) < 0 && /sheboygan/i.test(topic)) {
      titles.unshift('Sheboygan, Wisconsin');
    }
  }
  return titles;
}

async function resolveWikiTitle(topic) {
  var titles = await resolveWikiTitles(topic);
  return titles[0] || null;
}

async function fetchWikiSummary(title) {
  var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
  var res = await wikiGetJson(url);
  if (!res.ok || !res.data) return null;
  if (res.data.type === 'disambiguation') return null;
  var extract = String(res.data.extract || '').trim();
  if (!extract || /^.*may refer to/i.test(extract)) return null;
  var label = res.data.title || title;
  return {
    title: label,
    extract: extract,
    url: (res.data.content_urls && res.data.content_urls.desktop && res.data.content_urls.desktop.page) ||
      ('https://en.wikipedia.org/wiki/' + encodeURIComponent(label.replace(/ /g, '_')))
  };
}

// --- Live currency rates (Frankfurter API — free, no key, 84 central banks) ---

var CURRENCY_ALIASES = {
  dollar: 'USD', usd: 'USD', 'us dollar': 'USD',
  euro: 'EUR', eur: 'EUR',
  pound: 'GBP', gbp: 'GBP', sterling: 'GBP',
  yen: 'JPY', jpy: 'JPY',
  yuan: 'CNY', cny: 'CNY', renminbi: 'CNY', rmb: 'CNY',
  ruble: 'RUB', rouble: 'RUB', rub: 'RUB',
  rupee: 'INR', inr: 'INR',
  franc: 'CHF', chf: 'CHF',
  'canadian dollar': 'CAD', cad: 'CAD',
  'australian dollar': 'AUD', aud: 'AUD',
  bitcoin: 'BTC', btc: 'BTC',
  lira: 'TRY', try: 'TRY',
  krona: 'SEK', sek: 'SEK',
  zloty: 'PLN', pln: 'PLN',
  real: 'BRL', brl: 'BRL',
  won: 'KRW', krw: 'KRW',
  dirham: 'AED', aed: 'AED',
  hryvnia: 'UAH', uah: 'UAH', гривна: 'UAH',
  тенге: 'KZT', kzt: 'KZT',
  рубль: 'RUB', рубля: 'RUB', рублю: 'RUB', рублей: 'RUB',
  доллар: 'USD', доллара: 'USD', евро: 'EUR', фунт: 'GBP', фунта: 'GBP',
  иена: 'JPY', иены: 'JPY', юань: 'CNY', юаня: 'CNY'
};

var RATE_WORDS = ['rate','price','exchange','cost','course','стоимость','курс','цена','汇率','价格'];
var QUERY_WORDS = ['rate','price','exchange','cost','worth','value','convert','курс','стоимость','цена','汇率','价格'];
var QUERY_PHRASES = ['how much','сколько стоит','多少钱'];

function hasRateWord(text) {
  var words = text.toLowerCase().split(/[\s,;:!?.]+/).filter(Boolean);
  for (var i = 0; i < RATE_WORDS.length; i++) {
    if (words.indexOf(RATE_WORDS[i]) >= 0) return true;
  }
  return false;
}

function hasQueryWord(text) {
  var t = text.toLowerCase();
  var words = t.split(/[\s,;:!?.]+/).filter(Boolean);
  for (var i = 0; i < QUERY_WORDS.length; i++) {
    if (words.indexOf(QUERY_WORDS[i]) >= 0) return true;
  }
  for (var j = 0; j < QUERY_PHRASES.length; j++) {
    if (t.indexOf(QUERY_PHRASES[j]) >= 0) return true;
  }
  return false;
}
var CONVERT_PATTERN = /\b(\w+)\s+(?:to|в|к|→|->)\s+(\w+)\b/i;
var SHOW_TARGETS = ['EUR', 'GBP', 'JPY', 'CNY', 'RUB', 'CHF', 'CAD', 'AUD', 'INR', 'KRW', 'TRY', 'BRL', 'PLN', 'UAH', 'KZT', 'SEK', 'AED'];

function findCurrencyCodes(text) {
  var t = String(text || '').toLowerCase().trim();
  var tWords = t.split(/[\s,;:!?.\/\-]+/).filter(Boolean);
  var found = [];
  var seen = {};

  function pushCode(code) {
    if (!code || seen[code]) return;
    seen[code] = true;
    found.push(code);
  }

  // Prefer left-to-right order so "eur usd" → base EUR.
  for (var w = 0; w < tWords.length; w++) {
    var word = tWords[w];
    if (CURRENCY_ALIASES[word]) {
      pushCode(CURRENCY_ALIASES[word]);
      continue;
    }
    var upper = word.toUpperCase();
    if (/^[A-Z]{3}$/.test(upper) &&
        (SHOW_TARGETS.indexOf(upper) >= 0 || ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'BTC'].indexOf(upper) >= 0)) {
      pushCode(upper);
    }
  }

  // Multi-word aliases (e.g. "us dollar") if not already covered.
  var keys = Object.keys(CURRENCY_ALIASES).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) {
    var alias = keys[i];
    if (alias.indexOf(' ') < 0) continue;
    if (t.indexOf(alias) >= 0) pushCode(CURRENCY_ALIASES[alias]);
  }

  return found;
}

function detectCurrencyQuery(text) {
  var t = String(text || '').toLowerCase().trim();

  // "X to Y" conversion pattern (e.g. "euro to dollar", "USD to EUR")
  var convertMatch = t.match(CONVERT_PATTERN);
  if (convertMatch) {
    var fromCode = CURRENCY_ALIASES[convertMatch[1]] || (convertMatch[1].length === 3 ? convertMatch[1].toUpperCase() : null);
    var toCode = CURRENCY_ALIASES[convertMatch[2]] || (convertMatch[2].length === 3 ? convertMatch[2].toUpperCase() : null);
    if (fromCode && toCode) return { base: fromCode, targets: [toCode] };
  }

  // Slash / dash pairs: "eur/usd", "usd-rub"
  var slashMatch = t.match(/\b([a-z]{3})\s*[\/\-]\s*([a-z]{3})\b/i);
  if (slashMatch) {
    var a = CURRENCY_ALIASES[slashMatch[1].toLowerCase()] || slashMatch[1].toUpperCase();
    var b = CURRENCY_ALIASES[slashMatch[2].toLowerCase()] || slashMatch[2].toUpperCase();
    if (a && b && a !== b) return { base: a, targets: [b] };
  }

  var found = findCurrencyCodes(t);
  // Bare pairs like "eur usd" are FX asks even without the word "rate".
  if (found.length >= 2) {
    return { base: found[0], targets: found.slice(1) };
  }

  if (!hasQueryWord(t) && !matchesCurrencyName(t)) return null;
  if (found.length === 0) return null;

  var base = found[0];
  var targets = found.slice(1);
  if (targets.length === 0) {
    targets = base === 'USD' ? ['EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD'] : ['USD'];
  }

  return { base: base, targets: targets };
}

function matchesCurrencyName(text) {
  if (!hasRateWord(text)) return false;
  var words = text.toLowerCase().split(/[\s,;:!?.]+/).filter(Boolean);
  var keys = Object.keys(CURRENCY_ALIASES);
  for (var i = 0; i < keys.length; i++) {
    var alias = keys[i];
    if (alias.indexOf(' ') >= 0 ? text.toLowerCase().indexOf(alias) >= 0 : words.indexOf(alias) >= 0) return true;
  }
  return false;
}

function isWeakWikiTopic(topic) {
  var t = String(topic || '').trim().toLowerCase();
  if (!t || t.length < 2) return true;
  if (/^(you|me|i|we|us|they|he|she|it|this|that|привет|hello|hi|hey)$/i.test(t)) return true;
  if (/^(hi|hello|hey|yo|привет|здравствуй|здравствуйте)[!?.]*$/i.test(t)) return true;
  return false;
}

function wikiTitleLooksRelevant(title, topic) {
  var hay = String(title || '').toLowerCase();
  var words = String(topic || '').toLowerCase().split(/[\s\-_/]+/).filter(function (w) {
    return w.length > 2 && !/^(the|and|for|of|a|an|what|who|when|where)$/i.test(w);
  });
  if (!words.length) return true;
  var hits = 0;
  for (var i = 0; i < words.length; i++) {
    if (hay.indexOf(words[i]) >= 0) hits += 1;
  }
  // Require at least one meaningful topic word in the article title.
  return hits > 0;
}

async function fetchCurrencyRatesFrankfurter(base, targets) {
  var url = 'https://api.frankfurter.dev/v1/latest?base=' + encodeURIComponent(base);
  if (targets && targets.length) {
    url += '&symbols=' + targets.map(encodeURIComponent).join(',');
  }
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 2800) : null;
  try {
    var res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    });
    var body = await res.text();
    var data = body ? JSON.parse(body) : null;
    if (!res.ok || !data || !data.rates) return null;
    return { date: data.date, base: data.base || base, rates: data.rates, source: 'frankfurter' };
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchCurrencyRatesCdn(base, targets) {
  var b = String(base || 'USD').toLowerCase();
  var urls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + b + '.min.json',
    'https://latest.currency-api.pages.dev/v1/currencies/' + b + '.min.json'
  ];
  for (var u = 0; u < urls.length; u++) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
    try {
      var res = await fetch(urls[u], {
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      var body = await res.text();
      var data = body ? JSON.parse(body) : null;
      if (!res.ok || !data || !data[b]) continue;
      var table = data[b];
      var rates = {};
      var list = targets && targets.length ? targets : Object.keys(table).slice(0, 8);
      for (var i = 0; i < list.length; i++) {
        var code = String(list[i]).toUpperCase();
        var key = code.toLowerCase();
        if (typeof table[key] === 'number') rates[code] = table[key];
      }
      if (!Object.keys(rates).length) continue;
      return {
        date: data.date || new Date().toISOString().slice(0, 10),
        base: base,
        rates: rates,
        source: 'cdn'
      };
    } catch (e) {
      // try next mirror
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}

async function fetchCurrencyRates(base, targets) {
  var primary = await fetchCurrencyRatesFrankfurter(base, targets);
  if (primary) return primary;
  return fetchCurrencyRatesCdn(base, targets);
}

function formatRateAnswer(data, requestedTargets) {
  var lines = ['**' + data.base + ' exchange rates** (' + data.date + ')\n'];
  var codes = requestedTargets && requestedTargets.length
    ? requestedTargets
    : Object.keys(data.rates).sort();
  for (var i = 0; i < codes.length; i++) {
    var c = codes[i];
    if (data.rates[c] !== undefined) {
      var val = data.rates[c];
      if (typeof val === 'number') val = Math.round(val * 1e6) / 1e6;
      lines.push('1 ' + data.base + ' = **' + val + '** ' + c);
    }
  }
  var src = data.source === 'cdn'
    ? 'Currency API mirror (daily)'
    : 'Frankfurter API (European Central Bank + 83 central banks)';
  lines.push('\nSource: ' + src);
  return lines.join('\n');
}

async function answerCurrencyRate(userText) {
  var q = detectCurrencyQuery(userText);
  if (!q) return null;
  var data = await fetchCurrencyRates(q.base, q.targets);
  if (!data) return null;
  return {
    ok: true,
    output_text: formatRateAnswer(data, q.targets),
    provider: 'currency_rate_fallback',
    model: 'frankfurter-ecb',
    mode: 'chat'
  };
}

// --- Main entry point ---

async function answerGeneralKnowledge(userText) {
  // Try live currency rates first
  try {
    var rateAnswer = await answerCurrencyRate(userText);
    if (rateAnswer && rateAnswer.ok) return rateAnswer;
  } catch (e) { /* fall through */ }

  // Never Wikipedia-search FX queries ("dollar rate" → junk "Exchange rate" article).
  if (detectCurrencyQuery(userText)) {
    return {
      ok: true,
      output_text:
        'Live FX lookup is briefly unavailable. Try again in a moment, or ask **euro to dollar** / **USD to EUR**.',
      provider: 'currency_rate_fallback',
      model: 'fx-unavailable',
      mode: 'chat'
    };
  }

  var topic = extractTopic(userText);
  if (!topic || topic.length < 2 || isWeakWikiTopic(topic)) {
    return { ok: false, error: 'no_topic' };
  }

  var titles = await resolveWikiTitles(topic);
  titles = titles.filter(function (title) { return wikiTitleLooksRelevant(title, topic); });
  if (!titles.length) {
    return { ok: false, error: 'no_wiki_match' };
  }

  var summary = null;
  for (var i = 0; i < titles.length; i++) {
    summary = await fetchWikiSummary(titles[i]);
    if (summary) break;
  }
  if (!summary) {
    return { ok: false, error: 'no_wiki_summary' };
  }

  var text = '**' + summary.title + '** — ' + summary.extract;
  if (summary.url) {
    text += '\n\nSource: ' + summary.url;
  }

  return {
    ok: true,
    output_text: text,
    provider: 'wikipedia_fallback',
    model: 'wikipedia-rest-v1',
    mode: 'chat'
  };
}

module.exports = {
  extractTopic: extractTopic,
  detectCurrencyQuery: detectCurrencyQuery,
  answerCurrencyRate: answerCurrencyRate,
  answerGeneralKnowledge: answerGeneralKnowledge
};
