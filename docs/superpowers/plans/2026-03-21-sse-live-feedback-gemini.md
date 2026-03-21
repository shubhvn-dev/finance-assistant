# SSE Live Feedback With Gemini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ephemeral, turn-by-turn live feedback during practice calls using Gemini and SSE, showing a simple `on_track` or `off_track` signal in the call UI without changing the current session persistence flow.

**Architecture:** Keep ElevenLabs as the live conversation transport and FastAPI as the session/transcript backend. Add a Gemini-backed provider layer, a session-scoped SSE feedback stream, and a trigger endpoint that evaluates only advisor turns and publishes live feedback events to the frontend.

**Tech Stack:** FastAPI, asyncpg, Next.js App Router, React, EventSource/SSE, Gemini API, ElevenLabs React SDK, PostgreSQL

---

## File Map

### Existing files to modify
- `backend/main.py`
- `backend/app/core/config.py`
- `backend/requirements.txt`
- `frontend/lib/api.ts`
- `frontend/components/VoiceCallUI.tsx`

### New backend files
- `backend/app/services/llm/base.py`
- `backend/app/services/llm/gemini.py`
- `backend/app/services/live_feedback.py`
- `backend/app/services/sse.py`

### Test files to add
- `backend/tests/test_live_feedback.py`
- `backend/tests/test_sse_stream.py`
- `backend/tests/test_scorecard_provider.py`
- `frontend/components/__tests__/VoiceCallUI.feedback.test.tsx`

## Parallelization Strategy

### Sequential prerequisite
- [ ] Lock the shared contracts before parallel work starts:
  - Gemini provider interface
  - SSE event payload
  - `POST /sessions/{id}/feedback/evaluate` request and response shape

### Parallel workstreams after contracts are fixed
- [ ] Workstream A: Gemini provider foundation
- [ ] Workstream B: SSE transport and session pub/sub
- [ ] Workstream C: Live feedback evaluation endpoint
- [ ] Workstream D: Frontend SSE client and live indicator UI
- [ ] Workstream E: End-of-call scorecard migration to Gemini

### Main merge points
- [ ] `backend/main.py` route wiring
- [ ] `frontend/components/VoiceCallUI.tsx` feedback state integration

### Ownership guidance for parallel workers
- [ ] Worker A owns `backend/app/services/llm/*` plus Gemini config wiring
- [ ] Worker B owns `backend/app/services/sse.py` and SSE route plumbing
- [ ] Worker C owns `backend/app/services/live_feedback.py` and feedback evaluate route plumbing
- [ ] Worker D owns `frontend/lib/api.ts` and `frontend/components/VoiceCallUI.tsx`
- [ ] Worker E owns scorecard migration to the new provider interface

## Shared Contracts

### Live feedback response from Gemini
```json
{
  "status": "on_track",
  "reason": "You handled the objection directly."
}
```

### SSE payload
```json
{
  "type": "feedback",
  "session_id": "uuid",
  "turn_number": 4,
  "status": "on_track",
  "reason": "You handled the objection directly.",
  "generated_at": "2026-03-21T15:04:05Z"
}
```

### Feedback evaluate request
```json
{
  "turn_number": 4
}
```

### Feedback evaluate response
```json
{
  "status": "accepted"
}
```

### Frontend feedback state
```ts
type FeedbackUiState = 'idle' | 'evaluating' | 'on_track' | 'off_track' | 'error';
```

## Task 1: Gemini Provider Foundation

**Files:**
- Create: `backend/app/services/llm/base.py`
- Create: `backend/app/services/llm/gemini.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/requirements.txt`
- Test: `backend/tests/test_scorecard_provider.py`

- [ ] Define a provider interface with two responsibilities:
  - `generate_live_feedback(persona, recent_messages, turn_number)`
  - `generate_scorecard(persona, full_transcript)`

