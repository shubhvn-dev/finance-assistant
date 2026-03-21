import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/app/dashboard/page';
import { getSession, getSessions } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getSession: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}));

const mockedGetSession = vi.mocked(getSession);
const mockedGetSessions = vi.mocked(getSessions);

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedGetSession.mockReset();
    mockedGetSessions.mockReset();
  });

  it('builds the manager leaderboard from seeded rep sessions', async () => {
    mockedGetSessions
      .mockResolvedValueOnce([
        {
          id: 'session-a1',
          user_id: 'temp-user-001',
          persona_id: 'robert',
          started_at: '2026-03-21T12:00:00Z',
          ended_at: '2026-03-21T12:08:00Z',
          status: 'completed',
        },
        {
          id: 'session-a0',
          user_id: 'temp-user-001',
          persona_id: 'marcus',
          started_at: '2026-03-20T12:00:00Z',
          ended_at: '2026-03-20T12:08:00Z',
          status: 'completed',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'session-b1',
          user_id: 'temp-user-002',
          persona_id: 'sarah',
          started_at: '2026-03-21T13:00:00Z',
          ended_at: '2026-03-21T13:08:00Z',
          status: 'completed',
        },
        {
          id: 'session-b0',
          user_id: 'temp-user-002',
          persona_id: 'robert',
          started_at: '2026-03-20T13:00:00Z',
          ended_at: '2026-03-20T13:08:00Z',
          status: 'completed',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'session-c1',
          user_id: 'temp-user-003',
          persona_id: 'marcus',
          started_at: '2026-03-19T14:00:00Z',
          ended_at: '2026-03-19T14:08:00Z',
          status: 'completed',
        },
      ]);

    mockedGetSession
      .mockResolvedValueOnce({
        session: {
          id: 'session-a1',
          user_id: 'temp-user-001',
          persona_id: 'robert',
          started_at: '2026-03-21T12:00:00Z',
          ended_at: '2026-03-21T12:08:00Z',
          status: 'completed',
        },
        messages: [],
        scorecard: {
          overall_score: 68,
          opener_score: 8,
          opener_feedback: 'Strong opener.',
          objection_handling_score: 7,
          objection_handling_feedback: 'Handled well.',
          tone_confidence_score: 8,
          tone_confidence_feedback: 'Confident.',
          close_attempt_score: 7,
          close_attempt_feedback: 'Clear close.',
          discovery_score: 6,
          discovery_feedback: 'Needed deeper questions.',
          best_moment: 'Good reframe.',
          biggest_mistake: 'Missed a discovery turn.',
          what_to_say_instead: 'Tell me what has felt off in the relationship.',
          meeting_booked: true,
          annotations: [],
        },
      })
      .mockResolvedValueOnce({
        session: {
          id: 'session-a0',
          user_id: 'temp-user-001',
          persona_id: 'marcus',
          started_at: '2026-03-20T12:00:00Z',
          ended_at: '2026-03-20T12:08:00Z',
          status: 'completed',
        },
        messages: [],
        scorecard: {
          overall_score: 70,
          opener_score: 6,
          opener_feedback: 'Flat.',
          objection_handling_score: 7,
          objection_handling_feedback: 'Okay.',
          tone_confidence_score: 7,
          tone_confidence_feedback: 'Solid.',
          close_attempt_score: 6,
          close_attempt_feedback: 'Late close.',
          discovery_score: 6,
          discovery_feedback: 'Average.',
          best_moment: 'Recovered from pushback.',
          biggest_mistake: 'Did not differentiate enough.',
          what_to_say_instead: 'Here is where we are different.',
          meeting_booked: false,
          annotations: [],
        },
      })
      .mockResolvedValueOnce({
        session: {
          id: 'session-b1',
          user_id: 'temp-user-002',
          persona_id: 'sarah',
          started_at: '2026-03-21T13:00:00Z',
          ended_at: '2026-03-21T13:08:00Z',
          status: 'completed',
        },
        messages: [],
        scorecard: {
          overall_score: 91,
          opener_score: 9,
          opener_feedback: 'Excellent.',
          objection_handling_score: 8,
          objection_handling_feedback: 'Strong.',
          tone_confidence_score: 9,
          tone_confidence_feedback: 'Great tone.',
          close_attempt_score: 8,
          close_attempt_feedback: 'Direct close.',
          discovery_score: 8,
          discovery_feedback: 'Good discovery.',
          best_moment: 'Strong transition.',
          biggest_mistake: 'Minor miss.',
          what_to_say_instead: 'Could we unpack that for a second?',
          meeting_booked: true,
          annotations: [],
        },
      })
      .mockResolvedValueOnce({
        session: {
          id: 'session-b0',
          user_id: 'temp-user-002',
          persona_id: 'robert',
          started_at: '2026-03-20T13:00:00Z',
          ended_at: '2026-03-20T13:08:00Z',
          status: 'completed',
        },
        messages: [],
        scorecard: {
          overall_score: 86,
          opener_score: 8,
          opener_feedback: 'Strong.',
          objection_handling_score: 8,
          objection_handling_feedback: 'Strong.',
          tone_confidence_score: 8,
          tone_confidence_feedback: 'Steady.',
          close_attempt_score: 7,
          close_attempt_feedback: 'Solid.',
          discovery_score: 8,
          discovery_feedback: 'Solid discovery.',
          best_moment: 'Good pacing.',
          biggest_mistake: 'Slightly rushed.',
          what_to_say_instead: 'Walk me through what matters most right now.',
          meeting_booked: true,
          annotations: [],
        },
      })
      .mockResolvedValueOnce({
        session: {
          id: 'session-c1',
          user_id: 'temp-user-003',
          persona_id: 'marcus',
          started_at: '2026-03-19T14:00:00Z',
          ended_at: '2026-03-19T14:08:00Z',
          status: 'completed',
        },
        messages: [],
        scorecard: {
          overall_score: 65,
          opener_score: 6,
          opener_feedback: 'Okay.',
          objection_handling_score: 7,
          objection_handling_feedback: 'Decent.',
          tone_confidence_score: 6,
          tone_confidence_feedback: 'Uneven.',
          close_attempt_score: 5,
          close_attempt_feedback: 'Too soft.',
          discovery_score: 5,
          discovery_feedback: 'Not enough discovery.',
          best_moment: 'Kept the call alive.',
          biggest_mistake: 'Quoted value too late.',
          what_to_say_instead: 'Before pricing, what are you optimizing for?',
          meeting_booked: false,
          annotations: [],
        },
      });

    const element = await DashboardPage();
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Manager Dashboard');
    expect(markup).toContain('Rep Name');
    expect(markup).toContain('Sessions This Week');
    expect(markup).toContain('Avg Score');
    expect(markup).toContain('Trend');
    expect(markup).toContain('Weakest Category');
    expect(markup).toContain('Jordan Lee');
    expect(markup).toContain('Avery Stone');
    expect(markup).toContain('Morgan Patel');
    expect(markup).toContain('Assign scenario');
    expect(markup).toContain('Discovery');
    expect(markup).toContain('↑');
    expect(markup).toContain('↓');

    expect(mockedGetSessions).toHaveBeenCalledTimes(3);
    expect(mockedGetSession).toHaveBeenCalledTimes(5);
  });
});
