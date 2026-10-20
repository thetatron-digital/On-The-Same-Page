// ============================================
// THREE-WAY MERGE (project data)
// ============================================
// Two people edit the same Drive project; on sync we merge their changes
// against the last version both had (the base) instead of letting the
// last save win. Rules:
// - A value changed on one side only takes that side's change.
// - Plain objects merge key by key.
// - Arrays of objects with an `id` (scenes, elements, strips, shots...)
//   merge item by item: adds and deletes from both sides are kept, edits
//   to the same item merge recursively, and a reorder on one side wins.
// - When both sides change the same value differently, ours wins and the
//   path is reported as a conflict.
// Dates are compared by time. Values are never mutated.

export interface MergeResult<T> {
  value: T;
  conflicts: string[];
}

type Json = unknown;
type Item = { id: string } & Record<string, unknown>;

const isPlainObject = (v: Json): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

const isIdArray = (v: Json): v is Item[] =>
  Array.isArray(v) && v.every((x) => isPlainObject(x) && typeof x.id === 'string');

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return Number.isNaN(a) && Number.isNaN(b);
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function mergeIdArrays(base: Item[], ours: Item[], theirs: Item[], path: string, conflicts: string[]): Item[] {
  const byId = (list: Item[]) => new Map(list.map((x) => [x.id, x]));
  const b = byId(base);
  const o = byId(ours);
  const t = byId(theirs);

  const merged = new Map<string, Item>();
  for (const id of new Set([...o.keys(), ...t.keys()])) {
    const inO = o.has(id);
    const inT = t.has(id);
    const at = `${path}[${id}]`;
    if (inO && inT) {
      merged.set(id, merge(b.get(id), o.get(id), t.get(id), at, conflicts) as Item);
    } else if (b.has(id)) {
      // Deleted on one side: stays deleted unless the other side edited it
      const kept = inO ? o.get(id)! : t.get(id)!;
      if (!deepEqual(kept, b.get(id))) {
        conflicts.push(at);
        merged.set(id, kept);
      }
    } else {
      merged.set(id, (inO ? o.get(id) : t.get(id))!); // added on one side
    }
  }

  // Order: whichever side reordered the shared items wins (ours if both)
  const common = (list: Item[]) => list.map((x) => x.id).filter((id) => b.has(id) && merged.has(id));
  const baseOrder = common(base);
  const theirsReordered = !sameOrder(common(theirs), baseOrder) && sameOrder(common(ours), baseOrder);
  const [primary, secondary] = theirsReordered ? [theirs, ours] : [ours, theirs];

  const order = primary.map((x) => x.id).filter((id) => merged.has(id));
  // Items only the other side has go after the item they followed there
  secondary.forEach((item, i) => {
    if (!merged.has(item.id) || order.includes(item.id)) return;
    let at = 0;
    for (let k = i - 1; k >= 0; k--) {
      const idx = order.indexOf(secondary[k].id);
      if (idx >= 0) { at = idx + 1; break; }
    }
    order.splice(at, 0, item.id);
  });
  return order.map((id) => merged.get(id)!);
}

function merge(base: Json, ours: Json, theirs: Json, path: string, conflicts: string[]): Json {
  if (deepEqual(ours, theirs)) return ours;
  if (deepEqual(base, ours)) return theirs;
  if (deepEqual(base, theirs)) return ours;

  if (isPlainObject(ours) && isPlainObject(theirs)) {
    const b = isPlainObject(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const value = merge(b[key], ours[key], theirs[key], path ? `${path}.${key}` : key, conflicts);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  if (isIdArray(ours) && isIdArray(theirs)) {
    return mergeIdArrays(isIdArray(base) ? base : [], ours, theirs, path, conflicts);
  }
  conflicts.push(path || '(root)');
  return ours;
}

/** Merge `ours` and `theirs`, both edited from `base` */
export function merge3<T>(base: T, ours: T, theirs: T): MergeResult<T> {
  const conflicts: string[] = [];
  const value = merge(base, ours, theirs, '', conflicts) as T;
  return { value, conflicts };
}
