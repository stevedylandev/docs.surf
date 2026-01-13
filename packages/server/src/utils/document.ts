import { resolvePds } from "./resolver";
import { parseAtUri } from "./at-uri";

export async function resolveViewUrl(
  db: D1Database,
  siteUri: string,
  path: string
): Promise<string | null> {
  const parsed = parseAtUri(siteUri);
  if (!parsed) return null;

  try {
    const pds = await resolvePds(db, parsed.did);
    if (!pds) return null;

    const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
      parsed.did
    )}&collection=${encodeURIComponent(parsed.collection)}&rkey=${encodeURIComponent(
      parsed.rkey
    )}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      value?: { url?: string; domain?: string };
    };
    const siteUrl = data.value?.url || data.value?.domain;
    if (!siteUrl) return null;

    const baseUrl = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    return `${baseUrl}${path}`;
  } catch {
    return null;
  }
}

export async function processDocument(
  db: D1Database,
  did: string,
  collection: string,
  rkey: string
) {
  try {
    // 1. Resolve PDS
    const pds = await resolvePds(db, did);
    if (!pds) {
      console.warn(`Could not resolve PDS for ${did}`);
      return;
    }

    // 2. Fetch Record
    const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
      did
    )}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
         // Record deleted?
         console.warn(`Record not found: ${did}/${collection}/${rkey}`);
      }
      return;
    }

    const data = (await response.json()) as {
      uri: string;
      cid?: string;
      value: {
        title?: string;
        path?: string;
        site?: string;
        content?: unknown;
        textContent?: string;
        publishedAt?: string;
        [key: string]: unknown;
      };
    };

    const { value, cid } = data;

    // 3. Update repo_records
    await db
      .prepare(
        `INSERT INTO repo_records (did, rkey, collection, cid, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(did, collection, rkey) DO UPDATE SET
           cid = ?,
           synced_at = datetime('now')`
      )
      .bind(did, rkey, collection, cid || null, cid || null)
      .run();

    // 4. Resolve View URL and Update resolved_documents
    const uri = `at://${did}/${collection}/${rkey}`;
    let viewUrl: string | null = null;
    if (value.site && value.path) {
      viewUrl = await resolveViewUrl(db, value.site, value.path);
    }

    // Set stale_at to 12 hours from now
    const STALE_OFFSET_HOURS = 12;

    await db
      .prepare(
        `INSERT INTO resolved_documents (uri, did, rkey, title, path, site, content, text_content, published_at, view_url, resolved_at, stale_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+${STALE_OFFSET_HOURS} hours'))
         ON CONFLICT(uri) DO UPDATE SET
           title = ?,
           path = ?,
           site = ?,
           content = ?,
           text_content = ?,
           published_at = ?,
           view_url = ?,
           resolved_at = datetime('now'),
           stale_at = datetime('now', '+${STALE_OFFSET_HOURS} hours')`
      )
      .bind(
        uri,
        did,
        rkey,
        value.title || null,
        value.path || null,
        value.site || null,
        value.content ? JSON.stringify(value.content) : null,
        value.textContent || null,
        value.publishedAt || null,
        viewUrl,
        // Update bindings
        value.title || null,
        value.path || null,
        value.site || null,
        value.content ? JSON.stringify(value.content) : null,
        value.textContent || null,
        value.publishedAt || null,
        viewUrl
      )
      .run();
  } catch (error) {
    console.error(`Error processing document ${did}/${collection}/${rkey}:`, error);
  }
}
