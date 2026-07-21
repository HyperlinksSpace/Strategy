# Vercel deploy — Strategy site + AI composer

**Website:** Vercel → [ctrategy.hyperlinks.space](https://ctrategy.hyperlinks.space)  
**TinyModel sidecar (composer control plane):** Railway → [tinymodel.hyperlinks.space](https://tinymodel.hyperlinks.space)

The static site and `POST /api/ai` run on **Vercel**. Vercel `/api/ai` calls the **Railway sidecar** for `/v1/plan`, then **Vercel AI Gateway** for generation when configured.

```text
Browser (ctrategy.hyperlinks.space)
  → Vercel POST /api/ai
      → Railway tinymodel.hyperlinks.space POST /v1/plan
      → Vercel AI Gateway (AI_GATEWAY_API_KEY)
  ← output_text + actions
```

## Vercel project env (required)

Set in **Vercel → Strategy project → Settings → Environment Variables** (Production):

| Variable | Value |
| -------- | ----- |
| `TINYMODEL_API_URL` | `https://tinymodel.hyperlinks.space` |
| `AI_GATEWAY_API_KEY` | Your Vercel AI Gateway API key |
| `AI_PROVIDER` | `hybrid` |
| `AI_COMPOSER_QUALITY_MODEL` | `openai/gpt-4o-mini` (optional) |
| `AI_COMPOSER_FAST_MODEL` | `openai/gpt-4.1-nano` (optional) |

Optional legacy fallback: `OPENAI` or `OPENAI_API_KEY`.

## Deploy

```bash
cd Strategy
git push origin main   # if Vercel GitHub integration is connected
# or:
vercel --prod
```

After changing env vars, **Redeploy** the Vercel project.

## Verify

```bash
curl -sS https://ctrategy.hyperlinks.space/api/ai
curl -sS -X POST https://ctrategy.hyperlinks.space/api/ai \
  -H 'Content-Type: application/json' \
  -d '{"input":"explain TinyModel sidecar","context":{"locale":"en"}}'
```

Expect:
- `tinymodel.url`: `https://tinymodel.hyperlinks.space`
- `vercel_ai.gateway_key`: `true` (when `AI_GATEWAY_API_KEY` is set)
- `meta.generator`: `vercel_ai` for complex prompts

```bash
node scripts/ai-composer-smoke.js --base-url https://ctrategy.hyperlinks.space
```

## Not on Railway

The **Strategy website** should not be deployed to Railway. Only **TinyModel** sidecar lives on Railway (`TinyModel` / `TinyModel-sidecar-*` services in project HSP).

Optional `server.js` + `Dockerfile` in this repo are for self-host experiments only — production uses Vercel `api/ai.js`.
