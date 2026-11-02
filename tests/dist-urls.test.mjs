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

// Names no draft: it checks whichever local posts say `draft: true`. Drafts
// exist only on the author's machine, so in CI this passes trivially.
test("draft posts are not published", () => {
	const dir = join(DIST, "..", "src", "content", "posts");
	const drafts = readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map((f) => ({ slug: f.slice(0, -3), src: readFileSync(join(dir, f), "utf8") }))
		.filter(({ src }) => /^draft:\s*true\s*$/m.test(src.split(/^---\s*$/m)[1] ?? ""));
	for (const { slug, src } of drafts) {
		const title = src.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
		for (const file of pages) {
			const html = readFileSync(file, "utf8");
			assert.ok(!html.includes(slug) && !(title && html.includes(title)), `${file} leaks draft ${slug}`);
		}
	}
});

test("rss lists the canonical post URL", () => {
	assert.ok(read("rss.xml").includes("https://akasakajelos.github.io/2025/04/25/hello-world/"));
});

test("hello-world shows its pool cover", () => {
	assert.ok(
		read("2025/04/25/hello-world/index.html").includes("/covers/6833939bly1gicitcxhpij20zk0m8hdt.jpg"),
	);
});

test("posts mount giscus, configured for this repository", () => {
	const html = read("2025/04/25/hello-world/index.html");
	assert.ok(html.includes('id="giscus-container"'), "no giscus container");
	assert.ok(html.includes("AkasakaJelos/akasakajelos.github.io"), "giscus repo not configured");
	assert.ok(html.includes("R_kgDOKsjkHQ") && html.includes("DIC_kwDOKsjkHc4DKK6g"), "giscus IDs not configured");
	assert.ok(html.includes('"mapping":"pathname"') && html.includes('"strict":"1"'), "giscus mapping/strict changed");
	// A per-page value in the giscus config would add one CSP hash per post.
	assert.ok(!html.includes('"term":'), "giscus config carries a per-page term");
});

test("the CSP lets giscus load its script, stylesheet and iframe", () => {
	const html = read("2025/04/25/hello-world/index.html");
	const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
	for (const directive of ["script-src", "style-src", "frame-src"]) {
		const sources = policy.split(";").map((d) => d.trim().split(/\s+/)).find(([name]) => name === directive) ?? [];
		assert.ok(sources.includes("https://giscus.app"), `${directive} lacks https://giscus.app`);
	}
});

// Both were CSP violations found in the browser check: the unpinned
// iconify-icon "3-latest" CDN script, and Vite inlining a KaTeX font as data:.
test("no page loads scripts from code.iconify.design", () => {
	for (const file of pages) {
		assert.ok(!readFileSync(file, "utf8").includes("code.iconify.design"), `${file} references code.iconify.design`);
	}
});

test("no stylesheet embeds a data: font (font-src is 'self')", () => {
	const styles = walk(DIST).filter((f) => f.endsWith(".css"));
	assert.ok(styles.length > 0, "no CSS in dist");
	for (const file of [...styles, ...pages]) {
		assert.ok(!/url\(\s*["']?data:font\//.test(readFileSync(file, "utf8")), `${file} embeds a data: font`);
	}
});
