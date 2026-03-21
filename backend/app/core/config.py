import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    @property
    def LLM_PROVIDER(self) -> str | None:
        return os.getenv("LLM_PROVIDER")

    @property
    def GEMINI_API_KEY(self) -> str | None:
        return os.getenv("GEMINI_API_KEY")

    @property
    def ANTHROPIC_API_KEY(self) -> str | None:
        return os.getenv("ANTHROPIC_API_KEY")
    # ... other config

settings = Settings()
