import { Hono } from "hono";
import type { Bindings } from "../types";

const feed = new Hono<{ Bindings: Bindings }>();

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
         ORDER BY rkey DESC
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
        `SELECT uri, did, rkey, title, path, site, content, text_content, published_at, view_url
         FROM resolved_documents
         ORDER BY rkey DESC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<{
        uri: string;
        did: string;
        rkey: string;
        title: string | null;
        path: string | null;
        site: string | null;
        content: string | null;
        text_content: string | null;
        published_at: string | null;
        view_url: string | null;
      }>();

    const documents = (results || []).map((doc) => ({
      uri: doc.uri,
      did: doc.did,
      rkey: doc.rkey,
      title: doc.title || "Untitled",
      path: doc.path,
      site: doc.site,
      content: doc.content ? JSON.parse(doc.content) : null,
      textContent: doc.text_content,
      publishedAt: doc.published_at,
      viewUrl: doc.view_url,
    }));

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
