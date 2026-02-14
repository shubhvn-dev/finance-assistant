import { PERSONAS } from '@/lib/personas';
import { VoiceCallUI } from '@/components/VoiceCallUI';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface SessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const persona = PERSONAS.find((p) => p.id === id);

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

        <VoiceCallUI agentId={persona.agentId} />
      </div>
    </main>
  );
}