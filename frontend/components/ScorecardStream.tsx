'use client';

import { experimental_useObject as useObject } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { scorecardSchema } from '@/lib/scorecardSchema';
import { saveScorecard } from '@/lib/api';
import type { Message } from '@/lib/api';

interface Props {
  sessionId: string;
  personaId: string;
  messages: Message[];
  personaName: string;
}

function getGrade(score: number) {
  if (score >= 9) return { grade: 'A', color: 'text-green-600' };
  if (score >= 7) return { grade: 'B', color: 'text-blue-600' };
  if (score >= 5) return { grade: 'C', color: 'text-yellow-600' };
  if (score >= 3) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
}

function ScoreBar({ label, score, feedback }: { label: string; score?: number; feedback?: string }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  const barColor = score == null ? 'bg-slate-200' : score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900">{score != null ? `${score}/10` : '—'}</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {feedback && <p className="text-sm text-slate-600">{feedback}</p>}
    </div>
  );
}

export function ScorecardStream({ sessionId, personaId, messages, personaName }: Props) {
  const submitted = useRef(false);
  const [saved, setSaved] = useState(false);

  const { object, submit, isLoading, error } = useObject({
    api: '/api/generate-scorecard',
    schema: scorecardSchema,
  });

  useEffect(() => {
    if (!submitted.current) {
      submitted.current = true;
      submit({
        sessionId,
        personaId,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          turn_number: m.turn_number,
        })),
      });
    }
  }, []);

  useEffect(() => {
    if (!isLoading && object && !saved) {
      setSaved(true);
      saveScorecard(sessionId, {
        overall_score: object.overall_score ?? 0,
        opener_score: object.opener_score ?? 0,
        opener_feedback: object.opener_feedback ?? '',
        objection_handling_score: object.objection_handling_score ?? 0,
        objection_handling_feedback: object.objection_handling_feedback ?? '',
        tone_confidence_score: object.tone_confidence_score ?? 0,
        tone_confidence_feedback: object.tone_confidence_feedback ?? '',
        close_attempt_score: object.close_attempt_score ?? 0,
        close_attempt_feedback: object.close_attempt_feedback ?? '',
        best_moment: object.best_moment ?? '',
        biggest_mistake: object.biggest_mistake ?? '',
        what_to_say_instead: object.what_to_say_instead ?? '',
        meeting_booked: object.meeting_booked ?? false,
        annotations: object.annotations as never,
      }).catch(console.error);
    }
  }, [isLoading, object, saved, sessionId]);

  const annotationMap = new Map(
    (object?.annotations ?? [])
      .filter((a): a is NonNullable<typeof a> => a != null)
      .map((a) => [a.turn_number, a])
  );

  const grade = object?.overall_score != null ? getGrade(object.overall_score) : null;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Analysis Failed</h3>
        <p className="text-red-700 text-sm">Could not generate scorecard. Check your Gemini API key.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Overall score */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
        {isLoading && !object?.overall_score ? (
          <>
            <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Analyzing your call...</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Call Performance</h2>
            <p className="text-slate-500 mb-6">Practice session with {personaName}</p>
            <div className={`text-7xl font-bold ${grade?.color ?? 'text-slate-300'} mb-2`}>
              {grade?.grade ?? '—'}
            </div>
            <div className="text-2xl text-slate-700">{object?.overall_score ?? '—'}/10</div>
            <div className="mt-6 flex items-center justify-center">
              {object?.meeting_booked === true ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-semibold">Meeting Booked</span>
                </div>
              ) : object?.meeting_booked === false ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full">
                  <XCircle className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-600 font-semibold">No Meeting Booked</span>
                </div>
              ) : null}
            </div>
          </>
        )}
        {isLoading && (
          <p className="text-xs text-slate-400 mt-4 animate-pulse">
            {!object?.overall_score ? 'Extracting signals...' : 'Generating feedback...'}
          </p>
        )}
        {!isLoading && saved && (
          <p className="text-xs text-green-600 mt-4">Saved · rubric {object && 'v2.0'} · {process.env.NEXT_PUBLIC_GEMINI_MODEL ?? 'gemini-2.0-flash'}</p>
        )}
      </div>

      {/* Score breakdown */}
      {(object?.opener_score != null || isLoading) && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Detailed Breakdown</h3>
          <ScoreBar label="Opener" score={object?.opener_score} feedback={object?.opener_feedback} />
          <ScoreBar label="Objection Handling" score={object?.objection_handling_score} feedback={object?.objection_handling_feedback} />
          <ScoreBar label="Tone & Confidence" score={object?.tone_confidence_score} feedback={object?.tone_confidence_feedback} />
          <ScoreBar label="Close Attempt" score={object?.close_attempt_score} feedback={object?.close_attempt_feedback} />
        </div>
      )}

      {/* Key moments */}
      {(object?.best_moment || object?.biggest_mistake) && (
        <div className="grid md:grid-cols-2 gap-6">
          {object.best_moment && (
            <div className="bg-green-50 rounded-2xl border border-green-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-bold text-green-900">Best Moment</h3>
              </div>
              <p className="text-green-800">{object.best_moment}</p>
            </div>
          )}
          {object.biggest_mistake && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-bold text-red-900">Biggest Mistake</h3>
              </div>
              <p className="text-red-800 mb-4">{object.biggest_mistake}</p>
              {object.what_to_say_instead && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-xs font-semibold text-red-700 uppercase mb-2">What to say instead:</p>
                  <p className="text-red-900 font-medium italic">&ldquo;{object.what_to_say_instead}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Annotated transcript */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Call Transcript</h3>
        {isLoading && (
          <p className="text-sm text-slate-400 mb-6 animate-pulse">Annotations loading...</p>
        )}
        {!isLoading && annotationMap.size > 0 && (
          <p className="text-sm text-slate-500 mb-6">
            {annotationMap.size} coaching moment{annotationMap.size !== 1 ? 's' : ''} highlighted
          </p>
        )}
        {!isLoading && annotationMap.size === 0 && <div className="mb-6" />}

        {messages.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No messages recorded.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const annotation = message.role === 'advisor'
                ? annotationMap.get(message.turn_number)
                : undefined;
              const isGood = annotation?.type === 'good';
              const isBad = annotation?.type === 'bad';

              return (
                <div key={message.id}>
                  <div className={`p-4 rounded-lg border ${
                    isBad ? 'bg-red-50 border-red-200'
                    : isGood ? 'bg-green-50 border-green-200'
                    : message.role === 'advisor' ? 'bg-blue-50 border-blue-100'
                    : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold uppercase ${
                        isBad ? 'text-red-700'
                        : isGood ? 'text-green-700'
                        : message.role === 'advisor' ? 'text-blue-700'
                        : 'text-slate-700'
                      }`}>
                        {message.role === 'advisor' ? 'You' : personaName}
                      </span>
                      <span className="text-xs text-slate-400">Turn {message.turn_number}</span>
                      {annotation && (
                        <span className={`ml-auto flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {annotation.label}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800">{message.content}</p>
                  </div>

                  {annotation && (
                    <div className={`mx-4 rounded-b-xl border-x border-b px-4 py-3 ${
                      isGood ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <p className={`text-sm ${isGood ? 'text-green-800' : 'text-red-800'}`}>
                        {annotation.insight}
                      </p>
                      {annotation.rewrite && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <p className="text-xs font-semibold text-red-600 uppercase mb-1">Say this instead</p>
                          <p className="text-sm text-red-900 italic">&ldquo;{annotation.rewrite}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
