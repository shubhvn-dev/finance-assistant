# Hackathon UI Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add annotated transcript coaching, a five-axis performance radar, and a manager dashboard that sells the team-performance story for the hackathon demo.

**Architecture:** Extend the existing scorecard contract end-to-end with `annotations` and `discovery_score`, keep the current session APIs intact, and build the new dashboard as frontend-only aggregation over existing session detail endpoints. UI changes stay within the existing scorecard page and component structure to minimize integration risk.

**Tech Stack:** FastAPI, asyncpg, Pydantic, Next.js App Router, React, TypeScript, Vitest, Recharts (or SVG fallback if install is blocked)

---

### Task 1: Extend Scorecard Data Contract

**Files:**
- Modify: `backend/prompts.py`
- Modify: `backend/app/models/session.py`
- Modify: `backend/main.py`
- Modify: `backend/schema.sql`
- Modify: `backend/migrate_add_annotations.sql`
- Modify: `backend/tests/test_sessions.py`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Write the failing backend/frontend type tests**
- [ ] **Step 2: Run the targeted tests to verify they fail**
  Run: `cd backend && .venv/bin/pytest tests/test_sessions.py -q`
  Run: `cd frontend && npm test -- tests/scorecard/scorecard-page.test.tsx`
- [ ] **Step 3: Extend the score prompt and scorecard models with `discovery_score` and stable `annotations` handling**
- [ ] **Step 4: Add the DB migration for `discovery_score` and preserve compatibility for existing rows**
- [ ] **Step 5: Run the targeted tests to verify they pass**
- [ ] **Step 6: Commit**

### Task 2: Upgrade Scorecard Page and Annotated Transcript

**Files:**
- Modify: `frontend/components/Scorecard.tsx`
- Modify: `frontend/app/session/[id]/scorecard/page.tsx`
- Modify: `frontend/tests/scorecard/scorecard-page.test.tsx`

- [ ] **Step 1: Write failing UI tests for radar content and transcript annotation rendering**
- [ ] **Step 2: Run the scorecard page tests to verify they fail**
  Run: `cd frontend && npm test -- tests/scorecard/scorecard-page.test.tsx`
- [ ] **Step 3: Implement the radar chart/header treatment and transcript callout styling**
- [ ] **Step 4: Run the scorecard page tests to verify they pass**
- [ ] **Step 5: Commit**

### Task 3: Build Manager Dashboard

**Files:**
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/tests/dashboard/dashboard-page.test.tsx`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Write the failing dashboard aggregation/render test**
- [ ] **Step 2: Run the dashboard test to verify it fails**
  Run: `cd frontend && npm test -- tests/dashboard/dashboard-page.test.tsx`
- [ ] **Step 3: Implement client-side aggregation over seeded rep IDs using `getSessions` + `getSession` fan-out**
- [ ] **Step 4: Run the dashboard test to verify it passes**
- [ ] **Step 5: Commit**

### Task 4: Install or Fallback for Radar Visualization

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` or equivalent lockfile if dependency install succeeds
- Modify: `frontend/components/Scorecard.tsx`

- [ ] **Step 1: Add `recharts` if dependency installation is possible**
- [ ] **Step 2: If install is blocked, implement an equivalent inline SVG radar without changing the external scorecard API**
- [ ] **Step 3: Run frontend typecheck/build tests covering the chosen path**
- [ ] **Step 4: Commit**

### Task 5: Verify End-to-End Surfaces

**Files:**
- Review only: `backend/main.py`
- Review only: `frontend/components/Scorecard.tsx`
- Review only: `frontend/app/session/[id]/scorecard/page.tsx`
- Review only: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Run backend targeted tests**
  Run: `cd backend && .venv/bin/pytest tests/test_sessions.py -q`
- [ ] **Step 2: Run frontend targeted tests**
  Run: `cd frontend && npm test -- tests/scorecard/scorecard-page.test.tsx tests/dashboard/dashboard-page.test.tsx`
- [ ] **Step 3: Run frontend typecheck**
  Run: `cd frontend && npm run typecheck`
- [ ] **Step 4: Summarize any remaining risks if verification is incomplete**
