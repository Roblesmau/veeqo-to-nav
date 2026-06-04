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
  - `localStorage` — per-user prefs (API key, theme, display name, column choices, store selection, webhook URL, filter-scope choice).
  - `IndexedDB` (`veeqo_to_nav_db`) — local cache of Items + Bin files for offline reuse.
  - `Supabase` — team-shared filter settings + Items/Bin files + activity log. Each shows a "Updated by [name] [time]" pill.
- **Filter scope (multi-tenant lite):** filters + stores have two Supabase rows per user:
  - `filters` / `stores` — Team default (visible to everyone).
  - `filters:user:<NAME>` / `stores:user:<NAME>` — private per-user view.
  Dropdown on panel 2 switches between them. Items and Bin files are *always* shared.

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
- Nav SO export priority order: `['BIN-ECAMZ', 'BIN-VIN', 'DE-MAIN']`. Allocation is **strict** — every bin (including DE-MAIN) respects its actual available stock. Unfulfillable qty is surfaced in a pre-download confirm modal and is excluded from the export rather than dumped into DE-MAIN.
- Nav SO export schema: `Type | No. | Location Code | Quantity | Net Price Paid`. Bucket key is `(SKU, Location, NetUnitPrice)` so different unit prices for the same SKU+location produce **separate rows**. `Net Price Paid` is per-unit (`price_per_unit - total_discounts`, treated as already per-unit — do not divide by qty). Rows sorted by Location Code asc, then SKU, then price.
- Order by Loc export schema: `Order Number | Type | No. | Ecom Item | UPC | Location Code | Quantity | Net Price Paid`. Same allocation + unfulfillable logic as Nav SO, but the bucket key adds `OrderNumber` so each order keeps its own rows. Sorted Location → Order → SKU → price. SKU metadata (UPC, Ecom Item) is cached once per local SKU during the line-item pass so all rows for that SKU stay consistent.
- Zone Code column is the source of truth for zone filtering; Bin Code is a fallback heuristic.
- **Scanner-tolerant UPC search.** Filter inputs strip leading zeros on both the needle and the haystack so a scanned `09856` matches a DB value of `9856` (regex: `/^0+(?=\d)/`). Apply in both the orders preview and the merged-results filter.

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

## Best practices (lessons from this repo)

- **Verify allocation bugs against real exports.** When the user reports "this SKU shouldn't be in the export," dump the actual xlsx (temp-install `xlsx` with `npm i xlsx --no-save`, write a tiny `.cjs` dumper, then **clean up** `node_modules`/`package-lock.json`/the script). Faster than guessing.
- **Prefer "strict + warn" over silent fallback.** If a rule (e.g. bin priority) could mask missing data, surface it in a confirm modal listing the affected SKUs before letting the user download. Never quietly dump remainder into the last bucket.
- **Orthogonal rules stay orthogonal.** Price-stamping (per-unit Net Price) and qty allocation (bin priority + stock cap) are independent — keep them in independent passes so an edge case in one doesn't bleed into the other.
- **Bucket keys carry every distinguishing dimension.** When the same SKU can have different prices in the same location, the aggregation key must include price; otherwise rows collapse and information is lost. When a new export "is like Nav SO but per-order," the only change should be appending `OrderNumber` to the bucket key — reuse the allocation pass verbatim.
- **Clone, don't fork, related exports.** Order by Loc reuses Nav SO's allocation, unfulfillable-tracking, and warn-modal. Keep the shared logic in a helper (`buildOrderByLocRows` mirrors `buildNavSORows`) so a fix to the strict-allocation rule lands in one place mentally even if it's two functions.
- **Cache row metadata once per key.** When an export needs columns like UPC/Ecom alongside the SKU, populate a `Map<localSku, {upc, ecom}>` during the line-item pass and look it up at row-build time — don't re-resolve from `MAPPING` per row.
- **Watch for invisible delimiters in source.** Composite-key strings like `${a}|${b}|${c}` can end up with non-printable bytes (e.g. U+0001 SOH) if a paste/edit mangles the pipe. The code "works" because both write and split use the same byte, but it's unreadable. If `Edit` reports "string not found" on a line you can see, suspect a hidden byte and verify with `od -c`; fix with `perl -i -pe 's/\x01/|/g'`.
- **Dual-source data: route, don't fork the consumers.** When a pivot can come from two backends (Excel vs Supabase), keep the *output shape* identical (`BIN_MAP[sku] = { totalQty, byCode }` + `LOCATION_CODES[]`) and put the branch in one router function (`rebuildBinMap()` → `…FromWorkbook()` or `…FromSupabase()`). Downstream code (merged view, Nav SO, Order by Loc, insufficient-stock, webhook) stays unaware of the source. Adding a third source later = one new writer, zero consumer changes.
- **Mirror UX feedback across every branch of a dual-source feature.** If the Supabase branch updates a "Last Bin content: TIME" pill, the Excel branch must too — otherwise switching sources looks broken. Same rule for spinners, activity-log writes (manual only, never silent/auto), and stale-cache warnings.
- **Verify Supabase project identity by decoding the JWT.** Anon keys are JWTs whose `ref` claim is the project ref. When "schema cache miss" persists after `notify pgrst, 'reload schema'` and `grant select … to anon`, base64-decode the anon key's middle segment and compare its `ref` to `SB_URL`. A mismatch means the code is talking to a different project than the user set the table up in. Faster than re-running grants.
- **Parallel-fire side-effect refreshes on user-facing actions.** When "Fetch Orders" also needs a fresh Supabase bin pull, kick the pull off *before* the orders loop (`const binPromise = refreshBinFromSupabase({silent:true}).catch(…)`), then `await binPromise` right before the consumer (`previewOrders()`). Cuts user-perceived latency vs sequential; the `.catch` keeps a bin failure from blocking orders.
- **Hide, don't grey, inactive dual-source UI blocks.** Users find half-faded controls confusing ("can I still click it?"). Use `display:none` on the inactive block via a single `.inactive` class toggled from the radio handler. Greying is for *temporarily disabled* affordances, not for the unselected half of a toggle.
- **Code review on direct-to-main repos: review commits, comment inline.** The `code-review` skill assumes PRs. On a no-PR repo, ask the user up front whether to review (a) this session's commits or (b) the last N commits on main, and where to put the output (inline vs a GH commit comment). Then run the same 5-agent + scoring pipeline against the commit range. Skip the gh-comment step.

