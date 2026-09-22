// Generates a unique build version on every `npm run build`.
// The version is a timestamp (+ optional git hash) so it changes every build,
// which lets the client detect a stale bundle and force a cache clear + reload.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')

// ---------------------------------------------------------------------------
// Regression guard: reject bare `{ flag && <JSX/> }` patterns.
//
// SQLite returns is_scanned / is_fake / wrap_required as integers 0/1, so a bare
// `{card.is_scanned && <Foo/>}` renders the literal text "0" on every falsy card
// (React renders the number 0). The safe form is `{!!card.is_scanned && <Foo/>}`.
// Fail the build rather than ship another stray-"0" release.
// ---------------------------------------------------------------------------
const DANGEROUS = /\{\s*(!?)([a-zA-Z_][\w.]*)\s*\.\s*(is_scanned|is_fake|wrap_required)\s*&&/
const scanDir = path.join(root, 'src')
let bad = []
;(function walk(d) {
  for (const name of fs.readdirSync(d)) {
    const full = path.join(d, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full)
    else if (/\.(jsx|js|tsx|ts)$/.test(name)) {
      const src = fs.readFileSync(full, 'utf8')
      const lines = src.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(DANGEROUS)
        if (m && m[1] !== '!!') {
          bad.push(`${path.relative(root, full)}:${i + 1}: ${lines[i].trim()}`)
        }
      }
    }
  }
})(scanDir)
if (bad.length) {
  console.error('[gen-version] Aborting build — bare numeric-&& JSX patterns found:')
  for (const b of bad) console.error('  ' + b)
  console.error('Fix: wrap the flag in !!, e.g. {!!card.is_scanned && <Foo/>}')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

let gitHash = ''
try {
  gitHash = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
} catch (e) { /* not a git repo or git unavailable */ }

const builtAt = new Date().toISOString()
// YYYYMMDDHHMMSS — unique per build
const stamp = builtAt.replace(/[-:T.]/g, '').slice(0, 14)
const fullVersion = gitHash ? `${pkg.version}+${stamp}-${gitHash}` : `${pkg.version}+${stamp}`

const out = {
  version: fullVersion,
  baseVersion: pkg.version,
  build: stamp,
  git: gitHash || null,
  builtAt,
}

fs.writeFileSync(path.join(root, 'build-version.json'), JSON.stringify(out, null, 2) + '\n')

console.log(`[gen-version] build version: ${fullVersion} (build ${stamp})`)