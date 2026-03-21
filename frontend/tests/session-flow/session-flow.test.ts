import { describe, expect, it } from 'vitest';
import { getBackendPersonaId } from '../../app/session/[id]/page';
import { normalizeMessageRole } from '../../components/VoiceCallUI';
import { parseApiError } from '../../lib/api';

describe('session flow helpers', () => {
  it('maps frontend persona ids to backend persona ids', () => {
    expect(getBackendPersonaId('easy')).toBe('marcus');
    expect(getBackendPersonaId('medium')).toBe('sarah');
    expect(getBackendPersonaId('aggressive')).toBe('robert');
    expect(getBackendPersonaId('unknown')).toBe('marcus');
  });

  it('normalizes websocket message roles for transcript persistence', () => {
    expect(normalizeMessageRole('user')).toBe('advisor');
    expect(normalizeMessageRole('agent')).toBe('prospect');
    expect(normalizeMessageRole('ai')).toBe('prospect');
    expect(normalizeMessageRole('something-else')).toBe('prospect');
  });

  it('extracts readable api error messages with fallback support', () => {
    expect(parseApiError({ detail: 'Session failed' }, 'Fallback')).toBe('Session failed');
    expect(parseApiError({ message: 'Bad request' }, 'Fallback')).toBe('Bad request');
    expect(parseApiError({}, 'Fallback')).toBe('Fallback');
  });
});
