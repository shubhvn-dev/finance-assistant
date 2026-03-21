-- Migration: add annotations column to scorecards
-- Run this once against any existing database that was created before this change.
-- Safe to run multiple times (IF NOT EXISTS guard).

ALTER TABLE scorecards
  ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT NULL;
