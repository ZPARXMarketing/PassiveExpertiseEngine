# Expertise Engine (Super-Learning)

> Active skill acquisition — metalearning, direct practice, drilling weaknesses, active retrieval.

This repo is a **hi-fi clickable prototype** of a tablet-first skill-acquisition app.
You create a **project** (any goal). The engine gives you:

1. **Blueprint** — path overview plus a row of **round concept icons**; tap one to open its
   full **study page** (metalearning)
2. **Terminal** — timed deep-work practice (direct practice)
3. **Synthesis** — Feynman explain-back + SRS review queue (encoding / retrieval)
4. **Dashboard** — retention heat map + micro-drills (rapid feedback)

Authored content ships for **Finance for small businesses** (med-spa P&L, cash vs profit)
and **B2B lead generation**. **Any other goal is designed by the model on the spot** —
see [Learning paths](#learning-paths) — falling back to a generic stub curriculum when
no key is configured. Everything in `src/data/` is shaped like an API boundary for
later AI/DB swap.

## Run it

```bash
npm install
npm run dev      # local dev server (no serverless functions)
npm run build    # production build → dist/
```

Study-page generation works under `npm run dev` as long as you paste an
OpenRouter key into **Settings**. To exercise the *server-side* key path instead,
run the Netlify function too:

```bash
npx netlify dev  # serves the SPA and /.netlify/functions/*
```

## Learning paths

Typing a goal on **Subjects** decides the whole curriculum:

1. **Authored samples win.** Goals matching the finance or B2B keywords open those
   hand-written curricula, including the CSV P&L task no generator can produce.
2. **Everything else is designed by the model.** One call returns the optimal path
   for that goal — 5–7 concepts in dependency order, marked for 80/20 weight, plus
   the first practice tasks, Feynman prompts with review cards, and MCQ drills. The
   app lays the concepts out as the blueprint graph itself (rows are dependency
   depth), wires each task/prompt/drill to its concept, and saves it as a normal
   project. All four stages work from the moment it lands — nothing else to set up.
3. **No key, or the call fails?** The project is still created with the generic
   starter path, and the reason stays on screen next to the input with a link to
   Settings. No goal is ever rejected.

Generated paths are marked `source: 'generated'` and carry an **ai path** badge on
their project card. They are never overwritten by the sample templates on load, and
"reset progress" clears statuses and retention in place instead of regenerating —
the curriculum you were given is the curriculum you keep.

The path generator is defensive about model output: ids are slugged and de-duplicated,
prerequisites pointing at unknown or later concepts are dropped, tasks and drills
aimed at concepts that do not exist are discarded, and a path with fewer than three
usable concepts is rejected outright rather than shown. If the model returns no usable
task or Feynman prompt, the app writes one against the first core concept so Terminal
and Synthesis are never empty.

Enabling generation is the same key and the same Settings as study pages — see below.
The two features share `OPENROUTER_API_KEY` and use one function each
(`generate-path`, `generate-study`).

## Concept study pages

The Blueprint is the dependency graph itself: every concept is a round icon on
the graph, encircled by a ring showing its retention, with a ★ badge on the
80/20 core nodes. Tapping (or focusing and pressing Enter on) a node opens a
dedicated study page — tagline, why it matters, 5–7 sections with a worked
example, formulas, key terms, common mistakes, and reveal-style self-checks —
plus buttons into the practice task, Feynman prompt and drill wired to that
concept.

Content comes from two places:

- **Authored** — the finance and B2B samples ship full study pages in
  `src/data/samples/*-study.ts`, so the app is useful with no API key.
- **Generated** — “Generate deep-dive” asks a cheap model through **OpenRouter**
  for the same JSON shape. The result is normalised, cached on the subject in
  localStorage, and survives a progress reset. Without a key the button returns a
  clear message and the authored outline stays on screen.

### Enabling generation

**Option A — your own key (Settings).** Open **Settings** (gear, bottom-left) and
paste an OpenRouter key from `openrouter.ai/keys`. The browser then calls
OpenRouter directly, so this works under plain `npm run dev` with no deploy. Pick
any model slug; the default is `deepseek/deepseek-chat`. “Test key” makes one
1-token call to confirm the key and model before you rely on them.

Note that a key in the browser is readable by anything with access to that
browser profile — fine for your own machine, not for a shared deployment.

**Option B — server-side key.** Leave Settings blank and set these in the Netlify
site environment; the app falls back to `netlify/functions/generate-study.mts` and
`netlify/functions/generate-path.mts`, which hold the key server-side:

| Variable | Required | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | — |
| `OPENROUTER_MODEL` | no | `deepseek/deepseek-chat` |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` |

Both paths send the same prompts (`src/data/studyPrompt.ts`,
`src/data/pathPrompt.ts`), so output is identical either way.

## Architecture

```
src/
  data/
    types.ts           Subject aggregate + task/synth/SRS/drill/study shapes
    subjects.ts        seed + sample matching + progress reset
    path.ts            path client: graph layout, normaliser, practice fallbacks
    pathPrompt.ts      curriculum prompt shared by browser and function
    study.ts           study-page client, normaliser, outline fallback
    studyPrompt.ts     prompt + request shape shared by browser and function
    samples/           finance + b2b + stub blueprints, *-study.ts pages
    pnl.ts             CSV P&L tagging evaluator
    drills.ts          rapid-calc question generator
  state/AppContext.tsx multi-subject store, localStorage key `pee-v2`
  components/          Subjects, Blueprint(+Graph), Concept, Terminal, Synthesis,
                       Dashboard, Drill, Settings
  styles/              theme tokens + responsive app-shell
netlify/functions/
  generate-path.mts    OpenRouter curriculum generator (server-side key path)
  generate-study.mts   OpenRouter study-page generator (server-side key path)
```

**Tablet (≥860px):** left side rail + multi-column terminal/dashboard.  
**Phone:** bottom tab bar; layouts stack.

Progress is **per project** in `localStorage` (`pee-v2`). Generation settings
live separately under `pee-settings-v1`, so clearing the API key never touches
your projects.

## Roadmap / pivot plan

See [TODO.md](./TODO.md).
