/**
 * Lightweight general-knowledge fallback (Wikipedia) when LLM quota/keys fail.
 * Used for who/what/when/where questions on the strategy AI CORE chat.
 */

function wikiTimeoutMs() {
  var n = Number(process.env.WIKI_FALLBACK_TIMEOUT_MS || 8000);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

function extractTopic(text) {
  var t = String(text || '').trim();
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

async function resolveWikiTitle(topic) {
  var q = encodeURIComponent(topic);
  // Full-text search handles typos better than opensearch (e.g. Enstein → Albert Einstein).
  var search = await wikiGetJson(
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + q +
    '&srlimit=3&namespace=0&format=json&origin=*'
  );
  if (search.ok && search.data && search.data.query &&
      Array.isArray(search.data.query.search) && search.data.query.search[0]) {
    return search.data.query.search[0].title;
  }

  var open = await wikiGetJson(
    'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + q +
    '&limit=1&namespace=0&format=json&origin=*'
  );
  if (!open.ok || !open.data || !Array.isArray(open.data) || !open.data[1] || !open.data[1][0]) {
    return null;
  }
  return open.data[1][0];
}

async function fetchWikiSummary(title) {
  var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
  var res = await wikiGetJson(url);
  if (!res.ok || !res.data) return null;
  var extract = String(res.data.extract || '').trim();
  if (!extract) return null;
  var label = res.data.title || title;
  return {
    title: label,
    extract: extract,
    url: (res.data.content_urls && res.data.content_urls.desktop && res.data.content_urls.desktop.page) ||
      ('https://en.wikipedia.org/wiki/' + encodeURIComponent(label.replace(/ /g, '_')))
  };
}

async function answerGeneralKnowledge(userText) {
  var topic = extractTopic(userText);
  if (!topic || topic.length < 2) {
    return { ok: false, error: 'no_topic' };
  }

  var title = await resolveWikiTitle(topic);
  if (!title) {
    return { ok: false, error: 'no_wiki_match' };
  }
  var summary = await fetchWikiSummary(title);
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
  answerGeneralKnowledge: answerGeneralKnowledge
};
