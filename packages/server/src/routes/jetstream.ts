import { Hono } from "hono";
import type { Bindings } from "../types";

const jetstream = new Hono<{ Bindings: Bindings }>();

function getStub(env: Bindings) {
	const id = env.JETSTREAM_CONSUMER.idFromName("singleton");
	return env.JETSTREAM_CONSUMER.get(id);
}

jetstream.get("/start", async (c) => {
	const stub = getStub(c.env);
	const resp = await stub.fetch(new Request("http://do/start"));
	return c.json(await resp.json());
});

jetstream.get("/status", async (c) => {
	const stub = getStub(c.env);
	const resp = await stub.fetch(new Request("http://do/status"));
	return c.json(await resp.json());
});

jetstream.get("/stop", async (c) => {
	const stub = getStub(c.env);
	const resp = await stub.fetch(new Request("http://do/stop"));
	return c.json(await resp.json());
});

export default jetstream;
