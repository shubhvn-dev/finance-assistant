import { getSession, Annotation } from '@/lib/api';
import { Scorecard } from '@/components/Scorecard';
import Link from 'next/link';
import { ArrowLeft, Home, TrendingUp, TrendingDown } from 'lucide-react';
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
        {scorecard ? (
          <Scorecard scorecard={scorecard} personaName={personaName} />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-4">Scorecard Not Available</h1>
            <p className="text-yellow-700">
              This session has not been scored yet. Please complete the call first.
            </p>
          </div>
        )}

        {/* Annotated Transcript */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mt-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Call Transcript</h3>
          {scorecard?.annotations && scorecard.annotations.length > 0 && (
            <p className="text-sm text-slate-500 mb-6">
              Annotated — {scorecard.annotations.length} coaching moment{scorecard.annotations.length !== 1 ? 's' : ''} highlighted
            </p>
          )}
          {!scorecard?.annotations && <div className="mb-6" />}

          {messages.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No messages recorded.</p>
          ) : (() => {
            const annotationMap = new Map<number, Annotation>(
              (scorecard?.annotations ?? []).map((a: Annotation) => [a.turn_number, a])
            );

            return (
              <div className="space-y-3">
                {messages.map((message: import('@/lib/api').Message) => {
                  const annotation = message.role === 'advisor'
                    ? annotationMap.get(message.turn_number)
                    : undefined;

                  const isGood = annotation?.type === 'good';
                  const isBad = annotation?.type === 'bad';

                  return (
                    <div key={message.id}>
                      {/* Message bubble */}
                      <div
                        className={`p-4 rounded-lg border ${
                          isBad
                            ? 'bg-red-50 border-red-200'
                            : isGood
                            ? 'bg-green-50 border-green-200'
                            : message.role === 'advisor'
                            ? 'bg-blue-50 border-blue-100'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-semibold uppercase ${
                              isBad
                                ? 'text-red-700'
                                : isGood
                                ? 'text-green-700'
                                : message.role === 'advisor'
                                ? 'text-blue-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {message.role === 'advisor' ? 'You' : personaName}
                          </span>
                          <span className="text-xs text-slate-400">Turn {message.turn_number}</span>
                          {annotation && (
                            <span
                              className={`ml-auto flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isGood
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isGood ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {annotation.label}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800">{message.content}</p>
                      </div>

                      {/* Annotation card */}
                      {annotation && (
                        <div
                          className={`mx-4 rounded-b-xl border-x border-b px-4 py-3 ${
                            isGood
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <p className={`text-sm ${isGood ? 'text-green-800' : 'text-red-800'}`}>
                            {annotation.insight}
                          </p>
                          {annotation.rewrite && (
                            <div className="mt-2 pt-2 border-t border-red-200">
                              <p className="text-xs font-semibold text-red-600 uppercase mb-1">
                                Say this instead
                              </p>
                              <p className="text-sm text-red-900 italic">
                                &ldquo;{annotation.rewrite}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
