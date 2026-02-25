export {};

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const JETSTREAM_INSTANCES = (
	process.env.JETSTREAM_INSTANCES ??
	"jetstream1.us-east.bsky.network,jetstream2.us-east.bsky.network,jetstream1.us-west.bsky.network,jetstream2.us-west.bsky.network"
)
	.split(",")
	.map((h) => h.trim());
const WANTED_COLLECTIONS = (
	process.env.WANTED_COLLECTIONS ?? "site.standard.document"
)
	.split(",")
	.map((c) => c.trim());
const CURSOR_FILE = process.env.CURSOR_FILE ?? "./cursor.txt";
const BATCH_INTERVAL_MS = Number(process.env.BATCH_INTERVAL_MS) || 5000;
const INACTIVITY_TIMEOUT_MS =
	Number(process.env.INACTIVITY_TIMEOUT_MS) || 300_000;

const DEFAULT_CURSOR = "1772036746";

if (!WEBHOOK_URL) {
	console.error("WEBHOOK_URL environment variable is required");
	process.exit(1);
}

let cursor = DEFAULT_CURSOR;
let currentInstanceIndex = 0;
let ws: WebSocket | null = null;
let lastMessageTime = Date.now();
let batch: Array<{
	type: string;
	did: string;
	collection: string;
	rkey: string;
	cid: string;
	record?: Record<string, unknown>;
}> = [];

async function loadCursor(): Promise<void> {
	try {
		const file = Bun.file(CURSOR_FILE);
		const text = await file.text();
		const trimmed = text.trim();
		if (trimmed) {
			cursor = trimmed;
			console.log(`Loaded cursor from file: ${cursor}`);
		}
	} catch {
		console.log(`No cursor file found, using default: ${cursor}`);
	}
}

async function saveCursor(): Promise<void> {
	try {
		await Bun.write(CURSOR_FILE, cursor);
	} catch (err) {
		console.error("Failed to save cursor:", err);
	}
}

async function flushBatch(): Promise<void> {
	if (batch.length === 0) return;

	const events = batch.splice(0, batch.length);
	console.log(`Flushing batch of ${events.length} events`);

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (WEBHOOK_SECRET) {
			headers["Authorization"] = `Bearer ${WEBHOOK_SECRET}`;
		}

		const res = await fetch(WEBHOOK_URL!, {
			method: "POST",
			headers,
			body: JSON.stringify(events),
		});

		if (!res.ok) {
			console.error(
				`Webhook responded with ${res.status}: ${await res.text()}`,
			);
			return;
		}

		const result = (await res.json()) as Record<string, unknown>;
		console.log("Batch result:", JSON.stringify(result));
		await saveCursor();
	} catch (err) {
		console.error("Failed to send batch:", err);
	}
}

function connect(): void {
	const host = JETSTREAM_INSTANCES[currentInstanceIndex];
	const collections = WANTED_COLLECTIONS.map(
		(c) => `wantedCollections=${c}`,
	).join("&");
	const url = `wss://${host}/subscribe?${collections}&cursor=${cursor}`;

	console.log(`Connecting to ${host} with cursor ${cursor}`);

	ws = new WebSocket(url);

	ws.addEventListener("open", () => {
		console.log(`Connected to ${host}`);
		lastMessageTime = Date.now();
	});

	ws.addEventListener("message", (event) => {
		lastMessageTime = Date.now();

		try {
			const data = JSON.parse(String(event.data));

			if (data.kind !== "commit") return;

			cursor = String(data.time_us);

			batch.push({
				type: data.commit.operation,
				did: data.did,
				collection: data.commit.collection,
				rkey: data.commit.rkey,
				cid: data.commit.cid,
				record: data.commit.record,
			});
		} catch (err) {
			console.error("Failed to parse message:", err);
		}
	});

	ws.addEventListener("close", (event) => {
		console.log(`WebSocket closed: code=${event.code} reason=${event.reason}`);
	});

	ws.addEventListener("error", (event) => {
		console.error("WebSocket error:", event);
	});
}

function switchInstance(): void {
	currentInstanceIndex =
		(currentInstanceIndex + 1) % JETSTREAM_INSTANCES.length;
	const newHost = JETSTREAM_INSTANCES[currentInstanceIndex];
	console.log(`Switching to instance: ${newHost}`);

	if (ws) {
		try {
			ws.close();
		} catch {
			// ignore close errors
		}
		ws = null;
	}

	connect();
}

// --- Main ---

await loadCursor();
connect();

// Batch flush interval
setInterval(() => {
	flushBatch();
}, BATCH_INTERVAL_MS);

// Inactivity check every 30s
setInterval(() => {
	const elapsed = Date.now() - lastMessageTime;
	if (elapsed > INACTIVITY_TIMEOUT_MS) {
		console.log(
			`No messages for ${Math.round(elapsed / 1000)}s, triggering failover`,
		);
		switchInstance();
	}
}, 30_000);

console.log("Jetstream consumer started");
console.log(`  Webhook URL: ${WEBHOOK_URL}`);
console.log(`  Instances: ${JETSTREAM_INSTANCES.join(", ")}`);
console.log(`  Collections: ${WANTED_COLLECTIONS.join(", ")}`);
console.log(`  Batch interval: ${BATCH_INTERVAL_MS}ms`);
console.log(`  Inactivity timeout: ${INACTIVITY_TIMEOUT_MS}ms`);
