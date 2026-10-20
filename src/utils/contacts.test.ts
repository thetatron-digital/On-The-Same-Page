import { describe, expect, it } from 'vitest';
import type { ProductionPerson } from '../types/screenplay';
import { csvToPeople, newContacts, parseCsv, peopleToCsv, peopleToVcf, vcfToPeople } from './contacts';

const person = (extra: Partial<ProductionPerson>): ProductionPerson => ({
  id: 'p', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100', group: 'Crew',
  roles: [{ group: 'Crew', department: 'Camera', position: 'Director of Photography' }], tags: ['key crew'], notes: 'Prefers\nmorning; calls', avatarColor: '#000', ...extra,
});
const people = [
  person({}),
  person({ id: 'q', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', group: 'Talent', castNumber: 2, roles: [{ group: 'Talent', department: '', position: '', characterName: 'MAYA' }], tags: [], notes: '' }),
];

describe('contacts', () => {
  it('round-trips vCards', () => {
    const vcf = peopleToVcf(people, 'Night Shift');
    expect(vcf).toContain('TITLE:Cast #2: MAYA');
    expect(vcf).toContain('NOTE:Prefers\\nmorning\\; calls');
    expect(vcf.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    const back = vcfToPeople(vcf);
    expect(back[0]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100', group: 'Crew', tags: ['key crew'], notes: 'Prefers\nmorning; calls' });
    expect(back[0].roles).toEqual([{ group: 'Crew', department: 'Camera', position: 'Director of Photography' }]);
    expect(back[1]).toMatchObject({ group: 'Talent', castNumber: 2, roles: [{ characterName: 'MAYA' }] });
  });

  it('reads vCards from phones (folded lines, item prefixes, FN only)', () => {
    const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sam Lee\r\nitem1.EMAIL;type=INTERNET:sam@\r\n example.com\r\nTEL;type=WORK:111\r\nTEL;type=CELL:222\r\nEND:VCARD\r\n';
    expect(vcfToPeople(vcf)).toEqual([expect.objectContaining({ firstName: 'Sam', lastName: 'Lee', email: 'sam@example.com', phone: '222', group: 'Crew' })]);
  });

  it('round-trips CSV, including quotes and line breaks', () => {
    const csv = peopleToCsv(people);
    expect(parseCsv(csv)[1][10]).toBe('Prefers\nmorning; calls');
    const back = csvToPeople(csv);
    expect(back[1]).toMatchObject({ firstName: 'Grace', group: 'Talent', castNumber: 2, roles: [{ characterName: 'MAYA' }] });
  });

  it('reads other spreadsheets by column name', () => {
    const back = csvToPeople('Name,E-mail,Job Title,Department\nJo Park,jo@example.com,Gaffer,Electric\n');
    expect(back[0]).toMatchObject({ firstName: 'Jo', lastName: 'Park', email: 'jo@example.com', roles: [{ department: 'Electric', position: 'Gaffer' }] });
  });

  it('skips people already in the list', () => {
    const incoming = [...vcfToPeople(peopleToVcf(people)), { firstName: 'New', lastName: 'Person', email: '', phone: '', group: 'Crew' as const, roles: [], tags: [], notes: '' }];
    expect(newContacts(people, incoming).map((p) => p.firstName)).toEqual(['New']);
  });
});
