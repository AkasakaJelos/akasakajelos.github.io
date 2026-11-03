import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModule, subsetCollection } from "../integrations/iconify-offline.mjs";

const data = {
	prefix: "demo",
	width: 24,
	height: 24,
	icons: { home: { body: "<path d='h'/>" }, star: { body: "<path d='s'/>" } },
	aliases: { house: { parent: "home" }, "house-flipped": { parent: "house", hFlip: true } },
};

test("keeps only the requested icons and collection dimensions", () => {
	const { subset, missing } = subsetCollection(data, ["star"]);
	assert.deepEqual(missing, []);
	assert.deepEqual(Object.keys(subset.icons), ["star"]);
	assert.deepEqual(subset.aliases, {});
	assert.equal(subset.width, 24);
	assert.equal(subset.prefix, "demo");
});

test("follows alias chains to their parent icon", () => {
	const { subset, missing } = subsetCollection(data, ["house-flipped"]);
	assert.deepEqual(missing, []);
	assert.deepEqual(Object.keys(subset.aliases).sort(), ["house", "house-flipped"]);
	assert.deepEqual(Object.keys(subset.icons), ["home"]);
});

test("reports unknown names instead of dropping them silently", () => {
	assert.deepEqual(subsetCollection(data, ["nope"]).missing, ["nope"]);
});

test("the generated module re-exports the offline icon component", () => {
	const code = buildModule({ "material-symbols": ["search"] });
	assert.ok(code.includes('from "@iconify/svelte/dist/OfflineIcon.svelte"'));
	assert.ok(code.includes('"search":'));
	assert.ok(!code.includes("api.iconify.design"));
});
