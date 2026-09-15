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
- `/2026/03/10/zkp-series/`

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

### Cover images

The 30 images in `source/covers/` are a ShokaX **random-cover pool** declared in
`source/_data/images.yml`; no post declares its own cover, and ShokaX picks one
per post at render time. Fuwari has no pool concept — each post takes a single
`image:` in its frontmatter.

Resolution: assign one cover per post explicitly, chosen from the existing pool,
and set it as that post's `image:`. The images move to `public/covers/` so the
existing `/covers/<name>.jpg` paths keep working. The unused remainder stays in
the repository as a library for future posts. `images.yml` is deleted — it has
no meaning outside ShokaX.

This is a deliberate behaviour change: covers become stable per post instead of
varying per render.

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

**swup re-mounting is mandatory.** Fuwari uses swup for client-side navigation,
the same hazard the current scripts handle via `pjax:complete`. Waline, the like
button and the login button must re-initialise on swup's content-replace event
or they will silently stop working after the first in-site navigation.

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
- **`https://unpkg.com` in `connect-src`** — carried over from the Waline emoji
  manifest fix (commit `6ef24b9`).

The existing verification script is reused against `dist/`: every page carries a
CSP, every inline script's SHA-256 appears in its page's `script-src`, no page
contains `'unsafe-inline'`, and no inline event handlers remain.

Whether Fuwari emits inline scripts that resist hashing (e.g. swup or theme
bootstrapping with build-varying content) is **unverified** and is the main
technical risk. If any prove unhashable, the fallback is to externalise them
into files served from `'self'`.

## Verification

1. `pnpm build` completes with no errors.
2. Both preserved URLs exist in `dist/` at the exact paths listed above.
3. Neither draft post appears anywhere in `dist/`.
4. CSP verification script passes on `dist/`.
5. `pnpm audit` reports no known vulnerabilities.
6. Browser check: page renders, search works, comments mount, and all three
   still work *after* a swup navigation.

## Known blockers and risks

- **The Waline backend returns HTTP 500** (`FUNCTION_INVOCATION_FAILED`) on all
  endpoints, including root. Comment integration can be verified structurally
  but not end-to-end until that Vercel deployment is fixed. This is independent
  of the migration.
- Fuwari inline scripts may resist hashing (above).
- Stock Fuwari visuals replace the current design. Accepted by the user.

## Out of scope

- Fixing the Waline backend (separate Vercel project, not in this repository).
- Preserving ShokaX styling or layout.
- Migrating the `main`/`master` legacy branches, which hold only April 2025
  build output and no manifest.
