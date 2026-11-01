# Upstream

Vendored from https://github.com/matsuzaka-yuki/Mizuki
Commit: 14da4262d8aa1d93dc8cff11705f14918ed7369f (2026-08-10)
License: Apache-2.0 (LICENSE), MIT (LICENSE.MIT), see THIRD_PARTY_NOTICES.md

Not vendored: .git, .github, .devin, .vscode, docs/, CLAUDE.md, vercel.json,
README*, logo.png, _frontmatter.json

## Local modifications

- package.json: removed predev/prebuild content sync, anime/Bangumi/Bilibili
  updaters, IndexNow submit and `preinstall: npx only-allow pnpm`; build no
  longer runs update-anime.mjs.
- scripts/: deleted sync-content.js, init-content-repo.js, update-anime.mjs,
  update-bangumi.mjs, update-bilibili.mjs, indexnow-submit.js.
- .env.example: deleted. It documented only variables for the removed
  features (ENABLE_CONTENT_SYNC, CONTENT_REPO_URL, CONTENT_DIR, INDEXNOW_KEY,
  INDEXNOW_HOST, BILI_SESSDATA) and was already matched by the root `.env.*`
  ignore rule.

## Baseline at vendoring (Task 1)

- pnpm install --frozen-lockfile: 1108 packages; lockfile passed pnpm's
  supply-chain policy check (1244 entries); only esbuild's postinstall ran.
- pnpm build: 26 pages, exit 0 (Vite warns it cannot optimize @iconify/svelte).
- pnpm test: 39/39 node:test cases and 8/8 crypto tests pass.
- pnpm audit: 123 advisories (1 critical, 64 high, 47 moderate, 11 low).
