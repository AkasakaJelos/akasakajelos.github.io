// The vendored giscus loader must be upstream's file plus exactly the two
// patches its header lists. Any other edit, accidental or not, fails here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "giscus", "client.js");

test("vendored giscus client is upstream plus the two documented patches", () => {
	const text = readFileSync(file, "utf8");
	const headerEnd = text.indexOf("*/\n") + 3;
	const sha = text.slice(0, headerEnd).match(/sha256 ([0-9a-f]{64})/)?.[1];
	assert.ok(sha, "header records no upstream sha256");
	const original = text
		.slice(headerEnd)
		.replace('k="https://giscus.app"', () => "k=(new URL(m.src)).origin")
		.replace('b.href="/giscus/default.css"', () => 'b.href="".concat(k,"/default.css")');
	assert.equal(createHash("sha256").update(original).digest("hex"), sha);
});
