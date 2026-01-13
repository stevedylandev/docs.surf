# AT Feeds

A monorepo for indexing and displaying [Standard.site](https://standard.site) documents from the AT Protocol, powered by Cloudflare Workers, D1, and Queues.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │    Pages     │────▶│   Worker     │────▶│     D1      │  │
│  │   (Client)   │     │   (API)      │     │  (Database) │  │
│  └──────────────┘     └──────────────┘     └─────────────┘  │
│                              ▲                    ▲          │
│                              │                    │          │
│                       ┌──────┴───────┐    ┌──────┴───────┐  │
│                       │    Queue     │    │     Cron     │  │
│                       │  (Resolver)  │    │  (Refresh)   │  │
│                       └──────┬───────┘    └──────────────┘  │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │ POST /webhook/tap
                    ┌──────────┴───────────┐
                    │   Tap Instance       │
                    │   (External VPS)     │
                    └──────────────────────┘
```

**Components:**

1. **Tap Indexer** (External) - Subscribes to the AT Protocol firehose and sends webhook events
2. **Server** (`packages/server`) - Cloudflare Worker with Hono API, D1 database, and Queue consumer
3. **Client** (`packages/client`) - Vite + React app deployed to Cloudflare Pages

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated
- A tap instance running somewhere (VPS, Fly.io, etc.)

### Setup

1. Install dependencies:

```bash
bun install
```

2. Create the D1 database:

```bash
bun run db:create
```

Copy the database ID and update `packages/server/wrangler.toml`.

3. Create the queue:

```bash
wrangler queues create document-resolution
```

4. Run database migrations:

```bash
# Local development
bun run db:migrate

# Production
bun run db:migrate:prod
```

5. (Optional) Set webhook secret:

```bash
bun run secret:set
```

6. Deploy the worker:

```bash
bun run deploy
```

7. Configure your tap instance:

```bash
TAP_WEBHOOK_URL=https://your-worker.workers.dev/webhook/tap
TAP_SIGNAL_COLLECTION=site.standard.document
TAP_COLLECTION_FILTERS=site.standard.document
```

8. Trigger initial resolution of existing records:

```bash
curl -X POST https://your-worker.workers.dev/admin/resolve-all
```

## Local Development

1. Start the worker locally:

```bash
bun run dev:server
```

The API will run on `http://localhost:8787`.

2. Start the client (in a separate terminal):

```bash
bun run dev:client
```

The client will run on `http://localhost:5173`.

## API Endpoints

### Health & Stats

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/stats` | GET | Database statistics |

### Feed Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/feed` | GET | Pre-resolved documents (fast) |
| `/feed-raw` | GET | Raw record references (for client-side resolution) |
| `/records/:did` | GET | Records by DID |

### Webhook

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/tap` | POST | Receives events from tap |
| `/webhook/tap/debug` | POST | Debug endpoint (echoes payload) |

### Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/resolve-all` | POST | Queue unresolved records for processing |

## How It Works

1. **Tap** subscribes to the AT Protocol firehose and filters for `site.standard.document` records
2. **Webhook** receives events and stores record references in D1, then pushes to the resolution queue
3. **Queue consumer** resolves each document (PDS lookup → record fetch → publication URL) and stores in `resolved_documents`
4. **Cron job** (every 15 min) refreshes stale documents and processes any missed records
5. **`/feed` endpoint** reads directly from `resolved_documents` for instant responses

## Project Structure

```
.
├── package.json            # Root workspace config
└── packages/
    ├── server/             # Cloudflare Worker
    │   ├── wrangler.toml   # Worker configuration
    │   ├── schema.sql      # D1 database schema
    │   ├── package.json
    │   └── src/
    │       └── index.ts    # API + Queue consumer + Cron handler
    └── client/             # Vite + React app
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── main.tsx
            └── App.tsx
```

## Scripts

```bash
# Development
bun run dev              # Run all packages in dev mode
bun run dev:server       # Run worker locally
bun run dev:client       # Run client locally

# Deployment
bun run deploy           # Deploy worker to Cloudflare
bun run deploy:client    # Deploy client to Cloudflare Pages

# Database
bun run db:create        # Create D1 database
bun run db:migrate       # Run migrations (local)
bun run db:migrate:prod  # Run migrations (production)

# Secrets
bun run secret:set       # Set TAP_WEBHOOK_SECRET
```

## Resources

- [tap Documentation](https://github.com/bluesky-social/indigo/tree/main/cmd/tap)
- [AT Protocol Specs](https://atproto.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Hono Documentation](https://hono.dev/)

## License

MIT
