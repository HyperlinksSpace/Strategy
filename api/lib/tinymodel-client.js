/**
 * TinyModel sidecar client for Strategy /api/ai composer.
 * Calls POST /v1/plan on the Railway sidecar (HyperlinksSpace/TinyModel1 + HSP corpus).
 */

function tinymodelBaseUrl() {
  return (
    process.env.TINYMODEL_API_URL ||
    'https://tinymodel.hyperlinks.space'
  ).replace(/\/$/, '');
}

function planTimeoutMs() {
  var n = Number(process.env.TINYMODEL_PLAN_TIMEOUT_MS || 8000);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

async function postJson(path, body) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller
    ? setTimeout(function () { controller.abort(); }, planTimeoutMs())
    : null;

  try {
    var res = await fetch(tinymodelBaseUrl() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });
    var text = await res.text();
    var data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new Error('TinyModel ' + path + ' invalid JSON (' + res.status + ')');
    }
    if (!res.ok) {
      var detail = data && data.detail ? JSON.stringify(data.detail) : text;
      throw new Error('TinyModel ' + path + ' ' + res.status + ': ' + detail);
    }
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function planRequest(text, options) {
  options = options || {};
  return postJson('/v1/plan', {
    text: text,
    context: options.context,
    candidates: options.candidates || [],
    top_k: options.topK != null ? options.topK : 2,
    min_confidence: options.minConfidence != null ? options.minConfidence : 0.55,
    min_margin: options.minMargin != null ? options.minMargin : 0.1
  });
}

function buildMetaTinyModel(plan) {
  var entries = plan.probs ? Object.entries(plan.probs) : [];
  var top = entries.length
    ? entries.reduce(function (a, b) { return b[1] > a[1] ? b : a; })[0]
    : (plan.routing && plan.routing.label);
  return {
    model: 'HyperlinksSpace/TinyModel1',
    intent: plan.intent,
    route_hint: plan.route_hint,
    actions: plan.actions,
    routing: plan.routing,
    retrieval: plan.retrieval,
    classify_top_label: top || null
  };
}

module.exports = {
  tinymodelBaseUrl: tinymodelBaseUrl,
  planRequest: planRequest,
  buildMetaTinyModel: buildMetaTinyModel
};
