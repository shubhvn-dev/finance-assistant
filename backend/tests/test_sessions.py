import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ANTHROPIC_API_KEY", "test")

import main as backend_main


class FakeResponse:
    def __init__(self, text: str):
        self.content = [SimpleNamespace(text=text)]


class FakeAnthropicMessages:
    def __init__(self, text: str):
        self._text = text

    def create(self, **kwargs):
        return FakeResponse(self._text)


class FakeAnthropicClient:
    def __init__(self, text: str):
        self.messages = FakeAnthropicMessages(text)


class FakeConnection:
    def __init__(
        self,
        *,
        session_row=None,
        scorecard_row=None,
        message_rows=None,
        sessions_rows=None,
    ):
        self.session_row = session_row
        self.scorecard_row = scorecard_row
        self.message_rows = message_rows or []
        self.sessions_rows = sessions_rows or []
        self.executed = []

    async def fetchrow(self, query, *args):
        if "INSERT INTO sessions" in query:
            return self.session_row
        if "FROM sessions WHERE id = $1" in query:
            return self.session_row
        if "FROM scorecards" in query:
            return self.scorecard_row
        return None

    async def fetch(self, query, *args):
        if "FROM messages" in query:
            return self.message_rows
        if "FROM sessions" in query:
            return self.sessions_rows
        return []

    async def execute(self, query, *args):
        self.executed.append((query, args))
        return "OK"

    async def fetchval(self, query, *args):
        return True


def install_test_client(monkeypatch, connection, *, raise_server_exceptions=True):
    monkeypatch.setattr(backend_main, "client", FakeAnthropicClient(TEST_SCORECARD_JSON))
    monkeypatch.setattr(backend_main, "get_pool", lambda: None)
    monkeypatch.setattr(backend_main, "close_pool", lambda: None)
    monkeypatch.setattr(
        backend_main,
        "generate_scorecard",
        lambda *, scoring_prompt, system_prompt: json.loads(TEST_SCORECARD_JSON),
        raising=False,
    )
    monkeypatch.setattr(
        backend_main,
        "build_fallback_scorecard",
        lambda: {
            "overall_score": 0,
            "opener": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "objection_handling": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "tone_and_confidence": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "close_attempt": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "discovery": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "best_moment": "Automatic AI scoring was unavailable for this call.",
            "biggest_mistake": "Automatic AI scoring was unavailable for this call.",
            "what_to_say_instead": "Retry scorecard generation after configuring a supported LLM provider.",
            "meeting_booked": False,
            "annotations": [],
        },
        raising=False,
    )

    @asynccontextmanager
    async def fake_get_db_connection():
        yield connection

    monkeypatch.setattr(backend_main, "get_db_connection", fake_get_db_connection)

    return TestClient(
        backend_main.app,
        raise_server_exceptions=raise_server_exceptions,
    )


TEST_SCORECARD_JSON = json.dumps(
    {
        "overall_score": 8,
        "opener": {"score": 7, "feedback": "Good opener."},
        "objection_handling": {"score": 8, "feedback": "Handled well."},
        "tone_and_confidence": {"score": 9, "feedback": "Confident."},
        "close_attempt": {"score": 6, "feedback": "Ask for next step earlier."},
        "discovery": {"score": 9, "feedback": "Great discovery questions."},
        "best_moment": "Asked for a follow-up.",
        "biggest_mistake": "Could have closed sooner.",
        "what_to_say_instead": "Can we schedule 15 minutes next week?",
        "meeting_booked": True,
        "annotations": [
            {
                "turn_number": 1,
                "type": "bad",
                "label": "Weak opener",
                "insight": "The opener was too generic.",
                "rewrite": "I work with families reviewing concentrated positions like yours.",
            }
        ],
    }
)


def test_end_session_persists_scorecard_and_marks_completed(monkeypatch):
    session_id = "11111111-1111-1111-1111-111111111111"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "started_at": datetime(2026, 3, 21, tzinfo=timezone.utc),
            "status": "in_progress",
        },
        message_rows=[
            {
                "role": "advisor",
                "content": "Hi, I wanted to reach out.",
                "turn_number": 1,
            },
            {
                "role": "prospect",
                "content": "Tell me more.",
                "turn_number": 2,
            },
        ],
    )
    client = install_test_client(monkeypatch, connection)

    response = client.post(f"/sessions/{session_id}/end")

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["status"] == "completed"
    assert body["scorecard"]["overall_score"] == 8
    assert body["scorecard"]["discovery_score"] == 9
    assert body["scorecard"]["annotations"] == [
        {
            "turn_number": 1,
            "type": "bad",
            "label": "Weak opener",
            "insight": "The opener was too generic.",
            "rewrite": "I work with families reviewing concentrated positions like yours.",
        }
    ]
    insert_query, insert_args = next(
        (query, args) for query, args in connection.executed if "INSERT INTO scorecards" in query
    )
    assert "annotations" in insert_query
    assert "discovery_score" in insert_query
    assert json.loads(insert_args[-1]) == body["scorecard"]["annotations"]
    assert any("INSERT INTO scorecards" in query for query, _ in connection.executed)
    assert any("UPDATE sessions SET status = 'completed'" in query for query, _ in connection.executed)


