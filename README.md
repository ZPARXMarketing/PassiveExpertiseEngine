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
- **Each subject remembers where you were.** Hop Music → Physics → Chemistry → back to Music and
  you land exactly where you left Music, scrolled to the same spot in the chapter and panels.
  Tapping the subject you're already in keeps your place. Subjects from before trails were kept
  open at the last thing you opened in them. Trail synced; scroll position per device.
- **Explore | Library** toggle in the top bar. In Library mode the left panel swaps the subject
  list for **Library · Paths · Schedule**, and each opens out in columns like Explore. In a
  smaller window the oldest columns fold into slim strips (tap one to open it), so nothing
  scrolls sideways. The top bar and the panel switch stay in the same place in both modes; the
  switch (Slim / Compact / Wide) also sets the Library, Paths and Schedule columns.
- **Library** browses like Explore: subject → branch → course → chapter columns (only where
  you've saved something, with counts), then that chapter's highlights, lectures and star.
  Search, type and colour filters still apply; **Sort → By colour** groups highlights by bucket.
  **+ Path** on a chapter (or a whole course) adds it to a path.
- **Paths** — a sequential, goal-specific course. **✦ New path with AI**: describe the goal,
  optionally paste the assignment / rubric and attach photos or PDFs, set a due date. The
  planner (`google/gemini-3.8-flash`, reads images and PDFs) sees your whole tree and drafts
  subject › branch › course › chapter steps with study time and what to focus on; the preview
  marks each step "In your library" or new. **Create** reuses matches and generates anything
  missing the way Explore does (full catalog / syllabus), so Explore keeps filling in. Steps
  can be reordered, re-timed, removed, ticked off; tap one to open the chapter.
- **Schedule** — tell it when you're free in plain words (the AI turns that into weekly blocks
  and one-off busy days) or set blocks by hand. Your paths' unfinished chapters are laid into
  that time, earliest due date first, long chapters split across blocks. Columns: Week / Month /
  Year → the days with study planned → that day's sessions (Year: month → day → sessions).
  It re-plans itself whenever you tick something off, fall behind or change availability, and
  warns when a path won't finish by its due date. Google Calendar can replace manual
  availability later.
- **Text size** A / A+ / A++ lives in Settings (this device).
- **Panel width switch** (top bar, three little layout pictures): Slim strips, Compact titles or
  Wide with summaries for the earlier panels. Tap the lit one again for Auto (fold to fit). Per device.
- **Sort the subject rail:** A–Z, Newest, or Custom: tap the 🔒 to unlock, drag subjects by their ≡
  handle, tap 🔓 to lock again. Synced.
- **Add to home screen** (Settings): shows the iOS Share → Add to Home Screen steps; it then opens
  full screen with its own icon.
- **Highlighter buckets.** Select text in a chapter (or a deeper dive) and tap a bucket — each has
  its own name and colour (Settings → Highlighter buckets: rename, recolour, add, hide). Marks stay
  on the text every visit, on every device. Tap a mark to move it to another bucket or remove it.
  The four original colours are the starter buckets, so older highlights keep their colour.
- **Study tools toolbar stays frozen** at the top of the chapter while you scroll.
- **Spend meter** (top right): OpenRouter spend on the site's key — all time · week · today, to
  three decimals. Turn it off in Settings.
- **Library tab** (pinned in the top bar). Filter by bucket with the colour chips, or **Sort → Group
  by bucket** to see every highlight under its bucket with a link back to its chapter. ☆ any course or chapter, or highlight chapter text →
  **★ Save highlight**. Everything is filed automatically by subject → branch → course → chapter
  in catalog order, with search, type filters, sort (course order / recently saved / A–Z), fold any
  subject or course, Open all / Close all — and it reopens exactly how you left it.

## Study tools

A **Study tools** switch in the reader (off by default, synced across devices) reveals:

- **Go deeper ›** beside each section heading — a sub-lesson opens underneath, and its own
  sections can go deeper again (3 levels). With Study tools on, each deeper dive can be deleted.
- **Ask a question** about the chapter, and **Practice problems** with hidden worked solutions.

- **🎧 Lectures** (button in the chapter toolbar; a 🎧 badge on each section shows how many
  lectures already cover it). Tick the whole chapter or any mix of sections, pick Short (~3 min),
  Medium (~7) or Long (~12), and record. It records in the background — a pill in the corner shows
  progress and "Lecture ready". Keep as many versions as you like; each has play with speed,
  download, transcript and delete (removes the MP3 too). Lectures play in an app-wide
  player bar that keeps going when the sheet closes or you move around (lock-screen/headphone
  controls, ±15 s, speed); each lecture remembers where you stopped and shows ✓ Listened once
  finished, synced across devices. Every lecture is also under **Library → Lectures**. Voice model, voice, style and speed live in Settings (synced); the voice
  list comes live from OpenRouter so only supported voices are offered.
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
- Lectures: `netlify/edge-functions/speech.ts` (`POST /api/speech`); default voice model `microsoft/mai-voice-2.1-flash` (voice Harper, en-US); any of OpenRouter's speech models can be chosen in Settings, and if the preferred one isn't listed the closest listed one is used. Raw-PCM models are saved as WAV.
- Site env: `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL`, `OPENROUTER_FACTCHECK_MODEL`, `OPENROUTER_TTS_MODEL` (optional).
- Or paste a key in **Settings** (⚙) — then that browser calls OpenRouter directly.

## Password

`netlify/edge-functions/auth.ts` runs first on every path (declared in `netlify.toml`) and asks
for the password in the `APP_PASSWORD` site environment variable — pages, the app bundle and
`/api/*` are all behind it. Each device stays signed in (HttpOnly cookie, one year); changing the
password signs every device out; **Settings → Lock this device** signs one out. With
`APP_PASSWORD` unset the site is open.

## Storage

Supabase project `dfhjesjzceyhzbtojkcw`, tables `xe_nodes`, `xe_lessons`, `xe_completions`,
`xe_visits`, `xe_saved`, `xe_extras`, `xe_prefs`, `xe_buckets` (migrations in `supabase/migrations/`, all applied). This is what syncs
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
