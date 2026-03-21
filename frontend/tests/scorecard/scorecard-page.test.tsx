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
});
