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
- pnpm-workspace.yaml: scoped security overrides plus one documented audit
  ignore for an advisory with no published fix (deepmerge). astro-icon
  ^1.2.0 (@iconify/tools 5, which unzips with fflate) removed extract-zip
  and its two advisories.
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

- Site identity: Bibliothek / Domus Sapientiae, siteURL
  https://akasakajelos.github.io/, timeZone Europe/Berlin (matches Hexo, so
  date permalinks keep their day); profile, banner text and About page
  replaced; upstream author's avatar.webp deleted.
- scripts/check-global-style-loading.mjs: dropped the About-page requirement
  for ::github card markup, which only the demo content has. Its stylesheet
  assertions (the actual regression guard) are unchanged and still pass.

- Content: upstream demo posts deleted; hello-world migrated. Unfinished
  drafts stay local and gitignored. Date permalinks enabled
  (%year%/%monthnum%/%day%/%postname%).
- src/pages/posts/[...slug].astro: emits no /posts/<slug>/ copies while
  permalinks are on (giscus keys threads by pathname).
- Post links made permalink-aware: FeedInfo.astro (hardcoded /posts/),
  PostListItem.astro and PostNavigation.astro (getPostUrlBySlug). Prev/next
  was verified with a temporary second post.
- tests/markdown-enhancements.test.mjs: skipped the wiki-link case that
  resolves upstream demo posts.
- Known limitation: plugins/remark-wiki-link.mjs still builds /posts/<id>/
  URLs. [[wiki links]] are unused here; tests/dist-urls.test.mjs fails the
  build if one ever produces a /posts/ link.

- Cover pool: src/constants/covers.ts (30 ShokaX covers in public/covers/,
  FNV-1a by post id, explicit image wins), applied in src/loaders/post-loader.ts.
- package.json build: `astro build --force`. Astro's content-layer cache is
  keyed on post file content, so loader or cover-pool changes were silently
  ignored for unchanged posts. --force re-parses every build (about 1s).

- Removed the theme author's Google Tag Manager tracking:
  layouts/partials/AnalyticsScripts.astro (defaulted to GTM-KRX3XGVH) and the
  <noscript> GTM iframe in layouts/Layout.astro.
- Inline onclick handlers replaced by delegated listeners in BackToTop,
  BackToHome and FloatingTOC; Footer's RSS/Atom handlers removed (they called
  an undefined window.navigateToPage and broke the links upstream).
  AnimationTest.astro and Announcement.astro still contain onclick but are not
  rendered; the CSP verifier fails the build if either is enabled.
- Dropped assets of disabled features: public/pio (and l2d-widget),
  public/assets/{music,projects,anime,js}, public/images. Restore from
  upstream 14da426 to re-enable any of them.
- integrations/site-csp.mjs: one hash-based CSP for every page, registered
  last in astro.config.mjs; injection is all-or-nothing. Clickjacking frame
  guard added to layouts/partials/HeadTags.astro.

- Comments: giscus enabled in config/commentConfig.ts (Announcements
  category, pathname mapping, strict title matching). components/comment/
  Giscus.astro no longer passes the unused per-page `term` (a stale /posts/
  path) through define:vars, so its inline script hashes once site-wide.
  The root giscus.json origin allowlist applies once it is on main_2, the
  default branch giscus reads it from.

- Promoted from site/ to the repository root, replacing Hexo. .gitignore:
  dropped the unanchored `demo` and `plans` lines (`plans` hid
  docs/superpowers/plans/) and appended the local tooling, secrets and
  draft rules carried over from the Hexo-era root. package.json gained
  `verify` and `test:dist`, and `test` also runs tools/verify-csp.test.cjs
  (renamed to .cjs: this package is "type": "module").

- Browser check fixes (both were CSP violations on every page):
  layouts/MainGridLayout.astro no longer renders IconifyLoader, which
  injected the unpinned iconify-icon "3-latest" script from
  code.iconify.design. Only removed feature pages (skills, diary) render
  the runtime <iconify-icon>; re-enabling them needs a self-hosted
  iconify-icon, not a CSP exception. astro.config.mjs no longer lets Vite
  inline fonts as data: URIs (KaTeX_Size3), so font-src stays 'self'.

- No third-party script or fetch in the page: integrations/iconify-offline.mjs
  resolves `@iconify/svelte` to its OfflineIcon plus the icons the source
  references (same scan as astro-icon), so nothing calls api.iconify.design;
  the Iconify preconnect in layouts/partials/HeadTags.astro is gone. The giscus
  loader and stylesheet are vendored in public/giscus/ (MIT, patched to target
  https://giscus.app; see the file header), so giscus.app only serves the
  comment iframe. Refresh the vendored copy from https://giscus.app/client.js
  when giscus changes its embed, and re-apply both patches.

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
