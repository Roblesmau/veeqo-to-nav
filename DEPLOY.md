# Deployment guide — share with non-technical users

The app is **two pieces**:
- `index.html` (the UI) → host on **Netlify**
- `proxy.js` (CORS proxy for Veeqo API) → host on **Render**

After both are deployed, anyone with the Netlify URL can use the app — no install, no terminal.

---

## Step 1 · Push the project to GitHub

You need a GitHub repo to connect Netlify and Render to.

1. Go to <https://github.com/new>, create a new **public** or **private** repo (e.g. `veeqo-to-nav`). Don't add README/license — leave it empty.
2. Copy the repo URL (looks like `https://github.com/YOUR-USERNAME/veeqo-to-nav.git`).
3. From the project folder, run:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/veeqo-to-nav.git
   git push -u origin main
   ```

GitHub may ask for credentials — use your GitHub username + a [Personal Access Token](https://github.com/settings/tokens?type=beta) as the password (not your real password).

---

## Step 2 · Deploy the proxy on Render (free)

1. Sign up / log in at <https://render.com> (use your GitHub account — it makes step 3 easier).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repo `veeqo-to-nav`.
4. Fill in:
   - **Name:** `veeqo-to-nav-proxy` (this becomes part of your URL)
   - **Region:** closest to you
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** Node
   - **Build Command:** *(leave blank — no build step)*
   - **Start Command:** `node proxy.js`
   - **Instance Type:** **Free**
5. Click **Create Web Service**.
6. Wait ~2 min for the first deploy. When it's green ("Live"), copy the URL at the top — it'll look like:

   ```
   https://veeqo-to-nav-proxy.onrender.com
   ```

7. Open `https://veeqo-to-nav-proxy.onrender.com/health` in your browser. You should see `Veeqo proxy OK`.

> ⚠️ **Free Render plan note:** the proxy goes to sleep after 15 min of no traffic. The first request after sleep takes ~30 sec to wake up. After that it's instant. For most uses (Mauricio fetching orders periodically) this is fine.

---

## Step 3 · Match the proxy URL in `index.html`

If your Render URL is different from `https://veeqo-to-nav-proxy.onrender.com`, edit the option in `index.html`:

```html
<option value="https://YOUR-RENDER-URL.onrender.com">Production proxy (Render)</option>
```

Then commit + push:

```bash
git add index.html
git commit -m "Point production proxy at Render URL"
git push
```

---

## Step 4 · Deploy the frontend on Netlify (free)

1. Sign up / log in at <https://app.netlify.com> (use GitHub).
2. Click **Add new site** → **Import an existing project**.
3. Choose **GitHub** and pick your `veeqo-to-nav` repo.
4. Settings:
   - **Branch to deploy:** `main`
   - **Build command:** *(leave blank)*
   - **Publish directory:** `.`
5. Click **Deploy**.
6. ~30 sec later you'll get a URL like:

   ```
   https://yourname-veeqo-to-nav.netlify.app
   ```

7. (Optional) In **Site settings → Change site name**, give it a friendlier name like `de-veeqo-to-nav`.

---

## Step 5 · Share it

Send the recipient **just the Netlify URL**. That's it.

The first time they open it:
1. They paste their Veeqo API key in panel 1.
2. Confirm Base URL is set to **Production proxy (Render)** (default).
3. Click **Load stores**, pick stores.
4. Upload Items and Bin/Stock files in panels 3 & 4 (these save to their browser, so they only do it once).
5. Switch to **Orders** tab — orders auto-fetch and refresh every 5 min.

---

## Updating the app later

Whenever you change the code:

```bash
git add .
git commit -m "Describe what changed"
git push
```

Both Netlify and Render auto-redeploy on push. Recipients just refresh their browser to get the latest.

---

## Costs

- **Netlify free tier:** 100 GB bandwidth/month — way more than you'll ever use.
- **Render free tier:** 750 hr/month free for web services — also more than enough for one always-on proxy.

Both are free for this use case.
