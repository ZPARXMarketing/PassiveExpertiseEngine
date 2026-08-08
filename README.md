# Domain Engine

> Type a topic. Get a few broad paths. Pick one or two. Do one useful dose a day while your knowledge character levels up.

This repo is a **hi-fi clickable prototype** of a tablet-first learning app. Its previous
version treated the thing you typed as a finished curriculum — one project, one flat graph
of 5–7 concepts. That collapses the moment someone types something real like *"Quantum
Mechanics"*: combinatorial explosion, decision paralysis, a dead UI.

So the top-level input is now a **Domain**, not a curriculum. A domain contains:

- a small set of high-level **Paths** — genuinely different routes through the field
- **progressive zoom** — only the next useful layer is ever visible
- an **adaptive schedule** that pushes doses into a daily **Feed**
- a **scoring / identity layer** that makes progress feel like something

The old four-stage engine (blueprint → practice → synthesis → drills) still exists. It just
stopped being the navigation and became the execution layer the Feed calls into.

## Run it

```bash
npm install
npm run dev      # local dev server (no serverless functions)
npm run build    # production build → dist/
```

Generation works under `npm run dev` as long as you paste an OpenRouter key into
**Settings**. To exercise the *server-side* key path instead:

```bash
npx netlify dev  # serves the SPA and /.netlify/functions/*
```

