# Migration: Hexo/ShokaX → Astro/Fuwari

Date: 2026-09-15
Status: Approved (design), pending implementation plan

## Goal

Replace the Hexo + ShokaX site with Astro + Fuwari for its anime-style visual
design, preserving existing post URLs, the Waline comment/like integration, and
the build-time CSP hardening currently implemented as Hexo filters.

## Constraints

- **Post URLs must not change.** Waline keys comment and reaction data by URL
  path (`/2025/04/25/hello-world/`). Changing the path orphans that data and
  breaks inbound links.
- **The live site must stay up during migration.** `main_2` continues to deploy
  Hexo until the switch commit.
- **No `'unsafe-inline'` in `script-src`.** The current site achieves this via
  build-time SHA-256 hashing; the replacement must match, not regress.
- Visual design is stock Fuwari. `source/_data/custom.styl` and ShokaX layout
  customisations are intentionally dropped.

## Target stack

Verified against `saicaca/fuwari@main` on 2026-09-15:

| Item | Value |
|---|---|
| Astro | 5.13.10 |
| Package manager | pnpm 9.14.4 (`preinstall` runs `only-allow pnpm`) |
| Node | >= 20 (local: 26.5.0) |
| Build | `astro build && pagefind --site dist` → `dist/` |
| Routing | `trailingSlash: "always"` |
| Transitions | swup (`@swup/astro`) |
| Search | pagefind (WASM) |

## Workspace strategy

Branch `astro-migration` off `main_2`. Fuwari is scaffolded into a subdirectory,
built and verified there, then promoted to the repository root in a single
commit. `.github/workflows/deploy.yml` is updated only in that final commit:

- `npx hexo generate` → `pnpm build`
- `upload-pages-artifact` path `public` → `dist`

This keeps `main_2` deployable from Hexo at every point until the switch.

## URL preservation

Fuwari serves posts from `src/pages/posts/[...slug].astro`, producing
`/posts/<slug>/`. Two changes preserve the existing scheme:

1. **Route.** Replace that file with
   `src/pages/[year]/[month]/[day]/[slug].astro`. `getStaticPaths` derives
   `year`/`month`/`day` from each entry's `published` date (zero-padded) and
   `slug` from the entry slug.

   Explicit dynamic segments are used rather than a root-level rest parameter
   because `src/pages/[...page].astro` already exists for home pagination; two
   rest routes at the root would be ambiguous. Astro ranks explicit dynamic
   segments above rest parameters, so the post route wins.

2. **Link generation.** `getPostUrlBySlug()` in `src/utils/url-utils.ts` is the
   single chokepoint for post links — it currently returns `/posts/${slug}/`.
   Rewriting it to emit `/YYYY/MM/DD/<slug>/` updates every internal link,
   including RSS and the sitemap. It must take the post's date, so its signature
   changes and all call sites are updated.

`trailingSlash: "always"` already matches the current Hexo `pretty_urls`
configuration, so no trailing-slash divergence is introduced.

### URLs that must resolve identically after migration

- `/2025/04/25/hello-world/`

`/2026/03/10/zkp-series/` is **not** live: the post is gitignored (see below), CI
builds from a clean checkout, and the URL returns 404 (checked 2026-11-01). It
only exists in local builds. If the post is ever published, the route above will
give it that URL, but there is no existing URL or Waline data to preserve.

## Content migration

Four posts in `source/_posts/` move to `src/content/posts/`. Frontmatter maps:

| Hexo | Fuwari | Note |
|---|---|---|
| `title` | `title` | unchanged |
| `date` | `published` | field rename; parsed as a date |
| `categories` (list) | `category` (string) | take first element |
| `tags` (list) | `tags` (list) | unchanged |
| `published: false` | `draft: true` | inverted meaning — see below |
| — | `description` | new; authored per post |

**`published` is a false friend.** In Hexo `published: false` hides a post; in
Fuwari `published` is the *date* field and hiding is `draft: true`. The two
currently-hidden posts (`casa_summer_1`, `cissp_summary1`) must come across as
`draft: true`, and must not appear in the built output.

`zkp-series.md` is untracked and gitignored; it stays that way.

Both drafts currently carry the title `CISSP Learning Journy`. For
`casa_summer_1.md` this is a copy-paste error (the post is about the CASA Summer
School), and "Journy" is a typo in both. Fix the titles before they become
non-drafts.

### Cover images

The 30 images in `source/covers/` are a ShokaX **random-cover pool** declared in
`source/_data/images.yml`; no post declares its own cover, and ShokaX picks one
per post at render time. Fuwari has no pool concept — each post takes a single
`image:` in its frontmatter.

Observed ShokaX behaviour: covers are drawn from the pool at build time and are
not stable per post — the same post shows different covers on different pages
(the home page alone renders 7 distinct covers).

Resolution: port the pool rather than hand-assigning covers. The 30 images move
to `public/covers/`, keeping the existing `/covers/<name>.jpg` paths. The pool
list moves from `source/_data/images.yml` to a typed module
(`src/constants/covers.ts`), and a `resolveCover(entry)` helper returns:

