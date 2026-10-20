// Shared helpers used by more than one store slice
import type { Screenplay, ProductionData } from '../types/screenplay';
import { DEFAULT_DEPARTMENTS, DEFAULT_DISCLAIMER } from '../types/screenplay';
import { getPlainText } from '../utils/fdx';
import { paginateScript } from '../engine/paginate';
import type { WritingStats } from './types';

// Fresh BaseCamp production data for a new or pre-v2 project
export const createDefaultProductionData = (): ProductionData => ({
  people: [],
  locations: [],
  scenes: [],
  departments: DEFAULT_DEPARTMENTS.map((d, i) => ({ ...d, id: `dept-default-${i}` })),
  callSheets: [],
  settings: {
    projectName: '',
    defaultCallTime: '7:00 AM',
    defaultLunchDuration: 30,
    defaultDisclaimer: DEFAULT_DISCLAIMER,
  },
});

// Calculate writing statistics from screenplay
export const calculateWritingStats = (screenplay: Screenplay): WritingStats => {
  let wordCount = 0;
  let characterCount = 0;
  let sceneCount = 0;
  let dialogueCount = 0;

  screenplay.elements.forEach((element) => {
    const text = getPlainText(element.content);
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    wordCount += words.length;
    characterCount += text.length;

    if (element.type === 'Scene Heading') {
      sceneCount++;
    }
    if (element.type === 'Dialogue') {
      dialogueCount++;
    }
  });

  const { pageCount } = paginateScript(screenplay.elements);

  // 1 page ≈ 1 minute of screen time
  const totalMinutes = pageCount;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const estimatedRuntime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    pageCount,
    wordCount,
    characterCount,
    sceneCount,
    dialogueCount,
    estimatedRuntime,
  };
};

// Max history entries to prevent memory issues
export const MAX_HISTORY = 100;
