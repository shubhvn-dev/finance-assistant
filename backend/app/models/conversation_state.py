from dataclasses import dataclass, field
from typing import List, Dict
from datetime import datetime


@dataclass
class ConversationTurn:
    """Represents a single turn in the conversation"""
    turn_number: int
    role: str  # "advisor" or "persona"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ConversationState:
    """
    Manages the state of an active conversation session.
    Tracks turn history, current turn number, and session metadata.
    """
    session_id: str
    user_id: str
    persona_id: str
    turn_history: List[ConversationTurn] = field(default_factory=list)
    current_turn: int = 0
    max_turns: int = 20  # Increased to allow ~10 exchanges
    status: str = "active"  # "active" or "ended"

    def add_turn(self, role: str, content: str) -> None:
        """
        Add a new turn to the conversation history.

        Args:
            role: Either "advisor" (user) or "persona" (AI)
            content: The text content of the turn
        """
        self.current_turn += 1
        self.turn_history.append(
            ConversationTurn(
                turn_number=self.current_turn,
                role=role,
                content=content
            )
        )

    def should_end(self) -> bool:
        """Check if the conversation has reached the maximum number of turns"""
        return self.current_turn >= self.max_turns

    def to_conversation_history(self) -> List[Dict]:
        """
        Format conversation history for Claude API.

        Returns:
            List of dicts with 'role' and 'content' keys formatted for Claude
        """
        return [
            {"role": turn.role, "content": turn.content}
            for turn in self.turn_history
        ]
