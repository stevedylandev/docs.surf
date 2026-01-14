/**
 * Verification utilities for standard.site records.
 *
 * Publications are verified via /.well-known/site.standard.publication
 * Documents are verified via <link rel="site.standard.document"> in HTML
 */

/**
 * Verifies a publication by checking /.well-known/site.standard.publication
 * @param pubUrl The publication's base URL (e.g., "https://example.com")
 * @param siteUri The expected AT-URI of the publication (e.g., "at://did:plc:abc/site.standard.publication/rkey")
 * @returns true if the .well-known endpoint returns the matching AT-URI
 */
export async function verifyPublication(
  pubUrl: string,
  siteUri: string
): Promise<boolean> {
  try {
    const baseUrl = pubUrl.startsWith("http") ? pubUrl : `https://${pubUrl}`;
    const wellKnownUrl = `${baseUrl.replace(/\/$/, "")}/.well-known/site.standard.publication`;

    const response = await fetch(wellKnownUrl, {
      headers: { Accept: "text/plain" },
    });

    if (!response.ok) return false;

    const body = await response.text();
    return body.trim() === siteUri.trim();
  } catch {
    return false;
  }
}

/**
 * Verifies a document by checking for a matching <link rel="site.standard.document"> tag
 * @param viewUrl The document's canonical URL (e.g., "https://example.com/blog/post")
 * @param documentUri The expected AT-URI of the document (e.g., "at://did:plc:abc/site.standard.document/rkey")
 * @returns true if the HTML contains a matching link tag
 */
export async function verifyDocument(
  viewUrl: string,
  documentUri: string
): Promise<boolean> {
  try {
    const response = await fetch(viewUrl, {
      headers: { Accept: "text/html" },
    });

    if (!response.ok) return false;

    const html = await response.text();

    // Look for <link rel="site.standard.document" href="at://...">
    // Using regex to avoid heavy HTML parser dependency
    const linkPattern =
      /<link[^>]+rel=["']site\.standard\.document["'][^>]+href=["']([^"']+)["'][^>]*>/i;
    const altPattern =
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']site\.standard\.document["'][^>]*>/i;

    const match = html.match(linkPattern) || html.match(altPattern);
    if (!match) return false;

    return match[1].trim() === documentUri.trim();
  } catch {
    return false;
  }
}

/**
 * Combined verification for a document record.
 * Checks publication verification first (if applicable), then document verification.
 *
 * @param pubUrl The publication's base URL
 * @param siteUri The AT-URI of the publication (from document's site field)
 * @param viewUrl The document's canonical URL
 * @param documentUri The AT-URI of the document
 * @returns true if either publication or document verification passes
 */
export async function verifyDocumentRecord(
  pubUrl: string | null,
  siteUri: string | null,
  viewUrl: string | null,
  documentUri: string
): Promise<boolean> {
  // Try publication verification first (if we have a publication AT-URI)
  if (pubUrl && siteUri && siteUri.startsWith("at://")) {
    const pubVerified = await verifyPublication(pubUrl, siteUri);
    if (pubVerified) return true;
  }

  // Fall back to document verification (if we have a view URL)
  if (viewUrl) {
    const docVerified = await verifyDocument(viewUrl, documentUri);
    if (docVerified) return true;
  }

  return false;
}
