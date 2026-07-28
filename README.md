# Expertise Engine (Super-Learning)

> Active skill acquisition — metalearning, direct practice, drilling weaknesses, active retrieval.

This repo is a **hi-fi clickable prototype** of a tablet-first skill-acquisition app.
You create a **project** (any goal). The engine gives you:

1. **Blueprint** — path overview plus a row of **round concept icons**; tap one to open its
   full **study page** (metalearning)
2. **Terminal** — timed deep-work practice (direct practice)
3. **Synthesis** — Feynman explain-back + SRS review queue (encoding / retrieval)
4. **Dashboard** — retention heat map + micro-drills (rapid feedback)

Mock content ships for **Finance for small businesses** (med-spa P&L, cash vs profit)
and **B2B lead generation**. Any other goal gets a generic stub curriculum.
Everything in `src/data/` is shaped like an API boundary for later AI/DB swap.

## Run it

```bash
npm install
npm run dev      # local dev server (no serverless functions)
npm run build    # production build → dist/
```

To exercise the study-page generator locally you need the Netlify function running too:

```bash
npx netlify dev  # serves the SPA and /.netlify/functions/*
```

## Concept study pages

Every node on the Blueprint is a round icon. Tapping it opens a dedicated page —
tagline, why it matters, 5–7 sections with a worked example, formulas, key terms,
common mistakes, and a reveal-style self-check — plus buttons into the practice
task, Feynman prompt and drill wired to that concept.

Content comes from two places:

- **Authored** — the finance and B2B samples ship full study pages in
  `src/data/samples/*-study.ts`, so the app is useful with no API key.
- **Generated** — “Generate deep-dive” calls `netlify/functions/generate-study.mts`,
  which asks a cheap chat model (**DeepSeek** by default) for the same JSON shape.
  The result is normalised, cached on the subject in localStorage, and survives a
  progress reset. Without a key the button returns a clear message and the authored
  outline stays on screen.

### Enabling generation

Set these in the Netlify site environment (or `.env` for `netlify dev`):

| Variable | Required | Default |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | yes | — |
| `DEEPSEEK_MODEL` | no | `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | no | `https://api.deepseek.com` |

The base URL is OpenAI-compatible, so any cheap provider that speaks
`/chat/completions` with `response_format: json_object` can be dropped in by
changing those two variables. The key never reaches the browser.

## Architecture

```
src/
  data/
    types.ts           Subject aggregate + task/synth/SRS/drill/study shapes
    subjects.ts        seed + goal→curriculum factory
    study.ts           study-page client, normaliser, outline fallback
    samples/           finance + b2b + stub blueprints, *-study.ts pages
    pnl.ts             CSV P&L tagging evaluator
    drills.ts          rapid-calc question generator
  state/AppContext.tsx multi-subject store, localStorage key `pee-v2`
  components/          Subjects, Blueprint, Concept, Terminal, Synthesis, Dashboard, Drill
  styles/              theme tokens + responsive app-shell
netlify/functions/
  generate-study.mts   DeepSeek-backed study-page generator (key stays server-side)
```

**Tablet (≥860px):** left side rail + multi-column terminal/dashboard.  
**Phone:** bottom tab bar; layouts stack.

Progress is **per project** in `localStorage` (`pee-v2`).

## Roadmap / pivot plan

See [TODO.md](./TODO.md).
