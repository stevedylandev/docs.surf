import { resolvePds } from "./resolver";
import { parseAtUri } from "./at-uri";
import { buildBlobUrl, extractBlobCid } from "./blob";
import { verifyDocumentRecord } from "./verification";

// Raw document record from PDS
interface DocumentRecord {
	site?: string;
	path?: string;
	title?: string;
	description?: string;
	coverImage?: unknown;
	content?: unknown;
	textContent?: string;
	bskyPostRef?: { uri: string; cid: string };
	tags?: string[];
	publishedAt?: string;
	updatedAt?: string;
}

// Raw publication record from PDS
interface PublicationRecord {
	url?: string;
	name?: string;
	description?: string;
	icon?: unknown;
}

// Resolved publication data
interface ResolvedPublication {
	url: string;
	name: string;
	description: string | null;
	iconCid: string | null;
	iconUrl: string | null;
}

/**
 * Fetches a publication record from an at:// URI
 */
async function fetchPublication(
	db: D1Database,
	siteUri: string,
): Promise<ResolvedPublication | null> {
	const parsed = parseAtUri(siteUri);
	if (!parsed) return null;

	try {
		const pds = await resolvePds(db, parsed.did);
		if (!pds) return null;

		const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
			parsed.did,
		)}&collection=${encodeURIComponent(parsed.collection)}&rkey=${encodeURIComponent(
			parsed.rkey,
		)}`;

		const response = await fetch(url);
		if (!response.ok) return null;

		const data = (await response.json()) as { value?: PublicationRecord };
		const pub = data.value;
		if (!pub?.url || !pub?.name) return null;

		const iconCid = extractBlobCid(pub.icon);
		const iconUrl = iconCid ? buildBlobUrl(pds, parsed.did, iconCid) : null;

		return {
			url: pub.url,
			name: pub.name,
			description: pub.description || null,
			iconCid,
			iconUrl,
		};
	} catch {
		return null;
	}
}

/**
 * Resolves the view URL for a document.
 * If site is an at:// URI, fetches the publication to get the base URL.
 * If site is an https:// URL, uses it directly.
 */
export async function resolveViewUrl(
	db: D1Database,
	siteUri: string,
	path: string,
): Promise<string | null> {
	// Check if site is an at:// URI or direct URL
	if (siteUri.startsWith("at://")) {
		const pub = await fetchPublication(db, siteUri);
		if (!pub?.url) return null;
		const baseUrl = pub.url.startsWith("http") ? pub.url : `https://${pub.url}`;
		return new URL(path, baseUrl).toString();
	}

	// Direct URL
	const baseUrl = siteUri.startsWith("http") ? siteUri : `https://${siteUri}`;
	return new URL(path, baseUrl).toString();
}

/**
 * Processes a document record: fetches from PDS, resolves publication,
 * and stores all fields in resolved_documents table.
 */
