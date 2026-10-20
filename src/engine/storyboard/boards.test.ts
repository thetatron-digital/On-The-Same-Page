import { describe, expect, it } from 'vitest';
import { boardAtTime, boardPositions, formatTime, shotLetter, suggestDurationMs } from './boards';

describe('storyboard boards', () => {
  it('numbers every board as its own shot when nothing is flagged', () => {
    expect(boardPositions([{}, {}, {}]).map((p) => p.shot)).toEqual(['1A', '2A', '3A']);
  });

  it('continues shots with letters until the next new-shot board', () => {
    const shots = boardPositions([{ newShot: true }, {}, {}, { newShot: true }, {}]).map((p) => p.shot);
    expect(shots).toEqual(['1A', '1B', '1C', '2A', '2B']);
  });

  it('treats the first board as a new shot even if unflagged', () => {
    expect(boardPositions([{}, {}, { newShot: true }]).map((p) => p.shot)).toEqual(['1A', '1B', '2A']);
  });

  it('runs letters past Z as A2, B2...', () => {
    expect([0, 25, 26, 27, 52].map(shotLetter)).toEqual(['A', 'Z', 'A2', 'B2', 'A3']);
  });

  it('accumulates start times with a default board length', () => {
    const positions = boardPositions([{ durationMs: 1500 }, {}, { durationMs: 500 }], 2000);
    expect(positions.map((p) => [p.startMs, p.durationMs])).toEqual([[0, 1500], [1500, 2000], [3500, 500]]);
    expect([0, 1499, 1500, 3600, 99999].map((t) => boardAtTime(positions, t))).toEqual([0, 0, 1, 2, 2]);
  });

  it('suggests a length from dialogue and action word counts', () => {
    expect(suggestDurationMs({})).toBe(2000);
    expect(suggestDurationMs({ dialogue: 'I told you not to come back here tonight.' })).toBe(3700);
    expect(suggestDurationMs({ dialogue: 'Run.', actionNotes: 'She bolts through the rain toward the car.' })).toBe(3400);
  });

  it('formats times as m:ss.s', () => {
    expect([0, 1500, 65000].map(formatTime)).toEqual(['0:00.0', '0:01.5', '1:05.0']);
  });
});
