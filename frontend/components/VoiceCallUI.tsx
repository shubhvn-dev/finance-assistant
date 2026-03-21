'use client';

import { useConversation } from '@elevenlabs/react';
import { Mic, PhoneOff, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { addMessage, endSession as endBackendSession } from '@/lib/api';

interface VoiceCallUIProps {
  agentId: string;
  personaId: string;
  sessionId: string;
}

const PERSONA_DISPLAY: Record<string, string> = {
  robert: 'Robert',
  sarah: 'Sarah',
  marcus: 'Marcus',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractObjectionTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (/fee|cost|expensive|charge|price/.test(lower)) tags.push('Fees');
  if (/time|busy|later|schedule|not now/.test(lower)) tags.push('Time');
  if (/risk|market|volatile|lose/.test(lower)) tags.push('Risk');
  if (/current|already|fidelity|vanguard|advisor|myself/.test(lower)) tags.push('Existing advisor');
  if (/not interested|don.t need|fine without|manage (it|my)/.test(lower)) tags.push('No interest');
  return tags;
}

export function normalizeMessageRole(messageRole: string): 'advisor' | 'prospect' {
  return messageRole === 'user' ? 'advisor' : 'prospect';
}

export function VoiceCallUI({ agentId, personaId, sessionId }: VoiceCallUIProps) {
  const router = useRouter();
  const personaName = PERSONA_DISPLAY[personaId] ?? 'Prospect';

  // ── Connection state ──────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [configError, setConfigError] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Talk time (word counts from completed turns) ──────────────────────────
  const [advisorWords, setAdvisorWords] = useState(0);
  const [prospectWords, setProspectWords] = useState(0);

  // ── Turn timer ────────────────────────────────────────────────────────────
  const [turnTimer, setTurnTimer] = useState(0);
  const turnStartRef = useRef<number>(Date.now());

  // ── Speaker tracking (for switch detection) ───────────────────────────────
  // isSpeaking from ElevenLabs = agent (prospect) is speaking
  const prevIsSpeakingRef = useRef<boolean>(false);

  // ── Objection tags (shown when YOUR turn starts, buffered from prospect msg)
  const [visibleTags, setVisibleTags] = useState<string[]>([]);
  const pendingTagsRef = useRef<string[]>([]);

  // ── Live feedback ─────────────────────────────────────────────────────────
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'evaluating' | 'on_track' | 'off_track'>('idle');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Turn counter ──────────────────────────────────────────────────────────
  const turnCounterRef = useRef(0);

  // ── Config check ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agentId || agentId.includes('placeholder')) {
      setConfigError(true);
    } else {
      setConfigError(false);
    }
  }, [agentId]);

  // ── Turn timer interval (ticks every second while connected) ─────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => {
      setTurnTimer(Math.floor((Date.now() - turnStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // ── Trigger evaluation (fires when YOUR turn ends → prospect starts) ──────
  const triggerEvaluate = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedbackStatus('evaluating');

    // TODO: replace with real POST /sessions/{sessionId}/feedback/evaluate
    // For now, clears after 4 s to avoid showing stale state
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackStatus('idle');
    }, 4000);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      setConnectionStatus('connected');
      turnStartRef.current = Date.now();
      setTurnTimer(0);
      setError(null);
    },
    onDisconnect: () => {
      setConnectionStatus('disconnected');
    },
    onMessage: async (message) => {
      if (!sessionId) return;

      const messageText = message.message || '';
      const messageRole = String(message.source || message.role || 'unknown');
      const transformedRole = normalizeMessageRole(messageRole);

      turnCounterRef.current += 1;

      // Update word counts
      const words = countWords(messageText);
      if (transformedRole === 'advisor') {
        setAdvisorWords((w) => w + words);
      } else {
        setProspectWords((w) => w + words);
        // Buffer objection tags — reveal them when your turn starts
        pendingTagsRef.current = extractObjectionTags(messageText);
      }

      addMessage(sessionId, {
        role: transformedRole,
        content: messageText,
        turn_number: turnCounterRef.current,
      }).catch(console.error);
    },
    onError: () => {
      setConnectionStatus('disconnected');
      setError('Connection error occurred');
    },
  });

  const { startSession, endSession, isSpeaking } = conversation;

  // ── Speaker-switch side effects ───────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const wasProspectSpeaking = prevIsSpeakingRef.current;
    const isProspectSpeaking = isSpeaking;

    if (wasProspectSpeaking === isProspectSpeaking) return;

    // Reset turn timer on every speaker switch
    turnStartRef.current = Date.now();
    setTurnTimer(0);

    if (!wasProspectSpeaking && isProspectSpeaking) {
      // Advisor → Prospect: your turn just ended → fire evaluate
      setVisibleTags([]);          // clear tags while prospect speaks
      triggerEvaluate();
    }

    if (wasProspectSpeaking && !isProspectSpeaking) {
      // Prospect → Advisor: prospect turn just ended → reveal buffered tags
      setVisibleTags(pendingTagsRef.current);
      pendingTagsRef.current = [];
      // Clear feedback status so it doesn't linger into your next turn
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedbackStatus('idle');
    }

    prevIsSpeakingRef.current = isProspectSpeaking;
  }, [isSpeaking, connectionStatus, triggerEvaluate]);

  const handleStartCall = useCallback(async () => {
    if (configError) return;
    setConnectionStatus('connecting');
    setError(null);
    turnCounterRef.current = 0;
    setAdvisorWords(0);
    setProspectWords(0);
    setVisibleTags([]);
    setFeedbackStatus('idle');

    try {
      // @ts-ignore - connectionType required by SDK
      await startSession({ agentId, connectionType: 'websocket' });
    } catch (err) {
      setError(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnectionStatus('disconnected');
    }
  }, [startSession, agentId, configError, sessionId]);

  const handleEndCall = useCallback(async () => {
    setIsEndingCall(true);
    await endSession();
    if (sessionId) {
      try { await endBackendSession(sessionId); } catch { /* non-fatal */ }
      router.push(`/session/${sessionId}/scorecard`);
    }
  }, [endSession, sessionId, router]);

  // ── Talk time calculation ─────────────────────────────────────────────────
  const totalWords = advisorWords + prospectWords;
  const advisorPct = totalWords > 0 ? Math.round((advisorWords / totalWords) * 100) : 0;
  const talkBarColor = advisorPct > 60 ? 'bg-red-500' : advisorPct > 40 ? 'bg-yellow-400' : 'bg-green-500';
  const talkLabel = advisorPct > 60 ? "You're over-explaining" : advisorPct > 40 ? 'Balanced' : 'Good — let them talk';
  const talkLabelColor = advisorPct > 60 ? 'text-red-600' : advisorPct > 40 ? 'text-yellow-600' : 'text-green-600';

  // ── Guards ────────────────────────────────────────────────────────────────
  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-100">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Configuration Error</h3>
        <p className="text-red-700 text-center">Temporarily unavailable. Please try later.</p>
        <p className="text-xs text-red-500 mt-4 font-mono">Missing Agent ID</p>
      </div>
    );
  }

  if (isEndingCall) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-blue-50 rounded-2xl border border-blue-100">
        <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Ending Call</h3>
        <p className="text-blue-700 text-center">Preparing your analysis...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-slate-100 gap-6">
      {error && (
        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm text-center">{error}</p>
        </div>
      )}

      {/* ── Speaker orb + turn timer ───────────────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div className={clsx(
          'w-24 h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-500',
          connectionStatus === 'connected' ? 'bg-blue-50' : 'bg-slate-50',
          isSpeaking && 'scale-110 bg-blue-100 animate-pulse',
        )}>
          <div className={clsx(
            'w-4 h-4 rounded-full transition-colors duration-300',
            connectionStatus === 'connected' ? 'bg-blue-500' : 'bg-slate-300',
            isSpeaking && 'bg-blue-600',
          )} />
        </div>

        <p className="text-slate-600 font-medium text-sm">
          {connectionStatus === 'disconnected' && 'Ready to call'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'connected' && (isSpeaking ? `${personaName} speaking...` : 'Your turn')}
        </p>

        {/* Turn timer — shows while prospect is speaking */}
        {connectionStatus === 'connected' && isSpeaking && (
          <div className="mt-1 flex flex-col items-center">
            <p className="text-xs text-slate-400">
              {personaName} · {formatTime(turnTimer)}
            </p>
            {turnTimer >= 60 && (
              <p className="text-xs text-amber-600 font-medium mt-1 animate-pulse">
                Long objection incoming — take notes
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Talk time bar (shown once call starts and words accumulate) ────── */}
      {connectionStatus === 'connected' && totalWords > 0 && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-500">Your talk time</span>
            <span className={`text-xs font-semibold ${talkLabelColor}`}>
              {advisorPct}% — {talkLabel}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${talkBarColor} transition-all duration-500`}
              style={{ width: `${advisorPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Objection tags (shown when YOUR turn starts, after prospect finishes) */}
      {visibleTags.length > 0 && (
        <div className="w-full flex flex-wrap gap-2">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-full"
            >
              {tag} objection
            </span>
          ))}
        </div>
      )}

      {/* ── Live feedback zone (only shown during prospect's turn) ──────────── */}
      {connectionStatus === 'connected' && feedbackStatus !== 'idle' && (
        <div className={clsx(
          'w-full p-3 rounded-xl border flex items-center gap-3',
          feedbackStatus === 'evaluating' && 'bg-slate-50 border-slate-200',
          feedbackStatus === 'on_track' && 'bg-green-50 border-green-200',
          feedbackStatus === 'off_track' && 'bg-red-50 border-red-200',
        )}>
          {feedbackStatus === 'evaluating' && (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin flex-shrink-0" />
              <span className="text-sm text-slate-600">Analyzing your last turn...</span>
            </>
          )}
          {feedbackStatus === 'on_track' && (
            <>
              <ThumbsUp className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700 font-medium">On track</span>
            </>
          )}
          {feedbackStatus === 'off_track' && (
            <>
              <ThumbsDown className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700 font-medium">Off track</span>
            </>
          )}
        </div>
      )}

      {/* ── Call button ───────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        {connectionStatus === 'disconnected' ? (
          <button
            onClick={handleStartCall}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Mic className="w-5 h-5" />
            Start Call
          </button>
        ) : (
          <button
            onClick={handleEndCall}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors shadow-sm hover:shadow-md"
          >
            <PhoneOff className="w-5 h-5" />
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
