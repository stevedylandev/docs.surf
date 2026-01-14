import { Hono } from "hono";
import type { Bindings, ResolvedDocumentRow, Document, Publication, BskyPostRef } from "../types";

const feed = new Hono<{ Bindings: Bindings }>();

/**
 * Transforms a database row into a Document object for the API response.
 */
function rowToDocument(row: ResolvedDocumentRow): Document {
  // Build publication object if we have publication data
  let publication: Publication | undefined;
  if (row.pub_url && row.pub_name) {
    publication = {
      url: row.pub_url,
      name: row.pub_name,
      description: row.pub_description || undefined,
      iconCid: row.pub_icon_cid || undefined,
      iconUrl: row.pub_icon_url || undefined,
    };
  }

  // Parse bskyPostRef if present
  let bskyPostRef: BskyPostRef | undefined;
  if (row.bsky_post_ref) {
    try {
      bskyPostRef = JSON.parse(row.bsky_post_ref);
    } catch {
      // Ignore parse errors
    }
  }

  // Parse tags if present
  let tags: string[] | undefined;
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags);
    } catch {
      // Ignore parse errors
    }
  }

  // Parse content if present
  let content: unknown | undefined;
  if (row.content) {
    try {
      content = JSON.parse(row.content);
    } catch {
      // Ignore parse errors
    }
  }

  return {
    uri: row.uri,
    did: row.did,
    rkey: row.rkey,
    title: row.title || "Untitled",
    description: row.description || undefined,
    path: row.path || undefined,
    site: row.site || undefined,
    content,
    textContent: row.text_content || undefined,
    coverImageCid: row.cover_image_cid || undefined,
    coverImageUrl: row.cover_image_url || undefined,
    bskyPostRef,
    tags,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at || undefined,
    publication,
    viewUrl: row.view_url || undefined,
    pdsEndpoint: row.pds_endpoint || undefined,
  };
}

// Get raw feed data (for client-side fetching)
// Accessible at both /feed/raw and /feed-raw (via alias in index.ts)
feed.get("/raw", async (c) => {
  try {
    const db = c.env.DB;
    const limit = Math.min(Number(c.req.query("limit")) || 15, 15);
    const offset = Number(c.req.query("offset")) || 0;

    const { results } = await db
      .prepare(
        `SELECT did, rkey FROM repo_records
         WHERE collection = 'site.standard.document'
         ORDER BY published_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<{ did: string; rkey: string }>();

    return c.json({
      count: results?.length || 0,
      limit,
      offset,
      records: results || [],
    });
  } catch (error) {
    return c.json(
      { error: "Failed to fetch feed", details: String(error) },
      500
    );
  }
});

// Get feed of documents with resolved URLs (server-side resolution)
feed.get("/", async (c) => {
  try {
    const db = c.env.DB;
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) || 0;

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
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<ResolvedDocumentRow>();

    const documents = (results || []).map(rowToDocument);

    return c.json({
      count: documents.length,
      limit,
      offset,
      documents,
    });
  } catch (error) {
    return c.json(
      { error: "Failed to fetch feed", details: String(error) },
      500
    );
  }
});

export default feed;
