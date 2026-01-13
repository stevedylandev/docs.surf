import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types";
import { health, webhook, feed, stats, records } from "./routes";

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", cors());

// Mount routes
app.route("/health", health);
app.route("/webhook", webhook);
app.route("/feed", feed);
app.route("/stats", stats);
app.route("/records", records);

// Legacy alias: /feed-raw -> /feed/raw
app.get("/feed-raw", async (c) => {
	const db = c.env.DB;
	const limit = Math.min(Number(c.req.query("limit")) || 15, 15);
	const offset = Number(c.req.query("offset")) || 0;

	const { results } = await db
		.prepare(
			`SELECT did, rkey FROM repo_records
       WHERE collection = 'site.standard.document'
       ORDER BY rkey DESC
       LIMIT ? OFFSET ?`,
		)
		.bind(limit, offset)
		.all<{ did: string; rkey: string }>();

	return c.json({
		count: results?.length || 0,
		limit,
		offset,
		records: results || [],
	});
});

// 404 handler
app.notFound((c) => {
	return c.json({ error: "Not found" }, 404);
});

// Export for Cloudflare Workers
export default {
	fetch: app.fetch,
};
