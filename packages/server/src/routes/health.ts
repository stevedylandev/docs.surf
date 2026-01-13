import { Hono } from "hono";
import type { Bindings } from "../types";

const health = new Hono<{ Bindings: Bindings }>();

health.get("/", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default health;
