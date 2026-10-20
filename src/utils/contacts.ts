// Crew and cast contacts in and out of BaseCamp People: vCard 3.0 (phones,
// Google and Apple Contacts) and CSV (spreadsheets).
import type { PersonRole, ProductionPerson } from '../types/screenplay';

export type NewPerson = Omit<ProductionPerson, 'id' | 'avatarColor'>;

// ---------- vCard ----------

const vEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const vUnescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([;,\\])/g, '$1');

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) { out.push(rest.slice(0, 75)); rest = ` ${rest.slice(75)}`; }
  out.push(rest);
  return out.join('\r\n');
}

const positions = (p: ProductionPerson) =>
  p.roles.map((r) => (r.group === 'Talent' ? (r.characterName || r.position ? `${r.characterName || r.position}` : '') : r.position)).filter(Boolean);

export function peopleToVcf(people: ProductionPerson[], org?: string): string {
  return people.map((p) => {
    const titles = positions(p);
    const departments = [...new Set(p.roles.map((r) => r.department).filter(Boolean))];
    const lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${vEscape(p.lastName)};${vEscape(p.firstName)};;;`,
      `FN:${vEscape(`${p.firstName} ${p.lastName}`.trim() || p.email)}`,
      ...(p.email ? [`EMAIL;TYPE=INTERNET:${p.email}`] : []),
      ...(p.phone ? [`TEL;TYPE=CELL:${p.phone}`] : []),
      ...(org ? [`ORG:${vEscape(org)}${departments[0] ? `;${vEscape(departments[0])}` : ''}`] : []),
      ...(titles.length ? [`TITLE:${vEscape(p.group === 'Talent' ? `Cast${p.castNumber ? ` #${p.castNumber}` : ''}: ${titles.join(', ')}` : titles.join(', '))}`] : []),
      `CATEGORIES:${[p.group, ...departments, ...p.tags].map(vEscape).join(',')}`,
      ...(p.notes ? [`NOTE:${vEscape(p.notes)}`] : []),
      'END:VCARD',
    ];
    return lines.map(fold).join('\r\n');
  }).join('\r\n') + '\r\n';
}

const splitUnescaped = (s: string, sep: string) => s.split(new RegExp(`(?<!\\\\)${sep}`));

export function vcfToPeople(text: string): NewPerson[] {
  const unfolded = text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '');
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1).map((c) => c.split(/END:VCARD/i)[0]);
  return cards.map((card) => {
    const props = card.split('\n').filter(Boolean).map((line) => {
      const i = line.indexOf(':');
      const [name, ...params] = line.slice(0, i).split(';');
      return { name: name.replace(/^item\d+\./i, '').toUpperCase(), params: params.join(';').toUpperCase(), value: line.slice(i + 1) };
    });
    const get = (n: string) => props.find((p) => p.name === n)?.value;
    const [last = '', first = ''] = splitUnescaped(get('N') ?? '', ';').map(vUnescape);
    let firstName = first.trim();
    let lastName = last.trim();
    if (!firstName && !lastName) {
      const [given = '', ...rest] = vUnescape(get('FN') ?? '').split(' ');
      firstName = given;
      lastName = rest.join(' ');
    }
    const categories = splitUnescaped(get('CATEGORIES') ?? '', ',').map(vUnescape).map((s) => s.trim()).filter(Boolean);
    const group = (['Talent', 'Client', 'Crew'] as const).find((g) => categories.includes(g)) ?? 'Crew';
    const org = splitUnescaped(get('ORG') ?? '', ';').map(vUnescape);
    const title = vUnescape(get('TITLE') ?? '');
    const department = org[1] || '';
    const roles: PersonRole[] = title
      ? [group === 'Talent'
        ? { group, department: '', position: '', characterName: title.replace(/^Cast( #\d+)?:\s*/, '') }
        : { group, department, position: title }]
      : [];
    const castNumber = Number(/^Cast #(\d+)/.exec(title)?.[1]) || undefined;
    const phone = props.find((p) => p.name === 'TEL' && /CELL|MOBILE/.test(p.params))?.value ?? get('TEL') ?? '';
    return {
      firstName, lastName,
      email: get('EMAIL') ?? '',
      phone,
      group,
      roles,
      tags: categories.filter((c) => c !== group && c !== department),
      notes: vUnescape(get('NOTE') ?? ''),
      ...(castNumber ? { castNumber } : {}),
    };
  }).filter((p) => p.firstName || p.lastName || p.email);
}

// ---------- CSV ----------

const CSV_HEAD = ['First Name', 'Last Name', 'Email', 'Phone', 'Group', 'Department', 'Position', 'Character', 'Cast #', 'Tags', 'Notes'];

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function peopleToCsv(people: ProductionPerson[]): string {
  const rows = people.map((p) => {
    const r = p.roles[0];
    return [p.firstName, p.lastName, p.email, p.phone, p.group, r?.department, r?.position, r?.characterName, p.castNumber, p.tags.join('; '), p.notes];
  });
  return [CSV_HEAD, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function csvToPeople(text: string): NewPerson[] {
  const [head, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!head) return [];
  const col = (names: string[]) => head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const at = {
    first: col(['first name', 'first', 'given name']), last: col(['last name', 'last', 'family name', 'surname']),
    name: col(['name', 'full name']), email: col(['email', 'e-mail', 'email address', 'e-mail 1 - value']),
    phone: col(['phone', 'mobile', 'cell', 'phone 1 - value']), group: col(['group']), department: col(['department', 'dept']),
    position: col(['position', 'role', 'title', 'job title']), character: col(['character']), cast: col(['cast #', 'cast number', 'cast id']),
    tags: col(['tags']), notes: col(['notes']),
  };
  const v = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return rows.map((r) => {
    let firstName = v(r, at.first);
    let lastName = v(r, at.last);
    if (!firstName && !lastName && at.name >= 0) [firstName, lastName] = [v(r, at.name).split(' ')[0], v(r, at.name).split(' ').slice(1).join(' ')];
    const groupText = v(r, at.group);
    const group = (['Talent', 'Client', 'Crew'] as const).find((g) => g.toLowerCase() === groupText.toLowerCase()) ?? (v(r, at.character) ? 'Talent' : 'Crew');
    const position = v(r, at.position);
    const characterName = v(r, at.character);
    const castNumber = Number(v(r, at.cast)) || undefined;
    return {
      firstName, lastName, email: v(r, at.email), phone: v(r, at.phone), group,
      roles: position || characterName || v(r, at.department)
        ? [{ group, department: v(r, at.department), position, ...(characterName ? { characterName } : {}) }]
        : [],
      tags: v(r, at.tags).split(/[;|]/).map((t) => t.trim()).filter(Boolean),
      notes: v(r, at.notes),
      ...(castNumber ? { castNumber } : {}),
    };
  }).filter((p) => p.firstName || p.lastName || p.email);
}

/** New people that aren't already in the list (same email, or same full name) */
export function newContacts(existing: ProductionPerson[], incoming: NewPerson[]): NewPerson[] {
  const emails = new Set(existing.map((p) => p.email.toLowerCase()).filter(Boolean));
  const names = new Set(existing.map((p) => `${p.firstName} ${p.lastName}`.trim().toLowerCase()));
  const out: NewPerson[] = [];
  for (const p of incoming) {
    const email = p.email.toLowerCase();
    const name = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
    if ((email && emails.has(email)) || (!email && names.has(name))) continue;
    if (email) emails.add(email);
    names.add(name);
    out.push(p);
  }
  return out;
}
