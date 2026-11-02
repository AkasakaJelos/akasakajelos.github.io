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

// All or nothing: every page is checked before any is written, and the error
// names each page that cannot take a policy. A partial write would leave pages
// without a CSP, and pages with and without one carry different policies.
export function injectPages(pages, policy) {
	const failures = [];
	const outputs = [];
	for (const { file, html } of pages) {
		try {
			outputs.push({ file, html: injectPolicy(html, policy) });
		} catch (error) {
			failures.push(`${file}: ${error.message}`);
		}
	}
	if (failures.length > 0) {
		throw new Error(
			`CSP not injected into ${failures.length} page(s); nothing was written:\n  ${failures.join("\n  ")}`,
		);
	}
	return outputs;
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
				const outputs = injectPages(pages, policy);
				await Promise.all(outputs.map(({ file, html }) => writeFile(file, html)));
				logger.info(`site-wide CSP injected into ${pages.length} pages (${hashes.size} inline script hashes)`);
			},
		},
	};
}
