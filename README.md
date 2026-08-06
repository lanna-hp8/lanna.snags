# Site Snag Register — PWA

A installable, offline-capable version of the snag register, built to fix the two problems the
in-chat version couldn't: camera access (blocked in Claude's sandboxed preview) and storage size
(capped at 5MB there; here it uses your browser's own storage, typically hundreds of MB to a few GB).

## What's different from the in-chat version

- **Photos**: capturing a photo now saves BOTH a small thumbnail AND the full-resolution original,
  both automatically linked to that snag — no extra steps, no separate "link a photo" workflow.
- **Storage**: everything (data + full-res photos) lives in your phone's browser storage
  (IndexedDB), not in a 5MB cloud record. Nothing is uploaded anywhere automatically.
- **Export**: a new Export tab builds a ZIP containing a data file (CSV + JSON) plus every photo,
  organised by tag code, with automatic splitting into multiple ZIP parts if the total is large,
  and an optional compression toggle.

## Deploying to GitHub Pages (one-time setup, ~10 minutes)

1. Go to [github.com](https://github.com) and sign in (or create a free account).
2. Click the **+** in the top-right → **New repository**. Name it anything, e.g. `site-snags`.
   Keep it Public (GitHub Pages on a free account requires a public repo). Click **Create repository**.
3. On the new repo's page, click **uploading an existing file** (or drag-and-drop).
4. Drag in **every file and folder from this package** — `index.html`, `manifest.json`, `sw.js`,
   `app.js`, `data.js`, the `icons/` folder, and the `plans/` folder — keeping the same folder
   structure. Commit the upload.
5. Go to the repo's **Settings** tab → **Pages** (left sidebar).
6. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
7. Wait about a minute, then refresh — GitHub shows you a URL like
   `https://yourname.github.io/site-snags/`. That's your app's permanent address.

## Installing on your phone

1. Open that URL in your phone's browser (Safari on iPhone, Chrome on Android).
2. **iPhone**: tap the Share icon → "Add to Home Screen".
   **Android**: tap the "⋮" menu → "Add to Home Screen" or "Install app".
3. Launch it from the home screen icon from then on — it opens full-screen, no address bar,
   and works offline once loaded.

## Important notes

- **Everything stays on your phone.** GitHub Pages just hosts the app's code — it never sees your
  snag data or photos. Those live entirely in your phone's browser storage.
- **Back up regularly.** Since everything lives on one device, use the Export tab periodically
  (not just at the very end) so you always have a ZIP backup outside the phone.
- **Re-deploying updates**: if you ask Claude for changes to this app later, you'll get an updated
  copy of these files — re-upload them to the same GitHub repo (they'll overwrite the old ones) and
  refresh the app on your phone. Your data isn't touched by this, since it's stored separately in
  the browser, not in the code.
