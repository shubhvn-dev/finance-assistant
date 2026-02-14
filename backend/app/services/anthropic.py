import anthropic
import json
from pathlib import Path
from app.core.config import settings

# Load prompts and personas
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


with open(PROMPTS_DIR / "personas.json") as f:
    PERSONAS = {p["id"]: p for p in json.load(f)}

with open(PROMPTS_DIR / "persona_system_prompt.md") as f:
    PERSONA_TEMPLATE = f.read()

with open(PROMPTS_DIR / "scoring_system_prompt.md") as f:
    SCORING_TEMPLATE = f.read()


# Initialize Anthropic client
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def get_persona_response(persona_id: str, conversation_history: list, turn_number: int) -> str:
    """
    Get the AI persona's response for the next turn.
    
    Args:
        persona_id: One of 'robert', 'sarah', 'marcus'
        conversation_history: List of dicts with 'speaker' and 'text'
        turn_number: Current turn (1-6)
    
    Returns:
        The persona's response as a string
    """
    persona = PERSONAS[persona_id]
    
    # Inject persona variables into template
    system_prompt = PERSONA_TEMPLATE.format(
        name=persona["name"],
        age=persona["age"],
        occupation=persona["occupation"],
        assets=persona["assets"],
        current_provider=persona["current_provider"],
        personality=persona["personality"],
        main_objection=persona["main_objection"],
        secondary_objections="\n".join(f"- {obj}" for obj in persona["secondary_objections"])
    )
    
    # Add turn awareness
    system_prompt += f"\n\nCURRENT TURN NUMBER: {turn_number}"
    
    # Build messages for Claude
    messages = []
    for turn in conversation_history:
        role = "user" if turn["speaker"] == "advisor" else "assistant"
        messages.append({
            "role": role,
            "content": turn["text"]
        })
    
    # Call Anthropic API
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=150,
        temperature=0.7,
        system=system_prompt,
        messages=messages
    )
    
    return response.content[0].text


def score_call(transcript: str, persona_id: str) -> dict:
    """
    Score a completed call and return structured feedback.
    
    Args:
        transcript: Full conversation as a formatted string
        persona_id: The persona that was used
    
    Returns:
        Dict with scorecard structure (overall_score, opener, etc.)
    """
    persona = PERSONAS[persona_id]
    
    # Build scoring prompt with persona context
    scoring_prompt = SCORING_TEMPLATE.format(
        transcript=transcript,
        persona_name=persona["name"],
        difficulty=persona["difficulty"],
        main_objection=persona["main_objection"]
    )
    
    # Call Anthropic API
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        temperature=0.3,  # Lower temp for more consistent JSON
        messages=[{
            "role": "user",
            "content": scoring_prompt
        }]
    )
    
    # Parse JSON response
    raw_text = response.content[0].text
    
    # Remove markdown fences if Claude adds them anyway
    if raw_text.startswith("```json"):
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
    
    scorecard = json.loads(raw_text)
    
    return scorecard
