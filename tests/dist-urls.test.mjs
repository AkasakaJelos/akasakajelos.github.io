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

const directive = (html, name) =>
	(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "")
		.split(";")
		.map((d) => d.trim().split(/\s+/))
		.find(([n]) => n === name) ?? [];

// The giscus loader and its stylesheet are vendored under public/giscus/, so
// giscus.app runs no script in the page; only the comment iframe comes from it.
test("giscus: only the iframe comes from giscus.app", () => {
	const html = read("2025/04/25/hello-world/index.html");
	assert.ok(directive(html, "frame-src").includes("https://giscus.app"), "frame-src lacks giscus");
	for (const name of ["script-src", "style-src"]) {
		assert.ok(!directive(html, name).includes("https://giscus.app"), `${name} still allows giscus.app`);
	}
	assert.ok(html.includes('"/giscus/client.js"'), "post does not load the vendored giscus client");
	const client = read("giscus/client.js");
	assert.ok(client.includes('k="https://giscus.app"'), "vendored client does not target giscus.app");
	assert.ok(!client.includes("new URL(m.src)"), "vendored client still derives its origin from its own URL");
	assert.ok(client.includes('"/giscus/default.css"'), "vendored client loads a remote stylesheet");
	assert.ok(read("giscus/default.css").includes(".giscus-frame"), "vendored giscus stylesheet missing");
});

// Icons are bundled at build time (integrations/iconify-offline.mjs).
test("no page contacts the Iconify API", () => {
	for (const file of pages) {
		assert.ok(!readFileSync(file, "utf8").includes("api.iconify.design"), `${file} references api.iconify.design`);
	}
	const connect = directive(read("index.html"), "connect-src");
	assert.deepEqual(connect, ["connect-src", "'self'"], `connect-src is ${connect.join(" ")}`);
	for (const name of ["script-src", "style-src"]) {
		const remote = directive(read("index.html"), name).filter((s) => /^https?:/.test(s));
		assert.deepEqual(remote, [], `${name} allows remote origins: ${remote.join(" ")}`);
	}
	for (const file of walk(join(DIST, "_astro")).filter((f) => f.endsWith(".js"))) {
		assert.ok(!readFileSync(file, "utf8").includes("api.iconify.design"), `${file} can still call the Iconify API`);
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
