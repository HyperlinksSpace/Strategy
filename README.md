# Hyperlinks Space — $1T Strategic Master Plan

Interactive strategy website for [Hyperlinks Space](https://github.com/HyperlinksSpace). Synthesizes the full interplanetary infrastructure blueprint: MQTT, OPC UA, DTN, CRDT, Edge AI, four-phase roadmap, and trillion-dollar moats.

## Live Site

After enabling GitHub Pages on this repository:

**Settings → Pages → Source: Deploy from branch → `main` / `/ (root)`**

Site URL: `https://hyperlinksspace.github.io/Strategy/`

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

The floating **AI CORE** chat calls `POST /api/ai` (Vercel serverless). The gateway uses the **TinyModel sidecar** (`POST /v1/plan`) as composer control plane, then returns `output_text` (+ optional section scroll actions).

- **Static preview** (`python -m http.server`): chat uses remote `program.hyperlinks.space/api/ai` unless you change `js/settings.js`.
- **Full stack**: `vercel dev` + env vars — see [`api/README.md`](api/README.md).
- **Smoke test**: `node scripts/ai-composer-smoke.js`

---

*The monopoly from hyperlinks to space and beyond.*
