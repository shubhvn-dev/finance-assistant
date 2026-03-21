import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.llm import (
    LLMProviderError,
    build_fallback_scorecard,
    generate_scorecard,
    get_scorecard_provider,
)


def test_get_scorecard_provider_prefers_explicit_env_override(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    provider = get_scorecard_provider()

    assert provider.name == "anthropic"


def test_get_scorecard_provider_auto_selects_gemini_when_only_gemini_key_exists(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    provider = get_scorecard_provider()

    assert provider.name == "gemini"


def test_generate_scorecard_uses_selected_provider(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    class StubProvider:
        name = "gemini"

        def generate_scorecard(self, *, scoring_prompt: str, system_prompt: str) -> dict:
            assert "Prospect persona:" in scoring_prompt
            assert "Return ONLY valid JSON" in system_prompt
            return {"overall_score": 9}

    monkeypatch.setattr("app.services.llm.get_scorecard_provider", lambda: StubProvider())

    scorecard = generate_scorecard(
        scoring_prompt="Prospect persona:\nTranscript:\nAdvisor: Hello",
        system_prompt="Return ONLY valid JSON",
    )

    assert scorecard == {"overall_score": 9}


def test_build_fallback_scorecard_returns_deterministic_shape():
    scorecard = build_fallback_scorecard()

    assert scorecard == {
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
    }


def test_generate_scorecard_raises_when_no_provider_is_configured(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(LLMProviderError, match="No supported LLM provider configured"):
        get_scorecard_provider()
