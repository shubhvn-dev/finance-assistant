-- Migration: add signals, prompt_version, model_version columns to scorecards
-- Run once against any existing database. Safe to run multiple times.

ALTER TABLE scorecards
  ADD COLUMN IF NOT EXISTS signals JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(50) DEFAULT 'v2.0',
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'unknown';
