/**
 * Constructs a full URL to fetch a blob from a PDS.
 * Format: {pds}/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}
 */
export function buildBlobUrl(pds: string, did: string, cid: string): string {
  const baseUrl = pds.endsWith("/") ? pds.slice(0, -1) : pds;
  return `${baseUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

/**
 * Extracts the CID from a blob reference object.
 * Blob refs can be in different formats:
 * - { $link: "cid" } (legacy)
 * - { ref: { $link: "cid" } } (current)
 * - { cid: "cid" } (simple)
 */
export function extractBlobCid(blob: unknown): string | null {
  if (!blob || typeof blob !== "object") return null;

  const b = blob as Record<string, unknown>;

  // Current format: { ref: { $link: "cid" } }
  if (b.ref && typeof b.ref === "object") {
    const ref = b.ref as Record<string, unknown>;
    if (typeof ref.$link === "string") return ref.$link;
  }

  // Legacy format: { $link: "cid" }
  if (typeof b.$link === "string") return b.$link;

  // Simple format: { cid: "cid" }
  if (typeof b.cid === "string") return b.cid;

  return null;
}
