import { readFile } from "node:fs/promises";
import { glob } from "astro/loaders";
import { extractFrontmatter } from "astro/markdown";

import { resolveCover } from "../constants/covers";
import { isDateOnlyFrontmatterField } from "../utils/frontmatter-date";

type GlobOptions = Parameters<typeof glob>[0];

interface ParseDataOptions<TData extends Record<string, unknown>> {
	id: string;
	data: TData;
	filePath?: string;
}

export function postGlob(options: GlobOptions): ReturnType<typeof glob> {
	const loader = glob(options);

	return {
		...loader,
		name: "mizuki-post-glob-loader",
		async load(context) {
			await loader.load({
				...context,
				parseData: async <TData extends Record<string, unknown>>(
					props: ParseDataOptions<TData>,
				): Promise<TData> => {
					if (!props.filePath) {
						throw new Error(`Post ${props.id} is missing its source file path`);
					}

					const source = await readFile(props.filePath, "utf8");
					const rawFrontmatter = extractFrontmatter(source) ?? "";
					const data = {
						...props.data,
						// One chokepoint for the cover pool: everything that renders a
						// cover (cards, post pages, OG images) reads entry.data.image.
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

					return (await context.parseData({
						...props,
						data,
					})) as TData;
				},
			});
		},
	};
}
