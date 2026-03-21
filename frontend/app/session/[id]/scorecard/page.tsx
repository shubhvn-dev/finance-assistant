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
  const annotationMap = new Map<number, Annotation>(
    (scorecard?.annotations ?? []).map((annotation: Annotation) => [annotation.turn_number, annotation]),
  );

  return (
    <main className="min-h-screen bg-cream-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/session/new"
            className="inline-flex items-center text-brand-400 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            New Session
          </Link>

          <Link
            href="/"
            className="inline-flex items-center text-brand-400 hover:text-brand-700 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Link>
        </div>

        {/* Scorecard */}
        {scorecard ? (
          <Scorecard scorecard={scorecard} personaName={personaName} />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl text-amber-900 mb-4">Scorecard Not Available</h1>
            <p className="text-amber-700">
              This session has not been scored yet. Please complete the call first.
            </p>
          </div>
        )}

        {/* Annotated Transcript */}
        <div className="bg-white rounded-2xl shadow-lg border border-cream-200 p-8 mt-6">
          <h3 className="font-display text-xl text-brand-900 mb-2">Call Transcript</h3>
          {scorecard?.annotations && scorecard.annotations.length > 0 && (
            <p className="text-sm text-brand-400 mb-6">
              Annotated — {scorecard.annotations.length} coaching moment{scorecard.annotations.length !== 1 ? 's' : ''} highlighted
            </p>
          )}
          {!scorecard?.annotations && <div className="mb-6" />}

          {messages.length === 0 ? (
            <p className="text-brand-400 text-center py-8">No messages recorded.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((message: import('@/lib/api').Message) => {
                const annotation =
                  message.role === 'advisor' ? annotationMap.get(message.turn_number) : undefined;
                const isGood = annotation?.type === 'good';
                const isBad = annotation?.type === 'bad';
                const calloutClasses = isGood
                  ? 'bg-green-50 border-green-200'
                  : isBad
                    ? 'bg-red-50 border-red-200'
                    : message.role === 'advisor'
                      ? 'bg-brand-50 border-brand-100'
                      : 'bg-cream-100 border-cream-200';

                return (
                  <div key={message.id}>
                    <div className={`rounded-lg border p-4 ${calloutClasses}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold uppercase ${
                            isBad
                              ? 'text-red-700'
                              : isGood
                                ? 'text-green-700'
                                : message.role === 'advisor'
                                  ? 'text-brand-600'
                                  : 'text-brand-400'
                          }`}
                        >
                          {message.role === 'advisor' ? 'You' : personaName}
                        </span>
                        <span className="text-xs text-brand-300">Turn {message.turn_number}</span>
                        {annotation && (
                          <span
                            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {isGood ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {annotation.label}
                          </span>
                        )}
                      </div>
                      <p className="text-brand-800">{message.content}</p>
                    </div>

                    {annotation && (
                      <div
                        className={`mx-4 border-l-2 px-4 py-3 ${
                          isGood
                            ? 'border-green-500 bg-green-50 text-green-900'
                            : 'border-red-500 bg-red-50 text-red-900'
                        }`}
                      >
                        <p className="text-sm">{annotation.insight}</p>
                        {annotation.rewrite && (
                          <p className="mt-2 text-sm italic text-green-700">
                            Try instead: {annotation.rewrite}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/session/new"
            className="btn-primary"
          >
            Practice Again
          </Link>
        </div>
      </div>
    </main>
  );
}
