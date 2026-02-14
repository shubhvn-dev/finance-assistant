from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    user_id: str
    persona_id: str
    conversation_id: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    persona_id: str
    conversation_id: Optional[str]
    started_at: datetime
    status: str


class MessageRequest(BaseModel):
    role: str  # 'advisor' or 'prospect'
    content: str
    turn_number: int


class ScorecardData(BaseModel):
    overall_score: int
    opener_score: int
    opener_feedback: str
    objection_handling_score: int
    objection_handling_feedback: str
    tone_confidence_score: int
    tone_confidence_feedback: str
    close_attempt_score: int
    close_attempt_feedback: str
    best_moment: str
    biggest_mistake: str
    what_to_say_instead: str
    meeting_booked: bool


class EndSessionResponse(BaseModel):
    session_id: str
    status: str
    ended_at: datetime
    scorecard: ScorecardData


class Message(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    turn_number: int
    created_at: datetime


class SessionDetail(BaseModel):
    session: SessionResponse
    messages: list[Message]
    scorecard: Optional[ScorecardData]
