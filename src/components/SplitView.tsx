import { useScreenplayStore } from '../store/screenplayStore';
import { getPlainText } from '../utils/fdx';
import './SplitView.css';

/**
 * Split View Component
 *
 * Displays the script in a two-column layout:
 * - Left column: AUDIO (Voice-over, dialogue, music cues)
 * - Right column: VIDEO (Scene headings, action descriptions, visual elements)
 *
 * This format is commonly used for:
 * - Commercial scripts
 * - Music videos
 * - Corporate videos
 * - Documentary narration
 */
export const SplitView = () => {
  const { screenplay } = useScreenplayStore();

  // Separate elements into audio and video categories
  const groupedElements: Array<{
    audio: Array<{ id: string; type: string; text: string }>;
    video: Array<{ id: string; type: string; text: string }>;
  }> = [];

  let currentGroup: {
    audio: Array<{ id: string; type: string; text: string }>;
    video: Array<{ id: string; type: string; text: string }>;
  } = { audio: [], video: [] };

  screenplay.elements.forEach((element) => {
    const text = getPlainText(element.content);
    const entry = { id: element.id, type: element.type, text };

    // Audio elements: Dialogue, Character, Parenthetical
    if (['Dialogue', 'Character', 'Parenthetical'].includes(element.type)) {
      currentGroup.audio.push(entry);
    }
    // Video elements: Scene Heading, Action, Transition, Shot
    else {
      // Start new group on Scene Heading
      if (element.type === 'Scene Heading' && (currentGroup.audio.length > 0 || currentGroup.video.length > 0)) {
        groupedElements.push(currentGroup);
        currentGroup = { audio: [], video: [] };
      }
      currentGroup.video.push(entry);
    }
  });

  // Don't forget the last group
  if (currentGroup.audio.length > 0 || currentGroup.video.length > 0) {
    groupedElements.push(currentGroup);
  }

  return (
    <div className="split-view-container">
      {/* Header */}
      <div className="split-header">
        <div className="split-column-header audio-header">
          AUDIO
          <span className="header-hint">Dialogue, V.O., Music</span>
        </div>
        <div className="split-column-header video-header">
          VIDEO
          <span className="header-hint">Scene, Action, Transitions</span>
        </div>
      </div>

      {/* Content */}
      <div className="split-content">
        {groupedElements.length === 0 ? (
          <div className="split-empty">
            <p>No content yet.</p>
            <p className="hint">
              Write your script in the normal view. Audio elements (dialogue, character names)
              will appear on the left, and visual elements (scenes, action) on the right.
            </p>
          </div>
        ) : (
          groupedElements.map((group, index) => (
            <div key={index} className="split-row">
              {/* Audio Column */}
              <div className="split-column audio-column">
                {group.audio.map((item) => (
                  <div key={item.id} className={`split-element ${item.type.toLowerCase().replace(' ', '-')}`}>
                    {item.type === 'Character' && (
                      <div className="element-label">{item.text}</div>
                    )}
                    {item.type === 'Parenthetical' && (
                      <div className="element-paren">({item.text})</div>
                    )}
                    {item.type === 'Dialogue' && (
                      <div className="element-dialogue">{item.text}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Video Column */}
              <div className="split-column video-column">
                {group.video.map((item) => (
                  <div key={item.id} className={`split-element ${item.type.toLowerCase().replace(' ', '-')}`}>
                    {item.type === 'Scene Heading' && (
                      <div className="element-scene">{item.text}</div>
                    )}
                    {item.type === 'Action' && (
                      <div className="element-action">{item.text}</div>
                    )}
                    {item.type === 'Transition' && (
                      <div className="element-transition">{item.text}</div>
                    )}
                    {item.type === 'Shot' && (
                      <div className="element-shot">{item.text}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