- [ ] Add Gemini configuration to `backend/app/core/config.py`:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`

- [ ] Add the Gemini SDK dependency to `backend/requirements.txt`.

- [ ] Implement Gemini live feedback prompting in `backend/app/services/llm/gemini.py`.

- [ ] Keep the live feedback prompt narrow:
  - binary output only
  - short reason only
  - strict JSON only
  - persona-aware
  - recent transcript window only

- [ ] Implement Gemini scorecard generation in the same provider so `/sessions/{id}/end` can migrate later without a second backend LLM path.

- [ ] Add backend tests for:
  - valid JSON parsing
  - malformed model output handling
  - scorecard response shape preservation

## Task 2: SSE Transport Layer

**Files:**
- Create: `backend/app/services/sse.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_sse_stream.py`

- [ ] Build an in-memory session-scoped pub/sub registry in `backend/app/services/sse.py`.

- [ ] Use one async queue per connected subscriber.

- [ ] Implement helper functions:
  - `subscribe(session_id)`
  - `unsubscribe(session_id, subscriber)`
  - `publish(session_id, event)`

- [ ] Add heartbeat support if needed to keep the SSE connection alive in development.

- [ ] Add `GET /sessions/{session_id}/feedback/stream` in `backend/main.py`.

- [ ] Ensure disconnects clean up queue state.

- [ ] Add tests for:
  - subscriber registration
  - event delivery
  - disconnect cleanup
  - no crash when publishing with zero listeners

## Task 3: Live Feedback Evaluation Endpoint

**Files:**
- Create: `backend/app/services/live_feedback.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_live_feedback.py`

- [ ] Create a helper that loads the recent transcript window from `messages`.

- [ ] Default transcript window size to 6 messages.

- [ ] Always include the latest advisor turn.

- [ ] Add helper logic to:
  - verify the session exists
  - fetch the session persona
  - ensure the latest message is an advisor turn
  - ignore duplicate evaluation requests for the same `session_id + turn_number`

- [ ] Add `POST /sessions/{session_id}/feedback/evaluate` in `backend/main.py`.

- [ ] Wire the endpoint to:
  - load session and recent transcript
  - call the Gemini provider
  - publish an SSE event through the session pub/sub
  - return `{"status": "accepted"}`

- [ ] Handle model or publish failures without crashing the app.

- [ ] Add tests for:
  - unknown session returns 404
  - non-advisor latest turn does not evaluate
  - duplicate turn request does not double-publish
  - advisor turn produces a publish call with the expected event shape

## Task 4: Frontend API Client And SSE Subscription

**Files:**
- Modify: `frontend/lib/api.ts`
- Test: `frontend/components/__tests__/VoiceCallUI.feedback.test.tsx`

- [ ] Add a helper to open an `EventSource` for `/sessions/{id}/feedback/stream`.

- [ ] Add a helper to call `POST /sessions/{id}/feedback/evaluate`.

- [ ] Keep the new helpers separate from existing `createSession`, `addMessage`, `endSession`, `getSession`, and `getSessions`.

- [ ] Make the evaluation helper non-fatal so feedback failures do not interrupt the call flow.

- [ ] Add mocked tests covering:
  - EventSource connection setup
  - evaluation POST request shape
  - non-fatal error behavior

## Task 5: VoiceCallUI Live Indicator

**Files:**
- Modify: `frontend/components/VoiceCallUI.tsx`
- Test: `frontend/components/__tests__/VoiceCallUI.feedback.test.tsx`

- [ ] Add local UI state:
  - `feedbackStatus`
  - `feedbackReason`
  - `feedbackTurnNumber`

- [ ] Open the feedback SSE stream when `sessionId` becomes available.

- [ ] Close the stream on unmount.

- [ ] After saving each message, trigger live evaluation only if the transformed role is `advisor`.

- [ ] Set `feedbackStatus` to `evaluating` while waiting for the SSE event.

- [ ] Update the UI when an SSE `feedback` event arrives.

- [ ] Render compact states only:
  - `idle`
  - `evaluating`
  - `on_track`
  - `off_track`
  - `error`

- [ ] Keep the live feedback area visually separate from:
  - connection state
  - scorecard generation state
  - final call completion state

- [ ] Add tests covering:
  - advisor messages trigger evaluation
  - prospect messages do not trigger evaluation
  - incoming SSE event updates the indicator
  - SSE failure degrades to non-fatal error state

## Task 6: End-Of-Call Scorecard Migration To Gemini

**Files:**
- Modify: `backend/main.py`
- Reuse: `backend/app/services/llm/base.py`
- Reuse: `backend/app/services/llm/gemini.py`
- Test: `backend/tests/test_scorecard_provider.py`

- [ ] Replace the direct Anthropic scorecard call inside `/sessions/{id}/end` with the Gemini provider.

- [ ] Preserve the current scorecard database writes and response shape.

- [ ] Preserve the current JSON normalization behavior where practical:
  - structured parsing
  - invalid model response handling
  - flattened DB insert fields

- [ ] Add regression tests ensuring scorecard generation still returns the expected shape used by the frontend.

## Task 7: Integration Pass

**Files:**
- Modify only as needed:
  - `backend/main.py`
  - `frontend/components/VoiceCallUI.tsx`

- [ ] Wire Task 2 and Task 3 together so the evaluation endpoint publishes onto the SSE stream.

- [ ] Wire Task 4 and Task 5 together so `VoiceCallUI` both subscribes to SSE and triggers evaluation.

- [ ] Confirm the new feedback flow does not break:
  - session creation
  - transcript persistence
  - scorecard generation
  - scorecard page rendering

## Task 8: Verification

**Backend verification**
- [ ] Run backend tests for SSE, feedback, and provider behavior.
- [ ] Run the backend server locally and confirm the feedback stream stays connected.

**Frontend verification**
- [ ] Run frontend tests for `VoiceCallUI` feedback state.
- [ ] Verify the call UI continues to start and end sessions correctly.

**Manual end-to-end checks**
- [ ] Start a new practice call.
- [ ] Speak one advisor turn.
- [ ] Confirm the advisor message is saved.
- [ ] Confirm `feedback/evaluate` is triggered.
- [ ] Confirm an SSE event updates the UI to `on_track` or `off_track`.
- [ ] Continue the call for several turns and confirm the latest feedback replaces the prior signal.
- [ ] End the call and confirm the scorecard still generates and renders.

## Execution Notes

- Keep feedback ephemeral in v1. Do not add new database tables or columns for feedback history.
- Do not add a websocket layer for v1. Use SSE only.
- Do not evaluate prospect turns.
- Do not stream long coaching text. The live indicator is binary with one short reason.
- Prefer moving non-route logic out of `backend/main.py` to reduce merge conflicts across workers.
- If multiple workers are active at once, they should avoid overlapping edits outside the stated merge points.

## Acceptance Criteria

- During an active call, the UI shows a live `on_track` or `off_track` indicator after advisor turns.
- The live indicator is delivered over SSE.
- Feedback is ephemeral and disappears when the session page is closed or the backend restarts.
- The existing transcript persistence flow still works.
- The final scorecard still works, now backed by Gemini instead of Anthropic.
- The new live feedback path does not block or break the voice call when feedback generation fails.
