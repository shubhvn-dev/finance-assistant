import json
from dataclasses import dataclass

from app.core.config import settings

ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
GEMINI_MODEL = "gemini-2.5-flash"
FALLBACK_MESSAGE = "Automatic AI scoring was unavailable for this call."
RETRY_MESSAGE = "Retry scorecard generation after configuring a supported LLM provider."


class LLMProviderError(RuntimeError):
    pass


def build_fallback_scorecard() -> dict:
    return {
        "overall_score": 0,
        "opener": {"score": 0, "feedback": FALLBACK_MESSAGE},
        "objection_handling": {"score": 0, "feedback": FALLBACK_MESSAGE},
        "tone_and_confidence": {"score": 0, "feedback": FALLBACK_MESSAGE},
        "close_attempt": {"score": 0, "feedback": FALLBACK_MESSAGE},
        "best_moment": FALLBACK_MESSAGE,
        "biggest_mistake": FALLBACK_MESSAGE,
        "what_to_say_instead": RETRY_MESSAGE,
        "meeting_booked": False,
    }


def _strip_code_fences(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) == 1:
            return text.strip("`").strip()
        text = "\n".join(lines[1:]).strip()
        if text.endswith("```"):
            text = text[: -3].strip()
    return text


def _parse_scorecard(raw_text: str) -> dict:
    try:
        return json.loads(_strip_code_fences(raw_text))
    except json.JSONDecodeError as exc:
        raise LLMProviderError(f"Failed to parse scorecard JSON: {exc}") from exc


def _extract_anthropic_text(response: object) -> str:
    try:
        content = response.content
        if not content:
            raise AttributeError("empty content")
        first_block = content[0]
        text = first_block.text
    except Exception as exc:  # pragma: no cover - defensive against SDK shape changes
        raise LLMProviderError(f"Failed to read Anthropic response text: {exc}") from exc

    if not isinstance(text, str) or not text.strip():
        raise LLMProviderError("Failed to read Anthropic response text: empty response")
    return text


@dataclass
class _AnthropicScorecardProvider:
    name: str = "anthropic"

    def generate_scorecard(self, *, scoring_prompt: str, system_prompt: str) -> dict:
        if not settings.ANTHROPIC_API_KEY:
            raise LLMProviderError("ANTHROPIC_API_KEY is required for anthropic provider")

        try:
            import anthropic
        except ImportError as exc:
            raise LLMProviderError("Anthropic provider is unavailable: anthropic package is not installed") from exc

        try:
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": scoring_prompt}],
            )
        except Exception as exc:
            raise LLMProviderError(f"Anthropic scorecard generation failed: {exc}") from exc

        return _parse_scorecard(_extract_anthropic_text(response))


@dataclass
class _GeminiScorecardProvider:
    name: str = "gemini"

    def generate_scorecard(self, *, scoring_prompt: str, system_prompt: str) -> dict:
        if not settings.GEMINI_API_KEY:
            raise LLMProviderError("GEMINI_API_KEY is required for gemini provider")

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise LLMProviderError("Gemini provider is unavailable: google-genai package is not installed") from exc

        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=scoring_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                ),
            )
            raw_text = response.text
        except Exception as exc:
            raise LLMProviderError(f"Gemini scorecard generation failed: {exc}") from exc

        if not isinstance(raw_text, str) or not raw_text.strip():
            raise LLMProviderError("Gemini scorecard generation failed: empty response")

        return _parse_scorecard(raw_text)


def get_scorecard_provider():
    provider_override = (settings.LLM_PROVIDER or "").strip().lower()

    if provider_override == "gemini":
        if not settings.GEMINI_API_KEY:
            raise LLMProviderError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
        return _GeminiScorecardProvider()

    if provider_override == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise LLMProviderError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
        return _AnthropicScorecardProvider()

    if provider_override:
        raise LLMProviderError(f"Unsupported LLM_PROVIDER override: {settings.LLM_PROVIDER}")

    if settings.GEMINI_API_KEY:
        return _GeminiScorecardProvider()

    if settings.ANTHROPIC_API_KEY:
        return _AnthropicScorecardProvider()

    raise LLMProviderError("No supported LLM provider configured")


def generate_scorecard(scoring_prompt: str, system_prompt: str) -> dict:
    provider = get_scorecard_provider()
    return provider.generate_scorecard(scoring_prompt=scoring_prompt, system_prompt=system_prompt)
