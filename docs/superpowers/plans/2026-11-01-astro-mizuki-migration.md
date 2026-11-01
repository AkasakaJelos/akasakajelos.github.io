# Astro/Mizuki Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hexo + ShokaX site with Astro 7 + a vendored copy of the Mizuki theme, keeping `/2025/04/25/hello-world/`, a hash-based CSP with no `'unsafe-inline'` in `script-src`, and giscus comments.

**Architecture:** Mizuki is vendored into `site/` on `astro-migration` and built there while `main_2` keeps deploying Hexo. Features are switched off by config where Mizuki offers a flag and deleted only when they are leaf pages or build scripts. Two small pieces of new code carry the security and continuity requirements: a deterministic cover-pool resolver in Mizuki's post loader, and an Astro integration that injects one identical CSP into every page. A final switch commit promotes `site/` to the root and repoints CI.

**Tech Stack:** Astro ^7.4.4, Mizuki @ `14da4262d8aa1d93dc8cff11705f14918ed7369f`, Tailwind 4, swup, Pagefind, giscus, pnpm 11, Node 24, `node:test`.

Spec: `docs/superpowers/specs/2026-11-01-astro-mizuki-migration-design.md`

## Global Constraints

- Live post URL is unchanged: `/2025/04/25/hello-world/`.
- `main_2` deploys Hexo until the Task 10 switch commit. Nothing is pushed without the author's go-ahead.
- `script-src` never contains `'unsafe-inline'`. The CSP is identical on every page.
- `astro` ≥ 7.2.8 (GHSA-26w7-cxv4-gfx2); target `^7.4.4`.
- `pnpm audit` reports zero advisories, or only ignores with a written reason.
- No build-time network fetches beyond package install and Astro's font provider.
- No third-party analytics: `oddmisc` removed, Clarity disabled.
- Drafts (`draft: true`) never appear in `dist/`.
- The unfinished posts `casa_summer_1`, `cissp_summary1` and `zkp-series` are never committed, at any path. They are local-only and gitignored.
- Run every command from the repository root unless a step says otherwise. Site commands use `pnpm --dir site …` until Task 10.
- Commit messages: Conventional Commits, decision trailers where applicable, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Prerequisites (author, before Task 1)

These cannot be done by an agent alone:

1. **Approve running third-party code.** Tasks 1–11 install and build Mizuki, which executes its lifecycle and build scripts. The Claude Code auto-mode classifier blocked this on 2026-11-01. Approve the prompt when it appears, or add a Bash allow rule.
2. **pnpm 11 locally.** pnpm 9.12's version switching crashes on Node 26 (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`). Run `! npm install -g pnpm@11.28.10`, then confirm with `pnpm --version` → `11.28.10`.
3. **giscus (needed by Task 7):** enable Discussions under the repository's Settings → General → Features, and install https://github.com/apps/giscus for `AkasakaJelos/akasakajelos.github.io`.

## File Structure

Created (all under `site/` until Task 10):

| Path | Responsibility |
|---|---|
| `site/` | Vendored Mizuki at the pinned SHA, minus excluded paths |
| `site/UPSTREAM.md` | Upstream SHA, excluded paths, running list of local modifications |
| `site/src/constants/covers.ts` | The 30-image cover pool and `resolveCover(id, image)` |
| `site/integrations/site-csp.mjs` | `astro:build:done` hook: one site-wide CSP from the union of inline-script hashes |
| `site/tests/covers.test.mjs` | Unit tests for the cover resolver |
| `site/tests/site-csp.test.mjs` | Unit tests for the CSP integration |
| `site/tests/dist-urls.test.mjs` | Post-build assertions on `dist/`: URLs, drafts, covers, comments |
| `tools/verify-csp.test.js` | Unit tests for the verifier, including `--site-wide` |

Modified: `.gitignore`, `tools/verify-csp.js`, `.github/workflows/deploy.yml`, `.node-version`, and these Mizuki files: `package.json`, `pnpm-workspace.yaml`, `astro.config.mjs`, `src/config/{siteConfig,profileConfig,navBarConfig,sidebarConfig,musicConfig,pioConfig,shareConfig,permalinkConfig,commentConfig}.ts`, `src/loaders/post-loader.ts`, `src/pages/posts/[...slug].astro`, `src/layouts/partials/HeadTags.astro`, `src/content/spec/about.md`.

