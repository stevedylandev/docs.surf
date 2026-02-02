import { Hono } from "hono";
import { Feed } from "feed";
import type { Bindings, ResolvedDocumentRow } from "../types";

const rss = new Hono<{ Bindings: Bindings }>();

rss.get("/", async (c) => {
	try {
		const db = c.env.DB;

		const { results } = await db
			.prepare(
				`SELECT uri, did, rkey, title, description, path, site, content, text_content,
                cover_image_cid, cover_image_url, bsky_post_ref, tags,
                published_at, updated_at, pub_url, pub_name, pub_description,
                pub_icon_cid, pub_icon_url, view_url, pds_endpoint,
                resolved_at, stale_at, verified
         FROM resolved_documents
         WHERE verified = 1
         ORDER BY published_at DESC
         LIMIT 50`,
			)
			.all<ResolvedDocumentRow>();

		const feed = new Feed({
			title: "Docs.surf",
			description: "A feed of standard.site documents to surf",
			id: "https://docs.surf/",
			link: "https://docs.surf/",
			copyright: "",
		});

		for (const row of results || []) {
			feed.addItem({
				title: row.title || "Untitled",
				id: row.uri,
				link: row.view_url || row.uri,
				description: row.description || undefined,
				date: row.published_at ? new Date(row.published_at) : new Date(),
			});
		}

		return c.body(feed.rss2(), 200, {
			"Content-Type": "application/xml",
		});
	} catch (error) {
		return c.json(
			{ error: "Failed to generate RSS feed", details: String(error) },
			500,
		);
	}
});

export default rss;
