# Docs.surf

![cover](./packages/client/public/og.png)

A monorepo for indexing and displaying [Standard.site](https://standard.site) documents from the AT Protocol, powered by Cloudflare Workers, D1, and Queues.

**Components:**

1. **Tap Indexer** (External) - Subscribes to the AT Protocol firehose and sends webhook events
2. **Server** (`packages/server`) - Cloudflare Worker with Hono API, D1 database, and Queue consumer
3. **Client** (`packages/client`) - Vite + React app deployed to Cloudflare Pages

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

## How It Works

1. **Tap** subscribes to the AT Protocol firehose and filters for `site.standard.document` records
2. **Webhook** receives events and stores record references in D1, then pushes to the resolution queue
3. **Queue consumer** resolves each document (PDS lookup → record fetch → publication URL) and stores in `resolved_documents`
4. **Cron job** (every 15 min) refreshes stale documents and processes any missed records
5. **`/feed` endpoint** reads directly from `resolved_documents` for instant responses

## Resources

- [tap Documentation](https://github.com/bluesky-social/indigo/tree/main/cmd/tap)
- [AT Protocol Specs](https://atproto.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Hono Documentation](https://hono.dev/)

## License

MIT
