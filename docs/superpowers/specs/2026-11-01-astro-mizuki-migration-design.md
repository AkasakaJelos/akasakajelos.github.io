# Migration: Hexo/ShokaX → Astro/Mizuki

Date: 2026-11-01
Status: Approved (design). Supersedes `2026-09-15-astro-fuwari-migration-design.md`.
Implementation plan: `docs/superpowers/plans/2026-11-01-astro-mizuki-migration.md`

## Why the base changed

The Fuwari design was re-verified on 2026-11-01 and no longer holds:

- `saicaca/fuwari` has had no commits since 2025-12-12 and pins Astro 5.13.10.
- Its lockfile carries 271 known advisories (4 critical, 122 high). One critical
  is in Astro itself, GHSA-26w7-cxv4-gfx2 (RCE via AVIF image optimisation),
  fixed only in Astro ≥ 7.2.8. Several XSS fixes, including one for
  `define:vars`, exist only in 6.x/7.x.
- Fuwari cannot simply be bumped. `@astrojs/tailwind` supports Astro ≤ 5 and
  Tailwind 3 only, so Astro 7 means a Tailwind 4 port on top of the
  content-collections API changes.

`matsuzaka-yuki/Mizuki`, a maintained Fuwari fork, has already done that port.
Chosen by the author on 2026-11-01 over Firefly and a self-ported Fuwari.

## Goal

Replace the Hexo + ShokaX site with Astro + Mizuki, preserving the one live post
URL and the build-time, hash-based CSP, and replacing Waline with giscus.

## Constraints

- **The live post URL must not change:** `/2025/04/25/hello-world/`. It is the
  only published post. `/2026/03/10/zkp-series/` is not live (gitignored, 404).
- **`main_2` keeps deploying Hexo** until the single switch commit.
- **No `'unsafe-inline'` in `script-src`.** The CSP is **identical on every page**
  (see Security).
- **Astro ≥ 7.2.8.** Target the latest 7.x (7.4.4 at time of writing).
- **`pnpm audit` reports zero advisories,** or only ignores that are documented
  with a reason.
- **No build-time network fetches** beyond package installation and Astro's
  font provider. Mizuki's anime/Bangumi/Bilibili updaters, content-repo sync
  and IndexNow submit are removed.
- **No third-party analytics.** The `oddmisc` (Umami) integration is removed and
  Clarity stays disabled.
- Visual design is stock Mizuki apart from site identity. Its extra feature
  pages, music player, Live2D mascot and share buttons are switched off.

## Target stack

| Item | Value |
|---|---|
| Base | Mizuki @ `14da4262d8aa1d93dc8cff11705f14918ed7369f` (2026-08-10), vendored |
| Astro | ^7.4.4 (requires Node ≥ 22.23.4) |
| Node (CI) | 24 LTS |
| Package manager | pnpm 11 (Mizuki uses `allowBuilds` and `minimumReleaseAge`) |
| Styling | Tailwind 4 via `@tailwindcss/vite` |
| Transitions | swup (`@swup/astro` 1.8), `updateHead` on in production |
| Search | Pagefind (WASM) |
| Comments | giscus (GitHub Discussions) |
| Hosting | GitHub Pages (unchanged) |

## Workspace strategy

Mizuki is vendored as a plain copy (no submodule) into `site/` on
`astro-migration`, built and verified there, then promoted to the repository
root in one switch commit. `site/UPSTREAM.md` records the upstream SHA, the
excluded paths and every local modification, so a later upstream update can be
diffed. Mizuki's Apache-2.0 `LICENSE`, `LICENSE.MIT` and
`THIRD_PARTY_NOTICES.md` are kept.

Not vendored: `.git`, `.github`, `.devin`, `.vscode`, `docs/`, `CLAUDE.md`,
`vercel.json`, `README*`, `logo.png`, `_frontmatter.json`. Upstream's
`CLAUDE.md` is third-party agent instruction and must not be inherited.

The root `.gitignore` pattern `public/` is unanchored and would hide
`site/public/`. It becomes `/public/`.

## URL preservation

Mizuki has a global permalink template. Setting
`permalinkConfig = { enable: true, format: "%year%/%monthnum%/%day%/%postname%" }`
serves posts from `src/pages/[...permalink].astro` at `/YYYY/MM/DD/<slug>/`.
`siteConfig.timeZone = "Europe/Berlin"` matches Hexo's timezone, and post dates
carry an explicit offset (`2025-04-25T12:00:00+02:00`), so the date parts cannot
shift a day.

**Mizuki still emits `/posts/<slug>/` duplicates when permalinks are enabled**
("for compatibility with old links"). This site never served `/posts/`, and
giscus keys threads by pathname, so a duplicate would split a post's comments.
`src/pages/posts/[...slug].astro` emits no paths while permalinks are enabled,
and the build is tested to contain no `/posts/` links.

Out of scope: redirects for the old `/tags/`, `/categories/` and `/archives/`
listing URLs. Astro's static redirect pages have no charset meta, which the CSP
injection requires.

## Content migration

Three tracked posts move to `site/src/content/posts/`:

| Hexo | Mizuki |
|---|---|
| `title` | `title` |
| `date` | `published`, with explicit `+02:00` offset |
| `categories[0]` | `category` |
| `tags` | `tags` |
| `published: false` | `draft: true` |

