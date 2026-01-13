// PDS cache TTL: 1 hour (PDS endpoints rarely change)
const PDS_CACHE_TTL_MS = 60 * 60 * 1000;

function isPdsCacheValid(cachedAt: string | null): boolean {
  if (!cachedAt) return false;
  const cacheTime = new Date(cachedAt).getTime();
  return Date.now() - cacheTime < PDS_CACHE_TTL_MS;
}

export async function resolvePds(
  db: D1Database,
  did: string
): Promise<string | null> {
  const cached = await db
    .prepare("SELECT pds_endpoint, cached_at FROM pds_cache WHERE did = ?")
    .bind(did)
    .first<{ pds_endpoint: string; cached_at: string }>();

  if (cached && isPdsCacheValid(cached.cached_at)) {
    return cached.pds_endpoint;
  }

  try {
    const response = await fetch(`https://plc.directory/${did}`);
    if (!response.ok) return null;

    const doc = (await response.json()) as {
      service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
    };

    const pds = doc.service?.find((s) => s.id === "#atproto_pds");
    if (pds?.serviceEndpoint) {
      await db
        .prepare(
          `INSERT INTO pds_cache (did, pds_endpoint, cached_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(did) DO UPDATE SET pds_endpoint = ?, cached_at = datetime('now')`
        )
        .bind(did, pds.serviceEndpoint, pds.serviceEndpoint)
        .run();

      return pds.serviceEndpoint;
    }

    return null;
  } catch {
    return null;
  }
}
