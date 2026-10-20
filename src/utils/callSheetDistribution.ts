// Sending call sheets: who gets one (cast and crew on the sheet with an
// email), each person's own message with their call time, email links,
// and reading "Confirmed" replies left as comments on the shared PDF.
import type { CallSheet, ProductionLocation, ProductionPerson } from '../types/screenplay';

export interface Recipient {
  personId: string;
  name: string;
  email: string;
  role: string;
  callTime: string;
}

export function callSheetRecipients(cs: CallSheet, people: ProductionPerson[]): { recipients: Recipient[]; missingEmail: string[] } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const missingEmail: string[] = [];
  const add = (personId: string, role: string, callTime: string) => {
    if (seen.has(personId)) return;
    seen.add(personId);
    const p = byId.get(personId);
    if (!p) return;
    const name = `${p.firstName} ${p.lastName}`.trim();
    if (!p.email) { missingEmail.push(name); return; }
    recipients.push({ personId, name, email: p.email, role, callTime: callTime || cs.crewCall });
  };
  for (const t of cs.talentCalls) {
    const p = byId.get(t.personId);
    const character = p?.roles.find((r) => r.group === 'Talent')?.characterName;
    add(t.personId, character ? `Cast: ${character}` : 'Cast', t.callTime);
  }
  for (const c of cs.crewCalls) add(c.personId, [c.position, c.department].filter(Boolean).join(', ') || 'Crew', c.callTime);
  return { recipients, missingEmail };
}

const longDate = (ymd: string) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '');

export function personalMessage(cs: CallSheet, r: Recipient, locations: ProductionLocation[], link?: string): string {
  const where = cs.locationIds.map((id) => locations.find((l) => l.id === id)).filter(Boolean)
    .map((l) => [l!.name, l!.streetAddress, l!.city].filter(Boolean).join(', ')).join(' / ');
  return [
    `Hi ${r.name.split(' ')[0]},`,
    '',
    `${cs.title}: Day ${cs.dayNumber} of ${cs.totalDays}${cs.date ? `, ${longDate(cs.date)}` : ''}.`,
    `Your call: ${r.callTime} (${r.role}).`,
    ...(where ? [`Location: ${where}`] : []),
    ...(cs.estimatedWrap ? [`Estimated wrap: ${cs.estimatedWrap}`] : []),
    '',
    link ? `Call sheet: ${link}` : 'The call sheet is attached.',
    'Please confirm by adding a comment "Confirmed" on the call sheet (or reply to this email).',
  ].join('\n');
}

export const callSheetSubject = (cs: CallSheet) =>
  `${cs.title} Call Sheet: Day ${cs.dayNumber}${cs.date ? ` (${longDate(cs.date)})` : ''}`;

export const mailto = (to: string[], subject: string, body: string, bcc = false) =>
  `mailto:${bcc ? '' : to.map(encodeURIComponent).join(',')}?${new URLSearchParams({ ...(bcc ? { bcc: to.join(',') } : {}), subject, body }).toString().replace(/\+/g, '%20')}`;

export interface DriveComment {
  author?: { displayName?: string; emailAddress?: string };
  content?: string;
  createdTime?: string;
}

/** People who left a confirming comment (matched by email, else by name) */
export function confirmationsFromComments(comments: DriveComment[], recipients: Recipient[]): { personId: string; at: Date; note?: string }[] {
  const out = new Map<string, { personId: string; at: Date; note?: string }>();
  for (const c of comments) {
    if (!/\b(confirm(ed)?|got it|see you|on my way|copy|ok|okay|yes)\b/i.test(c.content ?? '')) continue;
    const email = c.author?.emailAddress?.toLowerCase();
    const name = c.author?.displayName?.toLowerCase().trim();
    const r = recipients.find((x) => (email && x.email.toLowerCase() === email) || (name && x.name.toLowerCase() === name));
    if (r && !out.has(r.personId)) out.set(r.personId, { personId: r.personId, at: new Date(c.createdTime ?? Date.now()), note: c.content });
  }
  return [...out.values()];
}