export async function processDocument(
	db: D1Database,
	did: string,
	collection: string,
	rkey: string,
) {
	try {
		// 1. Resolve PDS
		const pds = await resolvePds(db, did);
		if (!pds) {
			console.warn(`Could not resolve PDS for ${did}`);
			return;
		}

		// 2. Fetch Document Record
		const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
			did,
		)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;

		const response = await fetch(url);
		if (!response.ok) {
			if (response.status === 404) {
				// Record was deleted from PDS - clean up our local copy
				console.warn(
					`Record not found (deleted): ${did}/${collection}/${rkey}`,
				);
				const uri = `at://${did}/${collection}/${rkey}`;
				await db
					.prepare("DELETE FROM resolved_documents WHERE uri = ?")
					.bind(uri)
					.run();
				await db
					.prepare(
						"DELETE FROM repo_records WHERE did = ? AND collection = ? AND rkey = ?",
					)
					.bind(did, collection, rkey)
					.run();
				return; // Not an error, just cleanup
			}
			// Other errors (5xx, rate limits, etc.) should be retried
			throw new Error(
				`Failed to fetch record: ${response.status} ${response.statusText}`,
			);
		}

		const data = (await response.json()) as {
			uri: string;
			cid?: string;
			value: DocumentRecord;
		};

		const { value, cid } = data;

		// 3. Update repo_records
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

		// 4. Extract document fields
		const title = value.title || null;
		const description = value.description || null;
		const path = value.path || null;
		const site = value.site || null;
		const content = value.content ? JSON.stringify(value.content) : null;
		const textContent = value.textContent || null;
		const coverImageCid = extractBlobCid(value.coverImage);
		const coverImageUrl = coverImageCid
			? buildBlobUrl(pds, did, coverImageCid)
			: null;
		const bskyPostRef = value.bskyPostRef
			? JSON.stringify(value.bskyPostRef)
			: null;
		const tags = value.tags ? JSON.stringify(value.tags) : null;
		const publishedAt = value.publishedAt || null;
		const updatedAt = value.updatedAt || null;

		// 5. Resolve publication if site is at:// URI
		let pubUrl: string | null = null;
		let pubName: string | null = null;
		let pubDescription: string | null = null;
		let pubIconCid: string | null = null;
		let pubIconUrl: string | null = null;
		let viewUrl: string | null = null;

		if (site) {
			if (site.startsWith("at://")) {
				// Fetch publication record
				const pub = await fetchPublication(db, site);
				if (pub) {
					pubUrl = pub.url;
					pubName = pub.name;
					pubDescription = pub.description;
					pubIconCid = pub.iconCid;
					pubIconUrl = pub.iconUrl;
					// Construct view URL
					if (pubUrl && path) {
						const baseUrl = pubUrl.startsWith("http")
							? pubUrl
							: `https://${pubUrl}`;
						viewUrl = new URL(path, baseUrl).toString();
					}
				}
			} else {
				// Site is a direct URL (loose document)
				pubUrl = site;
				if (path) {
					const baseUrl = site.startsWith("http") ? site : `https://${site}`;
					viewUrl = new URL(path, baseUrl).toString();
				}
			}
		}

		// 6. Verify the document
		const uri = `at://${did}/${collection}/${rkey}`;
		const verified = await verifyDocumentRecord(pubUrl, site, viewUrl, uri);

		// 7. Insert/update resolved_documents
		const STALE_OFFSET_HOURS = 24;

		await db
			.prepare(
				`INSERT INTO resolved_documents (
          uri, did, rkey, title, description, path, site, content, text_content,
          cover_image_cid, cover_image_url, bsky_post_ref, tags,
          published_at, updated_at, pub_url, pub_name, pub_description,
          pub_icon_cid, pub_icon_url, view_url, pds_endpoint,
          resolved_at, stale_at, verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+${STALE_OFFSET_HOURS} hours'), ?)
        ON CONFLICT(uri) DO UPDATE SET
          title = ?, description = ?, path = ?, site = ?, content = ?, text_content = ?,
          cover_image_cid = ?, cover_image_url = ?, bsky_post_ref = ?, tags = ?,
          published_at = ?, updated_at = ?, pub_url = ?, pub_name = ?, pub_description = ?,
          pub_icon_cid = ?, pub_icon_url = ?, view_url = ?, pds_endpoint = ?,
          resolved_at = datetime('now'), stale_at = datetime('now', '+${STALE_OFFSET_HOURS} hours'), verified = ?`,
			)
			.bind(
				// INSERT values
				uri,
				did,
				rkey,
				title,
				description,
				path,
				site,
				content,
				textContent,
				coverImageCid,
				coverImageUrl,
				bskyPostRef,
				tags,
				publishedAt,
				updatedAt,
				pubUrl,
				pubName,
				pubDescription,
				pubIconCid,
				pubIconUrl,
				viewUrl,
				pds,
				verified ? 1 : 0,
				// UPDATE values
				title,
				description,
				path,
				site,
				content,
				textContent,
				coverImageCid,
				coverImageUrl,
				bskyPostRef,
				tags,
				publishedAt,
				updatedAt,
				pubUrl,
				pubName,
				pubDescription,
				pubIconCid,
				pubIconUrl,
				viewUrl,
				pds,
				verified ? 1 : 0,
			)
			.run();

		console.log(`Processed document: ${uri}`);
	} catch (error) {
		console.error(
			`Error processing document ${did}/${collection}/${rkey}:`,
			error,
		);
		// Re-throw so the queue handler can retry
		throw error;
	}
}
