# CLAUDE.md — Working notes for this repo

Guidance for Claude Code (and future-me) when working on **Veeqo to Nav**.
Keep this short. Update it when conventions change.

---

## What this project is

A **single-file** web app (`index.html`) that:

1. Pulls orders from the **Veeqo REST API** via a same-origin proxy.
2. Merges them with two team-shared Excel/CSV files (Items + Bin/Stock).
3. Produces Nav-ready exports ("Scan and Ship" + "Nav SO" with priority bin allocation).

**Deploy target:** Vercel (static `index.html` + `api/[...path].js` serverless proxy).
Same domain → no CORS, no second platform.

**Team sync:** Supabase (Postgres + Storage, anon key, RLS open per `SUPABASE_SETUP.md`).

---

## Architecture rules (don't break these)

- **One HTML file.** No build step, no framework, no bundler. Vanilla JS + SheetJS CDN + Supabase CDN. Adding a build pipeline is a last resort — discuss first.
- **Proxy stays thin.** `api/[...path].js` forwards to `api.veeqo.com` and strips host/origin/`x-vercel-*` headers. Don't add business logic to the proxy.
- **API keys live in the user's browser only.** Never hardcode a Veeqo API key. Never log it. Never send it to Supabase.
- **Three storage layers, distinct purposes:**
  - `localStorage` — per-user prefs (API key, theme, display name, column choices, store selection).
  - `IndexedDB` (`veeqo_to_nav_db`) — local cache of Items + Bin files for offline reuse.
  - `Supabase` — team-shared filter settings + Items/Bin files. Each shows a "Updated by [name] [time]" pill.

---

## Conventions

### UI

- Dark theme is default; light theme via `html[data-theme="light"]` and CSS custom properties. Apply theme **before** first paint to avoid flash.
- Share-state pills use `.share-ok` (green, ✓) and `.share-warn` (orange, ⚠).
- Setup tab uses a CSS grid with `repeat(auto-fit, minmax(320px, 1fr))`. To stack panels in the same column, wrap them in `<div style="display:flex;flex-direction:column;gap:14px">`.
- Filter inputs auto-select on Enter (scanner-friendly).

### Data

- Items file is uploaded to Supabase as a **slim 3-column CSV** (Local SKU, Ecom SKU, UPC). Never upload the full XLSX — it hits the 50 MB Storage cap.
- Orders are processed in `created_at ASC` for cumulative-demand / insufficient-stock detection.
- Nav SO export priority order: `['BIN-ECAMZ', 'BIN-VIN', 'DE-MAIN']`.
- Zone Code column is the source of truth for zone filtering; Bin Code is a fallback heuristic.

### Veeqo integration

- "Buy label" button uses `https://app.veeqo.com/orders?number=<order_number>` (filters Veeqo's orders list to that one order). Do **not** link to the order detail page — it doesn't expose the buy-label action.

---

## Workflow

- **Direct-to-main.** No PRs, no feature branches. Push to `main` → Vercel auto-deploys (~30s).
- **Commit only when the user asks.** Don't proactively commit.
- **Commit messages:** short, imperative, focused on the *why* if non-obvious. Co-author trailer as per the default git-commit instructions.
- **Never commit:** `.env*`, anything under `.claude/worktrees/`, anything with an API key. `.gitignore` already covers these — keep it that way.
- **Before any destructive git op** (reset --hard, force push, branch -D), confirm with the user.

---

## When making changes to `index.html`

It's large (read-before-edit will sometimes need offset/limit). Prefer **`Edit` with tight unique context** over rewrites. If a change touches many spots, consider whether a small helper function would reduce duplication first.

Things to re-check after touching the orders pipeline:
- Date defaults still produce a sensible rolling window.
- Page size default is 100.
- Insufficient-stock highlighting + filter toggle still work.
- Sort arrows (▲/▼) still match the active column.
- Bulk-select copy-to-clipboard still works.

---

## Known footguns

- `new URL('/api/...')` throws — pass `window.location.origin` as the base.
- Stale `localStorage` zone selections can silently empty a Nav SO bucket after schema changes. When changing zone semantics, bump a version key and reset.
- SheetJS column letters (`'A'`, `'B'`, …) vs header names: detect which mode the user picked before calling `sheet_to_json`.
- Supabase Storage objects bucket needs explicit public read/insert/update policies — the table RLS policies are separate from the Storage policies. See `SUPABASE_SETUP.md`.

---

## Files of note

- `index.html` — the whole app.
- `api/[...path].js` — Vercel serverless proxy to Veeqo.
- `proxy.js` — local dev proxy (Node, port 8787, honors `PORT`).
- `vercel.json` — clean URLs + root redirect.
- `SUPABASE_SETUP.md` — one-time DB + Storage + policies setup.
- `DEPLOY.md` — Vercel deploy walkthrough for non-technical users.
- `favicon.svg` — VN wordmark, blue→green gradient.
