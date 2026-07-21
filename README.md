# Hyperlinks Space — $1T Strategic Master Plan

Interactive strategy website for [Hyperlinks Space](https://github.com/HyperlinksSpace). Synthesizes the full interplanetary infrastructure blueprint: MQTT, OPC UA, DTN, CRDT, Edge AI, four-phase roadmap, and trillion-dollar moats.

## Live Site

**Production (Vercel):** [https://ctrategy.hyperlinks.space](https://ctrategy.hyperlinks.space)

Also: `https://hyperlinks-strategy.vercel.app` · GitHub Pages mirror (static only, no `/api/ai`): `https://hyperlinksspace.github.io/Strategy/`

## Features

- **EN / RU / 中文** language switch (persisted in localStorage)
- **Light / Dark / System** theme (persisted in localStorage)
- Animated orbital diagrams, architecture stack, revenue cycle
- Gap analysis: current GitHub state vs $1T target
- Four-phase execution roadmap (2026–2040+)
- Founder north-star milestones

## Structure

```
Strategy/
├── index.html          # Main SPA
├── css/main.css        # Theme system & layout
├── js/
│   ├── i18n.js         # Translations (en, ru, zh)
│   └── app.js          # Theme, language, UX
├── promts/             # Source strategy prompts
└── .nojekyll           # GitHub Pages (skip Jekyll)
```

## Local Preview

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Open `http://localhost:8080`

## AI CORE + TinyModel composer

The floating **AI CORE** chat calls `POST /api/ai` (Vercel serverless). The gateway uses the **TinyModel sidecar** ([tinymodel.hyperlinks.space](https://tinymodel.hyperlinks.space/) → `POST /v1/plan`) as composer control plane, then returns `output_text` (+ optional section scroll actions).

- **Static preview** (`python -m http.server`): chat falls back to the configured remote endpoint in `js/settings.js`.
- **Full stack**: deploy on **Vercel** with env vars — see [`deploy/vercel/README.md`](deploy/vercel/README.md).
- **Smoke test**: `node scripts/ai-composer-smoke.js --base-url https://ctrategy.hyperlinks.space`

### Sidecar handshake (prove TinyModel → AI CORE)

Use this phrase in **AI CORE** (typed message, not a chip) to verify the Railway sidecar is the source of the reply:

```text
sidecar ping strategy ai core
```

**Pass criteria** — the bot must reply with a line containing `TM1-SIDECAR-OK`, for example:

```text
SIDECAR_OK · TM1-SIDECAR-OK · HyperlinksSpace/TinyModel1 · tinymodel.hyperlinks.space · intent=strategy_handshake · pair=strategy-ai-core
```

API check (same token):

```bash
curl -sS -X POST https://ctrategy.hyperlinks.space/api/ai \
  -H 'Content-Type: application/json' \
  -d '{"input":"sidecar ping strategy ai core","mode":"chat","context":{"locale":"en","surface":"ai-core"}}'
# expect: provider "tinymodel-sidecar", meta.sidecar_verified true, output_text with TM1-SIDECAR-OK
```

Direct sidecar:

```bash
curl -sS -X POST https://tinymodel.hyperlinks.space/v1/plan \
  -H 'Content-Type: application/json' \
  -d '{"text":"sidecar ping"}'
# expect: intent "strategy_handshake", reply_text with TM1-SIDECAR-OK
```

---

*The monopoly from hyperlinks to space and beyond.*
