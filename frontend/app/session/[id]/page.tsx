'use client';

import { PERSONAS } from '@/lib/personas';
import { VoiceCallUI } from '@/components/VoiceCallUI';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createSession } from '@/lib/api';

const PERSONA_ID_MAP: Record<string, string> = {
  easy: 'marcus',
  medium: 'sarah',
  aggressive: 'robert',
};

export function getBackendPersonaId(personaId: string): string {
  return PERSONA_ID_MAP[personaId] || 'marcus';
}

export default function SessionPage() {
  const params = useParams();
  const id = params?.id as string;
  const persona = PERSONAS.find((p) => p.id === id);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(true);
  const backendPersonaId = getBackendPersonaId(id);

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
    <main className="min-h-screen bg-cream-50 p-8 flex flex-col">
      <div className="max-w-4xl mx-auto w-full">
        <Link href="/session/new" className="inline-flex items-center text-brand-400 hover:text-brand-700 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Change Persona
        </Link>

        <div className="text-center mb-12">
          <h1 className="font-display text-3xl text-brand-900 mb-2">Practice with <span className="text-brand-600">{persona.name}</span></h1>
          <p className="text-brand-400">{persona.description}</p>
        </div>

        {isCreatingSession ? (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-cream-200">
            <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mb-4" />
            <p className="text-brand-400">Preparing session...</p>
          </div>
        ) : sessionId ? (
          <VoiceCallUI agentId={persona.agentId} personaId={backendPersonaId} sessionId={sessionId} />
        ) : (
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-8 bg-red-50 rounded-2xl border border-red-200">
            <p className="text-red-700">Failed to create session. Please refresh the page.</p>
          </div>
        )}
      </div>
    </main>
  );
}
