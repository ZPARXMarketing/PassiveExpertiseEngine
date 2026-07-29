# Pivot: Passive Expertise Engine → "Super-Learning" Skill-Acquisition Engine

## Context

The current app is a hi-fi clickable prototype of a **passive** learning product
— "the Netflix of expertise" — where content is delivered to the user in an
idle-window feed. It's a React 19 + Vite + TypeScript SPA, no router (view state
lives in a `useReducer` in `src/state/AppContext.tsx`), localStorage persistence,
and all content is hand-written mock data in `src/data/` deliberately shaped like
API responses so it can later be swapped for live AI. One subject only (Quantum
Physics). The shell is locked to a phone column (`.phone { max-width: 430px }`).

We're **inverting the philosophy**: from passive consumption to an **active,
four-stage skill-acquisition pipeline** based on accelerated-learning technique —
**Metalearning → Direct Practice → Drilling Weaknesses → Active Retrieval** —
realized as four hardcoded workflow modules. It must work for *any* project (the
worked example is "finance for small businesses"), support **multiple subjects
saved separately**, and ship as a **tablet-first** experience that still collapses
to phone. We keep the neon-on-dark visual style.

### Decisions (confirmed with user)
- **Depth:** Clickable prototype with mock data (new structure + navigation,
  content hand-written and swappable for real AI/DB later). Interactivity where
  it's cheap and offline (arithmetic drills, P&L tagging, SRS interval bumps).
- **Tablet:** Tablet-first, responsive **down** to phone. Side rail on tablet →
  bottom bar on phone. Keep neon-on-dark tokens.
- **Old surfaces:** Full rebuild of the view layer around the 4 stages. Drop the
  passive Feed / Story Player / Tutor. Salvage tokens + reusable primitives.
- **Subjects:** A Subjects home (create a project by typing a goal) + a switcher
  in the nav. Each subject saved **separately** in localStorage now; DB later.

## Target model

### Navigation (state-driven, no router — extend the existing reducer pattern)
A responsive **app shell** replaces `.phone`:
- **Tablet (≥ ~860px):** persistent left **side rail** — brand, active-subject
  switcher, the 5 nav entries, and a content area (CSS grid `rail | content`).
- **Phone (< ~860px):** rail collapses to the existing **bottom tab bar** style;
  subject switcher moves into the top of the content header.

**Nav entries** (all except Subjects scope to the active subject):
1. **Subjects** — home / project picker + "new project" (type a goal).
2. **Blueprint** *(Metalearning · Curriculum Aggregator)* — the 80/20 dependency
   graph of the field.
3. **Terminal** *(Direct Practice · Execution Terminal)* — timed, distraction-free
   deep-work session with a concrete task.
4. **Synthesis** *(Encoding + Active Retrieval · Feynman Test)* — explain-it-back,
   scripted feedback, atomize into SRS cards + the daily review queue.
5. **Dashboard** *(Rapid Feedback · Drilling Weaknesses)* — retention heat map of
   concept nodes + targeted micro-drills (rapid-fire active retrieval).

### Data model (localStorage now, API-shaped)
Rebuild `src/data/types.ts` around a **Subject/Project** aggregate:
- `Subject`: `{ id, goal, title, createdAt, blueprint: BlueprintNode[]/edges,
  tasks: PracticeTask[], synthPrompts: SynthesisPrompt[], srs: SrsCard[],
  drills: Drill[], metrics }`.
- `BlueprintNode` / `BlueprintEdge` — adapt existing `ConceptNode` / `ConceptEdge`
  (x/y/status/deps, plus an `is8020` flag for the core nodes).
- `PracticeTask` — `{ id, conceptId, prompt, kind: 'csv-pnl' | 'editor' | 'text',
  dataset?, correct? , evalNote }`.
- `SynthesisPrompt` — `{ id, conceptId, prompt, rubricKeywords[], passFeedback,
  failFeedback, cardsOnPass: SrsCard[] }`.
- `SrsCard` — `{ id, conceptId, front, back, ease, intervalDays, dueAt, reps }`.
- `Drill` — `{ id, conceptId, kind: 'rapid-calc' | 'mcq', spec }`.
- Per-subject progress: completed tasks, session time log, drill scores, card
  review history, node retention %.

Ship **two fully fleshed sample subjects** to prove "any project":
- **"Finance for small businesses"** — the user's detailed worked example
  (unit-economics/cash-flow/margin blueprint; a messy med-spa CSV → build a P&L
  task; the accrual-vs-cash-flow Feynman prompt; a Net-Profit-Margin rapid drill;
  a Gross-vs-Net decay node).
- One more (e.g. **"B2B lead generation"** or **"Master GoLang"**) with a lighter
  but complete set, so the switcher and multi-subject saving are demonstrable.

