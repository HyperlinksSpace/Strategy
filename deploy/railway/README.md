# Railway — Strategy AI gateway

Serves the strategy SPA + **`POST /api/ai`** composer:

```text
Browser → /api/ai → tinymodel.hyperlinks.space/v1/plan → Vercel AI Gateway (or TinyModel-only)
```

## Deploy

```bash
cd Strategy
railway login
export AI_GATEWAY_API_KEY=...   # optional here; can set in Railway dashboard
bash deploy/railway/deploy-new-instance.sh
```

After deploy:

```bash
railway domain --service Strategy-AI-Gateway
```

Point **ctrategy.hyperlinks.space** CNAME to Railway (or add custom domain in Railway dashboard).

## Required variables

| Variable | Value |
| -------- | ----- |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key |
| `TINYMODEL_API_URL` | `https://tinymodel.hyperlinks.space` |
| `AI_PROVIDER` | `hybrid` |

## Verify

```bash
curl -sS https://YOUR-URL/healthz
curl -sS https://YOUR-URL/api/ai
curl -sS -X POST https://YOUR-URL/api/ai \
  -H 'Content-Type: application/json' \
  -d '{"input":"sidecar ping strategy ai core","context":{"locale":"en"}}'
```

Expect `meta.generator: vercel_ai` for complex prompts when Gateway key is set.

## Client wiring

In `js/settings.js`, add Railway host to `sameOriginHosts` or set:

```javascript
endpoint: 'https://YOUR-RAILWAY-URL/api/ai'
```