Deleted at the switch (Task 10): `_config.yml`, `_config.shokax.yml`, `scaffolds/`, `scripts/`, `source/`, `themes/`, root `package.json` and `pnpm-lock.yaml` (replaced by Mizuki's).

---

### Task 1: Vendor Mizuki into `site/` with an offline build

**Files:**
- Create: `site/` (copy), `site/UPSTREAM.md`
- Modify: `.gitignore`, `site/package.json`
- Delete: `site/scripts/{sync-content.js,init-content-repo.js,update-anime.mjs,update-bangumi.mjs,update-bilibili.mjs,indexnow-submit.js}`

**Interfaces:**
- Produces: a `site/` directory where `pnpm --dir site build` writes `site/dist/` without network access beyond install.

- [ ] **Step 1: Fetch the pinned upstream commit into a temp directory**

```bash
SRC=$(mktemp -d)
git -C "$SRC" init -q
git -C "$SRC" remote add origin https://github.com/matsuzaka-yuki/Mizuki.git
git -C "$SRC" fetch -q --depth 1 origin 14da4262d8aa1d93dc8cff11705f14918ed7369f
git -C "$SRC" checkout -q FETCH_HEAD
git -C "$SRC" rev-parse HEAD
```

Expected: `14da4262d8aa1d93dc8cff11705f14918ed7369f`

- [ ] **Step 2: Copy it into `site/`, excluding non-vendored paths**

```bash
rsync -a \
  --exclude .git --exclude .github --exclude .devin --exclude .vscode \
  --exclude docs --exclude CLAUDE.md --exclude vercel.json \
  --exclude 'README*' --exclude logo.png --exclude _frontmatter.json \
  "$SRC"/ site/
ls site
```

Expected: the listing includes `LICENSE`, `LICENSE.MIT`, `THIRD_PARTY_NOTICES.md`, `astro.config.mjs`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `public`, `scripts`, `src` and `tests`. It must not include `CLAUDE.md`, `.github` or `docs`.

- [ ] **Step 3: Anchor the root `.gitignore` patterns that would hide `site/` files**

In `.gitignore`, replace the line `public/` with `/public/`. Then check:

```bash
git check-ignore -v site/public/favicon 2>/dev/null; echo "exit $?"
```

Expected: `exit 1` (not ignored). If it prints a rule, that rule also needs anchoring.

- [ ] **Step 4: Make the build offline and drop the remote preinstall**

```bash
node -e '
const fs = require("fs");
const f = "site/package.json";
const src = fs.readFileSync(f, "utf8");
const p = JSON.parse(src);
for (const k of ["sync-content", "init-content", "predev", "prebuild", "update-anime",
                 "update-bangumi", "update-bilibili", "submit", "preinstall"]) delete p.scripts[k];
p.scripts.build = "astro build && node scripts/check-global-style-loading.mjs && pagefind --site dist && node scripts/check-font-loading.mjs";
fs.writeFileSync(f, JSON.stringify(p, null, /^\t/m.test(src) ? "\t" : 2) + "\n");
'
rm -v site/scripts/sync-content.js site/scripts/init-content-repo.js site/scripts/update-anime.mjs \
      site/scripts/update-bangumi.mjs site/scripts/update-bilibili.mjs site/scripts/indexnow-submit.js
grep -rn -E "sync-content|init-content-repo|update-anime|update-bangumi|update-bilibili|indexnow-submit" \
  site/src site/scripts site/package.json site/astro.config.mjs
```

Expected: six `removed` lines, and the grep matches nothing that is an `import` or a script invocation. If it finds one, stop and report it rather than deleting further.

`preinstall` ran `npx only-allow pnpm`, which downloaded and executed a package on every install.

- [ ] **Step 5: Install and build**

```bash
pnpm --dir site install --frozen-lockfile
pnpm --dir site build
ls site/dist/index.html
```

Expected: install and build exit 0, and `site/dist/index.html` exists. A frozen-lockfile failure means Step 4 touched dependencies, which it must not.

- [ ] **Step 6: Record the baseline test and audit results**

```bash
pnpm --dir site test; echo "test exit $?"
pnpm --dir site audit | tail -3
```

Record both outputs verbatim. They go into `UPSTREAM.md` and the commit message, and Task 2 compares against them.

- [ ] **Step 7: Write `site/UPSTREAM.md`**

```markdown
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

## Baseline at vendoring (Task 1)

- pnpm test: <paste Step 6 result>
- pnpm audit: <paste Step 6 summary line>
```

Paste the real Step 6 output into the two placeholders before committing.

- [ ] **Step 8: Commit**

```bash
git add .gitignore site
git status --short | grep -v '^A  site/' | head
git commit -m "build(site): vendor Mizuki 14da426 with an offline build" -m "Constraint: no build-time network fetches beyond install" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: the `git status` filter shows only `M  .gitignore`. `site/node_modules/` and `site/dist/` must not be staged (Mizuki's `site/.gitignore` covers them).

---

### Task 2: Upgrade Astro past the critical advisory and clear the audit

**Files:**
- Modify: `site/package.json`, `site/pnpm-lock.yaml`, `site/pnpm-workspace.yaml`, `site/UPSTREAM.md`

**Interfaces:**
- Consumes: Task 1's buildable `site/`.
- Produces: `site/` on `astro@^7.4.4` with `pnpm --dir site audit` reporting zero advisories.

- [ ] **Step 1: Confirm the failing state**

```bash
pnpm --dir site why astro | grep -E "^astro "
pnpm --dir site audit | grep -c GHSA-26w7-cxv4-gfx2
```

Expected: `astro 7.1.3` and a count ≥ 1. This is the test that must flip.

- [ ] **Step 2: Upgrade Astro**

```bash
pnpm --dir site add astro@^7.4.4
pnpm --dir site why astro | grep -E "^astro "
```

Expected: `astro 7.4.4` or later 7.x. If `minimumReleaseAge` refuses a too-fresh version, take the newest version it accepts, as long as it is ≥ 7.2.8.

- [ ] **Step 3: Clear remaining advisories with scoped overrides**

```bash
pnpm --dir site audit --json > /tmp/site-audit.json; node -e '
const a = require("/tmp/site-audit.json");
for (const v of Object.values(a.advisories))
  console.log(v.module_name, "|", v.vulnerable_versions, "|", v.patched_versions, "|", v.github_advisory_id);'
```

For each line, add an entry to the `overrides:` map in `site/pnpm-workspace.yaml`. Create the key if it is absent. The rule matches the root `package.json` overrides from commit `2a0f68a`: key `<module>@<vulnerable range>`, value the caret of the lowest patched version. For example, for `zod | <4.6.6 | >=4.6.6`:

```yaml
overrides:
  "zod@<4.6.6": "^4.6.6"
```

Never use an open `>=` value, which can cross a major version. If an advisory has no patched version (`<0.0.0`), add its ID under `auditConfig.ignoreGhsas` in the same file, with a YAML comment on the line above naming its only consumer and why it is not reachable. Leave it unfixed and report it if you cannot write that sentence truthfully.

- [ ] **Step 4: Reinstall, rebuild, re-test, re-audit**

```bash
pnpm --dir site install
pnpm --dir site build
pnpm --dir site test; echo "test exit $?"
pnpm --dir site audit --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("advisories:",Object.keys(JSON.parse(d).advisories).length))'
```

Expected: build exits 0, test results match Task 1's baseline, and `advisories: 0`. If an override breaks the build, scope it under its consumer (`"<parent>>child": …`) instead of widening it, as was done for `stylus` in commit `2a0f68a`.

- [ ] **Step 5: Update `site/UPSTREAM.md` and commit**

Append under *Local modifications*: `- astro 7.1.3 → ^7.4.4 (GHSA-26w7-cxv4-gfx2); overrides in pnpm-workspace.yaml clear pnpm audit.`

```bash
git add site/package.json site/pnpm-lock.yaml site/pnpm-workspace.yaml site/UPSTREAM.md
git commit -m "fix(site): upgrade Astro to 7.4 and clear pnpm audit" -m "Astro 7.1.3 is affected by GHSA-26w7-cxv4-gfx2 (critical, AVIF RCE), fixed in 7.2.8." -m "Confidence: high" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Switch off demo features and third-party integrations

**Files:**
- Modify: `site/src/config/siteConfig.ts`, `site/src/config/musicConfig.ts`, `site/src/config/pioConfig.ts`, `site/src/config/shareConfig.ts`, `site/src/config/sidebarConfig.ts`, `site/src/config/navBarConfig.ts`, `site/astro.config.mjs`, `site/package.json`, `site/UPSTREAM.md`
- Delete: `site/src/pages/{anime,diary,friends,projects,skills,timeline,albums,devices,ai-tools}.astro`, `site/src/pages/albums/`

**Interfaces:**
- Consumes: Task 2's patched `site/`.
- Produces: a `dist/` with no feature pages, music player, mascot, share buttons or Umami calls. Navigation is Home, Archive, About and GitHub.

- [ ] **Step 1: Write the failing check**

```bash
pnpm --dir site build >/dev/null && for p in anime diary friends projects skills timeline albums devices ai-tools; do [ -e site/dist/$p ] && echo "PRESENT $p"; done; grep -rl "oddmisc\|umami" site/dist --include='*.html' | head -3
```

Expected now: nine `PRESENT` lines and at least one HTML file mentioning `oddmisc` or `umami`. After this task, both must be empty.

- [ ] **Step 2: Turn off feature pages**

In `site/src/config/siteConfig.ts`, set every key in `featurePages` to `false`: `anime`, `diary`, `friends`, `projects`, `skills`, `timeline`, `albums`, `devices`, `aiTools`.

- [ ] **Step 3: Delete the feature page routes**

```bash
rm -v site/src/pages/anime.astro site/src/pages/diary.astro site/src/pages/friends.astro \
      site/src/pages/projects.astro site/src/pages/skills.astro site/src/pages/timeline.astro \
      site/src/pages/albums.astro site/src/pages/devices.astro site/src/pages/ai-tools.astro
rm -rv site/src/pages/albums
```

- [ ] **Step 4: Disable music player, mascot and share buttons**

Set the top-level `enable` to `false` in `site/src/config/musicConfig.ts` (line 5, `enable: true, // 启用音乐播放器功能`), `site/src/config/pioConfig.ts` (line 5, `enable: true, // 启用看板娘`) and `site/src/config/shareConfig.ts` (line 5).

- [ ] **Step 5: Remove the music and announcement widgets from the sidebar**

In `site/src/config/sidebarConfig.ts`, delete the `properties` entries whose `type` is `"music-sidebar"` or `"announcement"`. Then replace the `components` block with:

```ts
	components: {
		left: ["profile", "tags", "card-toc"],
		right: ["site-stats", "calendar", "categories"],
		drawer: ["profile", "categories", "tags"],
	},
```

- [ ] **Step 6: Replace the navigation**

In `site/src/config/navBarConfig.ts`, keep the import and the doc comment, and replace the `navBarConfig` object with:

```ts
export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/AkasakaJelos",
			external: true,
			icon: "fa7-brands:github",
		},
	],
};
```

