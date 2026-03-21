import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import google.generativeai as genai

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
from prompts import get_persona_prompt, SIGNAL_EXTRACTION_PROMPT, SCORING_PROMPT

load_dotenv()

# ── AI configuration ──────────────────────────────────────────────────────────
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
CURRENT_PROMPT_VERSION = "v2.0"

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini = genai.GenerativeModel(model_name=GEMINI_MODEL)


# ── Two-stage scoring pipeline ────────────────────────────────────────────────
def generate_scorecard(transcript_text: str, persona: dict) -> dict:
    """Stage 1: extract behavioral signals. Stage 2: persona-aware scoring."""
    persona_description = (
        f"{persona['name']} — {persona['age']}-year-old {persona['occupation']}, "
        f"{persona['portfolio_value']} portfolio at {persona['current_provider']}"
    )

    # Stage 1 — signal extraction
    try:
        signal_response = gemini.generate_content(
            SIGNAL_EXTRACTION_PROMPT.format(transcript=transcript_text),
            generation_config=genai.GenerationConfig(response_mime_type="application/json"),
        )
        signals = json.loads(signal_response.text)
    except Exception as e:
        print(f"[WARN] Signal extraction failed: {e}. Proceeding with empty signals.")
        signals = {}

    # Stage 2 — persona-aware scoring
    score_prompt = SCORING_PROMPT.format(
        persona_description=persona_description,
        difficulty=persona["difficulty"],
        main_objection=persona["main_objection"],
        scoring_weights=json.dumps(persona.get("scoring_weights", {})),
        signals=json.dumps(signals, indent=2),
        transcript=transcript_text,
    )
    score_response = gemini.generate_content(
        score_prompt,
        generation_config=genai.GenerationConfig(response_mime_type="application/json"),
    )

    raw = score_response.text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:])
        raw = raw.rsplit("```", 1)[0].strip()

    scorecard = json.loads(raw)
    scorecard["signals"] = signals
    scorecard["prompt_version"] = CURRENT_PROMPT_VERSION
    scorecard["model_version"] = GEMINI_MODEL
    return scorecard


# ── App setup ─────────────────────────────────────────────────────────────────
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
        role = "user" if entry["role"] == "advisor" else "model"
        messages.append({"role": role, "parts": [entry["content"]]})

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_prompt,
    )
    response = model.generate_content(messages)

    return {
        "persona_id": req.persona_id,
        "turn_number": req.turn_number,
        "response": response.text,
    }


@app.post("/score")
def score(req: ScoreRequest):
    """Legacy scoring endpoint — uses the two-stage pipeline."""
    persona = PERSONAS.get(req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{req.persona_id}' not found")

    transcript_text = ""
    for entry in req.transcript:
        label = "Advisor" if entry["role"] == "advisor" else persona["name"]
        transcript_text += f"{label}: {entry['content']}\n"

    try:
        scorecard = generate_scorecard(transcript_text, persona)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse scorecard JSON: {str(e)}")

    return {"persona_id": req.persona_id, "user_id": req.user_id, "scorecard": scorecard}


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
            RETURNING id, user_id, persona_id, conversation_id, started_at, ended_at, status
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
            ended_at=row["ended_at"],
            status=row["status"],
        )


@app.post("/sessions/{session_id}/messages")
async def add_message(session_id: str, req: MessageRequest):
    """Add a message to a session (fire-and-forget from frontend)."""
    if req.role not in ["advisor", "prospect"]:
        raise HTTPException(status_code=400, detail="Role must be 'advisor' or 'prospect'")

    async with get_db_connection() as conn:
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
    """Mark a session as ended. Scorecard is generated client-side via streaming."""
    async with get_db_connection() as conn:
        session_row = await conn.fetchrow(
            "SELECT id, status FROM sessions WHERE id = $1",
            session_id,
        )

        if not session_row:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        if session_row["status"] == "completed":
            raise HTTPException(status_code=409, detail="Session has already been completed")

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
        )