def test_end_session_sends_discovery_score_in_prompt(monkeypatch):
    session_id = "aaaaaaa1-1111-1111-1111-111111111111"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "started_at": datetime(2026, 3, 21, tzinfo=timezone.utc),
            "status": "in_progress",
        },
        message_rows=[
            {
                "role": "advisor",
                "content": "Hi, I wanted to reach out.",
                "turn_number": 1,
            },
        ],
    )
    client = install_test_client(monkeypatch, connection)

    response = client.post(f"/sessions/{session_id}/end")

    assert response.status_code == 200
    assert "discovery" in backend_main.SCORING_PROMPT.lower()
    assert "annotations" in backend_main.SCORING_PROMPT.lower()


def test_end_session_uses_provider_wrapper_for_scorecard_generation(monkeypatch):
    session_id = "55555555-5555-5555-5555-555555555555"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "started_at": datetime(2026, 3, 21, tzinfo=timezone.utc),
            "status": "in_progress",
        },
        message_rows=[
            {
                "role": "advisor",
                "content": "Hi, I wanted to reach out.",
                "turn_number": 1,
            },
            {
                "role": "prospect",
                "content": "Tell me more.",
                "turn_number": 2,
            },
        ],
    )
    client = install_test_client(monkeypatch, connection)

    monkeypatch.setattr(
        backend_main.client.messages,
        "create",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("Anthropic should not be called")),
    )

    monkeypatch.setattr(
        backend_main,
        "generate_scorecard",
        lambda *, scoring_prompt, system_prompt: json.loads(TEST_SCORECARD_JSON),
        raising=False,
    )

    response = client.post(f"/sessions/{session_id}/end")

    assert response.status_code == 200
    assert response.json()["scorecard"]["overall_score"] == 8


def test_end_session_rejects_already_completed_session(monkeypatch):
    session_id = "22222222-2222-2222-2222-222222222222"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "started_at": datetime(2026, 3, 21, tzinfo=timezone.utc),
            "status": "completed",
        },
        message_rows=[],
    )
    client = install_test_client(monkeypatch, connection)

    response = client.post(f"/sessions/{session_id}/end")

    assert response.status_code == 409


