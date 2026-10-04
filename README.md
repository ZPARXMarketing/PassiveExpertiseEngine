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

## Generation

DeepSeek through OpenRouter (`deepseek/deepseek-chat` by default). One Netlify function,
`netlify/functions/generate.mts`, handles every step; prompts live in `src/app/prompts.ts`.

- Site env: `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL` (optional).
- Or paste a key in **Settings** (⚙) — then the browser calls OpenRouter directly.

## Storage

Supabase project `dfhjesjzceyhzbtojkcw`, tables `xe_nodes`, `xe_lessons`, `xe_completions`,
`xe_visits`, `xe_saved` (migrations in `supabase/migrations/`, both applied). This is what syncs
across devices. The browser uses the
publishable key; RLS allows read + insert, and delete of whole subjects only.

If those tables don't exist yet the app falls back to this device's localStorage (the rail shows
**this device** instead of **synced**).

## Run

```bash
npm install
npm run dev        # UI only; set a key in Settings to generate
npx netlify dev    # UI + the generate function
npm run build
```
