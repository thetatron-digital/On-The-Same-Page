// Finding reference images: free text across titles, credits, keywords and
// notes; facet values (any of the chosen values within a facet, all facets
// together); look filters; and closeness to a picked colour.
import type { FacetId, ImageLook, ReferenceImage } from '../../types/references';
import { colourDistance } from './look';

export interface ReferenceQuery {
  text?: string;
  facets?: Partial<Record<FacetId, string[]>>;
  look?: Partial<{ [K in keyof Omit<ImageLook, 'palette'>]: ImageLook[K][] }>;
  colour?: string; // hex
  deckImageIds?: string[];
  sceneId?: string;
}

const COLOUR_MATCH = 0.12;

export function matchesQuery(img: ReferenceImage, q: ReferenceQuery): boolean {
  if (q.deckImageIds && !q.deckImageIds.includes(img.id)) return false;
  if (q.sceneId && !img.sceneIds.includes(q.sceneId)) return false;
  for (const [facet, values] of Object.entries(q.facets ?? {}) as [FacetId, string[]][]) {
    if (values.length && !values.some((v) => img.facets[facet]?.includes(v))) return false;
  }
  for (const [key, values] of Object.entries(q.look ?? {}) as [keyof ImageLook, string[]][]) {
    if (values.length && !values.includes(img.look[key] as string)) return false;
  }
  if (q.colour && !img.look.palette.slice(0, 3).some((c) => colourDistance(c, q.colour!) <= COLOUR_MATCH)) return false;
  const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    const hay = [
      ...Object.values(img.credits), ...img.keywords, img.notes, img.department,
      ...Object.values(img.facets).flat(), img.focalLength ? `${img.focalLength}mm` : '',
    ].filter(Boolean).join(' ').toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
  }
  return true;
}

/** How many of `images` have each value of each facet (for the filter sidebar) */
export function facetCounts(images: ReferenceImage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const img of images) {
    for (const [facet, values] of Object.entries(img.facets)) {
      for (const v of values ?? []) counts.set(`${facet}:${v}`, (counts.get(`${facet}:${v}`) ?? 0) + 1);
    }
  }
  return counts;
}
