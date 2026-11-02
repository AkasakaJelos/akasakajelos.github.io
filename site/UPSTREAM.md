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
- astro 7.1.3 -> 7.4.4 (GHSA-26w7-cxv4-gfx2, critical, fixed only in >= 7.2.8);
  @astrojs/markdown-remark 7.2.1 -> ^7.3.0 to match astro's peer range.
- axios removed: only the deleted network scripts imported it.
- Direct bumps: sharp ^0.35.5, sanitize-html ^2.18.0, katex pinned to exactly
  0.18.10 (0.18.11 is deprecated upstream for accidental breaking changes).
- pnpm-workspace.yaml: scoped security overrides plus three documented audit
  ignores for advisories with no published fix (deepmerge, extract-zip x2).
  Cross-major overrides and why they are safe are explained in that file.
- Known upstream peer warnings, unchanged: @tailwindcss/typography's
  "insiders" tailwindcss range, ec-lang-logo wanting @expressive-code/core ^0.41.

- Disabled featurePages (all nine), music player, Live2D mascot (pio) and
  share buttons; removed the announcement and music widgets from the sidebar;
  deleted the nine feature page routes and albums/[id]; navigation is now
  Home, Archive, About, GitHub.
- Removed oddmisc (Umami analytics) from astro.config.mjs and dependencies.
  Profile.astro and PostMeta.astro still contain its hidden fallback markup
  and scripts, which bail out when window.oddmisc is undefined; left as-is to
  keep the upstream diff small.

## After Task 2

- pnpm audit: 0 advisories reported (registry metadata counts only the three
  ignored ones).
- pnpm build: 26 pages, exit 0. pnpm test: 39/39 and 8/8 pass. KaTeX renders on
  both math demo pages with no katex-error nodes; stylus runs on glob 14.

## Baseline at vendoring (Task 1)

- pnpm install --frozen-lockfile: 1108 packages; lockfile passed pnpm's
  supply-chain policy check (1244 entries); only esbuild's postinstall ran.
- pnpm build: 26 pages, exit 0 (Vite warns it cannot optimize @iconify/svelte).
- pnpm test: 39/39 node:test cases and 8/8 crypto tests pass.
- pnpm audit: 123 advisories (1 critical, 64 high, 47 moderate, 11 low).
