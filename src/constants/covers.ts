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
