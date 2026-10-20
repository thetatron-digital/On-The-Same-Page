// ============================================
// STORYBOARD BOARDS: numbering, shots, timing
// ============================================
// Same behavior as Storyboarder (findings/storyboarder.md): when boards are
// flagged "new shot", each flagged board starts the next shot and the boards
// after it continue it with letters (1A, 1B, 1C, then 2A...). With no flags
// at all, every board is its own shot (1A, 2A, 3A). Board start times are
// cumulative durations. OTSP's own code; the rules are the observed behavior.

export interface TimedBoard {
  newShot?: boolean;
  durationMs?: number;
}

export interface BoardPosition {
  number: number; // 1-based board number
  shot: string; // "1A", "1B", "2A"...
  startMs: number;
  durationMs: number;
}

/** A, B ... Z, then A2 ... Z2, A3 ... */
export const shotLetter = (index: number) => {
  const letter = String.fromCharCode(65 + (index % 26));
  const round = Math.floor(index / 26);
  return round === 0 ? letter : `${letter}${round + 1}`;
};

export function boardPositions(boards: TimedBoard[], defaultDurationMs = 2000): BoardPosition[] {
  const anyNewShot = boards.some((b) => b.newShot);
  let shot = 0;
  let within = 0;
  let time = 0;
  return boards.map((board, i) => {
    if (!anyNewShot || board.newShot || i === 0) {
      shot += 1;
      within = 0;
    } else {
      within += 1;
    }
    const durationMs = board.durationMs && board.durationMs > 0 ? board.durationMs : defaultDurationMs;
    const position = { number: i + 1, shot: `${shot}${shotLetter(within)}`, startMs: time, durationMs };
    time += durationMs;
    return position;
  });
}

const words = (text?: string) => (text ?? '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Suggested board length from its text: about 300 ms per spoken word plus a
 * second for dialogue, 200 ms per word of action; never under the default.
 * (OTSP's own estimate.)
 */
export function suggestDurationMs(board: { dialogue?: string; actionNotes?: string }, defaultDurationMs = 2000): number {
  const dialogue = words(board.dialogue);
  const action = words(board.actionNotes);
  const estimate = (dialogue ? dialogue * 300 + 1000 : 0) + (action ? action * 200 + 500 : 0);
  return Math.max(defaultDurationMs, Math.round(estimate / 100) * 100);
}

export const formatTime = (ms: number) => {
  const total = Math.round(ms / 100) / 10;
  const minutes = Math.floor(total / 60);
  const seconds = (total - minutes * 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
};

/** Board at a given playback time (for the animatic) */
export function boardAtTime(positions: BoardPosition[], ms: number): number {
  for (let i = positions.length - 1; i >= 0; i--) if (ms >= positions[i].startMs) return i;
  return 0;
}
