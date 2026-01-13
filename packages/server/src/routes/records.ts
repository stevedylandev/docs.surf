import { Hono } from "hono";
import type { Bindings } from "../types";

const records = new Hono<{ Bindings: Bindings }>();

records.get("/:did", async (c) => {
  try {
    const db = c.env.DB;
    const did = c.req.param("did");
    const limit = Number(c.req.query("limit")) || 20;
    const offset = Number(c.req.query("offset")) || 0;

    const { results } = await db
      .prepare(
        `SELECT * FROM repo_records
         WHERE did = ? AND collection = 'site.standard.document'
         ORDER BY rkey DESC
         LIMIT ? OFFSET ?`
      )
      .bind(did, limit, offset)
      .all();

    return c.json({
      did,
      count: results?.length || 0,
      limit,
      offset,
      records: results || [],
    });
  } catch (error) {
    return c.json(
      { error: "Failed to fetch records", details: String(error) },
      500
    );
  }
});

export default records;
