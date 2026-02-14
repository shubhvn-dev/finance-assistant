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
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-slate-500 hover:text-slate-900 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Call Logs</h1>
            <p className="text-slate-500 mt-2">Review your practice sessions and performance</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading call history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sessions.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No calls yet</h3>
            <p className="text-slate-500 mb-6">Start your first practice session to see it here</p>
            <Link
              href="/session/new"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Practice
            </Link>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && sessions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Persona
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/session/${session.id}/scorecard`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-slate-400 mr-2" />
                          <span className="text-sm text-slate-900">
                            {formatDate(session.started_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-slate-400 mr-2" />
                          <span className="text-sm text-slate-900">
                            {PERSONA_NAMES[session.persona_id] || session.persona_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">
                          {getDuration(session.started_at, session.ended_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : session.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
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
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
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
