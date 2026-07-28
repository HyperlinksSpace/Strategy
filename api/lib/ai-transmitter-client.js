/**
 * Hyperlinks Space AI Transmitter proxy for Strategy composer.
 * Used when Vercel AI Gateway / direct OpenAI are not configured on this deploy.
 *
 * Env:
 *   AI_TRANSMITTER_URL — default https://program.hyperlinks.space/api/ai
 *   AI_TRANSMITTER_DISABLED=1 — skip transmitter fallback
 */

function transmitterBaseUrl() {
  return (
    process.env.AI_TRANSMITTER_URL ||
    'https://program.hyperlinks.space/api/ai'
  ).replace(/\/$/, '');
}

function transmitterTimeoutMs() {
  var n = Number(process.env.AI_TRANSMITTER_TIMEOUT_MS || 12000);
  return Number.isFinite(n) && n > 0 ? n : 12000;
}

function isTransmitterConfigured() {
  if (process.env.AI_TRANSMITTER_DISABLED === '1') return false;
  // Require an explicit URL — the old default (program.hyperlinks.space) is not a working generator.
  return !!(process.env.AI_TRANSMITTER_URL && process.env.AI_TRANSMITTER_URL.trim());
}

function parseTransmitterBody(res, raw) {
  var body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch (e) {
    return { ok: false, error: 'Transmitter invalid JSON (' + res.status + ').' };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: (body && body.error) || ('Transmitter request failed (' + res.status + ').')
    };
  }

  if (!body || body.ok === false) {
    return {
      ok: false,
      error: (body && body.error) || 'Transmitter returned an error.'
    };
  }

  var text = String(body.output_text || body.text || body.message || '').trim();
  if (!text) {
    return { ok: false, error: 'Empty response from AI Transmitter.' };
  }

  return {
    ok: true,
    output_text: text,
    provider: 'ai_transmitter',
    model: body.model || null,
    mode: 'chat',
    transmitter: {
      url: transmitterBaseUrl(),
      provider: body.provider || null
    }
  };
}

function createTransmitterCaller() {
  if (!isTransmitterConfigured()) return null;

  return async function callTransmitter(input, system, options) {
    options = options || {};
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, transmitterTimeoutMs())
      : null;

    var payload = {
      input: input,
      mode: 'chat',
      context: Object.assign({
        source: 'strategy-site',
        surface: 'ai-core-composer',
        locale: 'en'
      }, options.context || {}),
      instructions: system || undefined
    };

    try {
      var res = await fetch(transmitterBaseUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      var raw = await res.text();
      return parseTransmitterBody(res, raw);
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      if (/abort/i.test(msg)) {
        return { ok: false, error: 'Transmitter request timed out.' };
      }
      return { ok: false, error: 'Transmitter: ' + msg };
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

module.exports = {
  transmitterBaseUrl: transmitterBaseUrl,
  isTransmitterConfigured: isTransmitterConfigured,
  createTransmitterCaller: createTransmitterCaller
};
