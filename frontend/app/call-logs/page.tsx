'use client';

import { useEffect, useState } from 'react';
import { getSessions, Session } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, FileText, Clock, User } from 'lucide-react';

// Persona name mapping
const PERSONA_NAMES: Record<string, string> = {
  'robert': 'Robert Chen (Hard)',
  'sarah': 'Sarah Mitchell (Medium)',
  'marcus': 'Marcus Johnson (Easy)',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return 'In progress';

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

export default function CallLogsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await getSessions('temp-user-001');
        setSessions(data);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError('Failed to load call history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return (
    <main className="min-h-screen bg-cream-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-brand-400 hover:text-brand-700 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="font-display text-3xl text-brand-900">Call Logs</h1>
            <p className="text-brand-400 mt-2">Review your practice sessions and performance</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-brand-400">Loading call history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sessions.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 p-12 text-center">
            <FileText className="w-16 h-16 text-brand-200 mx-auto mb-4" />
            <h3 className="font-display text-xl text-brand-900 mb-2">No calls yet</h3>
            <p className="text-brand-400 mb-6">Start your first practice session to see it here</p>
            <Link
              href="/session/new"
              className="btn-primary"
            >
              Start Practice
            </Link>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && sessions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream-100 border-b border-cream-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      Persona
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-cream-200 hover:bg-brand-50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/session/${session.id}/scorecard`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-brand-300 mr-2" />
                          <span className="text-sm text-brand-800">
                            {formatDate(session.started_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-brand-300 mr-2" />
                          <span className="text-sm text-brand-800">
                            {PERSONA_NAMES[session.persona_id] || session.persona_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-brand-800">
                          {getDuration(session.started_at, session.ended_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.status === 'completed'
                              ? 'bg-green-50 text-green-700'
                              : session.status === 'in_progress'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {session.status === 'completed' ? 'Completed' :
                           session.status === 'in_progress' ? 'In Progress' :
                           'Abandoned'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/session/${session.id}/scorecard`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Report
                          <FileText className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
