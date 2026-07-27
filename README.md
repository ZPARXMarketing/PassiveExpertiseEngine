# Expertise Engine (Super-Learning)

> Active skill acquisition — metalearning, direct practice, drilling weaknesses, active retrieval.

This repo is a **hi-fi clickable prototype** of a tablet-first skill-acquisition app.
You create a **project** (any goal). The engine gives you:

1. **Blueprint** — path overview of the skill, concept steps with “what you’ll learn,” plus 80/20 graph (metalearning)
2. **Terminal** — timed deep-work practice (direct practice)
3. **Synthesis** — Feynman explain-back + SRS review queue (encoding / retrieval)
4. **Dashboard** — retention heat map + micro-drills (rapid feedback)

Mock content ships for **Finance for small businesses** (med-spa P&L, cash vs profit)
and **B2B lead generation**. Any other goal gets a generic stub curriculum.
Everything in `src/data/` is shaped like an API boundary for later AI/DB swap.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

## Architecture

```
src/
  data/
    types.ts           Subject aggregate + task/synth/SRS/drill shapes
    subjects.ts        seed + goal→curriculum factory
    samples/           finance + b2b + stub blueprints
    pnl.ts             CSV P&L tagging evaluator
    drills.ts          rapid-calc question generator
  state/AppContext.tsx multi-subject store, localStorage key `pee-v2`
  components/          Subjects, Blueprint, Terminal, Synthesis, Dashboard, Drill
  styles/              theme tokens + responsive app-shell
```

**Tablet (≥860px):** left side rail + multi-column terminal/dashboard.  
**Phone:** bottom tab bar; layouts stack.

Progress is **per project** in `localStorage` (`pee-v2`).

## Roadmap / pivot plan

See [TODO.md](./TODO.md).
