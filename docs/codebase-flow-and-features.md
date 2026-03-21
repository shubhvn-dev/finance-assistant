# Finance Assistant Codebase Flow and Features

This document explains what is currently implemented in the repository, how the frontend and backend interact, and which product ideas are still only described in planning docs.

## High-Level Architecture

- `frontend/` is a Next.js app that handles navigation, persona selection, the ElevenLabs voice session UI, scorecard display, and call history.
- `backend/` is a FastAPI service that manages personas, session persistence, transcript storage, and Claude-powered scorecard generation.
- PostgreSQL stores `sessions`, `messages`, and `scorecards`.
- ElevenLabs provides the live voice conversation in the browser.
- Anthropic Claude generates the post-call evaluation and structured scorecard.

## Core User Flow

### 1. Home Page

The entry page is [`frontend/app/page.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/app/page.tsx). It exposes two primary actions:

- `Practice` routes to `/session/new`
- `Call Logs` routes to `/call-logs`

### 2. Persona Selection

[`frontend/app/session/new/page.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/app/session/new/page.tsx) renders three training options from [`frontend/lib/personas.ts`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/lib/personas.ts):

- `easy` → Friendly Client
- `medium` → Busy Professional
- `aggressive` → Skeptical Investor

These frontend personas are presentation-layer options. They are later mapped to backend personas:

- `easy` → `marcus`
- `medium` → `sarah`
- `aggressive` → `robert`

That mapping lives in [`frontend/app/session/[id]/page.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/app/session/[id]/page.tsx).

### 3. Session Creation

When a user opens `/session/[id]`, the frontend immediately creates a backend session by calling `POST /sessions` through [`frontend/lib/api.ts`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/lib/api.ts).

The page:

- resolves the selected frontend persona
- maps it to a backend persona id
- sends `user_id: "temp-user-001"` and `persona_id`
- stores the returned `sessionId`
- passes that `sessionId` into the voice UI

### 4. Live Voice Call

[`frontend/components/VoiceCallUI.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/components/VoiceCallUI.tsx) is the main interactive component for the live call.

Its responsibilities:

- start an ElevenLabs session with the configured `agentId`
- track connection state
- receive conversation messages from the ElevenLabs React SDK
- normalize message roles into backend-friendly values:
  - `user` → `advisor`
  - everything else → `prospect`
- persist each message to the backend with `POST /sessions/{id}/messages`
- end the live call
- trigger backend scorecard generation with `POST /sessions/{id}/end`

Important detail: the actual real-time back-and-forth voice conversation happens through ElevenLabs. The backend does not generate each live response for the current frontend flow.

### 5. Session End and Scorecard Generation

When the user clicks `End Call`, the frontend:

1. ends the ElevenLabs conversation
2. calls `POST /sessions/{session_id}/end`
3. waits for the backend to:
   - load the saved transcript from PostgreSQL
   - format it into a text conversation
   - send it to Claude with the scoring prompt
   - parse the JSON response
   - flatten and persist the scorecard
   - mark the session as `completed`
4. shows a `View Report` action

The scorecard pipeline is implemented in [`backend/main.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/main.py) using prompts from [`backend/prompts.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/prompts.py).

### 6. Scorecard Review

[`frontend/app/session/[id]/scorecard/page.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/app/session/[id]/scorecard/page.tsx) fetches full session details using `GET /sessions/{id}` and renders:

- scorecard summary
- category scores
- best moment
- biggest mistake
- replacement phrasing
- full call transcript

The score visualization lives in [`frontend/components/Scorecard.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/components/Scorecard.tsx).

### 7. Call History

[`frontend/app/call-logs/page.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/app/call-logs/page.tsx) loads sessions for the hardcoded user `temp-user-001` through `GET /sessions?user_id=...`.

This page shows:

- timestamp
- persona name
- computed duration
- session status
- link to the scorecard page

## Backend Responsibilities

The active backend entry point is [`backend/main.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/main.py).

### Implemented Endpoints

