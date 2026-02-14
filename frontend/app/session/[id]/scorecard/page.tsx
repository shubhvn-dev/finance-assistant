import { getSession } from '@/lib/api';
import { Scorecard } from '@/components/Scorecard';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { notFound } from 'next/navigation';

interface ScorecardPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Persona name mapping
const PERSONA_NAMES: Record<string, string> = {
  'robert': 'Robert Chen',
  'sarah': 'Sarah Mitchell',
  'marcus': 'Marcus Johnson',
};

export default async function ScorecardPage({ params }: ScorecardPageProps) {
  const { id } = await params;

  let sessionDetail;

  try {
    sessionDetail = await getSession(id);
  } catch (error) {
    console.error('Failed to fetch session:', error);
    notFound();
  }

  const { session, messages, scorecard } = sessionDetail;

  if (!scorecard) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-4">Scorecard Not Available</h1>
            <p className="text-yellow-700 mb-6">
              This session has not been scored yet. Please complete the call first.
            </p>
            <Link
              href="/session/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const personaName = PERSONA_NAMES[session.persona_id] || session.persona_id;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/session/new"
            className="inline-flex items-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            New Session
          </Link>

          <Link
            href="/"
            className="inline-flex items-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Link>
        </div>

        {/* Scorecard */}
        <Scorecard scorecard={scorecard} personaName={personaName} />

        {/* Transcript */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mt-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Call Transcript</h3>

          {messages.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No messages recorded.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message, idx) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.role === 'advisor'
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-slate-50 border border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-semibold uppercase ${
                        message.role === 'advisor' ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {message.role === 'advisor' ? 'You' : personaName}
                    </span>
                    <span className="text-xs text-slate-400">Turn {message.turn_number}</span>
                  </div>
                  <p className="text-slate-800">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/session/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            Practice Again
          </Link>
        </div>
      </div>
    </main>
  );
}
