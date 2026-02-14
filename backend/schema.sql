-- PitchIQ Database Schema
-- PostgreSQL 12+

-- Sessions: One per call
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,  -- Hardcoded 'temp-user-001' for v1
    persona_id VARCHAR(50) NOT NULL CHECK (persona_id IN ('robert', 'sarah', 'marcus')),
    conversation_id VARCHAR(255),  -- From ElevenLabs
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

-- Messages: Transcript turns
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('advisor', 'prospect')),
    content TEXT NOT NULL,
    turn_number INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scorecards: One per completed session
CREATE TABLE IF NOT EXISTS scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    overall_score INT CHECK (overall_score BETWEEN 0 AND 10),
    opener_score INT CHECK (opener_score BETWEEN 0 AND 10),
    opener_feedback TEXT,
    objection_handling_score INT CHECK (objection_handling_score BETWEEN 0 AND 10),
    objection_handling_feedback TEXT,
    tone_confidence_score INT CHECK (tone_confidence_score BETWEEN 0 AND 10),
    tone_confidence_feedback TEXT,
    close_attempt_score INT CHECK (close_attempt_score BETWEEN 0 AND 10),
    close_attempt_feedback TEXT,
    best_moment TEXT,
    biggest_mistake TEXT,
    what_to_say_instead TEXT,
    meeting_booked BOOLEAN DEFAULT false,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_id_turn ON messages(session_id, turn_number);
