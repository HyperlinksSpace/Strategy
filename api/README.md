# Strategy `/api/ai` — TinyModel composer (Vercel serverless)

Runs on **Vercel** at `ctrategy.hyperlinks.space/api/ai`. Calls the **Railway TinyModel sidecar** at `tinymodel.hyperlinks.space` for `POST /v1/plan`, then **Vercel AI Gateway** for LLM generation.

**Deploy + env:** [`deploy/vercel/README.md`](../deploy/vercel/README.md)
## Flow

```text
Browser (ai-chat.js)
  → POST /api/ai { input, mode, context, instructions }
      → POST TINYMODEL_API_URL/v1/plan   (TinyModel sidecar)
      → template (navigate) or Vercel AI generateText (RAG-enriched chat; OpenAI legacy fallback)
  ← { ok, output_text, actions[], meta.tinymodel }
```

## Vercel env

| Variable | Required | Default |
| -------- | -------- | ------- |
| `TINYMODEL_API_URL` | No | [https://tinymodel.hyperlinks.space](https://tinymodel.hyperlinks.space) |
| `AI_PROVIDER` | No | `hybrid` (`vercel_ai` · `openai` · `tinymodel`) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (OIDC on Vercel deploy) | — |
| `AI_COMPOSER_QUALITY_MODEL` | No | `openai/gpt-4o-mini` |
| `OPENAI` or `OPENAI_API_KEY` | Legacy LLM fallback | — |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |
| `TINYMODEL_PLAN_TIMEOUT_MS` | No | `20000` |

Run `npm install` in repo root (Vercel `ai` SDK for `/api/ai`).

**Generation routing (`hybrid`):**

| Composer choice | When | `meta.generator` |
| --------------- | ---- | ---------------- |
| **TinyModel only** | Section nav template, sidecar handshake, high-confidence short RAG | `tinymodel` |
| **Vercel AI Gateway** | Complex questions, explain/meta, soft rephrase, low-confidence chat | `vercel_ai` |
| **Legacy OpenAI** | Gateway unavailable | `openai` |

Gateway uses `@ai-sdk/gateway` + `AI_GATEWAY_API_KEY`. Model strings like `openai/gpt-4o-mini` with fallbacks via `AI_GATEWAY_ORDER` / `AI_GATEWAY_FALLBACK_MODELS`.

Inspect routing in responses: `meta.lane`, `meta.route_reason`, `meta.model`, `meta.gateway`.

## Local dev

```bash
npm i -g vercel   # once
vercel dev        # serves /api/ai on http://localhost:3000
```

`js/settings.js` includes `localhost` in `sameOriginHosts` so AI CORE calls same-origin `/api/ai`.

## Verify

```bash
node scripts/ai-composer-smoke.js
curl -sS http://localhost:3000/api/ai -H 'Content-Type: application/json' \
  -d '{"input":"open roadmap","context":{"locale":"en"}}'
```

### Sidecar handshake test flow

1. TinyModel (`POST /v1/plan`) recognizes `sidecar ping` / `sidecar ping strategy ai core` and returns `intent: strategy_handshake` with `reply_text` containing **`TM1-SIDECAR-OK`** (fast path — no classify/retrieve).
2. Strategy composer echoes that `reply_text` as `output_text` with `provider: tinymodel-sidecar` and `meta.sidecar_verified: true`.
3. In the browser AI CORE on [ctrategy.hyperlinks.space](https://ctrategy.hyperlinks.space/), send the ping phrase and confirm the fingerprint appears in the chat bubble.

```bash
# Production pair check
curl -sS -X POST https://tinymodel.hyperlinks.space/v1/plan \
  -H 'Content-Type: application/json' \
  -d '{"text":"sidecar ping strategy ai core"}'

curl -sS -X POST https://ctrategy.hyperlinks.space/api/ai \
  -H 'Content-Type: application/json' \
  -d '{"input":"sidecar ping strategy ai core","mode":"chat","context":{"locale":"en"}}'
```

## Client routing (local-first)

These stay **entirely in `ai-core.js`** — never hit TinyModel:

| Input | Handler |
| ----- | ------- |
| Premade chips (Overview, Guided tour, Current section, section names) | Local tour / help / `presentSection` |
| Section nav labels (`Roadmap`, `Vision`, …) | `openSection` + i18n voice |
| Tour / help / here keywords | `startTour`, `ai.help`, `ai.here` |

TinyModel composer runs only for **general chat** fallback (`askGeneral`). When the sidecar returns `strategy_section`, the client uses **`presentSection`** (same UX as chips), not a generic English template.

---

When TinyModel maps to a strategy section, the API returns:

```json
{ "type": "strategy_section", "sectionId": "roadmap" }
```

`ai-core.js` scrolls to that section while showing `output_text`.
