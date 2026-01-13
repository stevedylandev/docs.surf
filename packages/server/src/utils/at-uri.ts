export interface AtUriComponents {
  did: string;
  collection: string;
  rkey: string;
}

export function parseAtUri(uri: string): AtUriComponents | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

export function buildAtUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}
