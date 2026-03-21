import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScorecardPage from '@/app/session/[id]/scorecard/page';
import { getSession } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const mockedGetSession = vi.mocked(getSession);

describe('ScorecardPage', () => {
  beforeEach(() => {
    mockedGetSession.mockReset();
  });

  it('renders transcript even when the scorecard is missing', async () => {
    mockedGetSession.mockResolvedValue({
      session: {
        id: 'session-1',
        user_id: 'temp-user-001',
        persona_id: 'robert',
        started_at: '2026-03-21T12:00:00Z',
        status: 'completed',
      },
      messages: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: 'advisor',
          content: 'I wanted to follow up on your current workflow.',
          turn_number: 1,
          created_at: '2026-03-21T12:01:00Z',
        },
      ],
      scorecard: null,
    });

    const element = await ScorecardPage({
      params: Promise.resolve({ id: 'session-1' }),
    });

    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Scorecard Not Available');
    expect(markup).toContain('Call Transcript');
    expect(markup).toContain('I wanted to follow up on your current workflow.');
  });

  it('returns not found for a missing session', async () => {
    mockedGetSession.mockRejectedValue(new Error('Session not found'));

    await expect(
      ScorecardPage({
        params: Promise.resolve({ id: 'missing-session' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders annotated advisor transcript moments', async () => {
    mockedGetSession.mockResolvedValue({
      session: {
        id: 'session-1',
        user_id: 'temp-user-001',
        persona_id: 'robert',
        started_at: '2026-03-21T12:00:00Z',
        status: 'completed',
      },
      messages: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: 'advisor',
          content: 'I wanted to follow up on your current workflow.',
          turn_number: 1,
          created_at: '2026-03-21T12:01:00Z',
        },
        {
          id: 'message-2',
          session_id: 'session-1',
          role: 'prospect',
          content: 'This is not a good time.',
          turn_number: 2,
          created_at: '2026-03-21T12:02:00Z',
        },
      ],
      scorecard: {
        overall_score: 7,
        opener_score: 7,
        opener_feedback: 'Solid start.',
        objection_handling_score: 6,
        objection_handling_feedback: 'Could improve.',
        tone_confidence_score: 8,
        tone_confidence_feedback: 'Confident.',
        close_attempt_score: 5,
        close_attempt_feedback: 'Too early.',
        best_moment: 'Clear value prop.',
        biggest_mistake: 'Did not ask permission.',
        what_to_say_instead: 'Is now an okay time for 30 seconds?',
        meeting_booked: false,
        annotations: [
          {
            turn_number: 1,
            type: 'bad',
            label: 'Weak opener',
            insight: 'You led with a vague follow-up instead of a reason to stay on.',
            rewrite: 'I work with families reviewing concentrated positions like yours.',
          },
        ],
      },
    });

    const element = await ScorecardPage({
      params: Promise.resolve({ id: 'session-1' }),
    });

    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('Annotated');
    expect(markup).toContain('Weak opener');
    expect(markup).toContain('Say this instead');
    expect(markup).toContain('I work with families reviewing concentrated positions like yours.');
  });
});
