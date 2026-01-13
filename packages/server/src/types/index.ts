export type Bindings = {
  DB: D1Database;
  RESOLUTION_QUEUE: Queue;
  TAP_WEBHOOK_SECRET?: string;
};

export interface TapRecordEvent {
  id: number;
  type: "record";
  record: {
    live: boolean;
    rev: string;
    did: string;
    collection: string;
    rkey: string;
    action: "create" | "update" | "delete";
    cid?: string;
    record?: Record<string, unknown>;
  };
}

export interface TapIdentityEvent {
  id: number;
  type: "identity";
  identity: {
    did: string;
    handle: string;
    isActive: boolean;
    status: string;
  };
}

export type TapEvent = TapRecordEvent | TapIdentityEvent;

// Strong reference to a Bluesky post
export interface BskyPostRef {
  uri: string;
  cid: string;
}

// Publication record from site.standard.publication
export interface Publication {
  url: string;  // Base publication URL
  name: string;
  description?: string;
  iconCid?: string;  // CID for icon blob
  iconUrl?: string;  // Resolved full URL to icon
}

// Document record from site.standard.document
export interface Document {
  uri: string;
  did: string;
  rkey: string;
  // Document fields
  title: string;
  description?: string;
  path?: string;
  site?: string;  // at:// URI to publication or https:// URL
  content?: unknown;
  textContent?: string;
  coverImageCid?: string;  // CID for cover image blob
  coverImageUrl?: string;  // Resolved full URL to cover image
  bskyPostRef?: BskyPostRef;
  tags?: string[];
  publishedAt?: string;
  updatedAt?: string;
  // Resolved publication data
  publication?: Publication;
  // Metadata
  viewUrl?: string;  // Canonical URL (publication.url + path)
  pdsEndpoint?: string;  // PDS endpoint used for blob URLs
}

// Database row for resolved_documents table
export interface ResolvedDocumentRow {
  uri: string;
  did: string;
  rkey: string;
  title: string | null;
  description: string | null;
  path: string | null;
  site: string | null;
  content: string | null;
  text_content: string | null;
  cover_image_cid: string | null;
  cover_image_url: string | null;
  bsky_post_ref: string | null;
  tags: string | null;
  published_at: string | null;
  updated_at: string | null;
  pub_url: string | null;
  pub_name: string | null;
  pub_description: string | null;
  pub_icon_cid: string | null;
  pub_icon_url: string | null;
  view_url: string | null;
  pds_endpoint: string | null;
  resolved_at: string | null;
  stale_at: string | null;
}
