-- Migration: add annotations and discovery columns to scorecards
-- Run this once against any existing database that was created before this change.
-- Safe to run multiple times (IF NOT EXISTS guard).

ALTER TABLE scorecards
  ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT NULL;

ALTER TABLE scorecards
  ADD COLUMN IF NOT EXISTS discovery_score INT CHECK (discovery_score BETWEEN 0 AND 10);

ALTER TABLE scorecards
  ADD COLUMN IF NOT EXISTS discovery_feedback TEXT;
