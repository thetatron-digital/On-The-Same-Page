import { create } from 'zustand';
import type { ScreenplayState } from './types';
import { createScriptSlice } from './slices/script';
import { createUiSlice } from './slices/ui';
import { createStorySlice } from './slices/story';
import { createBreakdownSlice } from './slices/breakdown';
import { createArtCartSlice } from './slices/artCart';
import { createViewFinderSlice } from './slices/viewFinder';
import { createScheduleSlice } from './slices/schedule';
import { createProductionSlice } from './slices/production';
import { createOnSetSlice } from './slices/onSet';
import { createSuperVisorSlice } from './slices/superVisor';
import { createDailiesSlice } from './slices/dailies';
import { createReferencesSlice } from './slices/references';
import { createBudgetSlice } from './slices/budget';
import { createProjectSlice } from './slices/project';

export type { ScreenplayState } from './types';

// One store, one slice per app (see ./slices). Components should select
// only the fields they use: useScreenplayStore(useShallow(s => ({ ... })))
export const useScreenplayStore = create<ScreenplayState>()((...a) => ({
  ...createScriptSlice(...a),
  ...createUiSlice(...a),
  ...createStorySlice(...a),
  ...createBreakdownSlice(...a),
  ...createArtCartSlice(...a),
  ...createViewFinderSlice(...a),
  ...createScheduleSlice(...a),
  ...createProductionSlice(...a),
  ...createOnSetSlice(...a),
  ...createSuperVisorSlice(...a),
  ...createDailiesSlice(...a),
  ...createReferencesSlice(...a),
  ...createBudgetSlice(...a),
  ...createProjectSlice(...a),
}));
