// Going to a Find Anything result
import { useScreenplayStore } from '../store/screenplayStore';
import { useAppViews } from '../routing/appViews';
import { useDailiesUi } from '../components/dailies/dailiesUi';
import type { SearchItem } from '../engine/search';

const scrollTo = (elementId: string) => {
  // After the editor renders
  setTimeout(() => document.querySelector(`[data-element-id="${CSS.escape(elementId)}"]`)?.scrollIntoView({ block: 'center' }), 250);
};

export function goTo(item: SearchItem) {
  const store = useScreenplayStore.getState();
  const views = useAppViews.getState();
  switch (item.kind) {
    case 'scene':
    case 'character':
      store.setActiveApp('rewriter');
      if (item.target) { store.selectElement(item.target); scrollTo(item.target); }
      break;
    case 'element': {
      const tag = store.breakdown?.elements.find((t) => t.elementRefId === item.id);
      store.setActiveApp('breakdown');
      if (tag) store.selectBreakdownScene(tag.sceneId);
      break;
    }
    case 'person':
    case 'location':
    case 'callsheet':
      store.setBasecampView(item.target as 'people' | 'locations' | 'callsheets');
      store.setActiveApp('basecamp');
      break;
    case 'shot':
      views.set({ viewFinderView: 'shots' });
      if (item.target) store.selectViewFinderScene(item.target);
      store.selectShot(item.id);
      store.setActiveApp('viewfinder');
      break;
    case 'clip':
      views.set({ superVisorTab: 'dailies' });
      useDailiesUi.getState().set({ openClipId: item.id, compareClipId: null });
      store.setActiveApp('supervisor');
      break;
    case 'reference':
      views.set({ viewFinderView: 'references', referenceImageId: item.id });
      store.setActiveApp('viewfinder');
      break;
    case 'account':
      views.set({ bottomLineLevel: { kind: 'account', id: item.id } });
      store.setActiveApp('bottomline');
      break;
  }
}
