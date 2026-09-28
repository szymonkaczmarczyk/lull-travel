# LULL

Boutique travel site. Node + Express backend serving a JSON API and a static, no-build frontend.

```
server/            Express app
  data/*.json      Seed data (stays, destinations, journal) — never written at runtime
  data/db/         File-mode database (content edits, settings, outbox), gitignored
  db/              Storage drivers with one shared interface: file.js (local) and supabase.js (cloud)
  routes/          One router per resource; admin.js holds the whole /api/admin API
  lib/store.js     Content in memory, loaded from the driver at boot, updated in place by the CMS
  lib/enquiries.js Enquiry workflow: routing, status changes, reassigning, forwarding, notes
  lib/mail.js      Mail transports (log by default, nothing leaves the server) + outbox
  lib/settings.js  CMS settings: mailboxes, routing, statuses, templates, sender
  lib/schema.js    CMS field definitions and validation for stays, destinations, journal
  lib/auth.js      Single admin account from .env, HMAC-signed session cookie
  views/admin.html Admin shell, served for /admin and /admin/*
public/            Static frontend, served as-is — no bundler, no framework
  css/             base (tokens) → components → pages (or admin), loaded in that order
  js/              ES modules; app.js injects nav + footer on every public page
  js/admin/        Admin SPA: main.js (router, login), state.js, ui.js, views/*
supabase/          schema.sql — run once in the Supabase SQL editor
docs/admin.md      How the admin, database and mail work, and how to add endpoints (Polish)
.claude/skills/    Installed skills (see below)
vendor/            Upstream clones the skills came from
```

## Running

```bash
npm install
npm start          # http://localhost:3000, admin at /admin
npm run dev        # node --watch
npm run db:seed    # reset content to the seed files (asks for --yes)
```

Configuration lives in `.env` (see `.env.example`). Without Supabase keys the app runs on local files.

## Conventions

- **No build step.** Plain ES modules with `type="module"`, plain CSS with custom properties. Do not
  introduce a bundler, a framework, or a CSS preprocessor.
- **No external assets** beyond Google Fonts and the one hero video. Every other visual is a generated
  CSS gradient (`.art` in `base.css`), driven by a `tone: [dark, light]` pair on each data record.
- **Design tokens live in `base.css` `:root`.** Never hardcode a colour in a component — add or reuse a
  token. The palette is warm near-black + warm white with a single teal accent (`--teal`), used only for
  kickers, rules and small accents. `--warm`, `--ok` and `--danger` exist for admin status tags and errors.
- **Type:** Manrope (display), Inter (body), JetBrains Mono (labels/kickers). No serif, no italic.
  Emphasis comes from weight and colour.
- **Motion:** entrance cascade uses `.rise` with a `--d` delay; scroll reveals use `[data-reveal]` plus
  `observeReveals()` after any innerHTML injection. Everything is wrapped by the
  `prefers-reduced-motion` guard at the bottom of `base.css`.
- **Escape interpolated data** with `esc()` from `js/api.js` before it goes into a template literal.
- **Copy voice:** calm, specific, understated. Name the downside. No exclamation marks, no deal language.
- **Storage goes through `db`.** New queries get a function in both `db/file.js` and `db/supabase.js`
  with the same name and arguments. Routes never talk to files or Supabase directly.
- **Admin routes** go below `router.use(requireAdmin)` in `routes/admin.js` and are wrapped in `wrap()`.

## Skills installed

- `karpathy-guidelines` — behavioural guidelines: simplicity first, surgical changes, verifiable goals.
  Applies to all work in this repo.
- `ui-ux-pro-max` and siblings (`design`, `design-system`, `ui-styling`, `brand`, `banner-design`,
  `slides`) — searchable UI/UX database. Query it before making visual decisions:
  ```bash
  python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|ux|gsap>
  ```
  Its default palette recommendations do **not** override the established LULL palette above.

## Changelog

- **2026-09-28** — admin panel at `/admin` (enquiries with statuses, reassigning, forwarding, notes,
  CSV export; content editing for stays, destinations and journal; settings for mailboxes, routing,
  statuses, email templates and sender; outbox). Storage drivers with Supabase support and a local file
  fallback. Mail pipeline on the `log` transport, Resend adapter ready but off. `GET /api/admin/enquiries`
  and the rest of the admin API. `.env` loading, `supabase/schema.sql`, `npm run db:seed`, `docs/admin.md`.

  ## rules in polish

  nie pisz w kodzie komentarzy. Nigdy nie pisz zdan zaczynajac kazde slowo z duzej litery.
