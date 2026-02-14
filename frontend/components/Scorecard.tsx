'use client';

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Scorecard as ScorecardType } from '@/lib/api';

interface ScorecardProps {
  scorecard: ScorecardType;
  personaName?: string;
}

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 9) return { grade: 'A', color: 'text-green-600' };
  if (score >= 7) return { grade: 'B', color: 'text-blue-600' };
  if (score >= 5) return { grade: 'C', color: 'text-yellow-600' };
  if (score >= 3) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
}

function ScoreBar({ label, score, feedback }: { label: string; score: number; feedback: string }) {
  const percentage = (score / 10) * 100;
  const barColor = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900">{score}/10</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-slate-600">{feedback}</p>
    </div>
  );
}

export function Scorecard({ scorecard, personaName }: ScorecardProps) {
  const { grade, color } = getGrade(scorecard.overall_score);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Overall Score Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Call Performance</h2>
        {personaName && (
          <p className="text-slate-500 mb-6">Practice session with {personaName}</p>
        )}
        <div className={`text-7xl font-bold ${color} mb-2`}>{grade}</div>
        <div className="text-2xl text-slate-700">{scorecard.overall_score}/10</div>

        {/* Meeting Booked Status */}
        <div className="mt-6 flex items-center justify-center">
          {scorecard.meeting_booked ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700 font-semibold">Meeting Booked</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full">
              <XCircle className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600 font-semibold">No Meeting Booked</span>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Scores */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Detailed Breakdown</h3>

        <ScoreBar
          label="Opener"
          score={scorecard.opener_score}
          feedback={scorecard.opener_feedback}
        />

        <ScoreBar
          label="Objection Handling"
          score={scorecard.objection_handling_score}
          feedback={scorecard.objection_handling_feedback}
        />

        <ScoreBar
          label="Tone & Confidence"
          score={scorecard.tone_confidence_score}
          feedback={scorecard.tone_confidence_feedback}
        />

        <ScoreBar
          label="Close Attempt"
          score={scorecard.close_attempt_score}
          feedback={scorecard.close_attempt_feedback}
        />
      </div>

      {/* Key Moments */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Best Moment */}
        <div className="bg-green-50 rounded-2xl border border-green-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-bold text-green-900">Best Moment</h3>
          </div>
          <p className="text-green-800">{scorecard.best_moment}</p>
        </div>

        {/* Biggest Mistake */}
        <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Biggest Mistake</h3>
          </div>
          <p className="text-red-800 mb-4">{scorecard.biggest_mistake}</p>

          <div className="mt-4 pt-4 border-t border-red-200">
            <p className="text-xs font-semibold text-red-700 uppercase mb-2">What to say instead:</p>
            <p className="text-red-900 font-medium italic">
              &ldquo;{scorecard.what_to_say_instead}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
