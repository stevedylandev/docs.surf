import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types";
import {
	health,
	webhook,
	feed,
	stats,
	records,
	admin,
	rss,
	jetstream,
} from "./routes";
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
app.route("/rss.xml", rss);
app.route("/jetstream", jetstream);

// 404 handler
app.notFound((c) => {
	return c.json({ error: "Not found" }, 404);
});

// Export Durable Object class
export { JetstreamConsumer } from "./durable-objects/jetstream-consumer";

// Export for Cloudflare Workers
export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
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

		// Cleanup: keep only the 300 most recent verified documents, delete everything else
		const deletedVerified = await env.DB.prepare(
			`DELETE FROM resolved_documents WHERE verified = 1 AND uri NOT IN (
				SELECT uri FROM resolved_documents WHERE verified = 1
				ORDER BY published_at DESC LIMIT 300
			)`,
		).run();
		if (deletedVerified.meta.changes > 0) {
			console.log(`Cleaned up ${deletedVerified.meta.changes} old verified documents`);
		}

		// Delete unverified/stale documents older than 24 hours
		const deletedUnverified = await env.DB.prepare(
			`DELETE FROM resolved_documents WHERE (verified IS NULL OR verified = 0)
			 AND resolved_at < datetime('now', '-24 hours')`,
		).run();
		if (deletedUnverified.meta.changes > 0) {
			console.log(`Cleaned up ${deletedUnverified.meta.changes} unverified documents`);
		}

		// Clean up orphaned repo_records
		if (deletedVerified.meta.changes > 0 || deletedUnverified.meta.changes > 0) {
			const orphaned = await env.DB.prepare(
				`DELETE FROM repo_records WHERE NOT EXISTS (
					SELECT 1 FROM resolved_documents WHERE resolved_documents.did = repo_records.did
					AND resolved_documents.rkey = repo_records.rkey
				)`,
			).run();
			if (orphaned.meta.changes > 0) {
				console.log(`Cleaned up ${orphaned.meta.changes} orphaned repo_records`);
			}
		}

		// Ensure Jetstream consumer DO is alive
		try {
			const id = env.JETSTREAM_CONSUMER.idFromName("singleton");
			const stub = env.JETSTREAM_CONSUMER.get(id);
			await stub.fetch(new Request("http://do/start"));
		} catch (error) {
			console.error("Failed to ping Jetstream consumer:", error);
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
