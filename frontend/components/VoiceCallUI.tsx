'use client';

import { useConversation } from '@elevenlabs/react';
import { Mic, PhoneOff, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { addMessage, endSession as endBackendSession } from '@/lib/api';

interface LocalMessage {
  role: 'advisor' | 'prospect';
  content: string;
  turn_number: number;
}

interface VoiceCallUIProps {
  agentId: string;
  personaId: string;
  sessionId: string;
  personaFullName: string;
  personaRole: string;
  difficulty: string;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

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
  if (/current|already|fidelity|vanguard|advisor|myself/.test(lower)) tags.push('Incumbent advisor');
  if (/not interested|don.t need|fine without|manage (it|my)/.test(lower)) tags.push('No interest');
  if (/credib|trust|track record|prove/.test(lower)) tags.push('Credibility');
  return tags;
}

export function normalizeMessageRole(messageRole: string): 'advisor' | 'prospect' {
  return messageRole === 'user' ? 'advisor' : 'prospect';
}

const OBJECTION_TAG_COLORS: Record<string, string> = {
  'Fees': 'bg-amber-900/40 border-amber-600 text-amber-300',
  'Time': 'bg-slate-700 border-slate-500 text-slate-300',
  'Risk': 'bg-red-900/40 border-red-600 text-red-300',
  'Incumbent advisor': 'bg-blue-900/40 border-blue-600 text-blue-300',
  'No interest': 'bg-slate-700 border-slate-500 text-slate-300',
  'Credibility': 'bg-rose-900/40 border-rose-600 text-rose-300',
};

const DIFFICULTY_BADGE: Record<string, string> = {
  Aggressive: 'border-red-500 text-red-400',
  Medium: 'border-yellow-500 text-yellow-400',
  Easy: 'border-green-500 text-green-400',
};

const BAR_DELAYS = [0, 0.15, 0.3, 0.15, 0.05];
const BAR_DURATIONS = [0.6, 0.8, 0.5, 0.7, 0.9];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-0.5 h-5" style={{ minWidth: 28 }}>
      {BAR_DELAYS.map((delay, i) => (
        <div
          key={i}
          className={clsx('w-1 rounded-full transition-colors duration-300', active ? 'bg-green-400' : 'bg-slate-600')}
          style={
            active
              ? {
                  height: 16,
                  transformOrigin: 'bottom',
                  animation: `bar-wave ${BAR_DURATIONS[i]}s ease-in-out ${delay}s infinite`,
                }
              : { height: 4 }
          }
        />
      ))}
    </div>
  );
}

