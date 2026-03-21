'use client';

import { useConversation } from '@elevenlabs/react';
import { Mic, PhoneOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { addMessage, endSession as endBackendSession } from '@/lib/api';

interface VoiceCallUIProps {
  agentId: string;
  personaId: string;
  sessionId: string;
}

export function normalizeMessageRole(messageRole: string): 'advisor' | 'prospect' {
  if (messageRole === 'user') {
    return 'advisor';
  }

  return 'prospect';
}

export function VoiceCallUI({ agentId, personaId, sessionId }: VoiceCallUIProps) {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [configError, setConfigError] = useState<boolean>(false);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
  const [scorecardReady, setScorecardReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnCounterRef = useRef(0);
  useEffect(() => {
    console.log('[VoiceCallUI] Initialized with session ID:', sessionId);
  }, [sessionId]);

  // Check for valid configuration on mount
  useEffect(() => {
    console.log(`[VoiceCallUI] Initializing with Agent ID: ${agentId}`);

    if (!agentId || agentId.includes('placeholder')) {
      console.error('[VoiceCallUI] Error: Agent ID is not configured or is a placeholder.');
      setConfigError(true);
    } else {
      setConfigError(false);
    }
  }, [agentId]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('[VoiceCallUI] Connected to ElevenLabs WebSocket');
      setConnectionStatus('connected');
      setError(null);
    },
    onDisconnect: () => {
      console.log('[VoiceCallUI] Disconnected from ElevenLabs WebSocket');
      setConnectionStatus('disconnected');
      // Note: Session ending is handled in handleEndCall, not here
    },
    onMessage: async (message) => {
      console.log('[VoiceCallUI] Message received:', message);

      if (!sessionId) {
        console.warn('[VoiceCallUI] No session ID, skipping message save');
        return;
      }

      // Extract message data
      const messageText = message.message || '';
      const messageRole = String(message.source || message.role || 'unknown');

      // Transform role: 'user' -> 'advisor', 'agent'/'ai' -> 'prospect'
      const transformedRole = normalizeMessageRole(messageRole);
      if (transformedRole === 'prospect' && messageRole !== 'agent' && messageRole !== 'ai') {
        console.warn('[VoiceCallUI] Unknown message role:', messageRole, 'defaulting to prospect');
      }

      turnCounterRef.current += 1;

      // Fire-and-forget message save
      addMessage(sessionId, {
        role: transformedRole,
        content: messageText,
        turn_number: turnCounterRef.current,
      }).catch((err) => {
        console.error('[VoiceCallUI] Failed to save message:', err);
      });
    },
    onError: (error) => {
      console.error('[VoiceCallUI] WebSocket Error:', error);
      setConnectionStatus('disconnected');
      setError('Connection error occurred');
    },
  });

  const { startSession, endSession, isSpeaking } = conversation;

  const handleStartCall = useCallback(async () => {
    if (configError) return;

    setConnectionStatus('connecting');
    setError(null);
    turnCounterRef.current = 0;

    try {
      console.log('[VoiceCallUI] Starting call with session:', sessionId);
      // @ts-ignore - connectionType is required by the SDK
      await startSession({ agentId, connectionType: 'websocket' });
      console.log('[VoiceCallUI] Call started, ready to receive messages');
    } catch (error) {
      console.error('[VoiceCallUI] Failed to start session:', error);
      setError(`Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setConnectionStatus('disconnected');
    }
  }, [startSession, agentId, configError, sessionId]);

  const handleEndCall = useCallback(async () => {
    console.log('[VoiceCallUI] handleEndCall - Starting to end call');
    console.log('[VoiceCallUI] Current sessionId:', sessionId);

    // End the ElevenLabs session
    await endSession();

    // Manually trigger scorecard generation if we have a session
    if (sessionId && !isGeneratingScorecard) {
      console.log('[VoiceCallUI] Manually triggering scorecard generation');
      setIsGeneratingScorecard(true);
      setError(null);

      try {
        console.log('[VoiceCallUI] Calling endBackendSession for:', sessionId);
        console.log('[VoiceCallUI] This may take 5-10 seconds...');

        const result = await endBackendSession(sessionId);

        console.log('[VoiceCallUI] Scorecard generated successfully:', result);
        setIsGeneratingScorecard(false);
        setScorecardReady(true);
      } catch (err) {
        console.error('[VoiceCallUI] Failed to generate scorecard:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to generate scorecard: ${errorMessage}. You can still view the transcript at /session/${sessionId}/scorecard`);
        setIsGeneratingScorecard(false);

        // Still allow viewing the report even if scorecard generation failed
        setTimeout(() => {
          setScorecardReady(true);
        }, 3000);
      }
    }
  }, [endSession, sessionId, isGeneratingScorecard]);

  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-200">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">Configuration Error</h3>
        <p className="text-red-600 text-center">Temporarily unavailable. Please try later.</p>
        <p className="text-xs text-red-500 mt-4 font-mono">Missing Agent ID</p>
      </div>
    );
  }

  if (isGeneratingScorecard) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-brand-50 rounded-2xl border border-brand-100">
        <div className="w-16 h-16 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mb-4" />
        <h3 className="text-lg font-display text-brand-900 mb-2">Generating Scorecard</h3>
        <p className="text-brand-500 text-center">Analyzing your call performance...</p>
      </div>
    );
  }

  if (scorecardReady && sessionId) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-green-50 rounded-2xl border border-green-200 shadow-lg">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
        <h3 className="text-2xl font-display text-green-900 mb-2">Call Complete!</h3>
        <p className="text-green-700 text-center mb-6">Your performance report is ready to view.</p>

        <button
          onClick={() => router.push(`/session/${sessionId}/scorecard`)}
          className="btn-primary text-lg px-8 py-4"
        >
          View Report
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-cream-200">
      {error && (
        <div className="mb-4 w-full p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="mb-8 flex flex-col items-center">
        <div
          className={clsx(
            "w-28 h-28 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
            connectionStatus === 'disconnected' && "bg-cream-100",
            connectionStatus === 'connected' && !isSpeaking && "bg-brand-50",
            isSpeaking && "bg-brand-100 scale-110"
          )}
          style={connectionStatus === 'connected' && !isSpeaking ? { animation: 'pulse-soft 2s ease-in-out infinite' } : undefined}
        >
          <div className={clsx(
            "w-4 h-4 rounded-full transition-colors duration-300",
            connectionStatus === 'disconnected' && "bg-brand-200",
            connectionStatus === 'connected' && !isSpeaking && "bg-brand-500",
            isSpeaking && "bg-brand-600"
          )} />
        </div>
        <p className="font-display text-lg text-brand-900">
          {connectionStatus === 'disconnected' && 'Ready to Call'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'connected' && (isSpeaking ? 'Speaking...' : 'Listening...')}
        </p>
        {sessionId && connectionStatus === 'connected' && (
          <p className="font-mono text-xs text-brand-300 mt-2">Session: {sessionId.slice(0, 8)}...</p>
        )}
        {sessionId && connectionStatus === 'disconnected' && !scorecardReady && !isGeneratingScorecard && (
          <p className="font-mono text-xs text-brand-300 mt-2">Session ended - Click End Call to generate report</p>
        )}
      </div>

      <div className="flex gap-4">
        {connectionStatus === 'disconnected' ? (
          <button
            onClick={handleStartCall}
            className="btn-primary"
          >
            <Mic className="w-5 h-5" />
            Start Call
          </button>
        ) : (
          <button
            onClick={handleEndCall}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 border border-red-200 text-red-600 rounded-full font-semibold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            End Call
          </button>
        )}
      </div>
    </div>
  );
}
