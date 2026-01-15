import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types";
import { health, webhook, feed, stats, records, admin } from "./routes";
import { processDocument } from "./utils";

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", cors());

// Mount routes
app.route("/health", health);
app.route("/webhook", webhook);
app.route("/feed", feed);
app.route("/stats", stats);
app.route("/records", records);
app.route("/admin", admin);

// 404 handler
app.notFound((c) => {
	return c.json({ error: "Not found" }, 404);
});

// Export for Cloudflare Workers
export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
		const batchSize = 50;
		// Select stale documents
		const { results } = await env.DB.prepare(
			`SELECT did, rkey FROM resolved_documents
       WHERE stale_at < datetime('now') OR stale_at IS NULL
       LIMIT ?`,
		)
			.bind(batchSize)
			.all<{ did: string; rkey: string }>();

		if (results && results.length > 0) {
			const messages = results.map((row) => ({
				body: {
					did: row.did,
					collection: "site.standard.document",
					rkey: row.rkey,
				},
			}));

			// Send to queue
			await env.RESOLUTION_QUEUE.sendBatch(messages);
			console.log(`Queued ${messages.length} documents for resolution`);
		}
	},
	async queue(batch: MessageBatch<any>, env: Bindings) {
		for (const message of batch.messages) {
			try {
				const { did, collection, rkey } = message.body;
				await processDocument(env.DB, did, collection, rkey);
				message.ack();
			} catch (error) {
				console.error("Queue processing error:", error);
				message.retry();
			}
		}
	},
};
