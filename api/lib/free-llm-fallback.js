/**
 * Last-resort generative fallback when OpenAI / Gateway quota fails.
 * Prefer anonymous Pollinations OpenAI-compatible POST (model openai-fast).
 */

function timeoutMs() {
  var n = Number(process.env.FREE_LLM_TIMEOUT_MS || 22000);
  return Number.isFinite(n) && n > 0 ? n : 22000;
}

function freeLlmModel() {
  // Anonymous Pollinations: "openai" maps to a free gpt-oss class model.
  // "openai-fast" can hang or require pollen on some deploys.
  return (process.env.FREE_LLM_MODEL || 'openai').trim() || 'openai';
}

function buildMessages(userText, system) {
  var messages = [];
  var sys = String(system || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  if (sys) {
    messages.push({
      role: 'system',
      content: sys + ' Answer briefly in plain text. Do not use markdown asterisks.'
    });
  } else {
    messages.push({
      role: 'system',
      content: 'Answer briefly in plain text. Do not use markdown asterisks.'
    });
  }
  messages.push({ role: 'user', content: String(userText || '').trim().slice(0, 600) });
  return messages;
}

function looksLikeError(text) {
  var t = String(text || '').trim();
  if (!t) return true;
  if (t.charAt(0) === '{') {
    try {
      var j = JSON.parse(t);
      if (j && (j.error || j.status === 402 || j.status === 401)) return true;
    } catch (e) { /* not json */ }
  }
  if (/payment required|api key budget|budget too low|rate limit|Moved Permanently/i.test(t)) {
    return true;
  }
  return false;
}

function extractText(payload, raw) {
  if (payload && payload.choices && payload.choices[0]) {
    var msg = payload.choices[0].message || payload.choices[0];
    var content = msg && (msg.content || msg.text);
    if (content) return String(content).trim();
  }
  if (payload && typeof payload.content === 'string') return payload.content.trim();
  if (payload && typeof payload.text === 'string') return payload.text.trim();
  var plain = String(raw || '').trim();
  if (plain && plain.charAt(0) !== '{' && !looksLikeError(plain)) return plain;
  return '';
}

function sanitizeFreeReply(text) {
  // Drop accidental markdown asterisks so TTS never says "asterisk/звёздочка".
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, options) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs()) : null;
  try {
    return await fetch(url, Object.assign({}, options || {}, {
      signal: controller ? controller.signal : undefined
    }));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callPollinationsOpenAi(userText, system) {
  var res = await fetchWithTimeout('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'HyperlinksStrategyAICore/1.0 (ctrategy.hyperlinks.space)'
    },
    body: JSON.stringify({
      model: freeLlmModel(),
      messages: buildMessages(userText, system),
      temperature: 0.7
    })
  });
  var raw = await res.text();
  var data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!res.ok || looksLikeError(raw)) {
    return { ok: false, error: 'pollinations_openai_' + res.status };
  }
  var text = extractText(data, raw);
  if (!text || text.length < 2) return { ok: false, error: 'empty' };
  text = sanitizeFreeReply(text);
  if (text.length > 1800) text = text.slice(0, 1797) + '...';
  return {
    ok: true,
    output_text: text,
    provider: 'free_llm_fallback',
    model: 'pollinations:' + freeLlmModel(),
    mode: 'chat'
  };
}

async function callPollinationsGet(userText, system) {
  var prompt = String(userText || '').trim().slice(0, 280);
  if (system) prompt = 'Q: ' + prompt + ' A:';
  var url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) +
    '?model=' + encodeURIComponent(freeLlmModel());
  var res = await fetchWithTimeout(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'HyperlinksStrategyAICore/1.0 (ctrategy.hyperlinks.space)'
    }
  });
  var text = await res.text();
  if (!res.ok || looksLikeError(text)) {
    return { ok: false, error: 'pollinations_get_' + res.status };
  }
  text = sanitizeFreeReply(text);
  if (text.length < 2) return { ok: false, error: 'empty' };
  if (text.length > 1800) text = text.slice(0, 1797) + '...';
  return {
    ok: true,
    output_text: text,
    provider: 'free_llm_fallback',
    model: 'pollinations-get:' + freeLlmModel(),
    mode: 'chat'
  };
}

async function generate(userText, system) {
  if (!String(userText || '').trim()) {
    return { ok: false, error: 'empty_input' };
  }
  if (process.env.FREE_LLM_DISABLED === '1') {
    return { ok: false, error: 'disabled' };
  }

  try {
    var primary = await callPollinationsOpenAi(userText, system);
    if (primary && primary.ok) return primary;
  } catch (e1) { /* try get */ }

  try {
    return await callPollinationsGet(userText, system);
  } catch (e2) {
    return { ok: false, error: String(e2 && e2.message ? e2.message : e2) };
  }
}

module.exports = {
  generate: generate,
  callPollinationsOpenAi: callPollinationsOpenAi,
  callPollinationsGet: callPollinationsGet
};
