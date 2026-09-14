
## 14/09/2026, 17:13:41

I found the issue. Here's the diagnosis:

**Root Cause:** The `POST /api/boats` endpoint at `server.js:309` inserts into columns `licence`, `trailer_licence`, and `rate_type`. If the database was created before these columns were added to the schema, the `INSERT` fails with a SQLite error (e.g., "no such column: licence"), which gets swallowed by the generic 500 error handler.

**Why filling fields doesn't help:** The error happens at the database schema level, not the data level.

**Plan:**

1. **`server.js`** — Add a migration block (similar to the existing `service_cards` migrations at lines 28-40) that adds `licence`, `trailer_licence`, and `rate_type` columns to the `boats` table if they're missing.

2. **`src/screens/NewCardScreen.jsx`** — Fix `createBoat` to send `length_ft` as a proper number/null instead of an empty string (matching how `ScanCardScanner.jsx` handles it). This prevents potential SQLite REAL-column issues when the field is left blank.

3. **Verify** by starting the server and testing boat creation.

Want me to apply these fixes?
## 14/09/2026, 17:15:07

Fixed. Two changes made:

1. **`server.js:42-61`** — Added migration blocks to add the missing `licence`, `trailer_licence`, and `rate_type` columns to the `boats` table. These columns exist in `schema.sql` but were never migrated into existing databases, so the `INSERT` was failing with a 500 error.

2. **`src/screens/NewCardScreen.jsx:89`** — `length_ft` is now explicitly cast to a number (or `null`) before sending, matching how `ScanCardScanner.jsx` handles it and avoiding potential REAL-column issues when the field is left blank.

Next server startup will auto-run the migrations and boat creation should work.
## 14/09/2026, 17:19:52

There are no deploy scripts, Docker files, or CI/CD configs in this repo. The project is a standard Node.js + Express app with a Vite-built frontend.

**Standard deployment flow:**

1. Build locally: `npm run build` (outputs to `dist/`)
2. Push the repo to the server (git clone/pull, or SCP/rsync the project folder)
3. On the server:
   - `npm install --production`
   - `npm run build` (if you pushed source, not `dist/`)
   - Set env vars if using MySQL: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - Start: `node server.js` (or `pm2 start server.js` / `npm start`)

**Important notes:**
- The SQLite database (`data/local.db`) is NOT in the repo — it's created at runtime in the `data/` folder. If you're moving servers, you'll need to copy that file manually.
- The migrations I added run automatically on server startup, so the existing database will be updated.
- If you're using a reverse proxy (nginx, Caddy), proxy port 3000.

Do you have a specific server target in mind (VPS, Docker, PaaS like Render/Fly.io, etc.)? That would change the approach.