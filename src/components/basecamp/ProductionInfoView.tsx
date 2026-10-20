// Production Info (Movie Magic's Design ▸ Production Info): the header
// fields printed on reports and the Day Out of Days.
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import type { ProductionInfo } from '../../types/screenplay';
import { resolveProductionInfo } from '../../utils/productionInfo';
import './basecampTools.css';

const FIELDS: [keyof ProductionInfo, string][] = [
  ['pictureTitle', 'Picture Title'],
  ['company', 'Company'],
  ['productionNumber', 'Production No.'],
  ['episodeNumber', 'Episode No.'],
  ['director', 'Director'],
  ['producer', 'Producer'],
  ['upm', 'UPM'],
  ['assistantDirector', 'Assistant Director'],
  ['artDirector', 'Art Director'],
  ['setDresser', 'Set Dresser'],
  ['scriptDated', 'Script Dated'],
  ['preparedBy', 'Prepared By'],
  ['timing', 'Timing'],
  ['misc1', 'Misc. #1'],
  ['misc2', 'Misc. #2'],
  ['misc3', 'Misc. #3'],
  ['misc4', 'Misc. #4'],
];

export function ProductionInfoView() {
  const { settings, people, updateProductionSettings } = useScreenplayStore(
    useShallow((s) => ({
      settings: s.productionData.settings,
      people: s.productionData.people,
      updateProductionSettings: s.updateProductionSettings,
    }))
  );
  const entered = settings.productionInfo ?? {};
  const resolved = resolveProductionInfo(settings, people);
  const update = (field: keyof ProductionInfo, value: string) =>
    updateProductionSettings({ productionInfo: { ...entered, [field]: value || undefined } });

  return (
    <div className="bc-content-area">
      <div className="bc-page-header"><h2>Production Info</h2></div>
      <p className="bc-form-hint">
        Printed on the One Line and Shooting Schedules and the Day Out of Days. Blank crew fields are filled
        from All People by role (shown greyed out); type to override.
      </p>
      <div className="bct-info-grid">
        {FIELDS.map(([field, label]) => (
          <div key={field} className="bc-form-group">
            <label>{label.toUpperCase()}</label>
            <input
              value={entered[field] ?? ''}
              placeholder={resolved[field] ?? ''}
              onChange={(e) => update(field, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
