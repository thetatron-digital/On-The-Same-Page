// Top half of a Movie Magic-style breakdown sheet: scene facts from the
// script plus the fields a breakdown adds (Set, Synopsis, Script Day...).
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { STRIP_COLOR_HEX, stripColorFor, stripTextColor, type BreakdownScene, type BreakdownSheetFields } from '../../types/screenplay';
import { formatEighths } from '../../utils/breakdown';

type FieldKey = keyof BreakdownSheetFields;

// Movie Magic's sheet order (findings/ui-parity-spec.md, Breakdown Sheet)
const TEXT_FIELDS: [FieldKey, string, string][] = [
  ['set', 'Set', 'Story place'],
  ['location', 'Location', 'Real place it is shot'],
  ['sequence', 'Sequence', ''],
  ['scriptDay', 'Script Day', 'e.g. D3'],
  ['scriptPage', 'Script Page', ''],
  ['estTime', 'Est. Time', 'h:mm'],
  ['unit', 'Unit', 'e.g. Main, 2nd'],
];

export function SheetFields({ scene, sheetIndex }: { scene: BreakdownScene; sheetIndex: number }) {
  const { sheet, updateBreakdownSheet } = useScreenplayStore(
    useShallow((s) => ({
      sheet: s.breakdown?.sheets?.[scene.id],
      updateBreakdownSheet: s.updateBreakdownSheet,
    }))
  );
  const values: BreakdownSheetFields = { set: scene.location, ...sheet };
  const update = (key: FieldKey, value: string) => updateBreakdownSheet(scene.id, { [key]: value });
  const color = stripColorFor(scene.intExt, scene.timeOfDay || scene.dayNight);

  return (
    <div className="sheet-section sheet-fields">
      <div className="sheet-strip-bar" style={{ background: STRIP_COLOR_HEX[color], color: stripTextColor(color) }}>
        <span>Sheet {values.sheetNumber || sheetIndex + 1}</span>
        <span>Sc. {scene.sceneNumber}</span>
        <span>{scene.intExt}</span>
        <span>{scene.dayNight}</span>
        <span>{formatEighths(scene.eighths)} pgs</span>
      </div>
      <div className="info-grid sheet-grid">
        <label className="info-item">
          <span>Sheet #</span>
          <input value={values.sheetNumber ?? ''} placeholder={String(sheetIndex + 1)} onChange={(e) => update('sheetNumber', e.target.value)} />
        </label>
        <div className="info-item">
          <span>Scene(s)</span>
          <strong>{scene.sceneNumber}</strong>
        </div>
        <div className="info-item">
          <span>Int/Ext</span>
          <strong>{scene.intExt}</strong>
        </div>
        <div className="info-item">
          <span>Day/Night</span>
          <strong>{scene.timeOfDay || scene.dayNight}</strong>
        </div>
        <div className="info-item">
          <span>Pages</span>
          <strong>{formatEighths(scene.eighths)}</strong>
        </div>
        {TEXT_FIELDS.map(([key, label, placeholder]) => (
          <label key={key} className="info-item">
            <span>{label}</span>
            <input value={values[key] ?? ''} placeholder={placeholder} onChange={(e) => update(key, e.target.value)} />
          </label>
        ))}
        <label className="info-item info-wide">
          <span>Synopsis</span>
          <input value={values.synopsis ?? ''} placeholder="One line for the strip" onChange={(e) => update('synopsis', e.target.value)} />
        </label>
        <label className="info-item info-wide">
          <span>Comments</span>
          <textarea value={values.comments ?? ''} rows={2} onChange={(e) => update('comments', e.target.value)} />
        </label>
      </div>
    </div>
  );
}