- [ ] **Step 7: Remove the Umami integration**

In `site/astro.config.mjs`, delete the line `import { oddmisc } from "oddmisc";` and the integration block:

```js
		oddmisc({
			umami: {
				shareUrl: false,
			},
		}),
```

Then:

```bash
pnpm --dir site remove oddmisc
```

`PostMeta.astro` and `Profile.astro` already hide their view counters when `window.oddmisc` is absent; leave them unchanged.

- [ ] **Step 8: Build and run the check from Step 1**

```bash
pnpm --dir site build
for p in anime diary friends projects skills timeline albums devices ai-tools; do [ -e site/dist/$p ] && echo "PRESENT $p"; done; grep -rl "oddmisc\|umami" site/dist --include='*.html' | head -3; echo "check done"
pnpm --dir site test; echo "test exit $?"
```

Expected: only `check done` is printed, and the build exits 0. If `tests/music-player-loading.test.mjs` now fails *because the player is disabled*, delete that file, remove it from the `test` script in `site/package.json`, and note this in `UPSTREAM.md`. Any other failing test means a real regression: stop and report it.

- [ ] **Step 9: Update `UPSTREAM.md` and commit**

Append: `- Disabled featurePages, music, pio, share, announcement widget; deleted nine feature page routes; removed oddmisc (Umami).`

```bash
git add -A site
git commit -m "feat(site): drop demo feature pages and third-party integrations" -m "Removes Umami analytics (oddmisc) and switches off music player, Live2D mascot, share buttons and the nine feature pages." -m "Rejected: delete feature components too | flags keep the upstream diff small; pages are leaf routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Site identity, About page and avatar

**Files:**
- Modify: `site/src/config/siteConfig.ts`, `site/src/config/profileConfig.ts`, `site/src/content/spec/about.md`
- Create: `site/src/assets/images/avatar.jpg` (copied from `source/_data/assets/avatar.jpg`)

**Interfaces:**
- Produces: a site titled "Bibliothek" with Akasaka Jelos's profile. Task 5 relies on `siteConfig.timeZone === "Europe/Berlin"`.

- [ ] **Step 1: Write the failing check**

```bash
grep -l "One demo website\|まつざか ゆき\|mizuki.mysqil.com" site/dist/index.html; grep -c "<title>[^<]*Bibliothek" site/dist/index.html
```

Expected now: `site/dist/index.html` listed, and `0`.

- [ ] **Step 2: Site config**

In `site/src/config/siteConfig.ts`, set:

```ts
	title: "Bibliothek",
	subtitle: "Domus Sapientiae",
	siteURL: "https://akasakajelos.github.io/",
	siteStartDate: "2025-04-25",
	timeZone: "Europe/Berlin",
```

In the same file's `banner` section, set the banner `title` (currently `"わたしの部屋"`) to `"Bibliothek"` and its `subtitle` array to `["Domus Sapientiae"]`.

- [ ] **Step 3: Profile config**

Replace the `profileConfig` object in `site/src/config/profileConfig.ts`:

```ts
export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.jpg", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
	name: "Akasaka Jelos",
	bio: "My smoll webpage",
	typewriter: {
		enable: true,
		speed: 80,
	},
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/AkasakaJelos",
		},
	],
};
```

```bash
cp source/_data/assets/avatar.jpg site/src/assets/images/avatar.jpg
```

- [ ] **Step 4: About page**

Replace the whole content of `site/src/content/spec/about.md` with the body of `source/about/index.md`, everything after its closing frontmatter `---`:

```bash
awk 'f>=2{print} /^---$/{f++}' source/about/index.md > site/src/content/spec/about.md
head -3 site/src/content/spec/about.md
```

Expected: the first line is `Welcome to my webpage!`.

- [ ] **Step 5: Build and re-run the check**

```bash
pnpm --dir site build
grep -l "One demo website\|まつざか ゆき\|mizuki.mysqil.com" site/dist/index.html; grep -c "<title>[^<]*Bibliothek" site/dist/index.html
grep -c "ETH Zurich" site/dist/about/index.html
```

Expected: no file listed, then `1` and `1`.

- [ ] **Step 6: Commit**

```bash
git add site/src/config/siteConfig.ts site/src/config/profileConfig.ts site/src/content/spec/about.md site/src/assets/images/avatar.jpg
git commit -m "feat(site): set Bibliothek site identity, profile and about page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Migrate posts with date permalinks

**Files:**
- Create: `site/tests/dist-urls.test.mjs`, `site/src/content/posts/hello-world.md`; locally only, never committed: `site/src/content/posts/{casa_summer_1,cissp_summary1}.md`
- Modify: `site/src/config/permalinkConfig.ts`, `site/src/pages/posts/[...slug].astro`, `.gitignore`
- Delete: Mizuki demo posts under `site/src/content/posts/`

**Interfaces:**
- Consumes: `siteConfig.timeZone === "Europe/Berlin"` (Task 4).
- Produces: `site/tests/dist-urls.test.mjs`. Tasks 6 and 7 append test cases to it, and it exports nothing.

- [ ] **Step 1: Write the failing post-build test**

Create `site/tests/dist-urls.test.mjs`:

```js
// Post-build assertions on dist/. Run after `pnpm build`:
//     node --test tests/dist-urls.test.mjs
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const p = join(dir, entry.name);
		return entry.isDirectory() ? walk(p) : [p];
	});
}

const pages = existsSync(DIST) ? walk(DIST).filter((f) => /\.(html|xml)$/.test(f)) : [];
const read = (rel) => readFileSync(join(DIST, rel), "utf8");

test("dist has been built", () => {
	assert.ok(pages.length > 0, `no HTML/XML under ${DIST}; run pnpm build first`);
});

test("hello-world keeps its Hexo URL", () => {
	assert.ok(existsSync(join(DIST, "2025/04/25/hello-world/index.html")));
});

test("no /posts/ duplicates are emitted", () => {
	assert.ok(!existsSync(join(DIST, "posts")), "dist/posts/ exists");
});

test("no page or feed links to /posts/", () => {
	for (const file of pages) {
		const html = readFileSync(file, "utf8");
		assert.ok(!/["'(]\/posts\//.test(html), `${file} links to /posts/`);
		assert.ok(!html.includes("akasakajelos.github.io/posts/"), `${file} links to /posts/`);
	}
});

test("drafts are not published", () => {
	for (const file of pages) {
		const html = readFileSync(file, "utf8");
		assert.ok(!/CISSP Learning Journy|casa_summer_1|cissp_summary1/.test(html), `${file} leaks a draft`);
	}
});

test("rss lists the canonical post URL", () => {
	assert.ok(read("rss.xml").includes("https://akasakajelos.github.io/2025/04/25/hello-world/"));
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
pnpm --dir site build >/dev/null && (cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `fail` is at least 2 ("hello-world keeps its Hexo URL" and "no /posts/ duplicates").

- [ ] **Step 3: Ignore the local-only drafts at their new path, before writing anything**

`casa_summer_1`, `cissp_summary1` and `zkp-series` are unfinished and have been untracked since 2026-11-01 (commit `21b6903` on `main_2`). They exist only on the author's machine and must never be committed. Append to `.gitignore`:

```
site/src/content/posts/zkp-series.md
site/src/content/posts/casa_summer_1.md
site/src/content/posts/cissp_summary1.md
```

```bash
for f in zkp-series casa_summer_1 cissp_summary1; do git check-ignore -q "site/src/content/posts/$f.md" && echo "ignored $f"; done
```

Expected: three `ignored` lines. Do not continue until all three print.

- [ ] **Step 4: Replace demo posts with hello-world, and convert local drafts if present**

```bash
find site/src/content/posts -mindepth 1 -delete
for f in hello-world casa_summer_1 cissp_summary1; do
  if [ -f "source/_posts/$f.md" ]; then
    awk 'f>=2{print} /^---$/{f++}' "source/_posts/$f.md" > "/tmp/$f.body"
  else
    echo "skip $f (not on this machine)"
  fi
