// Bundles the runtime (Svelte) icons into the build instead of fetching them
// from api.iconify.design in the visitor's browser.
//
// Every `import Icon from "@iconify/svelte"` resolves to a virtual module that
// registers the icons this site references and re-exports @iconify/svelte's
// OfflineIcon, which never calls the Iconify API. The icon list comes from
// buildIconInclude(), the same source scan that feeds astro-icon, so the two
// stay in step. Names from collections that are not installed (e.g. the music
// player's eos-icons) are not bundled and render nothing.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildIconInclude } from "../src/plugins/astro-icon-include.mjs";

const require = createRequire(import.meta.url);
const VIRTUAL_ID = "\0iconify-offline";

// Copies the requested icons, and the alias chains they rely on, out of a full
// IconifyJSON collection. Returns the names that could not be found.
export function subsetCollection(data, names) {
	const icons = {};
	const aliases = {};
	const add = (name) => {
		if (data.icons?.[name]) {
			icons[name] = data.icons[name];
			return true;
		}
		const alias = data.aliases?.[name];
		if (!alias) return false;
		if (aliases[name]) return true;
		aliases[name] = alias;
		return add(alias.parent);
	};
	const missing = names.filter((name) => !add(name));
	const subset = { prefix: data.prefix, icons, aliases };
	for (const key of ["width", "height", "left", "top"]) {
		if (data[key] !== undefined) subset[key] = data[key];
	}
	return { subset, missing };
}

export function buildModule(include = buildIconInclude()) {
	const collections = Object.entries(include).map(([prefix, names]) => {
		const path = require.resolve(`@iconify-json/${prefix}/icons.json`);
		const { subset, missing } = subsetCollection(JSON.parse(readFileSync(path, "utf8")), names);
		if (missing.length > 0) {
			throw new Error(`iconify-offline: ${prefix} has no icon named ${missing.join(", ")}`);
		}
		return subset;
	});
	return [
		'import Icon from "@iconify/svelte/dist/OfflineIcon.svelte";',
		'import { addCollection } from "@iconify/svelte/dist/offline-functions";',
		`for (const collection of ${JSON.stringify(collections)}) addCollection(collection);`,
		"export default Icon;",
		'export * from "@iconify/svelte/dist/offline-functions";',
	].join("\n");
}

export default function iconifyOffline() {
	let code;
	return {
		name: "iconify-offline",
		enforce: "pre",
		resolveId(id) {
			return id === "@iconify/svelte" ? VIRTUAL_ID : null;
		},
		load(id) {
			if (id !== VIRTUAL_ID) return null;
			code ??= buildModule();
			return code;
		},
	};
}
