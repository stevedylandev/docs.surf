import type { Bindings, JetstreamEvent } from "../types";
import { resolvePds } from "../utils/resolver";
import { ingestDocument, deleteDocument } from "../utils/ingest";

const JETSTREAM_URL =
	"wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=site.standard.document";
const ALARM_INTERVAL_MS = 30_000;
const CURSOR_SAVE_INTERVAL_MS = 10_000;
const CURSOR_SAVE_MESSAGE_COUNT = 100;

export class JetstreamConsumer implements DurableObject {
	private state: DurableObjectState;
	private env: Bindings;
	private ws: WebSocket | null = null;
	private cursor: string | null = null;
	private messageCount = 0;
	private lastCursorSave = 0;
	private pdsCache: Map<string, string | null> = new Map();

	constructor(state: DurableObjectState, env: Bindings) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case "/start":
				return this.handleStart();
			case "/status":
				return this.handleStatus();
			case "/stop":
				return this.handleStop();
			default:
				return new Response("Not found", { status: 404 });
		}
	}

	async alarm(): Promise<void> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.log("Alarm: WebSocket not connected, reconnecting...");
			await this.connect();
		}
		// Reschedule alarm
		await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
	}

	private async handleStart(): Promise<Response> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return Response.json({
				status: "already_connected",
				cursor: this.cursor,
			});
		}

		await this.connect();
		await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);

		return Response.json({ status: "started", cursor: this.cursor });
	}

	private handleStatus(): Response {
		return Response.json({
			connected: this.ws?.readyState === WebSocket.OPEN,
			cursor: this.cursor,
			messageCount: this.messageCount,
		});
	}

	private async handleStop(): Promise<Response> {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		await this.state.storage.deleteAlarm();
		return Response.json({ status: "stopped" });
	}

	private async connect(): Promise<void> {
		// Close existing connection if any
		if (this.ws) {
			try {
				this.ws.close();
			} catch {}
			this.ws = null;
		}

		// Load cursor from storage
		if (!this.cursor) {
			this.cursor =
				(await this.state.storage.get<string>("cursor")) || null;
		}

		const url = this.cursor
			? `${JETSTREAM_URL}&cursor=${this.cursor}`
			: JETSTREAM_URL;

		console.log(`Connecting to Jetstream: ${url}`);

		try {
			const ws = new WebSocket(url);

			ws.addEventListener("message", (event) => {
				this.onMessage(event.data as string);
			});

			ws.addEventListener("close", () => {
				console.log("Jetstream WebSocket closed");
				this.ws = null;
				// Alarm will handle reconnection
			});

			ws.addEventListener("error", (event) => {
				console.error("Jetstream WebSocket error:", event);
				try {
					ws.close();
				} catch {}
				this.ws = null;
			});

			this.ws = ws;
		} catch (error) {
			console.error("Failed to connect to Jetstream:", error);
			this.ws = null;
		}
	}

	private async onMessage(data: string): Promise<void> {
		try {
			const event = JSON.parse(data) as JetstreamEvent;

			// Update cursor from every event
			this.cursor = String(event.time_us);

			// Only process commit events
			if (event.kind !== "commit") return;

			const { commit } = event;
			if (commit.collection !== "site.standard.document") return;

			// PDS filter: skip bridgy noise
			const pds = await this.resolvePdsWithCache(event.did);
			if (!pds || pds.includes("brid.gy")) return;

			if (
				commit.operation === "create" ||
				commit.operation === "update"
			) {
				await ingestDocument(this.env.DB, this.env.RESOLUTION_QUEUE, {
					did: event.did,
					rkey: commit.rkey,
					collection: commit.collection,
					cid: commit.cid,
					record: commit.record,
				});
			} else if (commit.operation === "delete") {
				await deleteDocument(this.env.DB, {
					did: event.did,
					collection: commit.collection,
					rkey: commit.rkey,
				});
			}

			this.messageCount++;

			// Periodically save cursor
			await this.maybeSaveCursor();
		} catch (error) {
			console.error("Error processing Jetstream message:", error);
		}
	}

	private async resolvePdsWithCache(did: string): Promise<string | null> {
		// Fast in-memory cache (cleared on DO eviction)
		if (this.pdsCache.has(did)) {
			return this.pdsCache.get(did)!;
		}

		const pds = await resolvePds(this.env.DB, did);
		this.pdsCache.set(did, pds);

		// Keep in-memory cache bounded
		if (this.pdsCache.size > 10_000) {
			const firstKey = this.pdsCache.keys().next().value;
			if (firstKey) this.pdsCache.delete(firstKey);
		}

		return pds;
	}

	private async maybeSaveCursor(): Promise<void> {
		if (!this.cursor) return;

		const now = Date.now();
		const shouldSave =
			this.messageCount % CURSOR_SAVE_MESSAGE_COUNT === 0 ||
			now - this.lastCursorSave > CURSOR_SAVE_INTERVAL_MS;

		if (shouldSave) {
			await this.state.storage.put("cursor", this.cursor);
			this.lastCursorSave = now;
		}
	}
}
