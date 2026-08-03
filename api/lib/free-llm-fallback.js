/**
 * Last-resort generative fallback when OpenAI / Gateway quota fails.
 * Uses anonymous Pollinations text API (no key). Best-effort only.
 */

function timeoutMs() {
  var n = Number(process.env.FREE_LLM_TIMEOUT_MS || 18000);
  return Number.isFinite(n) && n > 0 ? n : 18000;
}

function buildPrompt(userText, system) {
  var q = String(userText || '').trim().slice(0, 500);
  var sys = String(system || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
  if (sys) {
    return sys + ' User question: ' + q + ' Answer briefly in plain text.';
  }
  return 'Answer briefly in plain text: ' + q;
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
  if (/payment required|api key|budget too low|rate limit/i.test(t)) return true;
  return false;
}

async function callPollinations(userText, system) {
  var prompt = buildPrompt(userText, system);
  var url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt);
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs()) : null;
  try {
    var res = await fetch(url, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'HyperlinksStrategyAICore/1.0 (ctrategy.hyperlinks.space)'
      },
      signal: controller ? controller.signal : undefined
    });
    var text = await res.text();
    if (!res.ok || looksLikeError(text)) {
      return { ok: false, error: 'pollinations_unavailable' };
    }
    text = String(text || '').trim();
    if (text.length < 2) return { ok: false, error: 'empty' };
    // Cap runaway replies
    if (text.length > 1800) text = text.slice(0, 1797) + '...';
    return {
      ok: true,
      output_text: text,
      provider: 'free_llm_fallback',
      model: 'pollinations-anonymous',
      mode: 'chat'
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generate(userText, system) {
  if (!String(userText || '').trim()) {
    return { ok: false, error: 'empty_input' };
  }
  if (process.env.FREE_LLM_DISABLED === '1') {
    return { ok: false, error: 'disabled' };
  }
  return callPollinations(userText, system);
}

module.exports = {
  generate: generate,
  callPollinations: callPollinations
};
