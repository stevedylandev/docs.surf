export type Bindings = {
  DB: D1Database;
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

export interface Document {
  uri: string;
  did: string;
  rkey: string;
  title: string;
  path: string | null;
  site: string | null;
  content: unknown;
  textContent: string | null;
  publishedAt: string | null;
  viewUrl: string | null;
}
