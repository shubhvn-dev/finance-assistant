'use client';

import { PERSONAS } from '@/lib/personas';
import { VoiceCallUI } from '@/components/VoiceCallUI';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createSession } from '@/lib/api';

export default function SessionPage() {
  const params = useParams();
  const id = params?.id as string;
  const persona = PERSONAS.find((p) => p.id === id);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(true);

  // Map frontend persona IDs to backend persona IDs
  const personaIdMap: Record<string, string> = {
    'easy': 'marcus',
    'medium': 'sarah',
    'aggressive': 'robert',
  };

  const backendPersonaId = personaIdMap[id] || 'marcus';

  // Create session on page load
  useEffect(() => {
    const initSession = async () => {
      try {
        console.log('[SessionPage] Creating session for persona:', backendPersonaId);
        const session = await createSession({
          user_id: 'temp-user-001',
          persona_id: backendPersonaId,
        });
        setSessionId(session.id);
        console.log('[SessionPage] Session created:', session.id);
      } catch (err) {
        console.error('[SessionPage] Failed to create session:', err);
      } finally {
        setIsCreatingSession(false);
      }
    };

    initSession();
  }, [backendPersonaId]);

  if (!persona) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 flex flex-col">
      <div className="max-w-4xl mx-auto w-full">
        <Link href="/session/new" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Change Persona
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Practice with {persona.name}</h1>
          <p className="text-slate-500">{persona.description}</p>
        </div>

        {isCreatingSession ? (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
            <p className="text-slate-500">Preparing session...</p>
          </div>
        ) : sessionId ? (
          <VoiceCallUI agentId={persona.agentId} personaId={backendPersonaId} sessionId={sessionId} />
        ) : (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-700">Failed to create session. Please refresh the page.</p>
          </div>
        )}
      </div>
    </main>
  );
}