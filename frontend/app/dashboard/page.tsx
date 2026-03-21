import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession, getSessions, Session, SessionDetail, Scorecard } from '@/lib/api';

const SEED_REPS = [
  { userId: 'temp-user-001', name: 'Avery Stone' },
  { userId: 'temp-user-002', name: 'Jordan Lee' },
  { userId: 'temp-user-003', name: 'Morgan Patel' },
];

const CATEGORY_LABELS = {
  opener: 'Opener',
  objection: 'Objection',
  tone: 'Tone',
  discovery: 'Discovery',
  close: 'Close',
} as const;

type WeakestCategory = keyof typeof CATEGORY_LABELS;

type RepRow = {
  userId: string;
  repName: string;
  sessionsThisWeek: number;
  averageScore: number;
  trendUp: boolean;
  weakestCategory: string;
};

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isThisWeek(timestamp?: string): boolean {
  if (!timestamp) return false;

  const sessionDate = new Date(timestamp);
  const weekStart = getWeekStart(new Date());
  return sessionDate >= weekStart;
}

function getDiscoveryScore(scorecard: Scorecard): number {
  return typeof scorecard.discovery_score === 'number'
    ? scorecard.discovery_score
    : Math.round(
        (scorecard.opener_score +
          scorecard.objection_handling_score +
          scorecard.tone_confidence_score +
          scorecard.close_attempt_score) /
          4,
      );
}

function getWeakestCategory(scorecard: Scorecard): string {
  const categories: Array<{ key: WeakestCategory; score: number }> = [
    { key: 'opener', score: scorecard.opener_score },
    { key: 'objection', score: scorecard.objection_handling_score },
    { key: 'tone', score: scorecard.tone_confidence_score },
    { key: 'discovery', score: getDiscoveryScore(scorecard) },
    { key: 'close', score: scorecard.close_attempt_score },
  ];

  categories.sort((left, right) => left.score - right.score);
  return CATEGORY_LABELS[categories[0].key];
}

function summarizeRep(
  rep: (typeof SEED_REPS)[number],
  sessions: Session[],
  details: SessionDetail[],
): RepRow {
  const completedDetails = details
    .filter((detail) => detail.session.status === 'completed' && detail.scorecard)
    .sort(
      (left, right) =>
        new Date(right.session.started_at).getTime() - new Date(left.session.started_at).getTime(),
    );

  const scores = completedDetails.map((detail) => detail.scorecard?.overall_score ?? 0);
  const recent = completedDetails[0]?.scorecard;
  const previous = completedDetails[1]?.scorecard;

  return {
    userId: rep.userId,
    repName: rep.name,
    sessionsThisWeek: sessions.filter((session) => isThisWeek(session.started_at)).length,
    averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
    trendUp: recent && previous ? recent.overall_score > previous.overall_score : true,
    weakestCategory: recent ? getWeakestCategory(recent) : 'No scored calls',
  };
}

export default async function DashboardPage() {
  const rows = await Promise.all(
    SEED_REPS.map(async (rep) => {
      const sessions = await getSessions(rep.userId);
      const details = await Promise.all(
        sessions
          .filter((session) => session.status === 'completed')
          .map((session) => getSession(session.id)),
      );

      return summarizeRep(rep, sessions, details);
    }),
  );

  const leaderboard = rows.sort((left, right) => right.averageScore - left.averageScore);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f5f7f2_0%,_#edf3ec_48%,_#f8faf7_100%)] p-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
            Manager Dashboard
          </div>
        </div>

        <section className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
            Team Performance
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            See who is improving, where they break down, and who needs a new scenario next.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            This board aggregates seeded reps from the current session APIs and turns individual
            scorecards into a team view for managers and judges.
          </p>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.22em] text-slate-300">
              <tr>
                <th className="px-6 py-4">Rep Name</th>
                <th className="px-6 py-4">Sessions This Week</th>
                <th className="px-6 py-4">Avg Score</th>
                <th className="px-6 py-4">Trend</th>
                <th className="px-6 py-4">Weakest Category</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaderboard.map((row) => (
                <tr key={row.userId} className="hover:bg-slate-50">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-950">{row.repName}</span>
                      <span className="text-xs text-slate-500">{row.userId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-700">{row.sessionsThisWeek}</td>
                  <td className="px-6 py-5 text-sm font-semibold text-slate-950">{row.averageScore}</td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                        row.trendUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {row.trendUp ? '↑' : '↓'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-700">{row.weakestCategory}</td>
                  <td className="px-6 py-5 text-right">
                    <button
                      type="button"
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      Assign scenario
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
