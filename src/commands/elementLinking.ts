// Element Linking after tagging (Movie Magic Scheduling-style): tagging an
// element that has linked elements can bring them into the scene too,
// per the breakdown's link setting (auto / confirm / never). Shared by
// BreakDown's tagging and ReWriter's Tags Mode.
import { useScreenplayStore } from '../store/screenplayStore';
import { pendingLinkedElements } from '../utils/elements';

const store = () => useScreenplayStore.getState();

/** After tagging `tagIds`, add their linked elements as the setting says. Returns how many were added. */
export function offerLinkedElements(tagIds: string[]): number {
  const { breakdown } = store();
  const mode = breakdown?.elementLinkMode ?? 'confirm';
  if (!breakdown || mode === 'never') return 0;
  const offers = tagIds.flatMap((id) => {
    const tag = breakdown.elements.find((e) => e.id === id);
    if (!tag?.elementRefId) return [];
    const pending = pendingLinkedElements(breakdown, tag.sceneId, tag.elementRefId);
    return pending.length ? [{ tag, pending }] : [];
  });
  if (!offers.length) return 0;
  if (mode === 'confirm') {
    const lines = offers.flatMap(({ pending }) => pending.map((p) => `${p.category}: ${p.name}`));
    const subject = offers.length === 1 ? offers[0].tag.text.toUpperCase() : `${offers.length} tagged elements`;
    if (!confirm(`Also add the elements linked to ${subject}?\n\n${[...new Set(lines)].join('\n')}`)) return 0;
  }
  return offers.reduce((sum, { tag }) => sum + store().addLinkedElementsToScene(tag.sceneId, tag.elementRefId!), 0);
}
