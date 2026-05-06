# Deployment guide — share with non-technical users

The whole app deploys to a **single Vercel project**:
- `index.html` is served as a static file
- `api/[...path].js` runs as a serverless function and proxies the Veeqo API

Same domain → no CORS, no separate proxy server, no second platform.

---

## Step 1 · Push to GitHub (already done)

Repo: <https://github.com/Roblesmau/veeqo-to-nav>

If you make changes locally:

```bash
git add .
git commit -m "Describe your change"
git push
```

Vercel auto-redeploys on every push to `main`.

---

## Step 2 · Deploy to Vercel (free)

1. Sign up / log in at <https://vercel.com>. Use **Continue with GitHub** — it makes the repo connection automatic.
2. From the dashboard click **Add New...** → **Project**.
3. **Import Git Repository** → find `Roblesmau/veeqo-to-nav` → click **Import**.
   - First time: Vercel will ask for permission to access GitHub repos. Click **Configure**, pick "Only select repositories", choose `veeqo-to-nav`, authorize.
4. **Configure Project** screen — leave everything as detected:
   - **Framework Preset:** Other (or "No framework")
   - **Root Directory:** `./` (default)
   - **Build Command:** *(leave blank — Vercel auto-detects from vercel.json)*
   - **Output Directory:** *(leave blank)*
   - **Install Command:** *(leave blank)*
5. Click **Deploy**. ~30 seconds later you'll get a URL like:

   ```
   https://veeqo-to-nav.vercel.app
   ```

That's the URL you share. Done.

---

## Step 3 · Verify

Open the deployed URL. The app should load instantly. Test:

1. **Setup tab** → paste your Veeqo API key.
2. Confirm **Base URL** is `Production proxy (Vercel — same origin)`.
3. Click **Load stores** — if it lists your channels, the proxy is working.
4. Open `https://veeqo-to-nav.vercel.app/api/channels` directly in another tab — should return a 401 with a clear error (because no API key was sent), confirming the proxy is alive.

---

## Step 4 · Share it

Send the recipient **just the Vercel URL**. That's it. They:

1. Paste their Veeqo API key in panel 1.
2. Click **Load stores**, pick stores.
3. Upload Items and Bin/Stock files in panels 3 & 4 (saved to their browser, one-time).
4. Switch to **Orders** tab — orders auto-fetch and refresh every 5 min.

Each recipient's API key, store selection, items file, and bin file live in their own browser — never shared, never on the server.

---

## Updating the app

Whenever you push to `main`:

```bash
git add .
git commit -m "Description"
git push
```

Vercel detects the push and redeploys automatically (~30 sec). Recipients just refresh.

---

## Costs

- **Vercel Hobby (free):** 100 GB bandwidth/month, 100k serverless function invocations/month. More than enough for this use.

---

## Local development still works

The `proxy.js` file and `node proxy.js` workflow are unchanged for local testing. Just pick **"Local proxy (http://localhost:8787)"** from the Base URL dropdown when running locally.
