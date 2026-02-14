# Quick Start Guide

## Database Setup ✓ COMPLETE

The PostgreSQL database has been set up and is ready to use:

- **Database name:** `pitchiq`
- **Tables created:** `sessions`, `messages`, `scorecards`
- **Connection URL:** `postgresql://sumanthramesh@localhost:5432/pitchiq`

## Running the Application

### Terminal 1 - Backend API

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

The backend will start on `http://localhost:8000`

**Available endpoints:**
- `GET /personas` - List available personas
- `POST /sessions` - Create new session
- `POST /sessions/{id}/messages` - Add message
- `POST /sessions/{id}/end` - End session & generate scorecard
- `GET /sessions/{id}` - Fetch session details
- `GET /sessions?user_id={uid}` - List sessions

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

## Testing the Feature

1. Navigate to `http://localhost:3000/session/new`
2. Select a persona (Easy, Medium, or Aggressive)
3. Click "Start Call" to begin voice conversation
4. Speak with the AI persona for several turns
5. Click "End Call"
6. You'll be automatically redirected to the scorecard page
7. View your performance scores and transcript

## Database Verification

Check data in the database:

```bash
# View all sessions
psql pitchiq -c "SELECT id, persona_id, status, started_at FROM sessions ORDER BY started_at DESC LIMIT 5;"

# View messages for a specific session
psql pitchiq -c "SELECT turn_number, role, LEFT(content, 50) as preview FROM messages WHERE session_id = 'SESSION_ID' ORDER BY turn_number;"

# View scorecard for a session
psql pitchiq -c "SELECT overall_score, opener_score, objection_handling_score, meeting_booked FROM scorecards WHERE session_id = 'SESSION_ID';"
```

## Environment Variables

### Backend (`backend/.env`)
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
DATABASE_URL=postgresql://username@localhost:5432/pitchiq
```

### Frontend (`frontend/.env.local`)
Add if not exists:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Troubleshooting

### Backend won't start
- Ensure virtual environment is activated: `source venv/bin/activate`
- Check database is running: `pg_isready`
- Verify .env file exists in backend directory

### Frontend can't connect to backend
- Verify backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in frontend/.env.local

### Database connection errors
- Check PostgreSQL is running: `pg_isready`
- Verify database exists: `psql -l | grep pitchiq`
- Test connection: `psql pitchiq -c "SELECT 1;"`

### Scorecard not generating
- Check backend logs for Claude API errors
- Verify ANTHROPIC_API_KEY is set correctly
- Ensure at least 2 message turns were recorded

## Architecture Flow

```
User starts call
  ↓
Frontend: POST /sessions → Backend creates session in DB
  ↓
User speaks ↔ AI responds (ElevenLabs WebSocket)
  ↓
Frontend: POST /sessions/{id}/messages (for each turn)
  ↓
User ends call
  ↓
Frontend: POST /sessions/{id}/end
  ↓
Backend:
  - Fetches all messages from DB
  - Calls Claude API with scoring prompt
  - Saves scorecard to DB
  - Returns scorecard data
  ↓
Frontend: Navigate to /session/{id}/scorecard
  ↓
Display scorecard + full transcript
```

## Next Steps

- [ ] Test full end-to-end flow with voice call
- [ ] Verify scorecard generation works correctly
- [ ] Check transcript displays properly
- [ ] Test with all three personas (Easy, Medium, Aggressive)

## Support

For detailed setup information, see:
- `SETUP_TRANSCRIPT_SCORING.md` - Complete implementation details
- `CLAUDE.md` - Project guidelines and rules
- `PROJECT.md` - Product requirements
