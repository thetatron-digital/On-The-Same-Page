// Navigator > Scene Properties (Final Draft's NavSceneProperties): title,
// color, summary, plus length, page and characters from the script.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { SCENE_COLORS, type SceneColor } from '../types/screenplay';
import { sceneHeadingIndex } from '../engine/production';
import { formatEighths, scenesOf } from '../utils/reports';

export const ScenePropertiesPane = () => {
  const { screenplay, selectedElementId, setSceneProperties } = useScreenplayStore(
    useShallow((s) => ({ screenplay: s.screenplay, selectedElementId: s.selectedElementId, setSceneProperties: s.setSceneProperties }))
  );
  const scenes = useMemo(() => scenesOf(screenplay), [screenplay]);
  const headingIndex = selectedElementId ? sceneHeadingIndex(screenplay.elements, selectedElementId) : -1;
  if (headingIndex < 0) return <div className="scene-props empty-state">Put the cursor in a scene to see its properties.</div>;

  const heading = screenplay.elements[headingIndex];
  const position = screenplay.elements.slice(0, headingIndex + 1).filter((el) => el.type === 'Scene Heading').length - 1;
  const info = scenes[position];
  const props = heading.scene ?? {};

  return (
    <div className="scene-props" aria-label="Scene Properties">
      <h4>Scene Properties</h4>
      <div className="scene-props-heading">{info?.number}. {heading.content.map((r) => r.text).join('')}</div>
      <label>
        Title
        <input value={props.title ?? ''} onChange={(e) => setSceneProperties(heading.id, { title: e.target.value })} />
      </label>
      <div className="scene-props-colors" role="radiogroup" aria-label="Scene color">
        <button
          className={`scene-color none ${props.color ? '' : 'selected'}`}
          role="radio"
          aria-checked={!props.color}
          aria-label="No color"
          onClick={() => setSceneProperties(heading.id, { color: undefined })}
        />
        {(Object.keys(SCENE_COLORS) as SceneColor[]).map((c) => (
          <button
            key={c}
            className={`scene-color ${props.color === c ? 'selected' : ''}`}
            style={{ background: SCENE_COLORS[c] }}
            role="radio"
            aria-checked={props.color === c}
            aria-label={c}
            title={c}
            onClick={() => setSceneProperties(heading.id, { color: c })}
          />
        ))}
      </div>
      <label>
        Summary
        <textarea rows={4} value={props.summary ?? ''} onChange={(e) => setSceneProperties(heading.id, { summary: e.target.value })} />
      </label>
      {info && (
        <dl className="scene-props-facts">
          <dt>Length</dt><dd>{info.omitted ? 'OMITTED' : `${formatEighths(info.eighths)} pg`}</dd>
          <dt>Page</dt><dd>{info.page}</dd>
          <dt>Characters</dt><dd>{info.speakers.join(', ') || '—'}</dd>
        </dl>
      )}
    </div>
  );
};