@app.post("/sessions/{session_id}/scorecard")
async def save_scorecard(session_id: str, scorecard: ScorecardData):
    """Save a pre-generated scorecard (called after client-side streaming completes)."""
    async with get_db_connection() as conn:
        session_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)",
            session_id,
        )
        if not session_exists:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

        await conn.execute(
            """
            INSERT INTO scorecards (
                session_id, overall_score,
                opener_score, opener_feedback,
                objection_handling_score, objection_handling_feedback,
                tone_confidence_score, tone_confidence_feedback,
                close_attempt_score, close_attempt_feedback,
                best_moment, biggest_mistake, what_to_say_instead,
                meeting_booked, annotations, signals,
                prompt_version, model_version, generated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
            ON CONFLICT (session_id) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                opener_score = EXCLUDED.opener_score,
                opener_feedback = EXCLUDED.opener_feedback,
                objection_handling_score = EXCLUDED.objection_handling_score,
                objection_handling_feedback = EXCLUDED.objection_handling_feedback,
                tone_confidence_score = EXCLUDED.tone_confidence_score,
                tone_confidence_feedback = EXCLUDED.tone_confidence_feedback,
                close_attempt_score = EXCLUDED.close_attempt_score,
                close_attempt_feedback = EXCLUDED.close_attempt_feedback,
                best_moment = EXCLUDED.best_moment,
                biggest_mistake = EXCLUDED.biggest_mistake,
                what_to_say_instead = EXCLUDED.what_to_say_instead,
                meeting_booked = EXCLUDED.meeting_booked,
                annotations = EXCLUDED.annotations,
                signals = EXCLUDED.signals,
                prompt_version = EXCLUDED.prompt_version,
                model_version = EXCLUDED.model_version,
                generated_at = NOW()
            """,
            session_id,
            scorecard.overall_score,
            scorecard.opener_score,
            scorecard.opener_feedback,
            scorecard.objection_handling_score,
            scorecard.objection_handling_feedback,
            scorecard.tone_confidence_score,
            scorecard.tone_confidence_feedback,
            scorecard.close_attempt_score,
            scorecard.close_attempt_feedback,
            scorecard.best_moment,
            scorecard.biggest_mistake,
            scorecard.what_to_say_instead,
            scorecard.meeting_booked,
            json.dumps(scorecard.annotations) if scorecard.annotations else None,
            json.dumps(scorecard.signals) if scorecard.signals else None,
            scorecard.prompt_version or CURRENT_PROMPT_VERSION,
            scorecard.model_version or GEMINI_MODEL,
        )

    return {"status": "ok"}


@app.get("/sessions/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """Fetch full session details including messages and scorecard."""
    async with get_db_connection() as conn:
        session_row = await conn.fetchrow(
            "SELECT id, user_id, persona_id, conversation_id, started_at, status FROM sessions WHERE id = $1",
            session_id,
        )

        if not session_row:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

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

        scorecard_row = await conn.fetchrow(
            """
            SELECT overall_score,
                   opener_score, opener_feedback,
                   objection_handling_score, objection_handling_feedback,
                   tone_confidence_score, tone_confidence_feedback,
                   close_attempt_score, close_attempt_feedback,
                   best_moment, biggest_mistake, what_to_say_instead,
                   meeting_booked, annotations, signals, prompt_version, model_version
            FROM scorecards
            WHERE session_id = $1
            """,
            session_id,
        )

        scorecard = None
        if scorecard_row:
            def parse_json_col(val):
                if isinstance(val, str):
                    return json.loads(val)
                return val or None

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
                annotations=parse_json_col(scorecard_row["annotations"]),
                signals=parse_json_col(scorecard_row["signals"]),
                prompt_version=scorecard_row["prompt_version"],
                model_version=scorecard_row["model_version"],
            )

        return SessionDetail(
            session=SessionResponse(
                id=str(session_row["id"]),
                user_id=session_row["user_id"],
                persona_id=session_row["persona_id"],
                conversation_id=session_row["conversation_id"],
                started_at=session_row["started_at"],
                ended_at=session_row["ended_at"],
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
