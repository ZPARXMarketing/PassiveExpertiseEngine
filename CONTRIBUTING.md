# Contributing

Issues and pull requests are welcome.

1. `npm install`, then `npm run dev` (UI only) or `npx netlify dev` (UI + edge functions).
2. Before opening a PR: `npm run lint` and `npm run build` must pass.
3. Keep changes small and focused. Database changes go in a new file under `supabase/migrations/`; never edit an applied one.
4. Never commit keys. Secrets are Netlify environment variables; see `.env.example`.
5. UI changes: regenerate the README screenshots with `node scripts/screenshots.mjs` (see the header of that file).
