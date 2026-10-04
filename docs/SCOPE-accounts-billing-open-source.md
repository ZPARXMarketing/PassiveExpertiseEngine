# Scope: accounts, paid plans, then open source

Goal: anyone can sign up, pay through Stripe, and use Expertise Engine with their own private
Library, progress and lectures — then publish the code without weakening any of that.

Status: **planning.** Nothing below is built yet. Tick boxes as work lands.

---

## Where it stands today

- One shared password (`APP_PASSWORD`, `netlify/edge-functions/auth.ts`) in front of everything.
- One Supabase project; the browser talks to it directly with the publishable key.
- Row-level security allows **anyone with that key** to read/insert (and delete some) rows.
  Fine for one person behind a password; not fine for strangers or a public repo.
- The Supabase URL and publishable key are hard-coded as fallbacks in `src/app/store.ts`, and
  therefore in git history.
- All AI cost (DeepSeek text, Perplexity fact-checks, voice) is paid by one site-wide
  `OPENROUTER_API_KEY`.

Tables: `xe_nodes`, `xe_lessons`, `xe_completions`, `xe_visits`, `xe_saved`, `xe_extras`,
`xe_prefs`, storage bucket `xe-lectures`. Migrations: `supabase/migrations/`.

---

## Principles (what makes it safe to open source)

1. **Nothing depends on the code being secret.** Paywall and usage limits are enforced on the
   server (edge functions + database rules), never only in the browser.
2. **Every secret lives in environment settings**, never in the repo.
3. **Each person can only reach their own rows** — enforced by Supabase row-level security
   tied to their login.
4. **Self-hosting works without Stripe.** Billing is switched on by an env var, so the open
   source version runs for a single user or a private group with no payment setup.

---

## Phase 0 — Clean foundation (do first)

- [ ] Remove the hard-coded Supabase URL/key fallbacks from `store.ts`; read only
      `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` (set in Netlify before merging so the live
      site keeps working).
- [ ] Add `.env.example` listing every variable (no values).
- [ ] Scan git history for secrets (OpenRouter keys, service keys, passwords).
- [ ] Before the repo goes public: create a new Supabase publishable key, put it in Netlify,
      disable the old one (the old one is in history forever).

## Phase 1 — Accounts

- [ ] Supabase Auth: email + password and/or magic link; optionally Google.
- [ ] Custom email sender (e.g. Resend) — Supabase's built-in email is rate-limited and not
      meant for real sign-ups.
- [ ] Screens: sign up, sign in, forgot password, sign out, delete account.
- [ ] Replace the `APP_PASSWORD` gate with "signed in" (keep `APP_PASSWORD` optional as an
      invite code for private installs).
- [ ] Add `user_id uuid references auth.users` to every personal table:
      `xe_saved`, `xe_visits`, `xe_completions`, `xe_extras`, `xe_prefs` (key becomes
      `user_id + key`). Lecture audio path becomes `<user_id>/<chapter>/…`.
- [ ] Row-level security: `using (user_id = auth.uid())` on all of the above; revoke the
      current anonymous policies. Storage policy: users only touch their own folder.
- [ ] Move existing data to Jeremy's account (one migration: set `user_id` on all rows).
- [ ] Edge functions (`generate`, `speech`) verify the Supabase session token instead of the
      password cookie, and know which user is calling.

## Phase 2 — Shared catalog vs private layer

Recommended split:

| Shared (generated once, everyone benefits) | Private (per user) |
| --- | --- |
| Subjects, branches, courses, syllabi | Library (saved items, highlights) |
| Chapter text (`xe_nodes`, `xe_lessons`) | Progress, visits, completions |
| Fact-check results + corrected versions | Lectures + audio, listening progress |
| | Deeper dives, Q&A, practice sets, charts |
| | Settings (voice, study tools) |

- [ ] Shared tables: anyone signed in can read; only the server writes (generation moves
      fully server-side so users can't insert junk into the shared catalog).
- [ ] Each user's left rail shows *their* subjects (a small `xe_user_subjects` link table)
      even though the subject content itself is shared.
- [ ] Decide: is fact-check "fix" shared (improves the catalog for all) or private?

## Phase 3 — Billing (Stripe)

- [ ] Stripe account (Jeremy): business details, bank. Build in **test mode**, then go live.
- [ ] Product + price(s) in Stripe.
- [ ] `subscriptions` table: `user_id`, `stripe_customer_id`, `stripe_subscription_id`,
      `status`, `price_id`, `current_period_end`. Only the server writes it.
- [ ] Checkout: edge function creates a Stripe Checkout Session for the signed-in user →
      redirect to Stripe's hosted page.
- [ ] Webhook function: verifies Stripe's signature; handles `checkout.session.completed`,
      `customer.subscription.updated` / `.deleted`, `invoice.payment_failed`; updates
      `subscriptions`.
- [ ] Customer Portal button (Stripe-hosted): cancel, change card, invoices.
- [ ] Paywall screen for signed-in users without an active subscription.
- [ ] Server gate: `generate` and `speech` refuse work unless the caller's subscription is
      active (or billing is disabled for self-hosting).
- [ ] Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID(S)`,
      `SUPABASE_SERVICE_ROLE_KEY` (server only), `BILLING_ENABLED`.

## Phase 4 — Usage metering and caps

AI cost grows with use; one heavy user making long lectures all day can cost more than the
plan. Protect the margin:

- [ ] `usage` table: `user_id`, `kind` (chapter / lecture / fact-check / chart …), `cost`
      (from OpenRouter's reported usage), `created_at`.
- [ ] Monthly allowance per plan, checked server-side before each generation; friendly
      "you've reached this month's limit" message with the reset date.
- [ ] Shared catalog hits cost nothing (already generated) and don't count.
- [ ] Before pricing: measure real cost per chapter, lecture (per length), fact-check and
      chart from OpenRouter's current prices. **No price is set until this is done.**

## Phase 5 — Legal and operations

- [ ] Terms of service, privacy policy, refund policy (Stripe expects these).
- [ ] Sales tax: decide on Stripe Tax.
- [ ] Account deletion removes personal rows + audio.
- [ ] Support contact; basic error monitoring; Supabase backups.

## Phase 6 — Open source release

- [ ] License decision (see below) → `LICENSE` file, `license` in `package.json`.
- [ ] Public README: what it is, screenshots, self-hosting guide (Supabase project + run
      migrations in order, Netlify deploy, env table), billing optional.
- [ ] `CONTRIBUTING.md`, `SECURITY.md` (how to report a vulnerability), CI (build + lint on
      pull requests).
- [ ] Remove anything personal or project-specific from docs (project refs, live URLs).
- [ ] Rotate the Supabase key (Phase 0) **before** flipping the repo to public.

---

## Open decisions

1. **License**
   - MIT: anyone can do anything, including run a competing paid copy.
   - AGPL-3.0: anyone can run it, but must publish their changes if they offer it as a
     service.
   - FSL (Functional Source License): no competing commercial use for 2 years, then becomes
     Apache/MIT.
2. **Plan shape:** monthly only / monthly + yearly / free tier + paid / trial length.
3. **Price and monthly allowance** — after the Phase 4 cost measurement.
4. **Sign-in methods:** email + password, magic link, Google.
5. **Shared catalog:** confirm the split in Phase 2; are fact-check fixes shared?
6. **Invite-only launch** first (`APP_PASSWORD` as invite code) or open sign-up?

---

## Suggested order

Phase 0 → 1 → 2 (one release: accounts with private data) → 4 metering → 3 Stripe (test mode)
→ 5 legal → go live → 6 open source.
