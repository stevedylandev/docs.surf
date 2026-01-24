import { Hono } from "hono";
import type { Bindings } from "../types";

const admin = new Hono<{ Bindings: Bindings }>();

// Queue all documents for re-processing
admin.post("/resolve-all", async (c) => {
	try {
		const db = c.env.DB;
		const queue = c.env.RESOLUTION_QUEUE;

		// Get limit from query params (default to 100 for safety)
		const limitParam = c.req.query("limit");
		const limit = limitParam ? parseInt(limitParam, 10) : 100;

		// Get records from repo_records
		const query =
			limit > 0
				? `SELECT did, rkey FROM repo_records
         WHERE collection = 'site.standard.document'
         ORDER BY synced_at DESC
         LIMIT ?`
				: `SELECT did, rkey FROM repo_records
         WHERE collection = 'site.standard.document'`;

		const { results } =
			limit > 0
				? await db
						.prepare(query)
						.bind(limit)
						.all<{ did: string; rkey: string }>()
				: await db.prepare(query).all<{ did: string; rkey: string }>();

		if (!results || results.length === 0) {
			return c.json({ message: "No documents to process", queued: 0 });
		}

		// Queue in batches of 100 (Cloudflare Queue limit)
		const batchSize = 100;
		let queued = 0;

		for (let i = 0; i < results.length; i += batchSize) {
			const batch = results.slice(i, i + batchSize);
			const messages = batch.map((row) => ({
				body: {
					did: row.did,
					collection: "site.standard.document",
					rkey: row.rkey,
				},
			}));

			await queue.sendBatch(messages);
			queued += messages.length;
		}

		return c.json({
			message: "Documents queued for re-processing",
			queued,
		});
	} catch (error) {
		return c.json(
			{ error: "Failed to queue documents", details: String(error) },
			500,
		);
	}
});

export default admin;
