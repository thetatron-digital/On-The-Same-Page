import { describe, expect, it } from 'vitest';
import type { CallSheet, ProductionPerson } from '../types/screenplay';
import { callSheetRecipients, confirmationsFromComments, mailto, personalMessage } from './callSheetDistribution';

const person = (id: string, first: string, email: string, extra: Partial<ProductionPerson> = {}): ProductionPerson =>
  ({ id, firstName: first, lastName: 'Lee', email, phone: '', group: 'Crew', roles: [], tags: [], notes: '', avatarColor: '', ...extra });
const people = [
  person('a', 'Ada', 'ada@example.com', { group: 'Talent', roles: [{ group: 'Talent', department: '', position: '', characterName: 'MAYA' }] }),
  person('g', 'Grace', 'grace@example.com'),
  person('n', 'Nobody', ''),
];
const cs = {
  id: 'cs', title: 'Night Shift', date: '2026-11-02', dayNumber: 3, totalDays: 20, crewCall: '6:00 AM', shootingCall: '7:00 AM', firstMeal: '', estimatedWrap: '6:00 PM',
  producer: '', director: '', locationIds: ['l1'], scenes: [], notes: '', nearestHospital: '', disclaimer: '', status: 'draft',
  talentCalls: [{ personId: 'a', callTime: '7:30 AM' }],
  crewCalls: [{ personId: 'g', department: 'Electric', position: 'Gaffer', callTime: '' }, { personId: 'n', department: 'Grip', position: 'Grip', callTime: '6:00 AM' }, { personId: 'a', department: '', position: '', callTime: '' }],
  createdAt: new Date(), updatedAt: new Date(),
} as unknown as CallSheet;

describe('call sheet distribution', () => {
  it('lists recipients once, with their own call or the crew call, and who has no email', () => {
    const { recipients, missingEmail } = callSheetRecipients(cs, people);
    expect(recipients.map((r) => `${r.name}|${r.role}|${r.callTime}`)).toEqual(['Ada Lee|Cast: MAYA|7:30 AM', 'Grace Lee|Gaffer, Electric|6:00 AM']);
    expect(missingEmail).toEqual(['Nobody Lee']);
  });

  it('writes a personal message with the call time and location', () => {
    const [ada] = callSheetRecipients(cs, people).recipients;
    const msg = personalMessage(cs, ada, [{ id: 'l1', name: 'Diner', streetAddress: '1 Main St', city: 'LA', state: '', postalCode: '', phone: '' }], 'https://x');
    expect(msg).toContain('Night Shift: Day 3 of 20, Monday, November 2.');
    expect(msg).toContain('Your call: 7:30 AM (Cast: MAYA).');
    expect(msg).toContain('Location: Diner, 1 Main St, LA');
    expect(msg).toContain('Call sheet: https://x');
  });

  it('builds mailto links (to, or bcc for everyone)', () => {
    expect(mailto(['a@x.com'], 'Day 3', 'Call 6 AM')).toBe('mailto:a%40x.com?subject=Day%203&body=Call%206%20AM');
    expect(mailto(['a@x.com', 'b@x.com'], 'S', 'B', true)).toBe('mailto:?bcc=a%40x.com%2Cb%40x.com&subject=S&body=B');
  });

  it('reads confirmations from comments by email or name', () => {
    const { recipients } = callSheetRecipients(cs, people);
    const got = confirmationsFromComments([
      { author: { emailAddress: 'ADA@example.com' }, content: 'Confirmed!', createdTime: '2026-11-01T20:00:00Z' },
      { author: { displayName: 'Grace Lee' }, content: 'Can I come later?' },
      { author: { displayName: 'Grace Lee' }, content: 'ok see you then' },
      { author: { displayName: 'Stranger' }, content: 'confirmed' },
    ], recipients);
    expect(got.map((c) => c.personId)).toEqual(['a', 'g']);
  });
});