done
```

`hello-world.md` is tracked, so it always exists. The two drafts exist only in the author's own checkout; a fresh clone or worktree prints `skip` for both, which is expected.

Each post file is its frontmatter block below followed by its body. Save a frontmatter block as `/tmp/<name>.fm`, then build the file with `cat /tmp/<name>.fm /tmp/<name>.body > site/src/content/posts/<name>.md`. Write the two draft files only when their `/tmp/<name>.body` exists.

Write `site/src/content/posts/hello-world.md` as this frontmatter followed by `/tmp/hello-world.body`:

```yaml
---
title: Hello World
published: 2025-04-25T12:00:00+02:00
category: General
tags:
  - Hexo
  - ShokaX
---
```

Write `site/src/content/posts/casa_summer_1.md` as this frontmatter followed by `/tmp/casa_summer_1.body`:

```yaml
---
title: CISSP Learning Journy
published: 2025-07-03T12:00:00+02:00
draft: true
category: General
tags:
  - Security
  - Cryptography
  - Consensus
  - Distributed Systems
---
```

Write `site/src/content/posts/cissp_summary1.md` as this frontmatter followed by `/tmp/cissp_summary1.body`:

```yaml
---
title: CISSP Learning Journy
published: 2025-07-03T12:00:00+02:00
draft: true
category: General
tags:
  - Security
  - CISSP
  - Consulting
  - Certificates
---
```

The titles are copied verbatim, including the existing error. The spec records that the author fixes them before un-drafting.

```bash
for f in hello-world casa_summer_1 cissp_summary1; do
  [ -f "/tmp/$f.body" ] || continue
  diff <(awk 'f>=2{print} /^---$/{f++}' site/src/content/posts/$f.md) /tmp/$f.body && echo "body ok $f"
done
git status --short --untracked-files=all site/src/content/posts
```

Expected: a `body ok` line for each post converted, and `git status` lists **only** `site/src/content/posts/hello-world.md`. If a draft appears, Step 3 did not take effect: stop.

- [ ] **Step 5: Enable date permalinks**

In `site/src/config/permalinkConfig.ts`, set:

```ts
	enable: true,
	format: "%year%/%monthnum%/%day%/%postname%",
