'use client';

import { useConversation } from '@elevenlabs/react';
import { Mic, PhoneOff, AlertCircle } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';

interface VoiceCallUIProps {
  agentId: string;
}

export function VoiceCallUI({ agentId }: VoiceCallUIProps) {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [configError, setConfigError] = useState<boolean>(false);

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
    },
    onDisconnect: () => {
      console.log('[VoiceCallUI] Disconnected from ElevenLabs WebSocket');
      setConnectionStatus('disconnected');
    },
    onMessage: (message) => console.log('[VoiceCallUI] Message received:', message),
    onError: (error) => {
      console.error('[VoiceCallUI] WebSocket Error:', error);
      setConnectionStatus('disconnected');
    },
  });

  const { startSession, endSession, isSpeaking } = conversation;

  const handleStartCall = useCallback(async () => {
    if (configError) return;
    
    setConnectionStatus('connecting');
    try {
      // @ts-ignore - connectionType is required by the SDK
      await startSession({ agentId, connectionType: 'websocket' });
    } catch (error) {
      console.error('[VoiceCallUI] Failed to start session:', error);
      setConnectionStatus('disconnected');
    }
  }, [startSession, agentId, configError]);

  const handleEndCall = useCallback(async () => {
    await endSession();
  }, [endSession]);

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

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
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