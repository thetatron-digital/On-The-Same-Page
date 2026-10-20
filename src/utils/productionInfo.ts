// Production Info with blanks filled from People (crew roles), the way
// BaseCamp's call sheets already find the producer and director
import type { ProductionInfo, ProductionPerson, ProductionSettings } from '../types/screenplay';

const ROLE_PATTERNS: [keyof ProductionInfo, RegExp][] = [
  ['director', /^director$/i],
  ['producer', /^producer$/i],
  ['upm', /unit production manager|^production manager$|^upm$/i],
  ['assistantDirector', /^(1st|first) (assistant director|ad)$/i],
  ['artDirector', /^art director$/i],
  ['setDresser', /^set dresser$|^lead set dresser$/i],
];

const fullName = (p: ProductionPerson) => `${p.firstName} ${p.lastName}`.trim();

export function resolveProductionInfo(settings: ProductionSettings, people: ProductionPerson[]): ProductionInfo {
  const info: ProductionInfo = { pictureTitle: settings.projectName || undefined, ...settings.productionInfo };
  for (const [field, pattern] of ROLE_PATTERNS) {
    if (info[field]) continue;
    const person = people.find((p) => p.group === 'Crew' && p.roles.some((r) => pattern.test(r.position.trim())));
    if (person) info[field] = fullName(person);
  }
  return info;
}

/** One-line credit block for report headers: "Company · Director: X · Producer: Y" */
export function productionInfoLine(info: ProductionInfo): string {
  return [
    info.company,
    info.productionNumber && `Prod. #${info.productionNumber}`,
    info.episodeNumber && `Ep. ${info.episodeNumber}`,
    info.director && `Director: ${info.director}`,
    info.producer && `Producer: ${info.producer}`,
    info.assistantDirector && `1st AD: ${info.assistantDirector}`,
    info.scriptDated && `Script dated ${info.scriptDated}`,
    info.preparedBy && `Prepared by ${info.preparedBy}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
}
