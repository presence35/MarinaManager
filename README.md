# Marina Manager

Campbell's Landing Marina — Service & Storage Management.

## Deploying to production (GoDaddy)

GoDaddy auto-builds, but it does **not** go live from a preview. The full sequence:

1. **Pull to Preview** — GoDaddy pulls the repo and builds the preview.
2. **Publish to Live** — promote the preview to the live app.
3. **Restart** — restart the Node app so `server.js` changes apply (new routes, schema/bootstrap).

Skipping any step leaves production stale in a different way:

| Skipped step | Symptom |
| --- | --- |
| No pull / no publish | Live still serves the previous commit |
| No restart | New routes/tables (e.g. `boat_serials`) missing; new frontend calls silently no-op |
| Client cache not cleared | Installed PWA keeps serving the old precached bundle |

### After deploying

- On devices: **Setup → tap the `MARINA MANAGER v…` footer** to clear the service-worker cache and reload (installed PWAs are the ones that get stuck).
- Verify the live build via `<site>/api/version` — it should reference the latest commit hash.

### Notes

- `dist/` and `build-version.json` are gitignored; they are produced by `npm run build` on the host (GoDaddy auto-builds).
- Production uses MySQL (`DB_HOST` etc. set by GoDaddy). The `boat_serials` table is created by the bootstrap in `server.js` on startup; look for `Ensured boat_serials table` in the logs. If it's missing, the DB account lacked `CREATE`.

## Local development

```
npm install
npm run dev        # node server.js — serves ./dist (run `npm run build` first)
npm run dev:vite   # vite dev server with HMR, proxies /api and /photos to :3000
npm run build      # regenerate ./dist
```
