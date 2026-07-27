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
| **Map** | The syllabus ("mirrors MIT 8.04"), unit by unit with live progress. Tap a unit to open its **path overview**. |
| **Path overview** | Drill into a unit like another path: overview of the path, then each concept as a step. Tap a concept for **what you'll learn**. |
| **Concept overview** | Sheet with learning goals and a CTA to queue the lesson in your feed (when available). |
| **You** | Depth rings (core → undergrad → graduate → frontier), retention %, and time reclaimed. No streaks, no XP. |

Progress (completed lessons, answered checks, queued concepts) persists in
`localStorage`; reset it from the You tab.

## Architecture

```
src/
  data/        hand-written mock content — the future AI boundary
    lessons.ts       3 full lessons × 5 beats + quick checks
    feed.ts          today's thread (lessons · checks · refreshes)
    knowledgeMap.ts  subject → units → concept graph (constellation)
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
