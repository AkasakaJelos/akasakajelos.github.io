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
	assert.equal(coverForId("example-post"), "/covers/6833939bly1gicitzannuj20zk0m8b29.jpg");
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
