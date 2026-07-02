# Supabase setup — one-time, ~3 minutes

This sets up the database tables and Storage bucket the app uses to share
filter settings + Items/Bin files across your team.

## 1. Run the SQL

1. Open <https://supabase.com/dashboard> → your `veeqo-to-nav` project (ref `zoqihptkwurpqenpjgfw`).
2. Left sidebar → **SQL Editor** → **+ New query**.
3. Paste the SQL below.
4. Click **Run**.

```sql
-- ============================================================
-- TABLES
-- ============================================================

-- Shared settings (filters, store selection, column choices, zones, …)
-- One row per logical key, value stored as JSON.
create table if not exists app_settings (
  key         text        primary key,
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Shared file metadata for the Items file and the Bin/Stock file.
-- The actual xlsx/csv bytes live in Storage; this row tracks where + when + who.
create table if not exists shared_files (
  kind          text        primary key,   -- 'items' or 'bin'
  storage_path  text        not null,
  original_name text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

-- Append-only team activity log (panel 7 — Team activity feed).
create table if not exists activity_log (
  id    bigserial   primary key,
  ts    timestamptz not null default now(),
  who   text,
  what  text
);
create index if not exists activity_log_ts_idx on activity_log (ts desc);

-- Orders already exported via "Export to Nav SO" (Orders tab → Exported column).
-- Team-shared: one row per order number. Exported orders are excluded from the
-- next Nav SO export and from insufficient-stock detection.
create table if not exists exported_orders (
  order_number text        primary key,
  exported_at  timestamptz not null default now(),
  exported_by  text
);

-- History tab — one row per Order + SKU + Location allocated by "Export to
-- Nav SO". An order that already has any row here is never re-logged, even
-- if manually un-exported and re-exported later. Full CRUD is available on
-- the History tab (edit/delete/add).
create table if not exists nav_so_export_history (
  id            bigserial   primary key,
  order_number  text        not null,
  order_date    timestamptz,
  customer      text,
  sku           text        not null,
  location_code text        not null,
  qty           numeric     not null default 0,
  exported_at   timestamptz not null default now(),
  exported_by   text,
  unique (order_number, sku, location_code)
);
create index if not exists nav_so_export_history_order_idx on nav_so_export_history (order_number);
create index if not exists nav_so_export_history_exported_at_idx on nav_so_export_history (exported_at desc);

-- ============================================================
-- ROW-LEVEL SECURITY
-- Single-workspace model: anyone with the anon key can read + write.
-- (Locking down to a workspace password or auth later is a 1-policy change.)
-- ============================================================
alter table app_settings    enable row level security;
alter table shared_files    enable row level security;
alter table activity_log    enable row level security;
alter table exported_orders enable row level security;
alter table nav_so_export_history enable row level security;

drop policy if exists "settings: read"   on app_settings;
drop policy if exists "settings: write"  on app_settings;
drop policy if exists "settings: update" on app_settings;
drop policy if exists "files: read"      on shared_files;
drop policy if exists "files: write"     on shared_files;
drop policy if exists "files: update"    on shared_files;
drop policy if exists "activity: read"   on activity_log;
drop policy if exists "activity: write"  on activity_log;
drop policy if exists "exported: read"   on exported_orders;
drop policy if exists "exported: write"  on exported_orders;
drop policy if exists "exported: update" on exported_orders;
drop policy if exists "exported: delete" on exported_orders;
drop policy if exists "history: read"   on nav_so_export_history;
drop policy if exists "history: write"  on nav_so_export_history;
drop policy if exists "history: update" on nav_so_export_history;
drop policy if exists "history: delete" on nav_so_export_history;

create policy "settings: read"   on app_settings for select using (true);
create policy "settings: write"  on app_settings for insert with check (true);
create policy "settings: update" on app_settings for update using (true);

create policy "files: read"      on shared_files for select using (true);
create policy "files: write"     on shared_files for insert with check (true);
create policy "files: update"    on shared_files for update using (true);

create policy "activity: read"   on activity_log for select using (true);
create policy "activity: write"  on activity_log for insert with check (true);

create policy "exported: read"   on exported_orders for select using (true);
create policy "exported: write"  on exported_orders for insert with check (true);
create policy "exported: update" on exported_orders for update using (true);
create policy "exported: delete" on exported_orders for delete using (true);

create policy "history: read"   on nav_so_export_history for select using (true);
create policy "history: write"  on nav_so_export_history for insert with check (true);
create policy "history: update" on nav_so_export_history for update using (true);
create policy "history: delete" on nav_so_export_history for delete using (true);

-- PostgREST needs to see the new tables + reload its schema cache.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.exported_orders to anon, authenticated;
grant select, insert, update, delete on public.nav_so_export_history to anon, authenticated;
notify pgrst, 'reload schema';
```

## 2. Create the Storage bucket

1. Left sidebar → **Storage** → **New bucket**.
2. **Name:** `files`
3. **Public bucket:** ✅ ON (so the app can download files via URL).
4. Click **Create**.

Then **add policies** so anyone with the anon key can upload/update.

- Inside the `files` bucket → **Policies** tab → **New policy** → **For full customization**.
- Paste this and Save:

```sql
-- Allow public read
create policy "files: public read"
on storage.objects for select
using (bucket_id = 'files');

-- Allow public insert (so the team can upload)
create policy "files: public insert"
on storage.objects for insert
with check (bucket_id = 'files');

-- Allow public update / overwrite
create policy "files: public update"
on storage.objects for update
using (bucket_id = 'files');
```

## 3. Done

Reload the app. Panels 2, 3, 4 will now auto-sync with Supabase. Each panel
shows a "Last updated by [name] [time]" pill so the team can see who
changed what and when.