### State (`src/state/AppContext.tsx`, rebuilt but same pattern)
- `AppState` gains `subjects: Subject[]`, `activeSubjectId`, `view` (the 5 entries),
  plus per-subject runtime (open task, timer, drill session, review queue).
- Persist a **subjects registry + per-subject progress separately** under a new
  key (e.g. `pee-v2`), so subjects are independent saves. Keep the existing
  load/save `useEffect` + Toast timer pattern.
- Actions mirror today's style (`setView`, `createSubject`, `setActiveSubject`,
  `startSession`, `logSessionTime`, `submitTask`, `submitFeynman`, `reviewCard`,
  `startDrill`, `answerDrill`, `resetProgress`, `showToast`/`clearToast`).

## Components / files

**Rebuild the view layer** (`src/App.tsx`, `src/components/*`). Salvage:
`Toast.tsx`, the `.card` / `.pill` / `.tag` / `.progress-*` primitives in
`global.css`, and the SVG graph rendering from `ConstellationView.tsx` +
unit-list from `MapScreen.tsx` (fold into Blueprint).

New/rebuilt components:
- `AppShell` (in `App.tsx`) — responsive rail/bottom-bar + content, subject switcher.
- `SubjectsHome.tsx` — subject cards + "new project" input (goal → creates a
  Subject; prototype maps known goals to sample blueprints, else a generic stub
  blueprint so any input is accepted).
- `BlueprintScreen.tsx` — reuse the constellation SVG for the dependency graph;
  node tap shows status and launches its Terminal task; highlight 80/20 core nodes.
- `TerminalScreen.tsx` — split layout (task prompt | workspace). Workspace by
  `kind`: `csv-pnl` = tag each CSV row COGS/OpEx/Revenue, app computes gross/net
  margin and compares to `correct`; `editor`/`text` = distraction-free textarea.
  A **session timer** with active-vs-idle logging (blur/focus + inactivity).
- `SynthesisScreen.tsx` — Feynman prompt → textarea (press-to-record is a stub
  that reveals the textarea) → scripted pass/fail from `rubricKeywords` heuristic →
  on pass, atomize into `SrsCard`s and enqueue. Includes the **daily review queue**
  (due cards, flip + grade, bump interval).
- `DashboardScreen.tsx` — retention **heat map** of blueprint nodes (color by
  decay), "decaying nodes" list, and **micro-drill** launcher.
- `DrillOverlay.tsx` — rapid-fire timed retrieval (e.g. randomized Net-Profit-
  Margin calc), scored; feeds back into node retention. Reuse quick-check styling.

## Styling / layout (`src/styles/`)
- **`theme.css`**: keep the neon-on-dark tokens; add a few for the new surfaces
  (a warm "decay/heat" ramp for the dashboard, a terminal accent). Keep the
  "swap for real NeonFlux" note.
- **`global.css`**: replace the `.phone` shell with a responsive `.app-shell`
  grid (`--rail-w` at tablet; single column + `.bottom-bar` below the breakpoint).
  Terminal/dashboard get 2-column layouts at tablet width, stacked on phone. Keep
  `env(safe-area-inset-*)` handling. Reuse existing card/pill/progress rules.
- Keep `index.html` fonts (Space Grotesk / Inter / JetBrains Mono).

## Out of scope (explicitly deferred)
Real Feynman grading, real audio recording/transcription, Supabase/DB sync, auth.
All are named as the swap points (mock modules in `src/data/`), consistent with
today's "future AI boundary" design.

**Shipped since this plan was written:** LLM curriculum generation. A goal with no
authored sample is now designed by the model — concept graph, first tasks, Feynman
prompts and drills — via `src/data/path.ts` + `netlify/functions/generate-path.mts`,
with the stub curriculum kept as the offline fallback. See README → Learning paths.

## Verification
1. `npm install && npm run dev` — app boots at the new Subjects home.
2. Create a project by typing a goal; confirm it's saved and appears in the
   switcher; reload → it persists (localStorage `pee-v2`); create a second and
   confirm they're **independent** saves.
3. Walk all four stages on the finance sample: open a Blueprint node → do the
   Terminal P&L task (tag rows, get evaluated) → pass the Synthesis/Feynman prompt
   → see cards enter the review queue → open Dashboard, run a rapid drill, watch a
   decaying node update.
4. **Responsive check:** resize from ~1280px (tablet: side rail, 2-col terminal)
   down to 390px (phone: bottom bar, stacked) — verify no horizontal scroll and
   the rail↔bottom-bar swap. Use Playwright (Chromium at `/opt/pw-browsers`) to
   screenshot both widths.
5. `npm run build` (runs `tsc -b` — must typecheck) and `npm run lint` (oxlint)
   pass clean.
6. Commit to `claude/expertise-engine-pivot-na78bl` and push `-u origin`.
