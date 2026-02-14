import asyncio
import json
import base64
from typing import AsyncGenerator
import websockets


class ElevenLabsTTSClient:
    """Client for ElevenLabs Text-to-Speech WebSocket API"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "wss://api.elevenlabs.io/v1/text-to-speech"

    async def generate_audio_stream(
        self,
        text: str,
        voice_id: str
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream audio chunks from ElevenLabs TTS API.

        Args:
            text: The text to convert to speech
            voice_id: ElevenLabs voice ID (from personas.py)

        Yields:
            Raw audio bytes (mp3 format)
        """
        url = f"{self.base_url}/{voice_id}/stream-input?model_id=eleven_turbo_v2_5"

        try:
            async with websockets.connect(url) as ws:
                # Step 1: Send initialization message with API key
                init_message = {
                    "text": " ",  # Space character to initialize
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    },
                    "xi_api_key": self.api_key
                }
                await ws.send(json.dumps(init_message))

                # Step 2: Send the actual text
                text_message = {
                    "text": text,
                    "try_trigger_generation": True
                }
                await ws.send(json.dumps(text_message))

                # Step 3: Send close message (empty string)
                close_message = {"text": ""}
                await ws.send(json.dumps(close_message))

                # Step 4: Receive and yield audio chunks
                async for message in ws:
                    data = json.loads(message)

                    # Check for errors
                    if "error" in data:
                        error_msg = data.get("error", "Unknown error")
                        print(f"[ElevenLabs TTS] API Error: {error_msg}")
                        raise Exception(f"ElevenLabs API error: {error_msg}")

                    if "audio" in data and data["audio"] is not None:
                        # Decode base64 audio and yield
                        audio_bytes = base64.b64decode(data["audio"])
                        yield audio_bytes

                    if data.get("isFinal"):
                        print(f"[ElevenLabs TTS] Received final marker")
                        break

        except websockets.exceptions.WebSocketException as e:
            print(f"[ElevenLabs TTS] WebSocket error: {e}")
            raise
        except Exception as e:
            print(f"[ElevenLabs TTS] Unexpected error: {e}")
            raise
