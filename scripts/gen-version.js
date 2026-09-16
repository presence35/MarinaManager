// Generates a unique build version on every `npm run build`.
// The version is a timestamp (+ optional git hash) so it changes every build,
// which lets the client detect a stale bundle and force a cache clear + reload.
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')
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