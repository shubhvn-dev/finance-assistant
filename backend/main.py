import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import anthropic

from app.core.database import get_pool, close_pool, get_db_connection
from app.models.session import (
    CreateSessionRequest,
    SessionResponse,
    MessageRequest,
    ScorecardData,
    EndSessionResponse,
    Message,
    SessionDetail,
)
from personas import PERSONAS
from prompts import get_persona_prompt, SCORING_PROMPT

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database connection lifecycle."""
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="PitchIQ Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class RespondRequest(BaseModel):
    persona_id: str
    turn_number: int
    conversation_history: list[dict]


class ScoreRequest(BaseModel):
    persona_id: str
    user_id: str
    transcript: list[dict]


@app.get("/personas")
def get_personas():
    return {
        pid: {
            "name": p["name"],
            "age": p["age"],
            "occupation": p["occupation"],
            "portfolio_value": p["portfolio_value"],
            "current_provider": p["current_provider"],
            "difficulty": p["difficulty"],
            "voice_id": p["voice_id"],
            "main_objection": p["main_objection"],
        }
        for pid, p in PERSONAS.items()
    }


@app.post("/respond")
def respond(req: RespondRequest):
    persona = PERSONAS.get(req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{req.persona_id}' not found")

    system_prompt = get_persona_prompt(persona)

    messages = []
    for entry in req.conversation_history:
        role = "user" if entry["role"] == "advisor" else "assistant"
        messages.append({"role": role, "content": entry["content"]})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        system=system_prompt,
        messages=messages,
    )

    reply = response.content[0].text

    return {
        "persona_id": req.persona_id,
        "turn_number": req.turn_number,
        "response": reply,
    }


@app.post("/score")
def score(req: ScoreRequest):
    persona = PERSONAS.get(req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{req.persona_id}' not found")

    transcript_text = ""
    for entry in req.transcript:
        label = "Advisor" if entry["role"] == "advisor" else persona["name"]
        transcript_text += f"{label}: {entry['content']}\n"

    scoring_message = f"""Prospect persona: {persona['name']} — {persona['age']}-year-old {persona['occupation']}, {persona['portfolio_value']} portfolio at {persona['current_provider']}, difficulty: {persona['difficulty']}.

Transcript:
{transcript_text}

Score this call now."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SCORING_PROMPT,
        messages=[{"role": "user", "content": scoring_message}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0].strip()

    try:
        scorecard = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse scorecard JSON from Claude")

    return {
        "persona_id": req.persona_id,
        "user_id": req.user_id,
        "scorecard": scorecard,
    }


