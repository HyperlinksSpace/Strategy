#!/usr/bin/env bash
# Deploy Strategy AI gateway (TinyModel composer + Vercel AI Gateway) on Railway.
# Run from Strategy repo root after: railway login
#
# Usage:
#   bash deploy/railway/deploy-new-instance.sh
#   SERVICE_NAME=Strategy-AI-Gateway bash deploy/railway/deploy-new-instance.sh
#
# Required in Railway dashboard (or export before run):
#   AI_GATEWAY_API_KEY=...   (Vercel AI Gateway — not passed on CLI by default)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SERVICE_NAME="${SERVICE_NAME:-Strategy-AI-Gateway}"
HSP_PROJECT_ID="${HSP_PROJECT_ID:-357753f3-3481-4559-af22-32c41cf7293e}"
RAILWAY_ENV="${RAILWAY_ENV:-production}"

echo "==> Strategy AI gateway Railway deploy (${SERVICE_NAME})"

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm i -g @railway/cli"
  exit 1
fi

railway whoami >/dev/null 2>&1 || railway login

echo "==> Linking project HSP (${HSP_PROJECT_ID}), env ${RAILWAY_ENV}"
railway link -p "$HSP_PROJECT_ID" -e "$RAILWAY_ENV" 2>/dev/null || railway link -p "$HSP_PROJECT_ID" -e "$RAILWAY_ENV"

if ! railway status 2>/dev/null | grep -q "Service:"; then
  echo "==> Creating service ${SERVICE_NAME}"
  MSYS_NO_PATHCONV=1 railway add --service "$SERVICE_NAME" \
    --variables "TINYMODEL_API_URL=https://tinymodel.hyperlinks.space" \
    --variables "AI_PROVIDER=hybrid" \
    --variables "HOST=0.0.0.0" \
    --variables "AI_COMPOSER_QUALITY_MODEL=openai/gpt-4o-mini" \
    --variables "AI_COMPOSER_FAST_MODEL=openai/gpt-4.1-nano"
fi

railway service "$SERVICE_NAME"

echo "==> Ensuring variables"
MSYS_NO_PATHCONV=1 railway variables \
  --set "TINYMODEL_API_URL=https://tinymodel.hyperlinks.space" \
  --set "AI_PROVIDER=hybrid" \
  --set "HOST=0.0.0.0" \
  --set "AI_COMPOSER_QUALITY_MODEL=openai/gpt-4o-mini" \
  --set "AI_COMPOSER_FAST_MODEL=openai/gpt-4.1-nano"

if [[ -n "${AI_GATEWAY_API_KEY:-}" ]]; then
  railway variables --set "AI_GATEWAY_API_KEY=${AI_GATEWAY_API_KEY}"
  echo "    AI_GATEWAY_API_KEY set from environment"
else
  echo ""
  echo "⛔ Set AI_GATEWAY_API_KEY in Railway → ${SERVICE_NAME} → Variables"
  echo "   (Vercel dashboard → AI Gateway → API Keys)"
  echo ""
fi

echo "==> Deploying (railway up --detach)"
railway up --detach

echo ""
echo "==> After healthy:"
echo "    railway domain --service ${SERVICE_NAME}"
echo "    curl -sS https://YOUR-URL/healthz"
echo "    curl -sS -X POST https://YOUR-URL/api/ai -H 'Content-Type: application/json' \\"
echo "      -d '{\"input\":\"explain TinyModel sidecar\",\"context\":{\"locale\":\"en\"}}'"
echo ""
railway status
