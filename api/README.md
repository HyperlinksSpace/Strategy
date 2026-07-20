# Strategy `/api/ai` — TinyModel composer

Serverless gateway (`api/ai.js`) for the AI CORE chat on the strategy site.

## Flow

```text
Browser (ai-chat.js)
  → POST /api/ai { input, mode, context, instructions }
      → POST TINYMODEL_API_URL/v1/plan   (TinyModel sidecar)
      → template (navigate) or OpenAI (RAG-enriched chat)
  ← { ok, output_text, actions[], meta.tinymodel }
```

## Vercel env

| Variable | Required | Default |
| -------- | -------- | ------- |
| `TINYMODEL_API_URL` | No | [https://tinymodel.hyperlinks.space](https://tinymodel.hyperlinks.space) |
| `OPENAI` or `OPENAI_API_KEY` | For LLM replies | — |
| `OPENAI_MODEL` | No | `gpt-4o-mini` |
| `AI_PROVIDER` | No | `hybrid` (`openai` = legacy OpenAI-only) |
| `TINYMODEL_PLAN_TIMEOUT_MS` | No | `8000` |

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
