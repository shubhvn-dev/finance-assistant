const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Session {
  id: string;
  user_id: string;
  persona_id: string;
  conversation_id?: string;
  started_at: string;
  status: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'advisor' | 'prospect';
  content: string;
  turn_number: number;
  created_at: string;
}

export interface Scorecard {
  overall_score: number;
  opener_score: number;
  opener_feedback: string;
  objection_handling_score: number;
  objection_handling_feedback: string;
  tone_confidence_score: number;
  tone_confidence_feedback: string;
  close_attempt_score: number;
  close_attempt_feedback: string;
  best_moment: string;
  biggest_mistake: string;
  what_to_say_instead: string;
  meeting_booked: boolean;
}

export interface SessionDetail {
  session: Session;
  messages: Message[];
  scorecard: Scorecard | null;
}

export interface CreateSessionRequest {
  user_id: string;
  persona_id: string;
  conversation_id?: string;
}

export interface MessageRequest {
  role: 'advisor' | 'prospect';
  content: string;
  turn_number: number;
}

export interface EndSessionResponse {
  session_id: string;
  status: string;
  ended_at: string;
  scorecard: Scorecard;
}

/**
 * Create a new session when a voice call starts.
 */
export async function createSession(req: CreateSessionRequest): Promise<Session> {
  const response = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create session' }));
    throw new Error(error.detail || 'Failed to create session');
  }

  return response.json();
}

/**
 * Add a message to a session (fire-and-forget).
 */
export async function addMessage(sessionId: string, req: MessageRequest): Promise<void> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to add message' }));
    throw new Error(error.detail || 'Failed to add message');
  }
}

/**
 * End a session and generate scorecard.
 * This can take 5-10 seconds as it calls Claude API.
 */
export async function endSession(sessionId: string): Promise<EndSessionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to end session' }));
      throw new Error(error.detail || 'Failed to end session');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out - scorecard generation took too long');
    }
    throw error;
  }
}

/**
 * Fetch full session details including messages and scorecard.
 */
export async function getSession(sessionId: string): Promise<SessionDetail> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Session not found');
    }
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch session' }));
    throw new Error(error.detail || 'Failed to fetch session');
  }

  return response.json();
}

/**
 * List all sessions, optionally filtered by user_id.
 */
export async function getSessions(userId?: string): Promise<Session[]> {
  const url = userId ? `${API_URL}/sessions?user_id=${userId}` : `${API_URL}/sessions`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch sessions' }));
    throw new Error(error.detail || 'Failed to fetch sessions');
  }

  return response.json();
}