`casa_summer_1` and `cissp_summary1` become `draft: true` and must not appear in
`dist/`. Both still carry the copy-pasted title `CISSP Learning Journy`; the
author fixes this before un-drafting. `zkp-series.md` stays local and gitignored.
Mizuki's demo posts are deleted. The About page body moves to
`site/src/content/spec/about.md`. The avatar moves to
`site/src/assets/images/avatar.jpg`.

### Cover images

The ShokaX random-cover pool is ported. The 30 images move to
`site/public/covers/`, the list moves to `site/src/constants/covers.ts`, and
Mizuki's post loader (`src/loaders/post-loader.ts`, `parseData`) sets `image`
when frontmatter omits it. That is the one chokepoint, so cards, post pages,
OG images and RSS all agree. Selection is deterministic by post id (FNV-1a
32-bit), so a post keeps its cover across pages and rebuilds. An explicit
`image:` always wins. `source/_data/images.yml` is deleted with the rest of
`source/` at the switch.

## Comments: giscus

`commentConfig = { enable: true, system: "giscus", ... }` with repository
`AkasakaJelos/akasakajelos.github.io`, mapping `pathname`, category
`Announcements` (only maintainers and the giscus app can open discussions),
and `lang: "en"`. Mizuki's `Giscus.astro` already lazy-loads, re-mounts on swup
`content:replace`, and syncs the light/dark theme.

Prerequisites outside the repository, done by the author:

1. Enable Discussions on the repository.
2. Install the giscus GitHub App for the repository.
3. Use the repository and category node IDs (retrievable with `gh api`).

Waline, its Vercel backend, Turnstile and the four Hexo scripts
(`like-button`, `login-button`, `turnstile-autohide`,
`hide-comment-useragent`) are not ported. Existing Waline comments are not
migrated; the backend has returned HTTP 500 since at least 2026-09-15.

## Security

### Site-wide CSP

An Astro integration (`site/integrations/site-csp.mjs`) runs on
`astro:build:done`, registered last. It hashes every non-JSON inline `<script>`
on every page and injects **one identical policy into all pages**, directly
after the charset meta.

Per-page hashing, which Hexo did safely because every navigation was a full
page load, breaks under swup. With `updateHead` on, swup inserts the next
page's `<head>` tags, and browsers intersect a newly inserted meta CSP with the
one already applied; they never remove one. A uniform policy means swup's head
diff sees an unchanged tag and leaves it alone. Hashes are sorted, so output is
reproducible.

Initial policy:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' https://giscus.app <sha256 hashes>;
style-src 'self' 'unsafe-inline' https://giscus.app;
font-src 'self';
img-src 'self' data: https:;
connect-src 'self' https://api.iconify.design;
frame-src https://giscus.app;
form-action 'self'; object-src 'none'; base-uri 'self';
upgrade-insecure-requests
```

- `'wasm-unsafe-eval'`: Pagefind is WebAssembly. Narrower than `'unsafe-eval'`.
- `giscus.app`: client script, its injected stylesheet, and the comment iframe.
- `api.iconify.design`: `@iconify/svelte` fetches icons at runtime (Mizuki
  preconnects to it). To be confirmed in the browser check.
- `style-src 'unsafe-inline'` stays, as on the Hexo site: Mizuki emits inline
  style attributes, which cannot be hashed.

The browser check is authoritative. A reported violation adds only the
reported origin, with a comment saying why.

A clickjacking frame-guard script (ported from `scripts/security-headers.js`)
goes into `HeadTags.astro`, because `frame-ancestors` is ignored in a meta CSP
and GitHub Pages sends no headers.

### Verification gate

`tools/verify-csp.js` gains `--site-wide`, which also fails when pages carry
differing policies. CI runs `node tools/verify-csp.js dist --site-wide`.

## Verification

1. `pnpm build` completes with no errors.
2. `dist/2025/04/25/hello-world/index.html` exists, `dist/posts/` does not, and
   no HTML or XML file links to `/posts/`.
3. Neither draft appears anywhere in `dist/`.
4. `node tools/verify-csp.js dist --site-wide` passes.
5. `pnpm audit` reports zero advisories (or documented ignores only).
6. Unit tests pass: Mizuki's suite, `covers.test.mjs`, `site-csp.test.mjs`,
   `tools/verify-csp.test.js`.
7. Browser check on `pnpm preview`: the page renders, search works, giscus
   mounts, icons render, theme toggle works, all of it still works after a swup
   navigation, and there are no CSP violations in the console.

## Known risks

- **Mizuki's own audit count is unmeasured.** pnpm 9 cannot read its pnpm-11
  workspace. Plan Task 2 measures and clears it.
- **Installing and building Mizuki runs third-party code.** The auto-mode
  classifier blocked it on 2026-11-01, so execution needs the author's approval.
- `pnpm/action-setup@v4.1.0` installing pnpm 11 is untested; the first CI run is
  the check.
- If Mizuki emits inline event handlers (`onload=` etc.), the verifier fails.
  The plan escalates rather than guesses a rewrite.
- Every page's policy carries every page's inline-script hashes. That is fine
  at this site's size, but grows with per-page unique inline scripts.

## Out of scope

- Hosting changes (Cloudflare/Netlify headers): GitHub Pages stays.
- Migrating Waline comments.
- Redirects for old listing URLs (see URL preservation).
- Preserving ShokaX styling.
