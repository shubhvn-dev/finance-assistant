import asyncio
import json
import uuid
import base64
import os
from typing import Dict

from fastapi import WebSocket, WebSocketDisconnect
import anthropic

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.models.conversation_state import ConversationState
from app.services.elevenlabs_tts import ElevenLabsTTSClient
from personas import PERSONAS
from prompts import get_persona_prompt


class ConversationWebSocketHandler:
    """Handles WebSocket connections for voice conversations"""

    def __init__(self):
        self.active_sessions: Dict[str, ConversationState] = {}
        self.tts_client = ElevenLabsTTSClient(os.getenv("ELEVENLABS_API_KEY"))
        self.anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def handle_connection(self, websocket: WebSocket):
        """Main handler for WebSocket connections"""
        await websocket.accept()
        session_id = None

        try:
            while True:
                # Receive message from client
                raw_message = await websocket.receive_text()
                message = json.loads(raw_message)

                msg_type = message.get("type")
                payload = message.get("payload", {})

                if msg_type == "start_session":
                    session_id = await self._handle_start_session(
                        websocket, payload
                    )

                elif msg_type == "user_speech":
                    await self._handle_user_speech(
                        websocket, session_id, payload
                    )

                elif msg_type == "end_session":
                    await self._handle_end_session(
                        websocket, session_id
                    )
                    break

        except WebSocketDisconnect:
            print(f"[WebSocket] Client disconnected: {session_id}")
            if session_id and session_id in self.active_sessions:
                del self.active_sessions[session_id]

        except Exception as e:
            print(f"[WebSocket] Error: {e}")
            await self._send_error(websocket, str(e))

    async def _handle_start_session(
        self, websocket: WebSocket, payload: dict
    ) -> str:
        """Initialize a new conversation session"""
        persona_id = payload["persona_id"]
        user_id = payload["user_id"]

        persona = PERSONAS.get(persona_id)
        if not persona:
            await self._send_error(websocket, f"Unknown persona: {persona_id}")
            return None

        # Create session
        session_id = f"sess-{uuid.uuid4().hex[:12]}"
        state = ConversationState(
            session_id=session_id,
            user_id=user_id,
            persona_id=persona_id
        )
        self.active_sessions[session_id] = state

        print(f"[WebSocket] Session started: {session_id} with persona {persona_id}")

        # Send confirmation
        await websocket.send_json({
            "type": "session_started",
            "payload": {
                "session_id": session_id,
                "persona": {
                    "name": persona["name"],
                    "voice_id": persona["voice_id"]
                }
            }
        })

        # Generate and send initial greeting from persona
        await self._generate_persona_response(websocket, session_id, is_first=True)

        return session_id

    async def _handle_user_speech(
        self, websocket: WebSocket, session_id: str, payload: dict
    ):
        """Process user's speech and generate persona response"""
        state = self.active_sessions.get(session_id)
        if not state:
            await self._send_error(websocket, "Invalid session")
            return

        transcript = payload["transcript"]
        print(f"[WebSocket] User said: {transcript}")

        # Add user's turn to history
        state.add_turn("advisor", transcript)
        print(f"[WebSocket] Turn {state.current_turn}: User spoke")

        # No max turns limit - conversation continues until user ends call

        # Generate persona response
        try:
            await self._generate_persona_response(websocket, session_id)
        except Exception as e:
            print(f"[WebSocket] Error in generate_persona_response: {e}")
            import traceback
            traceback.print_exc()
            await self._send_error(websocket, f"Failed to generate response: {str(e)}")

    async def _generate_persona_response(
        self, websocket: WebSocket, session_id: str, is_first: bool = False
    ):
        """Generate AI persona response and stream TTS audio"""
        state = self.active_sessions[session_id]
        persona = PERSONAS[state.persona_id]

        # Signal that AI is thinking
        await websocket.send_json({
            "type": "persona_thinking",
            "payload": {}
        })

        # Get response from Claude
        system_prompt = get_persona_prompt(persona)

        # Build message history for Claude
        messages = []
        for turn in state.turn_history:
            role = "user" if turn.role == "advisor" else "assistant"
            messages.append({"role": role, "content": turn.content})

        # For first turn, provide context to start the call
        if is_first:
            messages = [{"role": "user", "content": "The phone is ringing. Answer it."}]

        try:
            response = self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=256,
                system=system_prompt,
                messages=messages
            )

            persona_text = response.content[0].text
            print(f"[WebSocket] Persona responded: {persona_text}")

            # Add persona's turn to history
            state.add_turn("persona", persona_text)

            # Stream TTS audio to client
            chunk_count = 0
            try:
                async for audio_chunk in self.tts_client.generate_audio_stream(
                    persona_text, persona["voice_id"]
                ):
                    chunk_count += 1
                    # Encode audio chunk as base64
                    audio_b64 = base64.b64encode(audio_chunk).decode('utf-8')

                    await websocket.send_json({
                        "type": "audio_chunk",
                        "payload": {
                            "audio": audio_b64,
                            "turn_number": state.current_turn
                        }
                    })

                print(f"[WebSocket] Sent {chunk_count} audio chunks")

                # Send completion message with transcript
                await websocket.send_json({
                    "type": "audio_complete",
                    "payload": {
                        "transcript": persona_text,
                        "turn_number": state.current_turn
                    }
                })
            except Exception as audio_error:
                print(f"[WebSocket] Error streaming audio: {audio_error}")
                import traceback
                traceback.print_exc()
                # Still send completion so conversation doesn't hang
                await websocket.send_json({
                    "type": "audio_complete",
                    "payload": {
                        "transcript": persona_text,
                        "turn_number": state.current_turn
                    }
                })

        except Exception as e:
            print(f"[WebSocket] Error generating response: {e}")
            await self._send_error(websocket, f"Failed to generate response: {str(e)}")

    async def _handle_end_session(
        self, websocket: WebSocket, session_id: str
    ):
        """End conversation and trigger scoring"""
        state = self.active_sessions.get(session_id)
        if not state:
            return

        state.status = "ended"
        print(f"[WebSocket] Session ended: {session_id} after {state.current_turn} turns")

        # Send session ended message
        await websocket.send_json({
            "type": "session_ended",
            "payload": {
                "reason": "max_turns" if state.should_end() else "user_requested",
                "total_turns": state.current_turn,
                "session_id": session_id
            }
        })

        # Clean up
        del self.active_sessions[session_id]

    async def _send_error(self, websocket: WebSocket, message: str):
        """Send error message to client"""
        await websocket.send_json({
            "type": "error",
            "payload": {
                "message": message,
                "recoverable": False
            }
        })
