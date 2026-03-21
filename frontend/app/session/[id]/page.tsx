'use client';

import { PERSONAS } from '@/lib/personas';
import { VoiceCallUI } from '@/components/VoiceCallUI';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSession } from '@/lib/api';

const PERSONA_ID_MAP: Record<string, string> = {
  easy: 'marcus',
  medium: 'sarah',
  aggressive: 'robert',
};

const PERSONA_FULL_NAMES: Record<string, string> = {
  marcus: 'Marcus Johnson',
  sarah: 'Sarah Mitchell',
  robert: 'Robert Chen',
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

  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await createSession({
          user_id: 'temp-user-001',
          persona_id: backendPersonaId,
        });
        setSessionId(session.id);
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

  const personaFullName = PERSONA_FULL_NAMES[backendPersonaId] ?? persona.name;

  return (
    <main className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {isCreatingSession ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-600 border-t-green-500 animate-spin" />
          <p className="text-slate-500 text-sm">Preparing session...</p>
        </div>
      ) : sessionId ? (
        <VoiceCallUI
          agentId={persona.agentId}
          personaId={backendPersonaId}
          sessionId={sessionId}
          personaFullName={personaFullName}
          personaRole={persona.name}
          difficulty={persona.difficulty}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <p className="text-red-400 text-sm">Failed to create session. Please refresh the page.</p>
        </div>
      )}
    </main>
  );
}
