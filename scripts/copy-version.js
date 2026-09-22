// postbuild: copy build-version.json into dist/ so it ships with the deployed artifact.
//
// server.js serves dist/ as the static root and reads /api/version from there at
// request time. If the file is absent it falls back to the static package.json
// version, which would make the client's auto-update never fire after a re-deploy.
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'build-version.json')
const dst = path.join(root, 'dist', 'build-version.json')

if (!fs.existsSync(src)) {
  console.error('[copy-version] build-version.json missing — was gen-version prebuild skipped?')
  process.exit(1)
}
if (!fs.existsSync(path.dirname(dst))) {
  console.error('[copy-version] dist/ does not exist — did the build fail?')
  process.exit(1)
}
fs.copyFileSync(src, dst)
console.log(`[copy-version] copied ${path.basename(src)} -> dist/`)