# Strategy site + AI composer gateway (TinyModel sidecar + Vercel AI Gateway)
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    TINYMODEL_API_URL=https://tinymodel.hyperlinks.space \
    AI_PROVIDER=hybrid \
    AI_COMPOSER_QUALITY_MODEL=openai/gpt-4o-mini \
    AI_COMPOSER_FAST_MODEL=openai/gpt-4.1-nano

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY api/ ./api/
COPY index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY CNAME ./
COPY .nojekyll ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

CMD ["node", "server.js"]
