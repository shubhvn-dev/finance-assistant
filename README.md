# Finance Assistant

AI-powered cold call training platform for financial advisors.

## Architecture

This project is structured as a monorepo with a decoupled frontend and backend:

- **Backend (`/backend`)**: Python FastAPI service handling AI orchestration (Claude), data fetching (Finny), and persistence (Blaxel/Postgres).
- **Frontend (`/frontend`)**: Next.js 14+ application handling the UI and Voice WebSocket connection (ElevenLabs).

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- API Keys (Anthropic, ElevenLabs, Finny, Blaxel)

### Setup

1. **Environment Variables**
   Copy `.env.example` to `.env` in the root and fill in your keys.

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open http://localhost:3000 to view the app.