def test_end_session_generates_fallback_scorecard_when_scoring_fails(monkeypatch):
    session_id = "44444444-4444-4444-4444-444444444444"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "started_at": datetime(2026, 3, 21, tzinfo=timezone.utc),
            "status": "in_progress",
        },
        message_rows=[
            {
                "role": "advisor",
                "content": "Hi, I wanted to reach out.",
                "turn_number": 1,
            }
        ],
    )
    client = install_test_client(
        monkeypatch,
        connection,
        raise_server_exceptions=False,
    )

    monkeypatch.setattr(
        backend_main,
        "generate_scorecard",
        lambda *, scoring_prompt, system_prompt: (_ for _ in ()).throw(
            backend_main.LLMProviderError("Gemini unavailable")
        ),
        raising=False,
    )
    monkeypatch.setattr(
        backend_main,
        "build_fallback_scorecard",
        lambda: {
            "overall_score": 0,
            "opener": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "objection_handling": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "tone_and_confidence": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "close_attempt": {"score": 0, "feedback": "Automatic AI scoring was unavailable for this call."},
            "best_moment": "Automatic AI scoring was unavailable for this call.",
            "biggest_mistake": "Automatic AI scoring was unavailable for this call.",
            "what_to_say_instead": "Retry scorecard generation after configuring a supported LLM provider.",
            "meeting_booked": False,
            "annotations": [],
        },
        raising=False,
    )

    response = client.post(
        f"/sessions/{session_id}/end",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["status"] == "completed"
    assert body["scorecard"]["overall_score"] == 0
    assert body["scorecard"]["best_moment"] == "Automatic AI scoring was unavailable for this call."
    assert body["scorecard"]["annotations"] == []
    assert any("INSERT INTO scorecards" in query for query, _ in connection.executed)
    assert any("UPDATE sessions SET status = 'completed'" in query for query, _ in connection.executed)
    assert response.headers["access-control-allow-origin"] == "*"


def test_get_session_includes_ended_at(monkeypatch):
    class ProjectionConnection(FakeConnection):
        async def fetchrow(self, query, *args):
            row = await super().fetchrow(query, *args)
            if row and "FROM sessions WHERE id = $1" in query and "ended_at" not in query:
                projected_row = dict(row)
                projected_row.pop("ended_at", None)
                return projected_row
            return row

    session_id = "33333333-3333-3333-3333-333333333333"
    ended_at = datetime(2026, 3, 21, 16, 30, tzinfo=timezone.utc)
    connection = ProjectionConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "conversation_id": "conv-1",
            "started_at": datetime(2026, 3, 21, 15, 0, tzinfo=timezone.utc),
            "ended_at": ended_at,
            "status": "completed",
        },
        scorecard_row={
            "overall_score": 8,
            "opener_score": 7,
            "opener_feedback": "Good opener.",
            "objection_handling_score": 8,
            "objection_handling_feedback": "Handled well.",
            "tone_confidence_score": 9,
            "tone_confidence_feedback": "Confident.",
            "close_attempt_score": 6,
            "close_attempt_feedback": "Ask for next step earlier.",
            "discovery_score": 9,
            "discovery_feedback": "Great discovery questions.",
            "best_moment": "Asked for a follow-up.",
            "biggest_mistake": "Could have closed sooner.",
            "what_to_say_instead": "Can we schedule 15 minutes next week?",
            "meeting_booked": True,
            "annotations": json.dumps(
                [
                    {
                        "turn_number": 1,
                        "type": "good",
                        "label": "Strong opener",
                        "insight": "The call started with a clear value statement.",
                    }
                ]
            ),
        },
    )
    client = install_test_client(monkeypatch, connection)

    response = client.get(f"/sessions/{session_id}")

    assert response.status_code == 200
    body = response.json()
    assert datetime.fromisoformat(body["session"]["ended_at"].replace("Z", "+00:00")) == ended_at
    assert body["scorecard"]["discovery_score"] == 9
    assert body["scorecard"]["annotations"] == [
        {
            "turn_number": 1,
            "type": "good",
            "label": "Strong opener",
            "insight": "The call started with a clear value statement.",
            "rewrite": None,
        }
    ]


def test_get_session_normalizes_annotations_from_native_json(monkeypatch):
    session_id = "66666666-6666-6666-6666-666666666666"
    connection = FakeConnection(
        session_row={
            "id": session_id,
            "user_id": "temp-user-001",
            "persona_id": "robert",
            "conversation_id": "conv-2",
            "started_at": datetime(2026, 3, 21, 15, 0, tzinfo=timezone.utc),
            "ended_at": datetime(2026, 3, 21, 16, 30, tzinfo=timezone.utc),
            "status": "completed",
        },
        scorecard_row={
            "overall_score": 7,
            "opener_score": 7,
            "opener_feedback": "Good opener.",
            "objection_handling_score": 8,
            "objection_handling_feedback": "Handled well.",
            "tone_confidence_score": 9,
            "tone_confidence_feedback": "Confident.",
            "close_attempt_score": 6,
            "close_attempt_feedback": "Ask for next step earlier.",
            "discovery_score": 8,
            "discovery_feedback": "Strong discovery.",
            "best_moment": "Asked for a follow-up.",
            "biggest_mistake": "Could have closed sooner.",
            "what_to_say_instead": "Can we schedule 15 minutes next week?",
            "meeting_booked": False,
            "annotations": [
                {
                    "turn_number": 2,
                    "type": "bad",
                    "label": "Missed discovery",
                    "insight": "You moved too quickly to your product pitch.",
                    "rewrite": "Before pitching, ask what they are hoping to improve.",
                }
            ],
        },
    )
    client = install_test_client(monkeypatch, connection)

    response = client.get(f"/sessions/{session_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["scorecard"]["discovery_score"] == 8
    assert body["scorecard"]["annotations"] == [
        {
            "turn_number": 2,
            "type": "bad",
            "label": "Missed discovery",
            "insight": "You moved too quickly to your product pitch.",
            "rewrite": "Before pitching, ask what they are hoping to improve.",
        }
    ]
