'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, PhoneOff, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { ConversationWebSocketClient } from '@/lib/websocket-client';
import { useSpeechRecognition } from '@/lib/use-speech-recognition';
import { AudioPlayerQueue } from '@/lib/audio-player';

interface VoiceCallUIProps {
  personaId: string;
  userId?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type CallState = 'idle' | 'persona_speaking' | 'user_speaking' | 'waiting_for_user';

export function VoiceCallUI({ personaId, userId = 'demo-user' }: VoiceCallUIProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [personaTranscript, setPersonaTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsClient = useRef<ConversationWebSocketClient | null>(null);
  const audioPlayer = useRef<AudioPlayerQueue>(new AudioPlayerQueue());

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: speechSupported,
    error: speechError,
  } = useSpeechRecognition();

  // Handle ending the call
  const handleEndCall = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.send('end_session', {});
      wsClient.current.disconnect();
      wsClient.current = null;
    }

    stopListening();
    audioPlayer.current.stop();

    setConnectionStatus('disconnected');
    setCallState('idle');
    setSessionId(null);
    setCurrentTurn(0);
    setPersonaTranscript('');
  }, [stopListening]);

  // Setup WebSocket message handlers - helper function
  const setupWebSocketHandlers = useCallback((client: ConversationWebSocketClient) => {
    client.on('session_started', (payload) => {
      console.log('[Call] Session started:', payload.session_id);
      setSessionId(payload.session_id);
      setConnectionStatus('connected');
    });

    client.on('persona_thinking', () => {
      console.log('[Call] Persona is thinking/speaking - stopping microphone');
      setCallState('persona_speaking');
      // Force stop microphone to prevent feedback
      stopListening();
    });

    client.on('audio_chunk', (payload) => {
      audioPlayer.current.addChunk(payload.audio);
    });

    client.on('audio_complete', (payload) => {
      console.log('[Call] Persona said:', payload.transcript);
      setPersonaTranscript(payload.transcript);
      setCurrentTurn(payload.turn_number);
    });

    client.on('session_ended', (payload) => {
      console.log('[Call] Session ended:', payload.reason);
      handleEndCall();
    });

    client.on('error', (payload) => {
      console.error('[Call] Error:', payload.message);
      setError(payload.message);
    });
  }, [handleEndCall, stopListening]);

  // Setup audio playback complete handler
  useEffect(() => {
    audioPlayer.current.setOnPlaybackComplete(() => {
      console.log('[Call] Persona finished speaking, waiting for user');
      setCallState('waiting_for_user');
      // Don't auto-start listening - wait for user to click "Speak" button
    });
  }, []);

  // Handle new user transcript
  useEffect(() => {
    if (transcript && wsClient.current && sessionId) {
      console.log('[Call] User said:', transcript);

      // Stop listening
      stopListening();

      // Send to backend
      wsClient.current.send('user_speech', {
        transcript,
        turn_number: currentTurn + 1,
      });

      setCallState('idle');
    }
  }, [transcript, sessionId, currentTurn, stopListening]);

  // Handle user clicking "Speak" button
  const handleStartSpeaking = useCallback(() => {
    // Don't allow speaking if persona is still talking
    if (callState === 'persona_speaking' || audioPlayer.current.getIsPlaying()) {
      console.log('[Call] Cannot speak - persona still talking');
      return;
    }

    console.log('[Call] User clicked Speak, starting microphone');
    setCallState('user_speaking');
    startListening();
  }, [startListening, callState]);

  const handleStartCall = useCallback(async () => {
    if (!speechSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      // Determine WebSocket URL
      const wsUrl =
        process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/conversation';

      // Create and connect WebSocket
      wsClient.current = new ConversationWebSocketClient(wsUrl);
      await wsClient.current.connect();

      // Setup message handlers AFTER connection
      setupWebSocketHandlers(wsClient.current);

      // Start session
      wsClient.current.send('start_session', {
        persona_id: personaId,
        user_id: userId,
      });
    } catch (err) {
      console.error('[Call] Failed to start:', err);
      setError('Failed to connect to server');
      setConnectionStatus('disconnected');
    }
  }, [personaId, userId, speechSupported, setupWebSocketHandlers]);

  if (!speechSupported) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-100">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          Browser Not Supported
        </h3>
        <p className="text-red-700 text-center">
          Your browser does not support speech recognition. Please use Chrome,
          Edge, or Safari.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-100">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
        <p className="text-red-700 text-center">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
      <div className="mb-8 flex flex-col items-center">
        <div
          className={clsx(
            'w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500',
            connectionStatus === 'connected' ? 'bg-blue-50' : 'bg-slate-50',
            callState === 'persona_speaking' &&
              'animate-pulse scale-110 bg-blue-100'
          )}
        >
          <div
            className={clsx(
              'w-4 h-4 rounded-full transition-colors duration-300',
              connectionStatus === 'connected' ? 'bg-blue-500' : 'bg-slate-300',
              callState === 'persona_speaking' && 'bg-blue-600'
            )}
          />
        </div>

        <p className="text-slate-500 font-medium mb-2">
          {connectionStatus === 'disconnected' && 'Ready to call'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'connected' &&
            callState === 'idle' &&
            'Processing...'}
          {connectionStatus === 'connected' &&
            callState === 'persona_speaking' &&
            'Persona speaking...'}
          {connectionStatus === 'connected' &&
            callState === 'waiting_for_user' &&
            'Your turn - click Speak'}
          {connectionStatus === 'connected' &&
            callState === 'user_speaking' &&
            'Listening...'}
        </p>

        {currentTurn > 0 && (
          <p className="text-xs text-slate-400">Turn {currentTurn}</p>
        )}

        {personaTranscript && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg max-w-md">
            <p className="text-sm text-slate-700 italic">
              &quot;{personaTranscript}&quot;
            </p>
          </div>
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
          <>
            {callState === 'waiting_for_user' && (
              <button
                onClick={handleStartSpeaking}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition-colors shadow-sm hover:shadow-md animate-pulse"
              >
                <Mic className="w-5 h-5" />
                Speak
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors shadow-sm hover:shadow-md"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>

            {isListening && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Listening...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
