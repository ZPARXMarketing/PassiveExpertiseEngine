# Pivot: Passive Expertise Engine → Domain Engine

## The problem this pivot solves

The previous model treated the top-level input as **one project with a flat graph of 5–7
concepts**. That works for "finance for small businesses". It collapses the moment someone
types something real like **"Quantum Mechanics"**: there is no single six-concept path through
a field that size, so asking for one produces either mush or an unusable wall. Combinatorial
explosion → decision paralysis → dead UI.

## The new mental model

The top-level input is a **Domain**, not a finished curriculum. A domain is a living thing
that contains a few broad **Paths**, reveals only the layer you are on, schedules itself, and
tracks who you are becoming in it.

The old four-stage engine (Blueprint → Terminal → Synthesis → Dashboard) still exists
underneath. It stopped being the top-level navigation and became the **execution layer the
Feed calls into**.

## Shipped in this pivot

### 1. Domain + progressive paths (anti-overwhelm + agency)
- `generateDomain` returns 4–6 paths — pitch, payoff, depth estimate — and **no concepts**.
- The learner picks 1–2. Everything else stays collapsed. A third pick is refused.
- `generateLayer` builds **one layer** (5–8 concepts) of **one path** on select, and again on
  each unlock. Deeper layers stay locked until the layer above is warm, or until the learner
  deliberately opens it.
- Files: `src/data/domain.ts`, `domainPrompt.ts`, `layer.ts`, `components/PathsScreen.tsx`.

### 2. The Feed is the home
- `DashboardScreen` is gone. `FeedScreen` is the landing surface.
- Cards: concept unlock, decaying review, first pass, drill, teach-back, deep-work block,
  depth unlock, rank-up, side quest. Capped at 8.
- Cards are **derived, never persisted** — doing the work is what removes them.
- Files: `src/data/feed.ts`, `components/FeedScreen.tsx`.

### 3. Smart guidance + adaptive scheduler
- Pace (`remedial` / `steady` / `accelerated`) from recent retrieval accuracy and frontier
  warmth; `newConceptBudget` returns **0** when the frontier is cold, so struggling slows the
  frontier instead of piling on.
- Rolling multi-week plan interleaves the chosen paths so neither is abandoned.
- Files: `src/data/scheduler.ts`.

### 4. Scoring & identity
- Ranks Novice → Master, XP only for real mastery events, mastery % of the chosen subgraph,
  visible frontier, streak multiplier capped at 1.5× and tied to completed doses.
- Files: `src/data/rank.ts`, `components/ProgressScreen.tsx`.

### Execution-layer changes
- **Path Roadmap** (`components/PathRoadmap.tsx`) replaces the sparse graph as the primary
  view; the graph is an optional map behind a toggle.
- **Writing tax killed.** Default items are MCQ / discrimination / application / short answer /
  reconstruction / recall. Teach-backs are structured scaffolds by default, free writing opt-in.
- **Smarter items**, derived from study content plus sibling concepts for distractors
  (`src/data/retrieval.ts`).
- **FSRS-4.5** at the item level (`src/data/fsrs.ts`); concept retention is aggregated live
  retrievability, which drives the Feed, the heat map and every unlock decision.

### Data / migration
- `Subject` → `Domain` throughout; `srs: SrsCard[]` → `items: RetrievalItem[]`;
  `cardsOnPass` → `itemsOnPass`.
- localStorage `pee-v2` → `pee-v3`, migrated on load: the old graph becomes layer 0 of a
  single "Core path", old SRS cards become recall items with fresh memory state.
- Netlify: `generate-path` replaced by `generate-domain` + `generate-layer`.

## Verification

1. `npm install && npm run dev` — boots on the Domains home.
2. Open the finance sample's Feed; confirm identity strip, path attribution on cards, and that
   the card mix is doses rather than a wall.
3. Run a retrieval dose end to end; confirm the streak advances only on finishing the batch,
   XP moves, and the concept's heat-map cell changes.
4. Pass a structured teach-back; confirm new items are queued and, with no key, that the local
   grader says so.
5. Warm a layer, then confirm the **depth unlock** card appears in the Feed and opens the next
   layer.
6. Create a new domain with no API key; confirm starter routes, a readable reason, and that
   selecting a path still opens a walkable starter layer.
7. **Responsive check:** 1280px (rail, multi-column) down to 390px (bottom bar, stacked) — no
   horizontal scroll.
8. `npm run build` (runs `tsc -b`) and `npm run lint` pass clean.

## Still open

- **The Terminal is still keyword-graded.** Text practice blocks accept any ~100-character
  write-up; the CSV P&L task is the only one with real evaluation. The LLM grader used for
  teach-backs would fit here too.
- **`autoDrill.ts` is unwired.** It can generate an MCQ for a decayed concept but nothing
  calls it; the Feed surfaces authored drills only. Hooking it to `weakConceptIds` would let
  the Feed manufacture drills for concepts that have none.
- **No FSRS optimiser.** Weights are the published defaults, not fitted to the learner's own
  review log — which is now being recorded (`metrics.reviewLog`) and would be the input.
- **Reconstruction items are never generated.** The kind is implemented end to end in the
  retrieval screen, but neither the layer prompt nor `deriveItems` emits one yet.
- **Voice-first capture** is still absent; the direction calls for it as a teach-back option.
- Real audio transcription, Supabase/DB sync, and auth remain out of scope.
