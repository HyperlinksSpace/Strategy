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

---

*The monopoly from hyperlinks to space and beyond.*
