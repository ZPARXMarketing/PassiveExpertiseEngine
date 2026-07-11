# Passive Expertise Engine

> The Netflix of expertise — passive, personalized, and inevitable.

University-grade knowledge, absorbed in the moments you're already on your phone.
You pick a subject; the engine maps the whole field into a prerequisite graph,
breaks it into 60–90 second lessons, and delivers them during your idle windows —
with spaced repetition woven invisibly into the stream so it sticks.

This repo is the **hi-fi clickable prototype** of the mobile app (wireframe set
"2a" from the design handoff), built as a mobile-first React SPA with hand-written
sample content for one subject: **Quantum Physics**.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

Deploys to Netlify out of the box (`netlify.toml` sets the build command,
publish dir, and SPA redirect) — import the repo in Netlify and it just works.

## The app

Three tabs, three overlays:

| Surface | Job |
| --- | --- |
| **Feed** (home) | "Today's thread" — new-lesson cards, inline quick checks, and 30-second refreshes you consume in place. The thing you reach for in an idle window. |
| **Story player** | Only *new* concepts get it: 5 cinematic beats, tap right/left to advance, beat 6 is the quick check that closes the lesson. |
| **Tutor** | A lifeline, not a destination — summon it from any beat with "I don't get this", tap through a Socratic exchange, then resume the lesson where you left it. |
| **Map** | Your knowledge maps: mapped courses + the sample "mirrors MIT 8.04" degree, unit by unit with live progress. |
| **Map a course** | The onboarding — an **80/20 Audit** that turns a subject into a one-page overview (see below). |
| **Constellation** | Zoom into one unit: concepts as nodes, prerequisites as edges. Tap an open node to queue it next in your feed. |
| **You** | Depth rings (core → undergrad → graduate → frontier), retention %, and time reclaimed. No streaks, no XP. |

### Map a course — the 80/20 Audit

From the Map tab, "Map a new course" walks a subject through three moves before
any studying begins, so you learn the vital few instead of everything:

1. **Strategic compression — the 10% map** *(Young's rule)*: set a total time
   budget; the first 10% is reserved for surveying the field — its landscape,
   benchmarks, and best resources — not studying it.
2. **The 20% selection** *(Ferriss)*: the field is deconstructed into components;
   you keep the vital ~20% that yields 80% of results (the recommended core is
   pre-picked), with a live split-bar against the 20% line.
3. **The one-page metric** *(Ferriss)*: your picks compress into a single
   glanceable cheat sheet — gated at seven lines, because if the core mechanics
   don't fit on one page, it isn't simplified enough.

Four subjects ship with full blueprints (Quantum Physics, Machine Learning,
Copywriting, Personal Finance); any other subject gets a generic template the
engine would later refine. The result is saved to the Map as a reusable
one-page course overview.

Progress (mapped courses, completed lessons, answered checks, queued concepts)
persists in `localStorage`; reset it from the You tab.

## Architecture

```
src/
  data/        hand-written mock content — the future AI boundary
    lessons.ts       3 full lessons × 5 beats + quick checks
    feed.ts          today's thread (lessons · checks · refreshes)
    knowledgeMap.ts  subject → units → concept graph (constellation)
    blueprints.ts    course blueprints for the 80/20 audit onboarding
    tutor.ts         scripted Socratic tutor exchanges per concept
    stats.ts         retention / depth-ring numbers
  state/       AppContext.tsx — single useReducer store + localStorage
  components/  one file per surface (FeedScreen, StoryPlayer, TutorSheet,
               MapScreen, ConstellationView, YouScreen, …)
  styles/      theme.css (design tokens) + global.css
```

Everything in `src/data/` is shaped like an API response on purpose — swapping
mock content for live Claude-generated lessons means replacing those modules,
not the UI.

The visual theme is a neon-on-dark system defined entirely as CSS custom
properties in `src/styles/theme.css` (pending the real NeonFlux tokens — see
`TODO.md`).

## Roadmap

See [TODO.md](./TODO.md) — headline items: real NeonFlux design tokens, live AI
lesson/tutor generation, a real spaced-repetition scheduler, idle-window
delivery, and onboarding that builds the knowledge map for any subject.
