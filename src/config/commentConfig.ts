import type { CommentConfig } from "../types/config";
import { SITE_LANG } from "./siteConfig";

// 评论系统配置
export const commentConfig: CommentConfig = {
	enable: true, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "giscus", // 评论系统选择: "twikoo" | "giscus"
	twikoo: {
		envId: "https://twikoo.vercel.app",
		lang: SITE_LANG,
	},
	giscus: {
		repo: "AkasakaJelos/akasakajelos.github.io",
		repoId: "R_kgDOKsjkHQ",
		category: "Announcements",
		categoryId: "DIC_kwDOKsjkHc4DKK6g",
		mapping: "pathname",
		// Match threads by the SHA-1 of the path, which giscus writes into every
		// discussion it creates, instead of GitHub's fuzzy title search, so one
		// post never shows another post's comments.
		strict: "1",
		reactionsEnabled: "1",
		emitMetadata: "0",
		inputPosition: "top",
		theme: "preferred_color_scheme",
		lang: SITE_LANG,
		loading: "lazy",
	},
};