1. `entry.data.image` when the post declares one — an explicit cover always wins;
2. otherwise a cover selected from the pool by hashing the post slug.

Selection is **deterministic by slug** rather than randomised. Every post gets
pool art automatically with no manual assignment, new posts included, but a given
post keeps the same cover across every page and across rebuilds. This deviates
from ShokaX, where covers churned per page and per deploy; stable output keeps
builds reproducible and diffable.

`images.yml` is deleted once `covers.ts` replaces it.

## Comments and client integrations

All six `scripts/*.js` are Hexo injector plugins and do not port. They become
Astro components:

| Current script | Disposition |
|---|---|
| `like-button.js` | Astro component + client script |
| `login-button.js` | Astro component + client script |
| `turnstile-autohide.js` | Astro component |
| `hide-comment-useragent.js` | CSS in Fuwari's styles |
| `language-override.js` | drop — Fuwari has real i18n |
| `security-headers.js` | Astro integration (see below) |

**swup re-mounting is mandatory.** Fuwari uses swup for client-side navigation.
This is a **new** hazard, not one the current site already handles: ShokaX 0.5.4
ships no pjax (its `.pjax` classes are vestigial markup, and no built bundle
contains a navigation library or dispatches `pjax:complete`), so every in-site
link is a full page load and the `pjax:complete` listeners in `scripts/` are dead
code. Do not use them as a reference for what works. Waline, the like button and
the login button must re-initialise on swup's content-replace event or they will
silently stop working after the first in-site navigation.

**Pass Waline's `login` option explicitly.** `_config.shokax.yml` sets
`login: "force"`, but the ShokaX `init()` call never forwards it, so Waline runs
with its `"enable"` default and allows anonymous comments. The Fuwari component
should pass `login: 'force'` itself. Client-side options can be bypassed by
calling the API directly, so the real enforcement is the server's `LOGIN=force`
environment variable on the Vercel deployment.

Hexo's config merge takes the union of arrays, which is why the site ships
`requiredMeta: ["nick", "mail"]` although `_config.shokax.yml` lists only
`nick`. Decide the intended value explicitly rather than porting the merged one.

The `safeImageUrl()` avatar-scheme guard and the DOM-API-based rendering in
`login-button.js` (rather than `innerHTML`) are security-relevant and must be
carried over, not simplified away.

## Security hardening

The Hexo `after_render:html` filter has a direct Astro analogue: an integration
hook on `astro:build:done` that post-processes `dist/**/*.html`. The hashing
logic, the inline-handler rewrites and the build-time warning on unrecognised
handlers port across essentially unchanged.

Two additions this stack requires:

- **`'wasm-unsafe-eval'` in `script-src`** — pagefind is WebAssembly and will
  not run without it. This is narrower than `'unsafe-eval'` and does not permit
  string-to-code evaluation.
- **`https://unpkg.com` and `https://api.giphy.com` in `connect-src`** — carried
  over from the Hexo policy. unpkg serves Waline's emoji manifests (commit
  `6ef24b9`); Giphy backs Waline's default GIF search, which is active whenever no
  `search` option is passed. If the Fuwari component sets `search: false`, drop
  the Giphy entry.

`tools/verify-csp.js` is reused against `dist/` (`node tools/verify-csp.js dist`):
every page carries exactly one CSP inside `<head>`, every inline script's SHA-256
appears in its page's `script-src`, no `script-src` contains `'unsafe-inline'`,
and no inline event handlers remain. It already runs as a deploy gate in
`.github/workflows/deploy.yml`; the switch commit only changes its argument.

Whether Fuwari emits inline scripts that resist hashing (e.g. swup or theme
bootstrapping with build-varying content) is **unverified** and is the main
technical risk. If any prove unhashable, the fallback is to externalise them
into files served from `'self'`.

## Verification

1. `pnpm build` completes with no errors.
2. The preserved URL exists in `dist/` at the exact path listed above.
3. Neither draft post appears anywhere in `dist/`.
4. `node tools/verify-csp.js dist` passes.
5. `pnpm audit` reports no known vulnerabilities.
6. Browser check: page renders, search works, comments mount, and all three
   still work *after* a swup navigation.

## Known blockers and risks

- **The Waline backend returns HTTP 500** (`FUNCTION_INVOCATION_FAILED`) on all
  endpoints, including root (still the case on 2026-11-01). Comment integration can be verified structurally
  but not end-to-end until that Vercel deployment is fixed. This is independent
  of the migration.
- Fuwari inline scripts may resist hashing (above).
- Stock Fuwari visuals replace the current design. Accepted by the user.

## Out of scope

- Fixing the Waline backend (separate Vercel project, not in this repository).
- Preserving ShokaX styling or layout.
- Migrating the `main`/`master` legacy branches, which hold only April 2025
  build output and no manifest.