@app.post("/sessions", response_model=SessionResponse)
async def create_session(req: CreateSessionRequest):
    """Create a new session when a voice call starts."""
    if req.persona_id not in PERSONAS:
        raise HTTPException(status_code=404, detail=f"Persona '{req.persona_id}' not found")

    async with get_db_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO sessions (user_id, persona_id, conversation_id, started_at, status)
            VALUES ($1, $2, $3, NOW(), 'in_progress')
            RETURNING id, user_id, persona_id, conversation_id, started_at, status
            """,
            req.user_id,
            req.persona_id,
            req.conversation_id,
        )

        return SessionResponse(
            id=str(row["id"]),
            user_id=row["user_id"],
            persona_id=row["persona_id"],
            conversation_id=row["conversation_id"],
            started_at=row["started_at"],
            status=row["status"],
        )


@app.post("/sessions/{session_id}/messages")
async def add_message(session_id: str, req: MessageRequest):
    """Add a message to a session (fire-and-forget from frontend)."""
    if req.role not in ["advisor", "prospect"]:
        raise HTTPException(status_code=400, detail="Role must be 'advisor' or 'prospect'")

    async with get_db_connection() as conn:
        # Verify session exists
        session_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)",
            session_id,
        )

        if not session_exists:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        await conn.execute(
            """
            INSERT INTO messages (session_id, role, content, turn_number, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            """,
            session_id,
            req.role,
            req.content,
            req.turn_number,
        )

    return {"status": "ok"}


@app.post("/sessions/{session_id}/end", response_model=EndSessionResponse)
async def end_session(session_id: str):
    """End a session and generate scorecard."""
    async with get_db_connection() as conn:
        # Fetch session
        session_row = await conn.fetchrow(
            "SELECT id, user_id, persona_id, started_at, status FROM sessions WHERE id = $1",
            session_id,
        )

        if not session_row:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        persona_id = session_row["persona_id"]
        persona = PERSONAS.get(persona_id)

        if not persona:
            raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found")

        # Fetch all messages ordered by turn_number
        message_rows = await conn.fetch(
            """
            SELECT role, content, turn_number
            FROM messages
            WHERE session_id = $1
            ORDER BY turn_number ASC
            """,
            session_id,
        )

        # Format transcript
        transcript_text = ""
        for msg in message_rows:
            label = "Advisor" if msg["role"] == "advisor" else persona["name"]
            transcript_text += f"{label}: {msg['content']}\n"

        # Generate scorecard using Claude
        scoring_message = f"""Prospect persona: {persona['name']} — {persona['age']}-year-old {persona['occupation']}, {persona['portfolio_value']} portfolio at {persona['current_provider']}, difficulty: {persona['difficulty']}.

Transcript:
{transcript_text}

Score this call now."""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SCORING_PROMPT,
            messages=[{"role": "user", "content": scoring_message}],
        )

        raw = response.content[0].text.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            # Handle both ```json and ``` formats
            lines = raw.split("\n")
            raw = "\n".join(lines[1:])  # Remove first line with ```
            raw = raw.rsplit("```", 1)[0].strip()

        try:
            scorecard_json = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse Claude response. Raw content (first 500 chars):")
            print(raw[:500])
            print(f"[ERROR] JSON decode error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse scorecard JSON from Claude. Error: {str(e)}"
            )

        # Extract nested scores and flatten for database
        overall_score = scorecard_json.get("overall_score", 0)
        opener = scorecard_json.get("opener", {})
        objection_handling = scorecard_json.get("objection_handling", {})
        tone_and_confidence = scorecard_json.get("tone_and_confidence", {})
        close_attempt = scorecard_json.get("close_attempt", {})

        # Insert scorecard
        await conn.execute(
            """
            INSERT INTO scorecards (
                session_id, overall_score,
                opener_score, opener_feedback,
                objection_handling_score, objection_handling_feedback,
                tone_confidence_score, tone_confidence_feedback,
                close_attempt_score, close_attempt_feedback,
                best_moment, biggest_mistake, what_to_say_instead,
                meeting_booked, generated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            """,
            session_id,
            overall_score,
            opener.get("score", 0),
            opener.get("feedback", ""),
            objection_handling.get("score", 0),
            objection_handling.get("feedback", ""),
            tone_and_confidence.get("score", 0),
            tone_and_confidence.get("feedback", ""),
            close_attempt.get("score", 0),
            close_attempt.get("feedback", ""),
            scorecard_json.get("best_moment", ""),
            scorecard_json.get("biggest_mistake", ""),
            scorecard_json.get("what_to_say_instead", ""),
            scorecard_json.get("meeting_booked", False),
        )

        # Update session status
        ended_at = datetime.now()
        await conn.execute(
            "UPDATE sessions SET status = 'completed', ended_at = $1 WHERE id = $2",
            ended_at,
            session_id,
        )

        return EndSessionResponse(
            session_id=str(session_id),
            status="completed",
            ended_at=ended_at,
            scorecard=ScorecardData(
                overall_score=overall_score,
                opener_score=opener.get("score", 0),
                opener_feedback=opener.get("feedback", ""),
                objection_handling_score=objection_handling.get("score", 0),
                objection_handling_feedback=objection_handling.get("feedback", ""),
                tone_confidence_score=tone_and_confidence.get("score", 0),
                tone_confidence_feedback=tone_and_confidence.get("feedback", ""),
                close_attempt_score=close_attempt.get("score", 0),
                close_attempt_feedback=close_attempt.get("feedback", ""),
                best_moment=scorecard_json.get("best_moment", ""),
                biggest_mistake=scorecard_json.get("biggest_mistake", ""),
                what_to_say_instead=scorecard_json.get("what_to_say_instead", ""),
                meeting_booked=scorecard_json.get("meeting_booked", False),
            ),
        )


@app.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Fetch full session details including messages and scorecard."""
    async with get_db_connection() as conn:
        # Fetch session
        session_row = await conn.fetchrow(
            "SELECT id, user_id, persona_id, conversation_id, started_at, status FROM sessions WHERE id = $1",
            session_id,
        )

        if not session_row:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        # Fetch messages
        message_rows = await conn.fetch(
            """
            SELECT id, session_id, role, content, turn_number, created_at
            FROM messages
            WHERE session_id = $1
            ORDER BY turn_number ASC
            """,
            session_id,
        )

        messages = [
            Message(
                id=str(row["id"]),
                session_id=str(row["session_id"]),
                role=row["role"],
                content=row["content"],
                turn_number=row["turn_number"],
                created_at=row["created_at"],
            )
            for row in message_rows
        ]

        # Fetch scorecard if exists
        scorecard_row = await conn.fetchrow(
            """
            SELECT overall_score,
                   opener_score, opener_feedback,
                   objection_handling_score, objection_handling_feedback,
                   tone_confidence_score, tone_confidence_feedback,
                   close_attempt_score, close_attempt_feedback,
                   best_moment, biggest_mistake, what_to_say_instead,
                   meeting_booked
            FROM scorecards
            WHERE session_id = $1
            """,
            session_id,
        )

        scorecard = None
        if scorecard_row:
            scorecard = ScorecardData(
                overall_score=scorecard_row["overall_score"],
                opener_score=scorecard_row["opener_score"],
                opener_feedback=scorecard_row["opener_feedback"],
                objection_handling_score=scorecard_row["objection_handling_score"],
                objection_handling_feedback=scorecard_row["objection_handling_feedback"],
                tone_confidence_score=scorecard_row["tone_confidence_score"],
                tone_confidence_feedback=scorecard_row["tone_confidence_feedback"],
                close_attempt_score=scorecard_row["close_attempt_score"],
                close_attempt_feedback=scorecard_row["close_attempt_feedback"],
                best_moment=scorecard_row["best_moment"],
                biggest_mistake=scorecard_row["biggest_mistake"],
                what_to_say_instead=scorecard_row["what_to_say_instead"],
                meeting_booked=scorecard_row["meeting_booked"],
            )

        return SessionDetail(
            session=SessionResponse(
                id=str(session_row["id"]),
                user_id=session_row["user_id"],
                persona_id=session_row["persona_id"],
                conversation_id=session_row["conversation_id"],
                started_at=session_row["started_at"],
                status=session_row["status"],
            ),
            messages=messages,
            scorecard=scorecard,
        )


@app.get("/sessions")
async def list_sessions(user_id: Optional[str] = None):
    """List sessions, optionally filtered by user_id."""
    async with get_db_connection() as conn:
        if user_id:
            rows = await conn.fetch(
                """
                SELECT id, user_id, persona_id, conversation_id, started_at, ended_at, status
                FROM sessions
                WHERE user_id = $1
                ORDER BY started_at DESC
                """,
                user_id,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, user_id, persona_id, conversation_id, started_at, ended_at, status
                FROM sessions
                ORDER BY started_at DESC
                """
            )

        return [
            {
                "id": str(row["id"]),
                "user_id": row["user_id"],
                "persona_id": row["persona_id"],
                "conversation_id": row["conversation_id"],
                "started_at": row["started_at"],
                "ended_at": row["ended_at"],
                "status": row["status"],
            }
            for row in rows
        ]
