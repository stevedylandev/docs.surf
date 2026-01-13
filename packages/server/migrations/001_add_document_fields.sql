-- Migration: Add full Document and Publication fields to resolved_documents
-- Run with: wrangler d1 execute atfeeds-db --file=migrations/001_add_document_fields.sql --remote

-- Document fields
ALTER TABLE resolved_documents ADD COLUMN description TEXT;
ALTER TABLE resolved_documents ADD COLUMN cover_image_cid TEXT;
ALTER TABLE resolved_documents ADD COLUMN cover_image_url TEXT;
ALTER TABLE resolved_documents ADD COLUMN bsky_post_ref TEXT;
ALTER TABLE resolved_documents ADD COLUMN tags TEXT;
ALTER TABLE resolved_documents ADD COLUMN updated_at TEXT;

-- Publication fields
ALTER TABLE resolved_documents ADD COLUMN pub_url TEXT;
ALTER TABLE resolved_documents ADD COLUMN pub_name TEXT;
ALTER TABLE resolved_documents ADD COLUMN pub_description TEXT;
ALTER TABLE resolved_documents ADD COLUMN pub_icon_cid TEXT;
ALTER TABLE resolved_documents ADD COLUMN pub_icon_url TEXT;

-- Metadata
ALTER TABLE resolved_documents ADD COLUMN pds_endpoint TEXT;

-- Index for publication queries
CREATE INDEX IF NOT EXISTS idx_resolved_documents_pub_url ON resolved_documents(pub_url);
