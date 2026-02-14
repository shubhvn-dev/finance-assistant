'use client';

import { useConversation } from '@elevenlabs/react';
import { Mic, PhoneOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { createSession, addMessage, endSession as endBackendSession } from '@/lib/api';

interface VoiceCallUIProps {
  agentId: string;
  personaId: string;
  sessionId: string;  // Now passed as prop
}

export function VoiceCallUI({ agentId, personaId, sessionId }: VoiceCallUIProps) {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [configError, setConfigError] = useState<boolean>(false);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
  const [scorecardReady, setScorecardReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnCounterRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);

  // Log session ID on mount
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
      let transformedRole: 'advisor' | 'prospect';
      if (messageRole === 'user') {
        transformedRole = 'advisor';
      } else if (messageRole === 'agent' || messageRole === 'ai') {
        transformedRole = 'prospect';
      } else {
        // Handle other possible role values
        console.warn('[VoiceCallUI] Unknown message role:', messageRole, 'defaulting to prospect');
        transformedRole = 'prospect';
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
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-100">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Configuration Error</h3>
        <p className="text-red-700 text-center">Temporarily unavailable. Please try later.</p>
        <p className="text-xs text-red-500 mt-4 font-mono">Missing Agent ID</p>
      </div>
    );
  }

  if (isGeneratingScorecard) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-blue-50 rounded-2xl border border-blue-100">
        <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Generating Scorecard</h3>
        <p className="text-blue-700 text-center">Analyzing your call performance...</p>
      </div>
    );
  }

  if (scorecardReady && sessionId) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-green-50 rounded-2xl border border-green-200 shadow-lg">
        <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
        <h3 className="text-2xl font-bold text-green-900 mb-2">Call Complete!</h3>
        <p className="text-green-700 text-center mb-6">Your performance report is ready to view.</p>

        <button
          onClick={() => router.push(`/session/${sessionId}/scorecard`)}
          className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg text-lg"
        >
          View Report
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
      {error && (
        <div className="mb-4 w-full p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="mb-8 flex flex-col items-center">
        <div className={clsx(
          "w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
          connectionStatus === 'connected' ? "bg-blue-50 animate-pulse" : "bg-slate-50",
          isSpeaking && "scale-110 bg-blue-100"
        )}>
          <div className={clsx(
            "w-4 h-4 rounded-full transition-colors duration-300",
            connectionStatus === 'connected' ? "bg-blue-500" : "bg-slate-300",
            isSpeaking && "bg-blue-600"
          )} />
        </div>
        <p className="text-slate-500 font-medium">
          {connectionStatus === 'disconnected' && 'Ready to call'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'connected' && (isSpeaking ? 'Agent speaking...' : 'Listening...')}
        </p>
        {sessionId && connectionStatus === 'connected' && (
          <p className="text-xs text-slate-400 mt-2">Session: {sessionId.slice(0, 8)}...</p>
        )}
        {sessionId && connectionStatus === 'disconnected' && !scorecardReady && !isGeneratingScorecard && (
          <p className="text-xs text-slate-400 mt-2">Session ended - Click End Call to generate report</p>
        )}
      </div>

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