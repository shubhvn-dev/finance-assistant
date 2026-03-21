# Transcript Scoring Setup

This repo already contains the transcript + scorecard flow. The setup work is just environment configuration, Postgres schema creation, and starting the backend and frontend.

## What is required

- Python 3.10+
- Node.js 18+
- PostgreSQL
- Anthropic API key for scorecard generation
- ElevenLabs persona agent IDs for the three call personas

## Environment Variables

Put backend variables in the root `.env` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/pitchiq
```

Put frontend variables in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AGENT_ID_EASY=your_elevenlabs_agent_id
NEXT_PUBLIC_AGENT_ID_MEDIUM=your_elevenlabs_agent_id
NEXT_PUBLIC_AGENT_ID_AGGRESSIVE=your_elevenlabs_agent_id
```

## Database Setup

Create the schema once against the database in `DATABASE_URL`:

```bash
psql "$DATABASE_URL" < backend/schema.sql
```

The schema creates the `sessions`, `messages`, and `scorecards` tables used by transcript scoring.

## Install Dependencies

```bash
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

## Run The App

```bash
cd backend
uvicorn main:app --reload
```

```bash
cd frontend
npm run dev
```

## Transcript Scoring Flow

1. The frontend starts a session with `POST /sessions`.
2. `VoiceCallUI` saves each turn to `POST /sessions/{id}/messages`.
3. When the call ends, `POST /sessions/{id}/end` loads all stored messages, formats the transcript, calls Claude, and writes the scorecard row.
4. The frontend then navigates to `/session/{id}/scorecard`, which reads the completed session details from `GET /sessions/{id}`.

The scoring prompt expects raw JSON with the fields defined in `backend/prompts.py`, and the backend flattens those values into the `scorecards` table.

## Quick Verification

```bash
psql "$DATABASE_URL" -c "SELECT id, persona_id, status FROM sessions ORDER BY started_at DESC LIMIT 5;"
psql "$DATABASE_URL" -c "SELECT session_id, overall_score, meeting_booked FROM scorecards ORDER BY generated_at DESC LIMIT 5;"
```

## Troubleshooting

- If the backend fails at startup, check `ANTHROPIC_API_KEY` and `DATABASE_URL`.
- If the frontend call UI stays in placeholder mode, check the three `NEXT_PUBLIC_AGENT_ID_*` values.
- If scorecard generation fails, confirm that the session has transcript rows in `messages`.

## Relevant Files

- `backend/main.py`
- `backend/prompts.py`
- `backend/schema.sql`
- `frontend/components/VoiceCallUI.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/personas.ts`
- `frontend/app/session/[id]/scorecard/page.tsx`
