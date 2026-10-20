import { describe, expect, it } from 'vitest';
import { decodePresence, encodePresence, presenceKey, stalePresenceKeys } from './presence';

const NOW = 1_800_000_000_000;

describe('presence notes', () => {
  it('round-trips and leaves out me and people who left', () => {
    const notes = {
      [presenceKey('me')]: encodePresence({ name: 'Me', app: 'rewriter', at: NOW }, presenceKey('me')),
      [presenceKey('alex')]: encodePresence({ name: 'Alex Rivera', app: 'basecamp', at: NOW - 10_000 }, presenceKey('alex')),
      [presenceKey('sam')]: encodePresence({ name: 'Sam', app: 'viewfinder', at: NOW - 5 * 60_000 }, presenceKey('sam')),
      other: 'not ours',
    };
    expect(decodePresence(notes, 'me', NOW)).toEqual([{ userId: 'alex', name: 'Alex Rivera', app: 'basecamp', at: NOW - 10_000 }]);
  });

  it('fits Drive\'s 124-byte limit and keeps pipes out of names', () => {
    const key = presenceKey('123456789012345678901');
    const value = encodePresence({ name: 'Ä'.repeat(200) + '|x', app: 'superVisor', at: NOW }, key);
    expect(new TextEncoder().encode(key + value).length).toBeLessThanOrEqual(124);
    expect(value.split('|')).toHaveLength(3);
  });

  it('finds notes old enough to clean up', () => {
    const notes = { [presenceKey('a')]: `${(NOW - 11 * 60_000) / 1000}|rewriter|A`, [presenceKey('b')]: `${NOW / 1000}|rewriter|B` };
    expect(stalePresenceKeys(notes, NOW)).toEqual([presenceKey('a')]);
  });
});