```

- [ ] **Step 6: Stop emitting `/posts/<slug>/` duplicates**

In `site/src/pages/posts/[...slug].astro`, replace the whole `for (const entry of blogEntries) { … }` loop inside `getStaticPaths` with:

```ts
	for (const entry of blogEntries) {
		// This site never served /posts/<slug>/, and giscus keys threads by
		// pathname, so a second copy would split each post's comments in two.
		// Permalinked posts are served only by src/pages/[...permalink].astro.
		if (permalinkConfig.enable || hasCustomPermalink(entry)) {
			continue;
		}

		const defaultSlug = removeFileExtension(entry.id);
		paths.push({
			params: { slug: defaultSlug },
			props: { entry },
		});

		if (entry.data.alias) {
			let alias = entry.data.alias.replace(/^\/+/, "").replace(/\/+$/, "");
			if (alias.startsWith("posts/")) {
				alias = alias.replace(/^posts\//, "");
			}
			paths.push({
				params: { slug: alias },
				props: { entry },
			});
		}
	}
```

- [ ] **Step 7: Build and run the test**

```bash
pnpm --dir site build && (cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `pass 6` and `fail 0`. If "no page or feed links to /posts/" fails, the failing file names the component that still calls `getPostUrlBySlug`. Switch that call to `getPostUrl(entry)` from `@/utils/url-utils`, which honours permalinks, and re-run.

- [ ] **Step 8: Commit**

```bash
git add .gitignore site/src/content/posts site/src/config/permalinkConfig.ts "site/src/pages/posts/[...slug].astro" site/tests/dist-urls.test.mjs
git commit -m "feat(site): migrate posts and preserve /YYYY/MM/DD/slug/ URLs" -m "Mizuki keeps /posts/<slug>/ copies when permalinks are on; this site never served them and giscus keys threads by pathname, so they are not emitted." -m "Constraint: /2025/04/25/hello-world/ must not change" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Deterministic cover pool

**Files:**
- Create: `site/src/constants/covers.ts`, `site/tests/covers.test.mjs`, `site/public/covers/*.jpg` (30 files from `source/covers/`)
- Modify: `site/src/loaders/post-loader.ts`, `site/package.json` (`test` script), `site/tests/dist-urls.test.mjs`

**Interfaces:**
- Produces: `export const COVER_POOL: readonly string[]`, `export function coverForId(id: string): string`, and `export function resolveCover(id: string, image: unknown): string` from `site/src/constants/covers.ts`.

- [ ] **Step 1: Write the failing unit test**

Create `site/tests/covers.test.mjs`:

```js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { COVER_POOL, coverForId, resolveCover } from "../src/constants/covers.ts";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

test("pool holds the 30 ported ShokaX covers", () => {
	assert.equal(COVER_POOL.length, 30);
	for (const p of COVER_POOL) assert.match(p, /^\/covers\/[a-z0-9]+\.jpg$/);
	assert.equal(new Set(COVER_POOL).size, 30);
});

test("every pool entry exists under public/", () => {
	for (const p of COVER_POOL) assert.ok(existsSync(join(PUBLIC, p)), `missing ${p}`);
});

test("selection is pinned (FNV-1a 32-bit mod pool size)", () => {
	// Changing the hash or reordering the pool changes every post's cover.
	assert.equal(coverForId("hello-world"), "/covers/6833939bly1gicitcxhpij20zk0m8hdt.jpg");
	assert.equal(coverForId("zkp-series"), "/covers/6833939bly1giclh3brzpj20zk0m8ann.jpg");
});

test("an explicit image always wins", () => {
	assert.equal(resolveCover("hello-world", "/custom.png"), "/custom.png");
});

test("a missing or blank image falls back to the pool", () => {
	const expected = coverForId("hello-world");
	assert.equal(resolveCover("hello-world", undefined), expected);
	assert.equal(resolveCover("hello-world", ""), expected);
	assert.equal(resolveCover("hello-world", "   "), expected);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
(cd site && node --experimental-strip-types --test tests/covers.test.mjs) 2>&1 | tail -3
```

Expected: failure with `ERR_MODULE_NOT_FOUND` for `src/constants/covers.ts`.

- [ ] **Step 3: Copy the images and write the module**

```bash
mkdir -p site/public/covers && cp source/covers/*.jpg site/public/covers/ && ls site/public/covers | wc -l
```

Expected: `30`.

Create `site/src/constants/covers.ts`, with the pool in the exact order of `source/_data/images.yml`:

```ts
// Ported from the ShokaX random-cover pool (source/_data/images.yml).
// Selection is deterministic by post id, so a post keeps its cover across
// pages and rebuilds. Order matters: reordering changes every post's cover.
export const COVER_POOL: readonly string[] = [
	"/covers/6833939bly1giciryrr3rj20zk0m8nhk.jpg",
	"/covers/6833939bly1gicis081o9j20zk0m8dmr.jpg",
	"/covers/6833939bly1gicis3attqj20zk0m8k7l.jpg",
	"/covers/6833939bly1giciszlczyj20zk0m816d.jpg",
	"/covers/6833939bly1gicit31ffoj20zk0m8naf.jpg",
	"/covers/6833939bly1gicit4jrvuj20zk0m8785.jpg",
	"/covers/6833939bly1gicitcxhpij20zk0m8hdt.jpg",
	"/covers/6833939bly1gicitf0kl1j20zk0m87fe.jpg",
	"/covers/6833939bly1gicitht3xtj20zk0m8k5v.jpg",
	"/covers/6833939bly1gicitspjpbj20zk0m81ky.jpg",
	"/covers/6833939bly1gicitzannuj20zk0m8b29.jpg",
	"/covers/6833939bly1giciub8ja1j20zk0m81ky.jpg",
	"/covers/6833939bly1giciuja1j1j20zk0m8kjl.jpg",
	"/covers/6833939bly1giciukx8a7j20zk0m8aio.jpg",
	"/covers/6833939bly1giciundwu5j20zk0m8n9e.jpg",
	"/covers/6833939bly1giciusoyjnj219g0u0x56.jpg",
	"/covers/6833939bly1giciuv0socj20zk0m8qes.jpg",
	"/covers/6833939bly1gicivghyooj20zk0m8dir.jpg",
	"/covers/6833939bly1giclfb3vzhj20zk0m8wny.jpg",
	"/covers/6833939bly1giclfdu6exj20zk0m87hw.jpg",
	"/covers/6833939bly1giclffsa1cj20zk0m811l.jpg",
	"/covers/6833939bly1giclflwv2aj20zk0m84qp.jpg",
	"/covers/6833939bly1giclfw2t96j20zk0m8x6p.jpg",
	"/covers/6833939bly1giclg5ms2rj20zk0m8u0x.jpg",
	"/covers/6833939bly1giclga70tsj20zk0m84mr.jpg",
	"/covers/6833939bly1giclgi503lj20zk0m8hdt.jpg",
	"/covers/6833939bly1giclgrvbd6j20zk0m8qv5.jpg",
	"/covers/6833939bly1giclh0m9pdj20zk0m8hdt.jpg",
	"/covers/6833939bly1giclh3brzpj20zk0m8ann.jpg",
	"/covers/6833939bly1giclh5u05ej20zk0m87df.jpg",
];

// FNV-1a 32-bit: tiny, dependency-free and identical on every platform and
// Node version, unlike anything seeded or locale-dependent.
function fnv1a(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

export function coverForId(id: string): string {
	return COVER_POOL[fnv1a(id) % COVER_POOL.length];
}

export function resolveCover(id: string, image: unknown): string {
	return typeof image === "string" && image.trim() !== "" ? image : coverForId(id);
}
```

- [ ] **Step 4: Run the unit test to confirm it passes**

```bash
(cd site && node --experimental-strip-types --test tests/covers.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `pass 5`, `fail 0`.

- [ ] **Step 5: Wire it into the post loader**

In `site/src/loaders/post-loader.ts`, add after the existing `isDateOnlyFrontmatterField` import:

```ts
import { resolveCover } from "../constants/covers";
```

and change the `data` object inside `parseData` to:

```ts
					const data = {
						...props.data,
						// One chokepoint for the cover pool: cards, post pages, OG
						// images and feeds all read entry.data.image.
						image: resolveCover(props.id, props.data.image),
						_publishedDateOnly: isDateOnlyFrontmatterField(
							rawFrontmatter,
							"published",
						),
						_updatedDateOnly: isDateOnlyFrontmatterField(
							rawFrontmatter,
							"updated",
						),
					};
```

Add `tests/covers.test.mjs` to the `node --experimental-strip-types --test …` file list in the `test` script of `site/package.json`.

- [ ] **Step 6: Assert the cover on the built page**

Append to `site/tests/dist-urls.test.mjs`:

```js
test("hello-world shows its pool cover", () => {
	assert.ok(
		read("2025/04/25/hello-world/index.html").includes("/covers/6833939bly1gicitcxhpij20zk0m8hdt.jpg"),
	);
});
```

```bash
pnpm --dir site build && (cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
pnpm --dir site test; echo "test exit $?"
```

Expected: `pass 7`, `fail 0`, and `test exit 0`.

- [ ] **Step 7: Commit**

```bash
git add site/src/constants/covers.ts site/tests/covers.test.mjs site/public/covers site/src/loaders/post-loader.ts site/package.json site/tests/dist-urls.test.mjs
git commit -m "feat(site): port the ShokaX cover pool with slug-stable selection" -m "Rejected: random per build | ShokaX churned covers per page and per deploy; stable output keeps builds diffable" -m "Directive: COVER_POOL order is load-bearing; append new covers, never reorder" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: giscus comments

**Files:**
- Modify: `site/src/config/commentConfig.ts`, `site/tests/dist-urls.test.mjs`

**Interfaces:**
- Consumes: Prerequisite 3 (Discussions enabled, giscus app installed).
- Produces: post pages containing `<div id="giscus-container"`. Task 8's policy allows `https://giscus.app`.

- [ ] **Step 1: Write the failing assertion**

Append to `site/tests/dist-urls.test.mjs`:

```js
test("posts mount giscus, configured for this repository", () => {
	const html = read("2025/04/25/hello-world/index.html");
	assert.ok(html.includes('id="giscus-container"'), "no giscus container");
	assert.ok(html.includes("AkasakaJelos/akasakajelos.github.io"), "giscus repo not configured");
});
```

```bash
(cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `fail 1`.

- [ ] **Step 2: Fetch the repository and category node IDs**

```bash
gh api repos/AkasakaJelos/akasakajelos.github.io --jq .node_id
gh api graphql -f query='{repository(owner:"AkasakaJelos",name:"akasakajelos.github.io"){hasDiscussionsEnabled discussionCategories(first:20){nodes{id name}}}}'
```

Expected: a repository ID starting `R_`, `"hasDiscussionsEnabled": true`, and an `Announcements` category with an ID starting `DIC_`. If Discussions are disabled, stop: Prerequisite 3 is not done.

- [ ] **Step 3: Configure giscus**

In `site/src/config/commentConfig.ts`, set `enable: true` and `system: "giscus"`, and set these `giscus` fields, using the Step 2 output for the two IDs:

```ts
		repo: "AkasakaJelos/akasakajelos.github.io",
		repoId: "R_…", // from Step 2
		category: "Announcements",
		categoryId: "DIC_…", // from Step 2
		mapping: "pathname",
```

Leave the remaining `giscus` fields at Mizuki's defaults. `lang` already follows `SITE_LANG = "en"`.

- [ ] **Step 4: Build and run the tests**

```bash
pnpm --dir site build && (cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `pass 8`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add site/src/config/commentConfig.ts site/tests/dist-urls.test.mjs
git commit -m "feat(site): enable giscus comments" -m "Replaces Waline: no backend to operate, no login token in localStorage, login always required, and the iframe isolates commenter content from the page." -m "Rejected: port Waline | backend down since 2026-09 and needs ~400 lines of custom login/like code" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Site-wide mode for the CSP verifier

**Files:**
- Modify: `tools/verify-csp.js`
- Create: `tools/verify-csp.test.js`

**Interfaces:**
- Produces: `node tools/verify-csp.js <dir> [--site-wide]`, and `module.exports = { checkPage, checkSiteWide }`. `checkPage(html: string) → { problems: string[], hashed: number, policy: string }` and `checkSiteWide(policies: string[]) → string | null`.

- [ ] **Step 1: Write the failing tests**

Create `tools/verify-csp.test.js`:

```js
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { checkPage, checkSiteWide } = require('./verify-csp.js');

const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

function page (script) {
  const csp = "default-src 'self'; script-src 'self' " + sha(script);
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/>' +
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
    '</head><body><script>' + script + '</script></body></html>';
}

test('a well-formed page passes and reports its policy', () => {
  const result = checkPage(page('a()'));
  assert.deepEqual(result.problems, []);
  assert.equal(result.hashed, 1);
  assert.match(result.policy, /^default-src 'self'; script-src /);
});

test('an unhashed inline script fails', () => {
  const html = page('a()').replace('</body>', '<script>b()</script></body>');
  assert.ok(checkPage(html).problems.some(p => p.startsWith('inline script not in script-src')));
});

test('an unquoted inline handler fails', () => {
  const html = page('a()').replace('<body>', '<body onclick=go()>');
  assert.ok(checkPage(html).problems.some(p => p.startsWith('inline event handlers')));
});

test('identical policies pass site-wide', () => {
  assert.equal(checkSiteWide(["script-src 'self'", "script-src 'self'"]), null);
});

test('differing policies fail site-wide', () => {
  const message = checkSiteWide(["script-src 'self'", "script-src 'self' 'sha256-x'"]);
  assert.match(message, /2 distinct policies/);
});
```

- [ ] **Step 2: Run them to confirm they fail**

```bash
node --test tools/verify-csp.test.js 2>&1 | grep -E "^(# |ℹ )(pass|fail) |is not a function|Cannot"
```

Expected: failure. `checkPage` is not exported yet, and `require` runs `main()`, which exits non-zero against the default `public` directory.

- [ ] **Step 3: Export the checks and add `--site-wide`**

In `tools/verify-csp.js`:

1. In `checkPage`, change the final `return { problems, hashed };` to `return { problems, hashed, policy };`.
2. Add this function after `checkPage`:

```js
// swup's head updates insert each page's <meta> CSP, and browsers intersect
// every policy they have seen. Under client-side navigation the policy must
// therefore be byte-identical on every page.
function checkSiteWide (policies) {
  const distinct = new Set(policies);
  if (distinct.size <= 1) return null;
  return distinct.size + ' distinct policies across pages; swup head updates would intersect them';
}
```

3. Replace the whole `main` function and the trailing `main();` call with:

```js
function main () {
  const args = process.argv.slice(2);
  const siteWide = args.includes('--site-wide');
  const dir = args.find(a => !a.startsWith('--')) || 'public';
  if (!fs.existsSync(dir)) {
    console.error('[verify-csp] ' + dir + ' does not exist; build the site first');
    process.exitCode = 1;
    return;
  }

  const pages = listHtml(dir);
  // An empty directory would otherwise pass vacuously.
  if (pages.length === 0) {
    console.error('[verify-csp] no HTML files under ' + dir);
    process.exitCode = 1;
    return;
  }

  let failing = 0;
  const policies = [];
  for (const page of pages) {
    const { problems, hashed, policy } = checkPage(fs.readFileSync(page, 'utf8'));
    policies.push(policy);
    if (problems.length === 0) {
      console.log('ok   ' + page + ' (' + hashed + ' inline scripts hashed)');
      continue;
    }
    failing++;
    console.log('FAIL ' + page);
    for (const p of problems) console.log('       - ' + p);
  }

  const siteWideProblem = siteWide ? checkSiteWide(policies) : null;
  if (siteWideProblem) console.log('FAIL site-wide: ' + siteWideProblem);

  console.log('\n[verify-csp] ' + pages.length + ' pages checked, ' + failing + ' failing' +
    (siteWide ? ', site-wide ' + (siteWideProblem ? 'FAIL' : 'ok') : ''));
  // exitCode rather than exit(): exit() can truncate output still buffered for a pipe.
  if (failing || siteWideProblem) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { checkPage, checkSiteWide };
```

4. Add `--site-wide` to the usage line in the header comment: `node tools/verify-csp.js [dir] [--site-wide]`.

- [ ] **Step 4: Run the tests, then confirm the Hexo build still passes without the flag**

```bash
node --test tools/verify-csp.test.js 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
npx hexo generate >/dev/null && node tools/verify-csp.js public | tail -1
node tools/verify-csp.js public --site-wide > /tmp/sitewide.log; echo "exit $?"; tail -1 /tmp/sitewide.log
```

Expected: `pass 5`, `fail 0`; then `17 pages checked, 0 failing`. The `--site-wide` run fails with `distinct policies`, because Hexo hashes per page and does full page loads. That is correct, and is why Hexo CI does not pass the flag.

- [ ] **Step 5: Commit**

```bash
git add tools/verify-csp.js tools/verify-csp.test.js
git commit -m "test(csp): add site-wide policy check and unit tests for the verifier" -m "Under swup, browsers intersect every <meta> CSP they see, so a per-page policy would block scripts after navigation." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Site-wide CSP integration

**Files:**
- Create: `site/integrations/site-csp.mjs`, `site/tests/site-csp.test.mjs`
- Modify: `site/astro.config.mjs`, `site/src/layouts/partials/HeadTags.astro`, `site/package.json` (`test` script), `site/UPSTREAM.md`

**Interfaces:**
- Consumes: `checkSiteWide` behaviour from Task 8 (via the CLI only).
- Produces: from `site/integrations/site-csp.mjs`, `export const DEFAULT_SOURCES`, `export function needsHash(attrs: string): boolean`, `export function collectHashes(html: string): Set<string>`, `export function buildPolicy(hashes: Iterable<string>, sources = DEFAULT_SOURCES): string`, `export function injectPolicy(html: string, policy: string): string`, and `export default function siteCsp(options?): AstroIntegration`.

- [ ] **Step 1: Write the failing tests**

Create `site/tests/site-csp.test.mjs`:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { buildPolicy, collectHashes, injectPolicy, needsHash } from "../integrations/site-csp.mjs";

const sha = (s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const PAGE =
	'<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>t</title>' +
	"<script>a()</script></head><body>" +
	'<script type="module">b()</script>' +
	'<script src="/x.js"></script>' +
	'<script type="application/ld+json">{"@type":"Person"}</script>' +
	"</body></html>";

test("needsHash exempts only src= scripts and JSON data blocks", () => {
	assert.equal(needsHash(""), true);
	assert.equal(needsHash(' type="module"'), true);
	assert.equal(needsHash(' type="importmap"'), true);
	assert.equal(needsHash(' src="/x.js"'), false);
	assert.equal(needsHash(' type="application/ld+json"'), false);
});

test("collectHashes hashes the two executable inline scripts", () => {
	assert.deepEqual([...collectHashes(PAGE)].sort(), [sha("a()"), sha("b()")].sort());
});

test("buildPolicy is deterministic and never allows unsafe-inline scripts", () => {
	const p1 = buildPolicy(new Set([sha("b()"), sha("a()")]));
	const p2 = buildPolicy(new Set([sha("a()"), sha("b()")]));
	assert.equal(p1, p2);
	const scriptSrc = p1.split("; ").find((d) => d.startsWith("script-src "));
	assert.ok(!scriptSrc.includes("'unsafe-inline'"));
	assert.ok(scriptSrc.includes("'wasm-unsafe-eval'"));
	assert.ok(p1.includes("frame-src https://giscus.app"));
});

test("injectPolicy puts the CSP right after charset, before any script", () => {
	const out = injectPolicy(PAGE, "default-src 'self'");
	const csp = out.indexOf('http-equiv="Content-Security-Policy"');
	assert.ok(csp > out.indexOf("charset="));
	assert.ok(csp < out.indexOf("<script"));
});

test("injectPolicy keeps $ sequences in the policy literal", () => {
	assert.ok(injectPolicy(PAGE, "x $& y").includes("x $& y"));
});

test("injectPolicy refuses pages without charset or with an existing CSP", () => {
	assert.throws(() => injectPolicy("<html><head></head></html>", "x"), /charset/);
	const twice = injectPolicy(PAGE, "x");
	assert.throws(() => injectPolicy(twice, "x"), /already/);
});
```

- [ ] **Step 2: Run them to confirm they fail**

```bash
(cd site && node --test tests/site-csp.test.mjs) 2>&1 | tail -3
```

Expected: failure with `ERR_MODULE_NOT_FOUND` for `integrations/site-csp.mjs`.

- [ ] **Step 3: Write the integration**

Create `site/integrations/site-csp.mjs`:

```js
// Injects one Content-Security-Policy <meta> into every built page.
//
// GitHub Pages sends no configurable headers, so the policy must be a <meta>.
// script-src uses SHA-256 hashes of the inline scripts instead of
// 'unsafe-inline'. The policy is the same on every page: with swup's
// updateHead, browsers intersect each newly inserted <meta> CSP with the ones
// already applied, so per-page policies would block scripts after an in-site
// navigation. Register this integration last, so every other integration has
// finished writing HTML before hashing.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_TAG = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const CHARSET_META = /<meta[^>]+charset=[^>]*>/i;
const INLINE_HANDLER = /<[a-zA-Z][^>]*\son[a-z]+\s*=/;

export const DEFAULT_SOURCES = Object.freeze({
	// Pagefind is WebAssembly; narrower than 'unsafe-eval'.
	script: ["'wasm-unsafe-eval'", "https://giscus.app"],
	// giscus injects its own stylesheet; Mizuki emits style="" attributes,
	// which cannot be hashed.
	style: ["'unsafe-inline'", "https://giscus.app"],
	// @iconify/svelte fetches icons at runtime.
	connect: ["https://api.iconify.design"],
	frame: ["https://giscus.app"],
	img: ["data:", "https:"],
});

// Conservative on purpose: only JSON data blocks are exempt. importmap,
// speculationrules and legacy JavaScript MIME types are governed by script-src.
export function needsHash(attrs) {
	if (/\ssrc\s*=/i.test(attrs)) return false;
	const type = attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i);
	return !(type && /^application\/(ld\+)?json$/i.test(type[1]));
}

export function collectHashes(html) {
	const hashes = new Set();
	for (const [, attrs, body] of html.matchAll(SCRIPT_TAG)) {
		if (!needsHash(attrs)) continue;
		hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
	}
	return hashes;
}

export function buildPolicy(hashes, sources = DEFAULT_SOURCES) {
	// Sorted so the output is byte-identical across rebuilds.
	const sorted = [...hashes].sort();
	return [
		"default-src 'self'",
		["script-src", "'self'", ...sources.script, ...sorted].join(" "),
		["style-src", "'self'", ...sources.style].join(" "),
		"font-src 'self'",
		["img-src", "'self'", ...sources.img].join(" "),
		["connect-src", "'self'", ...sources.connect].join(" "),
		["frame-src", ...sources.frame].join(" "),
		// Not covered by default-src: an injected form could otherwise post anywhere.
		"form-action 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"upgrade-insecure-requests",
	].join("; ");
}

export function injectPolicy(html, policy) {
	if (html.includes('http-equiv="Content-Security-Policy"')) {
		throw new Error("page already has a CSP meta");
	}
	const charset = html.match(CHARSET_META);
	if (!charset) throw new Error("page has no charset meta to anchor the CSP");
	const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
	// Function replacer: a string replacement would interpret $& and $' in the policy.
	return html.replace(charset[0], () => charset[0] + meta);
}

async function listHtml(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const p = join(dir, entry.name);
			if (entry.isDirectory()) return listHtml(p);
			return entry.name.endsWith(".html") ? [p] : [];
		}),
	);
	return nested.flat();
}

export default function siteCsp({ sources = DEFAULT_SOURCES } = {}) {
	return {
		name: "site-csp",
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const root = fileURLToPath(dir);
				const files = await listHtml(root);
				const pages = await Promise.all(
					files.map(async (file) => ({ file, html: await readFile(file, "utf8") })),
				);

				const hashes = new Set();
				for (const { html } of pages) {
					for (const hash of collectHashes(html)) hashes.add(hash);
				}
				const policy = buildPolicy(hashes, sources);

				for (const { file, html } of pages) {
					if (INLINE_HANDLER.test(html.replace(SCRIPT_TAG, ""))) {
						logger.warn(`inline event handler in ${file}; CSP will block it`);
					}
				}
				await Promise.all(pages.map(({ file, html }) => writeFile(file, injectPolicy(html, policy))));
				logger.info(`site-wide CSP injected into ${pages.length} pages (${hashes.size} inline script hashes)`);
			},
		},
	};
}
```

- [ ] **Step 4: Run the unit tests to confirm they pass**

```bash
(cd site && node --test tests/site-csp.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected: `pass 6`, `fail 0`.

- [ ] **Step 5: Check for inline handlers before wiring**

```bash
pnpm --dir site build >/dev/null
node -e '
const fs=require("fs"),path=require("path");const out=new Map();
(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(p.endsWith(".html")){const h=fs.readFileSync(p,"utf8").replace(/<script[^>]*>[\s\S]*?<\/script>/gi,"");for(const m of h.matchAll(/<[a-zA-Z][^>]*\s(on[a-z]+)\s*=/g))out.set(m[1],(out.get(m[1])||0)+1)}}})("site/dist");
console.log(out.size?Object.fromEntries(out):"no inline handlers")'
```

Expected: `no inline handlers`. If any are listed, **stop and report them** with the emitting component, and do not invent a rewrite. Each needs a decision: externalise it, or port the `HANDLER_REWRITES` approach from `scripts/security-headers.js`.

- [ ] **Step 6: Add the frame guard**

In `site/src/layouts/partials/HeadTags.astro`, insert immediately before the line `<!-- Set the theme before the page is rendered to avoid a flash -->`:

```astro
<!--
  Clickjacking defence: frame-ancestors is ignored in a <meta> CSP and GitHub
  Pages sends no headers. localhost is exempt so `astro preview` can be framed.
-->
<script is:inline>
	(function () {
		try {
			if (window.top === window.self) return;
			if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
			document.documentElement.style.display = "none";
			window.top.location = window.self.location.href;
		} catch (e) {
			document.documentElement.style.display = "none";
		}
	})();
</script>
```

- [ ] **Step 7: Register the integration last**

In `site/astro.config.mjs`, add with the other imports:

```js
import siteCsp from "./integrations/site-csp.mjs";
```

and make `siteCsp()` the final element of the `integrations` array, after `svelte(...)` and every other entry.

Add `tests/site-csp.test.mjs` to the `test` script's file list in `site/package.json`.

- [ ] **Step 8: Build and verify site-wide**

```bash
pnpm --dir site build 2>&1 | grep -E "site-csp|inline event handler"
node tools/verify-csp.js site/dist --site-wide > /tmp/verify.log; echo "exit $?"; tail -1 /tmp/verify.log
pnpm --dir site test; echo "test exit $?"
(cd site && node --test tests/dist-urls.test.mjs) 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
```

Expected:
- `site-wide CSP injected into N pages (M inline script hashes)` and no `inline event handler` line;
- `… 0 failing, site-wide ok` with `exit 0`;
- `test exit 0`;
- `pass 8`.

- [ ] **Step 9: Update `UPSTREAM.md` and commit**

Append: `- integrations/site-csp.mjs registered last in astro.config.mjs; frame guard added to src/layouts/partials/HeadTags.astro.`

```bash
git add site/integrations/site-csp.mjs site/tests/site-csp.test.mjs site/astro.config.mjs site/src/layouts/partials/HeadTags.astro site/package.json site/UPSTREAM.md
git commit -m "feat(site): inject one hash-based CSP into every page" -m "Constraint: no 'unsafe-inline' in script-src" -m "Constraint: swup updateHead intersects per-page <meta> policies" -m "Rejected: Astro experimental CSP | emits per-page hashes, which break under swup" -m "Directive: keep siteCsp() last in integrations; anything that edits HTML after it ships unhashed scripts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Promote `site/` to the root and switch CI (the switch commit)

**Files:**
- Delete: `_config.yml`, `_config.shokax.yml`, `scaffolds/`, `scripts/`, `source/`, `themes/`, `package.json`, `pnpm-lock.yaml`
- Move: every tracked entry of `site/` to the root
- Modify: `.gitignore`, `.node-version`, `.github/workflows/deploy.yml`, `package.json` (formerly `site/package.json`)

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces: a root-level Astro site that CI builds to `dist/` and verifies with `--site-wide`.

- [ ] **Step 1: Remove Hexo sources and local build output**

```bash
git rm -r -q _config.yml _config.shokax.yml scaffolds scripts source themes package.json pnpm-lock.yaml
rm -rf public db.json node_modules site/node_modules site/dist site/.astro
git status --short | grep -v '^D ' | head
```

Expected: no output besides possibly untracked local files such as `Todo.json`, which stays untouched.

- [ ] **Step 2: Move `site/` up**

```bash
cp .gitignore /tmp/root.gitignore
git mv -f site/.gitignore .gitignore
for p in $(git ls-tree --name-only HEAD site/ | sed 's|^site/||'); do
  [ "$p" = ".gitignore" ] && continue
  git mv "site/$p" "./$p"
done
rmdir site && echo "site/ empty and removed"
```

Expected: `site/ empty and removed`. If `git mv` reports a destination exists, a Step 1 deletion was missed: stop and report it.

- [ ] **Step 3: Merge `.gitignore`**

Mizuki's `.gitignore` is now at the root. It contains an unanchored `plans` line that would hide `docs/superpowers/plans/`, and a `demo` line. Delete both lines, then append:

```
# Local tooling state: absolute home paths and session transcripts must not
# be published in a public repo.
.omc/state/
.omc/sessions/
.omc/project-memory.json
.claude/logs/
.env.*
*.pem
*.key

# Local-only unfinished posts. Both paths: the Hexo copies stay on disk
# after `git rm -r source` because they are untracked.
source/_posts/zkp-series.md
source/_posts/casa_summer_1.md
source/_posts/cissp_summary1.md
src/content/posts/zkp-series.md
src/content/posts/casa_summer_1.md
src/content/posts/cissp_summary1.md
```

```bash
git check-ignore -v docs/superpowers/plans/2026-11-01-astro-mizuki-migration.md; echo "plans exit $?"
git check-ignore -v public/covers 2>/dev/null; echo "public exit $?"
for f in zkp-series casa_summer_1 cissp_summary1; do git check-ignore -q "source/_posts/$f.md" && git check-ignore -q "src/content/posts/$f.md" && echo "draft ignored $f"; done
```

Expected: `plans exit 1` and `public exit 1` (neither ignored), and three `draft ignored` lines. If any is missing, stop: the next commit would publish that draft.

- [ ] **Step 4: Point the scripts at the new layout**

```bash
node -e '
const fs = require("fs");
const src = fs.readFileSync("package.json", "utf8");
const p = JSON.parse(src);
p.scripts.verify = "node tools/verify-csp.js dist --site-wide";
p.scripts["test:dist"] = "node --test tests/dist-urls.test.mjs";
fs.writeFileSync("package.json", JSON.stringify(p, null, /^\t/m.test(src) ? "\t" : 2) + "\n");
'
echo 24 > .node-version
```

`tools/verify-csp.test.js` stays in `tools/`; add it to the `test` script: append ` && node --test tools/verify-csp.test.js` to the existing `test` command.

- [ ] **Step 5: Switch the deploy workflow**

Replace the `build` job steps in `.github/workflows/deploy.yml` with these, keeping the pinned action SHAs already in the file:

```yaml
      - name: Checkout
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version-file: .node-version

      # No `version:` — the action reads packageManager (pnpm 11) from package.json.
      - name: Setup pnpm
        uses: pnpm/action-setup@7088e561eb65bb68695d245aa206f005ef30921d # v4.1.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Verify build output
        run: |
          pnpm run test:dist
          pnpm run verify

      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3.0.1
        with:
          path: dist
```

Change the workflow `name:` to `Deploy Astro to GitHub Pages`. Leave `on`, `permissions`, `concurrency` and the `deploy` job unchanged.

- [ ] **Step 6: Full verification from a clean tree**

```bash
pnpm install --frozen-lockfile
pnpm test; echo "test exit $?"
pnpm build; echo "build exit $?"
pnpm run test:dist 2>&1 | grep -E "^(# |ℹ )(pass|fail) "
pnpm run verify | tail -1
pnpm audit --json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("advisories:",Object.keys(JSON.parse(d).advisories).length))'
```

Expected: `test exit 0`, `build exit 0`, `pass 8`, `… 0 failing, site-wide ok`, and `advisories: 0`.

- [ ] **Step 7: Commit the switch**

```bash
git status --short --untracked-files=all | grep -E '^\?\?'
```

Expected: no output. Every untracked file would be swept into the commit by `git add -A`, so stop and report any listed file. Do not add it to `.gitignore` yourself unless it is clearly build output.

```bash
git add -A
git commit -m "feat!: switch the site from Hexo/ShokaX to Astro/Mizuki" -m "Promotes site/ to the repository root and points CI at pnpm build, dist/ and the site-wide CSP verifier." -m "Constraint: /2025/04/25/hello-world/ unchanged (asserted by tests/dist-urls.test.mjs)" -m "Not-tested: pnpm/action-setup v4.1.0 installing pnpm 11 (first CI run)" -m "Scope-risk: broad" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then confirm the draft did not ride along:

```bash
git show --stat HEAD | grep -cE "zkp-series|casa_summer_1|cissp_summary1"
```

Expected: `0`.

---

### Task 11: Browser verification and release

**Files:**
- Modify (only if a violation is found): `integrations/site-csp.mjs` (`DEFAULT_SOURCES`)

**Interfaces:**
- Consumes: Task 10's built `dist/`.

- [ ] **Step 1: Serve the production build**

```bash
pnpm build && pnpm preview
```

Open the printed `localhost` URL with DevTools open. Enable *Preserve log* in the Console, filtered to `Content-Security-Policy`.

- [ ] **Step 2: Walk the checklist**

1. The home page renders, and the hello-world card shows its cover.
2. Search: open it, type `hello`, and the result appears. This exercises Pagefind WASM.
3. Click through to the post. The URL is `/2025/04/25/hello-world/`, the page swaps without a full reload (swup), and the giscus widget loads at the bottom.
4. Icons render in the navbar and sidebar. This exercises `api.iconify.design`.
5. Toggle dark mode, and giscus follows.
6. Press back to the home page, then forward to the post: search, giscus and icons still work after the swup navigation.
7. The console shows **zero** CSP violations.

- [ ] **Step 3: Handle violations, if any**

For each violation, add only the reported origin to the matching array in `DEFAULT_SOURCES` in `integrations/site-csp.mjs`, with a one-line comment saying which feature needs it. Then re-run Task 10 Step 6 and this task, and commit:

```bash
git add integrations/site-csp.mjs
git commit -m "fix(csp): allow <origin> for <feature>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

A violation for a `'sha256-…'` script hash, rather than an origin, means a script was added after hashing. Treat it as a bug in integration order, not a policy change.

- [ ] **Step 4: Hand off the release decision**

Report the checklist results to the author. Merging `astro-migration` into `main_2` and pushing deploys the new site publicly; that is the author's call. After the first deploy, check the live URL:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://akasakajelos.github.io/2025/04/25/hello-world/
```

Expected: `200`.
