# Expertise Engine

Type a subject. Drill down like a university catalog. Read each chapter as it's written for you.

```
Subjects (left rail) → Branches → Courses → Syllabus → Chapter text
```

- **Top bar** — type any topic. It becomes a subject in the left rail (re-typing an existing one just opens it).
- **Panels** — each selection slides a new panel of buttons in to its right: the branches of the
  subject (e.g. Economics → Microeconomics, Econometrics…), the course catalog for a branch
  (code + Intro/Intermediate/Advanced/Graduate), then the course syllabus (description,
  objectives, ordered chapters).
- **Reader** — picking a chapter writes it: intro, sections, worked example, key terms, recap,
  self-check quiz. Previous / Next / Mark complete; the syllabus shows progress.
- Everything is generated **once** and saved, so going back is instant and free.
- **Every click is saved.** Explored tiles turn violet, completed chapters get a ✓, and opening
  the app on any device resumes at the last thing you clicked.
- **Folding panels.** Older panels fold out of the way (full → compact → slim strip) so the newest
  always fits — more aggressively on phones. ‹ folds a panel, tapping a strip opens it, ☰ hides
  the subject rail. On phones a breadcrumb trail jumps back to any level.
- **Library tab** (pinned in the top bar). ☆ any course or chapter, or highlight chapter text →
  **★ Save highlight**. Everything is filed automatically by subject → branch → course → chapter
  in catalog order, with search and Courses / Chapters / Highlights filters.

## Study tools

A **Study tools** switch in the reader (off by default, synced across devices) reveals:

- **Go deeper ›** beside each section heading — a sub-lesson opens underneath, and its own
  sections can go deeper again (3 levels).
- **Ask a question** about the chapter, and **Practice problems** with hidden worked solutions.

- **🎧 Lecture** for a section or the whole chapter: a spoken lecture script, recorded in your
  teacher's voice (OpenAI voices via OpenRouter `/audio/speech`), saved as an MP3 in the
  `xe-lectures` storage bucket. Play with speed control, download, or read the transcript; every
  lecture is also under **Library → Lectures**. Voice, style and speed live in Settings (synced),
  with a preview button.
- **📊 Add a chart** for a section: the AI picks a line / bar / scatter / pie chart or a flow
  diagram (or draws the one you describe). Charts become part of that section for good, so each
  chapter grows into your own textbook. Invented numbers are labelled "Illustrative".

**Fact-check** (always visible once a chapter is written) checks the chapter against the web with
Perplexity Sonar and shows ✓ Verified or the flagged claims with corrections and sources.
**Fix these** (asks first) rewrites only the flagged parts; the corrected copy replaces the
original on screen and the badge becomes ✓ Corrected. Everything is generated once and saved.

## Generation

One streaming edge function, `netlify/edge-functions/generate.ts` (`POST /api/generate`), handles
every step; prompts and stream parsing live in `src/app/prompts.ts` and `src/app/parse.ts`.
Text appears while it is written, OpenRouter routes to the fastest provider, and the next chapter
is written in the background while you read.

- Writing: DeepSeek (`deepseek/deepseek-chat`). Fact-checks: `perplexity/sonar`.
- Lectures: `netlify/edge-functions/speech.ts` (`POST /api/speech`), model `openai/gpt-4o-mini-tts-2025-12-15`.
- Site env: `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL`, `OPENROUTER_FACTCHECK_MODEL`, `OPENROUTER_TTS_MODEL` (optional).
- Or paste a key in **Settings** (⚙) — then that browser calls OpenRouter directly.

## Storage

Supabase project `dfhjesjzceyhzbtojkcw`, tables `xe_nodes`, `xe_lessons`, `xe_completions`,
`xe_visits`, `xe_saved`, `xe_extras`, `xe_prefs` (migrations in `supabase/migrations/`, all applied). This is what syncs
across devices. The browser uses the
publishable key; RLS allows read + insert, and delete of whole subjects only.

If those tables don't exist yet the app falls back to this device's localStorage (the rail shows
**this device** instead of **synced**).

## Run

```bash
npm install
npm run dev        # UI only; set a key in Settings to generate
npx netlify dev    # UI + the streaming generate edge function
npm run build
```
