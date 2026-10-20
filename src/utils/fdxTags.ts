// ============================================
// FINAL DRAFT TAGS -> BREAKDOWN
// ============================================
// Final Draft's Tags Mode stores a breakdown inside the .fdx
// (findings/final-draft-13.md §4.1):
//   <Text TagNumber="n">...</Text>                    tagged run
//   <TagData>
//     <TagCategories><TagCategory Id Name Number Color Style/>
//     <TagDefinitions><TagDefinition Id CatId Label Number/>
//     <Tags><Tag Number="n"><DefId>…</DefId>…</Tag>      one run, 1+ definitions
// Category names are Movie Magic's (Cast Members, Props, ...), so tags map
// straight onto BreakDown. Set / Location / Sequence / Script Day / Unit /
// Synopsis / Comments are breakdown sheet fields rather than elements.
// The script itself is already in ReWriter; paragraphs are matched to its
// elements by text, in order.

import type { BreakdownElement, BreakdownSheetFields, ScreenplayElement } from '../types/screenplay';
import { generateId, getPlainText } from './fdx';

export const SHEET_FIELD_CATEGORIES: Record<string, keyof BreakdownSheetFields> = {
  Set: 'set',
  Location: 'location',
  Sequence: 'sequence',
  'Script Day': 'scriptDay',
  Unit: 'unit',
  Synopsis: 'synopsis',
  Comments: 'comments',
};

interface FdxRun { text: string; start: number; end: number; tagNumber?: string }
interface FdxParagraph { type: string; text: string; runs: FdxRun[] }
interface TagDefinition { label: string; category: string }

export interface FdxTagData {
  paragraphs: FdxParagraph[];
  definitionsByTag: Map<string, TagDefinition[]>;
}

export function readFdxTags(xml: string): FdxTagData {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('This is not a valid Final Draft (.fdx) file.');

  const categories = new Map<string, string>();
  doc.querySelectorAll('TagData > TagCategories > TagCategory').forEach((c) => {
    categories.set(c.getAttribute('Id') ?? '', c.getAttribute('Name') ?? '');
  });
  const definitions = new Map<string, TagDefinition>();
  doc.querySelectorAll('TagData > TagDefinitions > TagDefinition').forEach((d) => {
    definitions.set(d.getAttribute('Id') ?? '', {
      label: d.getAttribute('Label') ?? '',
      category: categories.get(d.getAttribute('CatId') ?? '') ?? '',
    });
  });
  const definitionsByTag = new Map<string, TagDefinition[]>();
  doc.querySelectorAll('TagData > Tags > Tag').forEach((t) => {
    const defs = [...t.querySelectorAll('DefId')]
      .map((d) => definitions.get(d.textContent?.trim() ?? ''))
      .filter((d): d is TagDefinition => !!d && !!d.category && !!d.label.trim());
    if (defs.length) definitionsByTag.set(t.getAttribute('Number') ?? '', defs);
  });

  // Script paragraphs only (not the title page or other Content blocks)
  const content = doc.querySelector('FinalDraft > Content');
  const paragraphs: FdxParagraph[] = [];
  content?.querySelectorAll(':scope > Paragraph').forEach((p) => {
    const runs: FdxRun[] = [];
    let offset = 0;
    p.querySelectorAll(':scope > Text').forEach((t) => {
      const text = t.textContent ?? '';
      runs.push({ text, start: offset, end: offset + text.length, tagNumber: t.getAttribute('TagNumber') ?? undefined });
      offset += text.length;
    });
    paragraphs.push({ type: p.getAttribute('Type') ?? '', text: runs.map((r) => r.text).join(''), runs });
  });

  return { paragraphs, definitionsByTag };
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toUpperCase();

export interface FdxTagImport {
  tags: BreakdownElement[];
  sheets: Record<string, Partial<BreakdownSheetFields>>;
  unmatchedParagraphs: number; // tagged paragraphs not found in the current script
}

/** Turn Final Draft tags into BreakDown tags against the script in ReWriter. */
export function importFdxTags(data: FdxTagData, elements: ScreenplayElement[]): FdxTagImport {
  // Scene of each script element (a scene's id is its heading's element id)
  const sceneOf = new Map<string, string>();
  let scene = '';
  for (const el of elements) {
    if (el.type === 'Scene Heading') scene = el.id;
    if (scene) sceneOf.set(el.id, scene);
  }
  const texts = elements.map((el) => normalize(getPlainText(el.content)));

  const tags: BreakdownElement[] = [];
  const sheets: Record<string, Partial<BreakdownSheetFields>> = {};
  let unmatchedParagraphs = 0;
  let cursor = 0;

  for (const paragraph of data.paragraphs) {
    const target = normalize(paragraph.text);
    const tagged = paragraph.runs.some((r) => r.tagNumber && data.definitionsByTag.has(r.tagNumber));
    if (!target) continue;
    // Find this paragraph in the script, looking a little ahead of the last match
    let found = -1;
    for (let i = cursor; i < Math.min(elements.length, cursor + 40); i++) {
      if (texts[i] === target) { found = i; break; }
    }
    if (found < 0) {
      if (tagged) unmatchedParagraphs++;
      continue;
    }
    cursor = found + 1;
    if (!tagged) continue;

    const element = elements[found];
    const sceneId = sceneOf.get(element.id);
    if (!sceneId) continue;
    for (const run of paragraph.runs) {
      for (const def of (run.tagNumber && data.definitionsByTag.get(run.tagNumber)) || []) {
        const sheetField = SHEET_FIELD_CATEGORIES[def.category];
        if (sheetField) {
          const fields = (sheets[sceneId] ??= {});
          if (!fields[sheetField]) fields[sheetField] = def.label.trim();
          continue;
        }
        tags.push({
          id: generateId(),
          text: def.label.trim(),
          category: def.category,
          sceneId,
          sourceElementId: element.id,
          startOffset: run.start,
          endOffset: run.end,
          notes: 'Imported from Final Draft tags',
        });
      }
    }
  }
  return { tags, sheets, unmatchedParagraphs };
}
