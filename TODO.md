# TODO — Passive Expertise Engine

## Design
- [ ] **Port real NeonFlux design tokens.** The style reference repo
      (`ZPARXMEDIA/NeonFlux-design`) is private and lives under a different
      GitHub org than this repo, so this session couldn't read it
      (cross-org repo access isn't supported here). The current theme in
      `src/styles/theme.css` is a stand-in "neon on dark" system designed to
      be swapped: replace the CSS custom properties at the top of that file
      with the real NeonFlux colors/fonts and the whole app follows.
      Easiest fix: start a session with `NeonFlux-design` as a source, or
      make it readable from this org.
- [ ] Real lesson visuals/animations in the story player (current build uses
      generative SVG motifs per beat).
- [ ] App icon + splash / PWA manifest for install-to-home-screen.

## Product
- [ ] Onboarding flow: pick a subject → engine builds the syllabus/knowledge map.
- [ ] Wire lessons + tutor to the Claude API (content is hand-written mock data
      for Quantum Physics right now — see `src/data/`).
- [ ] Real spaced-repetition scheduler (forgetting-curve timing); reviews are
      currently pre-authored feed items.
- [ ] Idle-window prediction + notification/delivery layer (the core "finds you
      when you're already on your phone" mechanic).
- [ ] Real assessment behind the retention/depth numbers on the You tab.
- [ ] More subjects than Quantum Physics.

## Engineering
- [ ] Netlify: connect the repo to a Netlify site (a `netlify.toml` with build
      settings + SPA redirect is already in place — importing the repo in the
      Netlify UI should just work).
- [ ] Tests (component + flow); only manual/Playwright verification so far.
- [ ] Backend: accounts, progress sync (localStorage-only today).
