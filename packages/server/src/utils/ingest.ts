import { resolveViewUrl } from "./document";

const STALE_OFFSET_HOURS = 24;

export async function ingestDocument(
	db: D1Database,
	queue: Queue,
	params: {
		did: string;
		rkey: string;
		collection: string;
		cid?: string;
		record?: Record<string, unknown>;
	},
): Promise<void> {
	const { did, rkey, collection, cid, record } = params;

	// Upsert repo_records
	await db
		.prepare(
			`INSERT INTO repo_records (did, rkey, collection, cid, synced_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(did, collection, rkey) DO UPDATE SET
         cid = ?,
         synced_at = datetime('now')`,
		)
		.bind(did, rkey, collection, cid || null, cid || null)
		.run();

	// If we have the full record, upsert resolved_documents with initial data
	if (record) {
		const uri = `at://${did}/${collection}/${rkey}`;
		const doc = record as {
			title?: string;
			path?: string;
			site?: string;
			content?: unknown;
			textContent?: string;
			publishedAt?: string;
			coverImage?: unknown;
			bskyPostRef?: { uri: string; cid: string };
			tags?: string[];
		};

		let viewUrl: string | null = null;
		if (doc.site && doc.path) {
			viewUrl = await resolveViewUrl(db, doc.site, doc.path);
		}

		await db
			.prepare(
				`INSERT INTO resolved_documents (uri, did, rkey, title, path, site, content, text_content, published_at, view_url, resolved_at, stale_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+${STALE_OFFSET_HOURS} hours'))
         ON CONFLICT(uri) DO UPDATE SET
           title = ?, path = ?, site = ?, content = ?, text_content = ?, published_at = ?, view_url = ?, resolved_at = datetime('now'), stale_at = datetime('now', '+${STALE_OFFSET_HOURS} hours')`,
			)
			.bind(
				uri,
				did,
				rkey,
				doc.title || null,
				doc.path || null,
				doc.site || null,
				doc.content ? JSON.stringify(doc.content) : null,
				doc.textContent || null,
				doc.publishedAt || null,
				viewUrl,
				doc.title || null,
				doc.path || null,
				doc.site || null,
				doc.content ? JSON.stringify(doc.content) : null,
				doc.textContent || null,
				doc.publishedAt || null,
				viewUrl,
			)
			.run();
	}

	// Queue for full resolution (verification, publication lookup, etc.)
	await queue.send({ did, collection, rkey });
}

export async function deleteDocument(
	db: D1Database,
	params: { did: string; collection: string; rkey: string },
): Promise<void> {
	const { did, collection, rkey } = params;

	await db
		.prepare(
			"DELETE FROM repo_records WHERE did = ? AND collection = ? AND rkey = ?",
		)
		.bind(did, collection, rkey)
		.run();

	const uri = `at://${did}/${collection}/${rkey}`;
	await db
		.prepare("DELETE FROM resolved_documents WHERE uri = ?")
		.bind(uri)
		.run();
}
