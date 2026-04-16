---
"@ghx-dev/core": patch
---

Fix CLI binary not working when installed via plugin hosts (e.g. Claude Code) that cache the npm package without running `npm install`.

- Bundle all runtime dependencies into `dist/cli/index.js` so the binary is self-contained
- Copy operation card YAMLs to `dist/cli/cards/` so `cardDirectory()` resolves correctly from the bundle
- Fix `bin` field in `package.json` to point to `bin/ghx` (which has the required shebang) instead of `dist/cli/index.js`
