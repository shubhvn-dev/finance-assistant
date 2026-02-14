# Transcript Processing & Scorecard Generation - Setup Guide

## Overview

This implementation adds:
- Real-time transcript capture during voice calls
- Automatic scorecard generation when calls end
- Session persistence to PostgreSQL database
- Scorecard display page with full transcript

## Prerequisites

1. PostgreSQL database (local or hosted)
2. Python 3.9+ with pip
3. Node.js 18+ with npm

## Setup Instructions

### 1. Database Setup

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb pitchiq

# Run schema
psql pitchiq < backend/schema.sql
```

**Option B: Hosted PostgreSQL (Recommended for Blaxel)**
- Use your DATABASE_URL from Blaxel or other provider
- Run the schema via your database UI or psql:
```bash
psql YOUR_DATABASE_URL < backend/schema.sql
```

### 2. Backend Setup

```bash
cd backend

# Install new dependencies (adds asyncpg)
pip install -r requirements.txt

# Update .env file
cat >> .env << EOF
DATABASE_URL=postgresql://user:password@host:5432/pitchiq
ANTHROPIC_API_KEY=your-key-here
EOF

# Test database connection
python -c "import asyncio; from app.core.database import get_pool; asyncio.run(get_pool())"
```

### 3. Frontend Setup

```bash
cd frontend

# Update .env.local
cat >> .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AGENT_ID_EASY=your-elevenlabs-agent-id
NEXT_PUBLIC_AGENT_ID_MEDIUM=your-elevenlabs-agent-id
NEXT_PUBLIC_AGENT_ID_AGGRESSIVE=your-elevenlabs-agent-id
EOF

# Install dependencies (if needed)
npm install
```

## File Changes Summary

### New Files Created
- `backend/schema.sql` - Database schema
- `backend/app/core/database.py` - Connection pooling
- `backend/app/models/session.py` - Pydantic models
- `frontend/lib/api.ts` - API client functions
- `frontend/components/Scorecard.tsx` - Scorecard display component
- `frontend/app/session/[id]/scorecard/page.tsx` - Scorecard page

### Modified Files
- `backend/requirements.txt` - Added asyncpg
- `backend/main.py` - Added session endpoints + lifespan manager
- `frontend/components/VoiceCallUI.tsx` - Integrated session management
- `frontend/app/session/[id]/page.tsx` - Pass personaId prop
- `.env.example` - Documented new variables

## New API Endpoints

```
POST   /sessions                    - Create session
POST   /sessions/{id}/messages      - Add message (fire-and-forget)
POST   /sessions/{id}/end           - End session + generate scorecard
GET    /sessions/{id}               - Fetch session details
GET    /sessions?user_id={uid}      - List sessions
```

## Testing

### 1. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 2. Manual Test Flow

1. Navigate to `http://localhost:3000/session/new`
2. Select a persona (Easy, Medium, or Aggressive)
3. Click "Start Call"
4. Speak for at least 5 turns with the AI persona
5. Click "End Call"
6. Verify:
   - Page navigates to `/session/{id}/scorecard`
   - Scorecard displays with scores and feedback
   - Transcript appears below scorecard
   - "Practice Again" button works

### 3. Database Verification

```sql
-- Check session was created
SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1;

-- Check messages were saved
SELECT role, turn_number, LEFT(content, 50) as content_preview
FROM messages
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY turn_number;

-- Check scorecard was generated
SELECT overall_score, opener_score, objection_handling_score
FROM scorecards
WHERE session_id = 'YOUR_SESSION_ID';
```

### 4. Sad Path Tests

- **Early disconnect:** End call after 1-2 turns → Should still generate scorecard with "too short" feedback
- **API failure:** Kill backend mid-call → Frontend should show error
- **Invalid URL:** Navigate to `/session/invalid-uuid/scorecard` → Should show 404
- **No scorecard:** Access scorecard page for incomplete session → Should show "not available" message

## Architecture Flow

```
User clicks "Start Call"
  ↓
VoiceCallUI.onConnect()
  ↓
POST /sessions (create session in DB)
  ↓
Store sessionId in state
  ↓
User speaks ↔ AI responds
  ↓
VoiceCallUI.onMessage() (for each turn)
  ↓
Transform role: 'user'→'advisor', 'agent'→'prospect'
  ↓
POST /sessions/{id}/messages (fire-and-forget)
  ↓
User clicks "End Call"
  ↓
VoiceCallUI.onDisconnect()
  ↓
POST /sessions/{id}/end
  ↓
Backend:
  - Fetch all messages from DB
  - Format as transcript
  - Call Claude for scoring
  - Parse nested JSON response
  - Insert scorecard into DB
  - Update session status to 'completed'
  ↓
Frontend: Navigate to /session/{id}/scorecard
  ↓
Scorecard page:
  - GET /sessions/{id}
  - Display scorecard + transcript
```

## Troubleshooting

### "DATABASE_URL environment variable is not set"
- Add DATABASE_URL to backend/.env or root .env file
- Ensure it's in correct PostgreSQL format

### "Failed to create session"
- Check backend logs for database connection errors
- Verify database is running and accessible
- Test connection with: `psql $DATABASE_URL -c "SELECT 1;"`

### "Session not found" on scorecard page
- Verify session was created: Check browser console for session ID
- Query database: `SELECT * FROM sessions WHERE id = 'SESSION_ID';`
- Ensure DATABASE_URL points to correct database

### Scorecard shows wrong scores
- Check backend logs for Claude API errors
- Verify scoring prompt format matches expected JSON structure
- Query: `SELECT * FROM scorecards WHERE session_id = 'SESSION_ID';`

### Messages not saving
- Check browser console for addMessage() errors
- Verify CORS is enabled on backend
- Check backend logs for database errors

## Linting & Type Checking

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck

# Backend (if configured)
cd backend
ruff check .
```

## Next Steps (Not in v1)

- [ ] Add user authentication (replace 'temp-user-001')
- [ ] Session resume feature (detect in-progress sessions)
- [ ] Real-time transcript display during call
- [ ] Export scorecard as PDF
- [ ] Session history dashboard
- [ ] Scorecard comparison view
- [ ] Error tracking (Sentry integration)
- [ ] Toast notifications (react-hot-toast)

## Known Limitations (v1)

1. **Refresh loses state:** If user refreshes during call, WebSocket disconnects and session is orphaned in DB
2. **No auth:** All sessions use hardcoded user_id 'temp-user-001'
3. **Fire-and-forget messages:** If addMessage() fails, transcript may be incomplete (silent failure)
4. **Client-side routing:** Scorecard navigation uses client router (not SSR-safe for deep links during generation)

## Support

If you encounter issues:
1. Check browser console for frontend errors
2. Check backend logs for API errors
3. Query database to verify data persistence
4. Review this guide's troubleshooting section