- `GET /personas`
  - Returns backend persona metadata from [`backend/personas.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/personas.py).
- `POST /respond`
  - Uses Claude to generate a persona response from conversation history.
  - Present in the backend, but not used by the current frontend voice flow.
- `POST /score`
  - Scores an arbitrary transcript with Claude.
  - Present in the backend, but the main app currently uses `POST /sessions/{id}/end` instead.
- `POST /sessions`
  - Creates a new session row.
- `POST /sessions/{id}/messages`
  - Persists each transcript turn.
- `POST /sessions/{id}/end`
  - Generates and saves the scorecard, then completes the session.
- `GET /sessions/{id}`
  - Returns session metadata, messages, and scorecard.
- `GET /sessions`
  - Lists sessions, optionally filtered by `user_id`.

### Persona and Prompt Model

[`backend/personas.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/personas.py) defines three personas with:

- demographic background
- portfolio/provider context
- difficulty
- main objection
- secondary objections
- voice id

[`backend/prompts.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/prompts.py) contains:

- a persona prompt generator for in-character objection handling
- a scoring prompt that forces JSON output for structured feedback

## Data Model

The database schema is defined in [`backend/schema.sql`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/schema.sql).

### `sessions`

Stores one row per practice call:

- user id
- persona id
- optional ElevenLabs conversation id
- start/end timestamps
- status

### `messages`

Stores one row per transcript turn:

- session id
- role (`advisor` or `prospect`)
- message content
- turn number
- created timestamp

### `scorecards`

Stores one row per completed session:

- overall score
- opener score/feedback
- objection handling score/feedback
- tone/confidence score/feedback
- close attempt score/feedback
- best moment
- biggest mistake
- suggested alternative phrasing
- meeting booked flag

## Frontend Features Currently Implemented

- Home page with navigation into practice and history
- Persona selection UI with three difficulty levels
- Session bootstrap against the backend
- ElevenLabs-powered voice conversation UI
- Transcript persistence per received message
- Post-call scorecard generation
- Detailed scorecard page with transcript review
- Call history page
- Basic loading and error states in major flows

## Tests Present in the Repo

### Frontend

- [`frontend/tests/session-flow/session-flow.test.ts`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/tests/session-flow/session-flow.test.ts)
  - validates persona mapping, websocket role normalization, and API error parsing
- [`frontend/tests/scorecard/scorecard-page.test.tsx`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/frontend/tests/scorecard/scorecard-page.test.tsx)
  - verifies transcript rendering and missing-session handling on the scorecard page

### Backend

- [`backend/tests/test_sessions.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/tests/test_sessions.py)
  - covers session completion, scorecard persistence, and completed-session rejection
- [`backend/tests/test_schema.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/tests/test_schema.py)
  - checks schema setup for UUID support

## Current Implementation Notes and Gaps

The repository includes planning docs such as [`PROJECT.md`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/PROJECT.md) that describe a broader product vision. The current codebase implements only part of that vision.

### Implemented in Code

- practice session creation
- AI voice conversation via ElevenLabs
- transcript storage
- AI scorecard generation
- session history

### Described in Planning Docs but Not Fully Implemented

- real authentication
- dashboard trend charts
- Finny-backed prospect enrichment
- manager/team workflows
- richer persona cards with financial profile details
- full separation of backend service modules under `backend/app/services/*`

### Notable Structural Detail

There are two backend layouts in the repo:

- the active app in [`backend/main.py`](/Users/sumanthramesh/Documents/dev/personal_projects/finance-assistant/backend/main.py)
- partially scaffolded modules under `backend/app/`

Today, the working API flow is centered on `backend/main.py`. Several files under `backend/app/` are stubs or alternate implementations and are not currently the main runtime path.

## Practical Summary

At its current state, this codebase is a working practice-call trainer with this implemented loop:

1. choose a persona
2. create a session
3. hold a voice conversation through ElevenLabs
4. save transcript turns to PostgreSQL
5. end the call
6. generate a Claude scorecard
7. review the report and transcript
8. revisit prior sessions from call logs

That is the core product flow the repository currently supports end to end.
