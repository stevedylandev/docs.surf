import { Hono } from "hono";
import type { Bindings } from "../types";

const stats = new Hono<{ Bindings: Bindings }>();

stats.get("/", async (c) => {
  try {
    const db = c.env.DB;
    const [records, pdsCache, recordCache, pubCache] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) as count FROM repo_records")
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM pds_cache")
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM record_cache")
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM publication_cache")
        .first<{ count: number }>(),
    ]);

    return c.json({
      repo_records: records?.count || 0,
      pds_cache: pdsCache?.count || 0,
      record_cache: recordCache?.count || 0,
      publication_cache: pubCache?.count || 0,
    });
  } catch (error) {
    return c.json(
      { error: "Failed to fetch stats", details: String(error) },
      500
    );
  }
});

export default stats;
