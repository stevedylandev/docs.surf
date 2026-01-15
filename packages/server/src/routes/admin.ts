import { Hono } from "hono";
import type { Bindings } from "../types";

const admin = new Hono<{ Bindings: Bindings }>();

// Queue all documents for re-processing
admin.post("/resolve-all", async (c) => {
	try {
		const db = c.env.DB;
		const queue = c.env.RESOLUTION_QUEUE;

		// Get all records from repo_records
		const { results } = await db
			.prepare(
				`SELECT did, rkey FROM repo_records
         WHERE collection = 'site.standard.document'`,
			)
			.all<{ did: string; rkey: string }>();

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
