import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { buildPolicy, collectHashes, injectPages, injectPolicy, needsHash } from "../integrations/site-csp.mjs";

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

test("injectPages checks every page before writing and names each failure", () => {
	const good = { file: "index.html", html: PAGE };
	const bad = { file: "pio/live2d-host.html", html: "<html><head></head></html>" };
	assert.throws(
		() => injectPages([good, bad], "x"),
		(err) => err.message.includes("pio/live2d-host.html") && err.message.includes("nothing was written"),
	);
	const out = injectPages([good], "x");
	assert.equal(out.length, 1);
	assert.equal(out[0].file, "index.html");
	assert.ok(out[0].html.includes('http-equiv="Content-Security-Policy"'));
});
