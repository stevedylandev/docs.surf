import { Hono } from "hono";
import type { Bindings, TapEvent } from "../types";
import { resolvePds, parseAtUri, resolveViewUrl } from "../utils";

const webhook = new Hono<{ Bindings: Bindings }>();

webhook.post("/tap", async (c) => {
  try {
    const db = c.env.DB;

    const secret = c.env.TAP_WEBHOOK_SECRET;
    if (secret) {
      const auth = c.req.header("Authorization");
      // Support both Bearer token (legacy) and Basic Auth (Tap default)
      // Tap sends Basic Auth as base64("admin:password")
      const expectedBasic = `Basic ${btoa(`admin:${secret}`)}`;
      const expectedBearer = `Bearer ${secret}`;

      if (auth !== expectedBasic && auth !== expectedBearer) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const event = (await c.req.json()) as TapEvent;

    if (event.type === "record") {
      const { record } = event;

      if (record.collection === "site.standard.document") {
        if (record.action === "create" || record.action === "update") {
          await db
            .prepare(
              `INSERT INTO repo_records (did, rkey, collection, cid, synced_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(did, collection, rkey) DO UPDATE SET
                 cid = ?,
                 synced_at = datetime('now')`
            )
            .bind(
              record.did,
              record.rkey,
              record.collection,
              record.cid || null,
              record.cid || null
            )
            .run();

          if (record.record) {
            const uri = `at://${record.did}/${record.collection}/${record.rkey}`;
            const doc = record.record as {
              title?: string;
              path?: string;
              site?: string;
              content?: unknown;
              textContent?: string;
              publishedAt?: string;
            };

            let viewUrl: string | null = null;
            if (doc.site && doc.path) {
              viewUrl = await resolveViewUrl(db, doc.site, doc.path);
            }

            await db
              .prepare(
                `INSERT INTO resolved_documents (uri, did, rkey, title, path, site, content, text_content, published_at, view_url, resolved_at, stale_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+12 hours'))
                 ON CONFLICT(uri) DO UPDATE SET
                   title = ?, path = ?, site = ?, content = ?, text_content = ?, published_at = ?, view_url = ?, resolved_at = datetime('now'), stale_at = datetime('now', '+12 hours')`
              )
              .bind(
                uri,
                record.did,
                record.rkey,
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
                viewUrl
              )
              .run();
          }
        } else if (record.action === "delete") {
          await db
            .prepare(
              "DELETE FROM repo_records WHERE did = ? AND collection = ? AND rkey = ?"
            )
            .bind(record.did, record.collection, record.rkey)
            .run();

          const uri = `at://${record.did}/${record.collection}/${record.rkey}`;
          await db
            .prepare("DELETE FROM resolved_documents WHERE uri = ?")
            .bind(uri)
            .run();
        }
      }
    }

    return c.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json(
      { error: "Failed to process webhook", details: String(error) },
      500
    );
  }
});

webhook.post("/tap/batch", async (c) => {
  try {
    const db = c.env.DB;

    const secret = c.env.TAP_WEBHOOK_SECRET;
    if (secret) {
      const auth = c.req.header("Authorization");
      // Support both Bearer token (legacy) and Basic Auth (Tap default)
      // Tap sends Basic Auth as base64("admin:password")
      const expectedBasic = `Basic ${btoa(`admin:${secret}`)}`;
      const expectedBearer = `Bearer ${secret}`;

      if (auth !== expectedBasic && auth !== expectedBearer) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const events = (await c.req.json()) as Array<{
      type: string;
      did: string;
      collection?: string;
      rkey?: string;
      cid?: string;
      record?: Record<string, unknown>;
    }>;

    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        if (
          (event.type === "commit" ||
            event.type === "create" ||
            event.type === "update") &&
          event.collection === "site.standard.document" &&
          event.did &&
          event.rkey
        ) {
          await db
            .prepare(
              `INSERT INTO repo_records (did, rkey, collection, cid, synced_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(did, collection, rkey) DO UPDATE SET cid = ?, synced_at = datetime('now')`
            )
            .bind(
              event.did,
              event.rkey,
              event.collection,
              event.cid || null,
              event.cid || null
            )
            .run();

          if (event.record) {
            const uri = `at://${event.did}/${event.collection}/${event.rkey}`;
            const doc = event.record as {
              title?: string;
              path?: string;
              site?: string;
              content?: unknown;
              textContent?: string;
              publishedAt?: string;
            };

            let viewUrl: string | null = null;
            if (doc.site && doc.path) {
              viewUrl = await resolveViewUrl(db, doc.site, doc.path);
            }

            await db
              .prepare(
                `INSERT INTO resolved_documents (uri, did, rkey, title, path, site, content, text_content, published_at, view_url, resolved_at, stale_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+12 hours'))
                 ON CONFLICT(uri) DO UPDATE SET
                   title = ?, path = ?, site = ?, content = ?, text_content = ?, published_at = ?, view_url = ?, resolved_at = datetime('now'), stale_at = datetime('now', '+12 hours')`
              )
              .bind(
                uri,
                event.did,
                event.rkey,
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
                viewUrl
              )
              .run();
          }
          processed++;
        } else if (
          event.type === "delete" &&
          event.collection === "site.standard.document" &&
          event.did &&
          event.rkey
        ) {
          await db
            .prepare(
              "DELETE FROM repo_records WHERE did = ? AND collection = ? AND rkey = ?"
            )
            .bind(event.did, event.collection, event.rkey)
            .run();

          const uri = `at://${event.did}/${event.collection}/${event.rkey}`;
          await db
            .prepare("DELETE FROM resolved_documents WHERE uri = ?")
            .bind(uri)
            .run();
          processed++;
        }
      } catch {
        errors++;
      }
    }

    return c.json({ ok: true, processed, errors });
  } catch (error) {
    console.error("Batch webhook error:", error);
    return c.json(
      { error: "Failed to process batch webhook", details: String(error) },
      500
    );
  }
});

export default webhook;