With no key at all the app is still fully walkable — see [Offline behaviour](#offline-behaviour).

## The four pillars

### 1. Domain + progressive paths

Typing a topic makes **one cheap call** that returns 4–6 broad paths — title, pitch, payoff,
depth estimate — and *no concepts at all*. That is the anti-overwhelm move: you cannot be
buried by a list of six routes.

Choosing a path triggers a **second call** for that path's **layer 0** only: 5–8 concepts in
dependency order, plus the practice hanging off them. Deeper layers stay collapsed until the
layer above is warm (or you deliberately unlock it anyway). At most two paths run at once.

The result is that the screen never shows dozens of things, whether you typed "negotiating
commercial leases" or "quantum mechanics".

### 2. The Feed is the home

There is no dashboard. The home screen is a live **Lesson Feed** — the single answer to
"what should I do today?". Cards cover new concept unlocks, decaying nodes, smart drills,
teach-back micros, practice blocks, depth unlocks, rank-ups and side quests.

Feed cards are **derived on every render and never persisted**. Doing the work behind a card
(answering its items, finishing its block) is what makes it disappear, so the Feed can't drift
out of sync with reality. It is capped at 8 cards: a feed you can't finish is the same
overwhelm problem in a different shape.

### 3. Smart guidance + adaptive scheduler

`src/data/scheduler.ts` reads recent retrieval accuracy and how warm the unlocked frontier is,
then picks a pace:

| pace | when | effect |
| --- | --- | --- |
| `accelerated` | ≥85% recent accuracy, warm frontier | 2 new concepts/day, branches open sooner |
| `steady` | default | 1 new concept/day, mixed with review |
| `remedial` | <60% accuracy, or a cold frontier | **0** new concepts; consolidation weeks inserted |

Reviews and new material are interleaved in one Feed. There is no separate review queue to
fall behind on.

### 4. Scoring and identity

Domain Rank (Novice → Initiate → Practitioner → Specialist → Authority → Master), XP for real
mastery, a visible frontier, mastery percentage of *your chosen subgraph*, and a streak
multiplier capped at 1.5× that only moves when a dose is actually completed. XP is never paid
for opening a page.

## Execution layer

**Path Roadmap replaces the sparse graph.** Big readable concept cards in teaching order, one
layer at a time. The dependency graph survives as an optional map behind a toggle on the Paths
screen, for people who want the whole shape at once.

**The writing tax is gone.** The default retrieval diet is high-discrimination MCQs,
application scenarios, structured reconstruction and short answers. Teach-backs are
**structured by default** — two or three one-line prompts instead of a blank textarea — with
free writing available as an opt-in advanced mode. Nothing requires an essay to advance.

**Retrieval items are derived from content the app already has.** Opening a concept mines its
study page for items: check-yourself pairs become short answers, common mistakes become
"which of these is the actual trap?", and sibling concepts on the same layer supply the
distractors that turn a definition into a discrimination item.

**Modern scheduling underneath.** `src/data/fsrs.ts` implements FSRS-4.5 with the published
default weights: every item carries **stability** (days until recall drops to 90%) and
**difficulty** (1–10). Because retrievability is a decay curve rather than a counter, concept
retention answers "how likely is recall *right now*?" — which is what drives the heat map,
the Feed's ordering, and every unlock decision.

## Daily loop

1. Open a domain → land on the Feed
2. Do the next dose (usually 60–180 seconds)
3. Occasionally open a full concept or a practice block
4. Watch rank and frontier advance
5. Repeat

## Offline behaviour

No topic is ever rejected and no chosen path is ever a dead end:

1. **Authored samples win.** "Finance for small businesses" and "B2B lead generation" open
   hand-written domains, including the CSV P&L task no generator can produce.
2. **Everything else is mapped by the model** — paths first, then one layer at a time.
3. **No key, or the call fails?** The domain is created with starter routes, a selected path
   opens with a starter layer, and the reason stays on screen with a link to Settings.
4. **Teach-back grading** prefers the LLM grader and falls back to the local rubric, saying
   which one ran.

Both generation paths are defensive about model output: ids are slugged and namespaced to
their path, prerequisites pointing at unknown or later concepts are dropped, items aimed at
concepts that do not exist are discarded, written items with no rubric are rejected as
ungradeable, and a layer with fewer than three usable concepts is rejected outright.

## Enabling generation

**Option A — your own key (Settings).** Paste an OpenRouter key from `openrouter.ai/keys`.
The browser then calls OpenRouter directly, so this works under plain `npm run dev` with no
deploy. "Test key" makes one 1-token call to confirm the key and model.

Note that a key in the browser is readable by anything with access to that browser profile —
fine for your own machine, not for a shared deployment.

**Option B — server-side key.** Leave Settings blank and set these in the Netlify site
environment; the app falls back to the functions, which hold the key server-side:

| Variable | Required | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | — |
| `OPENROUTER_MODEL` | no | `deepseek/deepseek-chat` |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` |

Both paths send the same prompts (`src/data/domainPrompt.ts`, `src/data/studyPrompt.ts`), so
output is identical either way.

## Architecture

```
src/
  data/
    types.ts           Domain aggregate: paths, layers, retrieval items, plan, progress
    domain.ts          domain + layer generation client, offline fallbacks, layer merge
    domainPrompt.ts    the two prompts (paths, then one layer) shared with the functions
    layer.ts           layer normaliser: id namespacing, dependency rows, map layout
    domains.ts         seeds, sample matching, v2 → v3 migration, progress reset
    feed.ts            the coach — derives today's Feed cards from domain state
    scheduler.ts       pace, frontier warmth, new-concept budget, rolling plan
    fsrs.ts            FSRS-4.5 scheduling at the retrieval-item level
    retrieval.ts       item derivation from study content, grading, queues
    rank.ts            XP, ranks, mastery, frontier, streaks
    retention.ts       time-based decay for concepts with no items yet
    study.ts           study-page client, normaliser, outline fallback
    grade.ts           LLM teach-back grading with a local rubric fallback
    samples/           finance + b2b authored domains, *-study.ts pages
    pnl.ts, drills.ts  CSV P&L evaluator, rapid-calc question generator
  state/AppContext.tsx single store, localStorage key `pee-v3`
  components/          Domains, Feed, Paths(+Roadmap, Graph), Concept, Terminal,
                       Retrieval(+TeachBack), Progress, Drill, Settings
netlify/functions/
  generate-domain.mts  paths for a topic (server-side key path)
  generate-layer.mts   one layer of one path
  generate-study.mts   concept study page
  generate-grade.mts   teach-back grading
```

**Tablet (≥860px):** left side rail + multi-column layouts. **Phone:** bottom tab bar; layouts
stack.

Progress is **per domain** in `localStorage` (`pee-v3`). A `pee-v2` save from the previous
version is migrated on load: the old graph becomes the first layer of a single "Core path",
and old SRS cards become recall items with fresh memory state — SM-2 ease does not translate
into FSRS stability, so re-measuring beats inventing one. Generation settings live separately
under `pee-settings-v1`, so clearing the API key never touches your domains.

## Roadmap / pivot plan

See [TODO.md](./TODO.md).