export function VoiceCallUI({
  agentId,
  sessionId,
  personaFullName,
  personaRole,
  difficulty,
}: VoiceCallUIProps) {
  const router = useRouter();
  const personaInitials = getInitials(personaFullName);
  const personaFirstName = personaFullName.split(' ')[0];

  // ── Connection state ───────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [configError, setConfigError] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const [callSeconds, setCallSeconds] = useState(0);
  const callStartRef = useRef<number>(0);
  const [turnTimer, setTurnTimer] = useState(0);
  const turnStartRef = useRef<number>(Date.now());

  // ── Talk time ──────────────────────────────────────────────────────────────
  const [advisorWords, setAdvisorWords] = useState(0);
  const [prospectWords, setProspectWords] = useState(0);

  // ── Speaker tracking ───────────────────────────────────────────────────────
  const prevIsSpeakingRef = useRef<boolean>(false);

  // ── Objection tags ─────────────────────────────────────────────────────────
  const [visibleTags, setVisibleTags] = useState<string[]>([]);
  const pendingTagsRef = useRef<string[]>([]);

  // ── Live feedback ──────────────────────────────────────────────────────────
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'evaluating' | 'on_track' | 'off_track'>('idle');
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Turn counter ───────────────────────────────────────────────────────────
  const turnCounterRef = useRef(0);

  // ── Local transcript ───────────────────────────────────────────────────────
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // ── Config check ───────────────────────────────────────────────────────────
  useEffect(() => {
    setConfigError(!agentId || agentId.includes('placeholder'));
  }, [agentId]);

  // ── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // ── Turn timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const interval = setInterval(() => {
      setTurnTimer(Math.floor((Date.now() - turnStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // ── Auto-scroll transcript ─────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const triggerEvaluate = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedbackStatus('evaluating');
    setCoachTip(null);
    // TODO: POST /sessions/{sessionId}/feedback/evaluate
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackStatus('idle');
    }, 4000);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      setConnectionStatus('connected');
      callStartRef.current = Date.now();
      turnStartRef.current = Date.now();
      setCallSeconds(0);
      setTurnTimer(0);
      setError(null);
    },
    onDisconnect: () => setConnectionStatus('disconnected'),
    onMessage: async (message) => {
      if (!sessionId) return;
      const messageText = message.message || '';
      const messageRole = String(message.role || 'unknown');
      const transformedRole = normalizeMessageRole(messageRole);

      turnCounterRef.current += 1;
      const words = countWords(messageText);

      if (transformedRole === 'advisor') {
        setAdvisorWords((w) => w + words);
      } else {
        setProspectWords((w) => w + words);
        pendingTagsRef.current = extractObjectionTags(messageText);
      }

      setMessages((prev) => [...prev, { role: transformedRole, content: messageText, turn_number: turnCounterRef.current }]);

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

  // ── Speaker-switch side effects ────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const wasProspectSpeaking = prevIsSpeakingRef.current;
    const isProspectSpeaking = isSpeaking;
    if (wasProspectSpeaking === isProspectSpeaking) return;

    turnStartRef.current = Date.now();
    setTurnTimer(0);

    if (!wasProspectSpeaking && isProspectSpeaking) {
      setVisibleTags([]);
      triggerEvaluate();
    }
    if (wasProspectSpeaking && !isProspectSpeaking) {
      setVisibleTags(pendingTagsRef.current);
      pendingTagsRef.current = [];
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
    setMessages([]);
    setCallSeconds(0);
    try {
      // @ts-ignore - connectionType required by SDK
      await startSession({ agentId, connectionType: 'websocket' });
    } catch (err) {
      setError(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnectionStatus('disconnected');
    }
  }, [startSession, agentId, configError]);

  const handleEndCall = useCallback(async () => {
    setIsEndingCall(true);
    await endSession();
    if (sessionId) {
      try { await endBackendSession(sessionId); } catch { /* non-fatal */ }
      router.push(`/session/${sessionId}/scorecard`);
    }
  }, [endSession, sessionId, router]);

  // ── Talk time ──────────────────────────────────────────────────────────────
  const totalWords = advisorWords + prospectWords;
  const advisorPct = totalWords > 0 ? Math.round((advisorWords / totalWords) * 100) : 0;
  const prospectPct = 100 - advisorPct;

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-red-300 mb-2">Configuration Error</h3>
        <p className="text-red-400 text-center text-sm">Temporarily unavailable. Please try later.</p>
        <p className="text-xs text-red-600 mt-4 font-mono">Missing Agent ID</p>
      </div>
    );
  }

  if (isEndingCall) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-16 h-16 rounded-full border-4 border-slate-600 border-t-white animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Ending Call</h3>
        <p className="text-slate-400">Preparing your analysis...</p>
      </div>
    );
  }

  // ── Disconnected: centered start screen ────────────────────────────────────
  if (connectionStatus === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg max-w-sm w-full text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300">
            {personaInitials}
          </div>
          <p className="text-xl font-semibold text-white">{personaFullName}</p>
          <p className="text-sm text-slate-500">{personaRole}</p>
        </div>
        <button
          onClick={handleStartCall}
          className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold transition-colors shadow-lg"
        >
          <Mic className="w-5 h-5" />
          Start Call
        </button>
      </div>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-600 border-t-green-500 animate-spin" />
        <p className="text-slate-400 text-sm">Connecting...</p>
      </div>
    );
  }

  // ── Connected: full call UI ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Live</span>
          </span>
          <span className="text-sm font-mono text-slate-400">{formatTime(callSeconds)}</span>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${DIFFICULTY_BADGE[difficulty] ?? 'border-slate-500 text-slate-400'}`}>
          {difficulty}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ──────────────────────────────���─────────────────────── */}
        <div className="flex flex-col gap-5 p-6 w-[58%] border-r border-slate-700/60 overflow-y-auto">

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Avatars */}
          <div className="flex items-center justify-center gap-10">
            {/* You */}
            <div className="flex flex-col items-center gap-2">
              <div className={clsx(
                'w-20 h-20 rounded-full flex items-center justify-center text-base font-bold transition-all duration-300',
                !isSpeaking
                  ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-slate-900 bg-green-900/30 text-green-300'
                  : 'bg-slate-700 text-slate-400',
              )}>
                You
              </div>
              <Waveform active={!isSpeaking} />
              <p className="text-sm font-semibold text-white">You</p>
              <p className="text-xs text-slate-500">Advisor</p>
            </div>

            <span className="text-slate-600 text-sm font-medium mb-8">vs</span>

            {/* Persona */}
            <div className="flex flex-col items-center gap-2">
              <div className={clsx(
                'w-20 h-20 rounded-full flex items-center justify-center text-base font-bold transition-all duration-300',
                isSpeaking
                  ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-slate-900 bg-green-900/30 text-green-300'
                  : 'bg-slate-700 text-slate-400',
              )}>
                {personaInitials}
              </div>
              <Waveform active={isSpeaking} />
              <p className="text-sm font-semibold text-white">{personaFullName}</p>
              <p className="text-xs text-slate-500">{personaRole}</p>
            </div>
          </div>

          {/* Talk time bar */}
          {totalWords > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">You {advisorPct}%</span>
                <span className={`text-xs font-semibold ${prospectPct > 60 ? 'text-red-400' : 'text-slate-400'}`}>
                  {personaFirstName} {prospectPct}%{prospectPct > 60 ? ' — listen more' : ''}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500 rounded-full"
                  style={{ width: `${advisorPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Objection tags */}
          {visibleTags.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Objections Detected</p>
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className={`px-3 py-1 border rounded-full text-xs font-semibold ${OBJECTION_TAG_COLORS[tag] ?? 'bg-slate-700 border-slate-500 text-slate-300'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Turn timer warning */}
          {isSpeaking && turnTimer >= 60 && (
            <p className="text-xs text-amber-400 font-medium animate-pulse">
              Long objection — take notes
            </p>
          )}

          {/* Feedback zone */}
          {feedbackStatus !== 'idle' && (
            <div className={clsx(
              'p-4 rounded-xl border flex items-start gap-3',
              feedbackStatus === 'evaluating' && 'bg-slate-800 border-slate-600',
              feedbackStatus === 'on_track' && 'bg-green-950/50 border-green-700',
              feedbackStatus === 'off_track' && 'bg-red-950/50 border-red-700',
            )}>
              {feedbackStatus === 'evaluating' && (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-slate-200 animate-spin flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-400">Analyzing your last turn...</span>
                </>
              )}
              {feedbackStatus === 'on_track' && (
                <>
                  <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0">
                    <ThumbsUp className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-300">On track</p>
                    {coachTip && <p className="text-xs text-green-400 mt-1">{coachTip}</p>}
                  </div>
                </>
              )}
              {feedbackStatus === 'off_track' && (
                <>
                  <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0">
                    <ThumbsDown className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-300">Off track</p>
                    {coachTip && <p className="text-xs text-red-400 mt-1">{coachTip}</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* End call */}
          <div className="mt-auto pt-2">
            <button
              onClick={handleEndCall}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors border border-slate-600"
            >
              <PhoneOff className="w-5 h-5" />
              End call
            </button>
          </div>

          {/* Dev: simulate feedback events */}
          {process.env.NODE_ENV === 'development' && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-600 mb-2">Simulate SSE feedback events →</p>
              <div className="flex flex-wrap gap-2">
                {(['evaluating', 'on_track', 'off_track'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setFeedbackStatus(s);
                      if (s === 'off_track') setCoachTip('You hedged on risk. Reframe around process, not outcome.');
                      if (s === 'on_track') setCoachTip(null);
                    }}
                    className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
                  >
                    {s === 'evaluating' ? 'Evaluating...' : s === 'on_track' ? 'On track' : 'Off track'}
                  </button>
                ))}
                <button
                  onClick={() => { setFeedbackStatus('idle'); setCoachTip(null); }}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: transcript ────────────────────────────────────────── */}
        <div className="flex flex-col w-[42%]">
          <div className="px-5 py-3 border-b border-slate-700/60 flex-shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Live Transcript</h3>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-slate-600 text-sm text-center mt-8">Listening...</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="space-y-1">
                <p className={`text-xs font-bold uppercase tracking-wide ${msg.role === 'prospect' ? 'text-orange-400' : 'text-slate-500'}`}>
                  {msg.role === 'prospect' ? personaFirstName : 'You'}
                </p>
                <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${msg.role === 'prospect' ? 'bg-slate-700/80 text-slate-200' : 'bg-slate-800 text-slate-300'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Coach tip */}
          {coachTip && feedbackStatus === 'off_track' && (
            <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-800/60 flex-shrink-0">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">Coach:</span> {coachTip}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
