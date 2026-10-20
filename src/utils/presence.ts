// Who else has a shared project open. Each editor leaves a short note on
// the Drive file (appProperties: key p_<userId>, value "<seconds>|<app>|<name>")
// and refreshes it while the project is open; notes older than a minute
// or so mean that person has left. Drive allows 124 bytes per key+value
// and 30 notes per app per file, so stale notes get cleared.

export interface Presence {
  userId: string;
  name: string;
  app: string;
  at: number; // ms since epoch
}

export const PRESENCE_PREFIX = 'p_';
export const PRESENCE_STALE_MS = 70_000;    // missed ~3 heartbeats
export const PRESENCE_CLEANUP_MS = 600_000; // remove notes this old

const MAX_BYTES = 124;
const bytes = (s: string) => new TextEncoder().encode(s).length;

export const presenceKey = (userId: string) => `${PRESENCE_PREFIX}${userId}`.slice(0, 48);

export function encodePresence(p: Omit<Presence, 'userId'>, key: string): string {
  let name = p.name.replace(/\|/g, ' ');
  const head = `${Math.round(p.at / 1000)}|${p.app}|`;
  while (name && bytes(key) + bytes(head + name) > MAX_BYTES) name = name.slice(0, -1);
  return head + name;
}

export function decodePresence(notes: Record<string, string> | undefined, myUserId: string | undefined, now: number): Presence[] {
  return Object.entries(notes ?? {})
    .filter(([key]) => key.startsWith(PRESENCE_PREFIX) && key !== (myUserId ? presenceKey(myUserId) : ''))
    .flatMap(([key, value]) => {
      const [seconds, app, ...name] = value.split('|');
      const at = Number(seconds) * 1000;
      if (!Number.isFinite(at) || now - at > PRESENCE_STALE_MS) return [];
      return [{ userId: key.slice(PRESENCE_PREFIX.length), name: name.join('|') || 'Someone', app, at }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Notes old enough to delete (anyone with edit access tidies up) */
export const stalePresenceKeys = (notes: Record<string, string> | undefined, now: number) =>
  Object.entries(notes ?? {})
    .filter(([key, value]) => key.startsWith(PRESENCE_PREFIX) && now - Number(value.split('|')[0]) * 1000 > PRESENCE_CLEANUP_MS)
    .map(([key]) => key);