---

## Known footguns

- `new URL('/api/...')` throws — pass `window.location.origin` as the base.
- Stale `localStorage` zone selections can silently empty a Nav SO bucket after schema changes. When changing zone semantics, bump a version key and reset.
- SheetJS column letters (`'A'`, `'B'`, …) vs header names: detect which mode the user picked before calling `sheet_to_json`.
- Supabase Storage objects bucket needs explicit public read/insert/update policies — the table RLS policies are separate from the Storage policies. See `SUPABASE_SETUP.md`.
- Supabase Storage's **bucket policy dialog** ("New policy → For full customization") rejects multi-statement DDL with "please allow at least one operation in your policy". Paste the three `create policy … on storage.objects …` statements in the **SQL Editor** instead — they apply globally.
- Adding a new table that the app reads via PostgREST? Run `grant usage on schema public to anon, authenticated; grant select on public.<table> to anon, authenticated; notify pgrst, 'reload schema';` or the anon client will get "Could not find the table in the schema cache."
- **Stray files in the project root.** This folder occasionally accumulates files from unrelated workstreams (e.g. Returns SOP `*.pdf`/`*.html`) and per-machine tooling (`skills-lock.json` from the `npx skills` CLI, `.agents/`). They're in `.gitignore` — don't propose committing them as part of Veeqo-to-Nav work. If a new file appears that clearly isn't part of this app, ask before staging.
- Supabase URL + anon key are entered per-browser via **Panel 1B** and read from `localStorage` (keys `veeqo_to_nav_sb_url` / `veeqo_to_nav_sb_anon`) — nothing is embedded in `index.html`. First-time users see `sb = null` until they configure; downstream code guards on this. If the client can't reach Supabase, **decode the anon key's JWT `ref` claim** (middle segment, base64) and compare against the saved URL's subdomain — a mismatch is the most likely cause, not a policy/RLS bug. Panel 1B's status pill does this check on load and shows ⚠ on mismatch.

---

## Files of note

- `index.html` — the whole app.
- `api/[...path].js` — Vercel serverless proxy to Veeqo.
- `proxy.js` — local dev proxy (Node, port 8787, honors `PORT`).
- `vercel.json` — clean URLs + root redirect.
- `SUPABASE_SETUP.md` — one-time DB + Storage + policies setup.
- `DEPLOY.md` — Vercel deploy walkthrough for non-technical users.
- `favicon.svg` — VN wordmark, blue→green gradient.
