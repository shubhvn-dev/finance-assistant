#!/bin/bash
# setup_repo.sh

echo "🚀 Starting repository setup for Finance Assistant (Split Architecture)..."

# --- BACKEND SETUP ---
echo "🐍 Setting up Backend (FastAPI)..."
mkdir -p backend/app/api/endpoints
mkdir -p backend/app/core
mkdir -p backend/app/models
mkdir -p backend/app/services
mkdir -p backend/tests

# Create Backend Files
touch backend/requirements.txt
touch backend/app/__init__.py
touch backend/app/main.py
touch backend/app/api/__init__.py
touch backend/app/api/api.py
touch backend/app/core/config.py
touch backend/app/core/database.py

# Create Service Placeholders
touch backend/app/services/anthropic.py
touch backend/app/services/finny.py
touch backend/app/services/scoring.py

# --- FRONTEND SETUP ---
echo "⚛️ Setting up Frontend (Next.js)..."
mkdir -p frontend/app/\(auth\)
mkdir -p frontend/app/dashboard
mkdir -p frontend/app/session/\[id\]
mkdir -p frontend/app/session/new
mkdir -p frontend/components
mkdir -p frontend/lib
mkdir -p frontend/types
mkdir -p frontend/public

# Create Frontend Files
touch frontend/app/layout.tsx
touch frontend/app/page.tsx
touch frontend/app/globals.css
touch frontend/components/VoiceCallUI.tsx
touch frontend/components/Scorecard.tsx
touch frontend/lib/api.ts
touch frontend/package.json

echo "✅ Setup complete! Structure created for backend/ and frontend/."
echo "👉 Run 'chmod +x setup_repo.sh' if needed, then execute."