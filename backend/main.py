import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import anthropic

from personas import PERSONAS
from prompts import get_persona_prompt, SCORING_PROMPT

load_dotenv()

app = FastAPI(title="PitchIQ Backend")

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

    raw = response.content[0].text

    try:
        scorecard = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse scorecard JSON from Claude")

    return {
        "persona_id": req.persona_id,
        "user_id": req.user_id,
        "scorecard": scorecard,
    }
