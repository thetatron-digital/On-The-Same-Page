import { useScreenplayStore } from '../store/screenplayStore';
import { getPlainText } from '../utils/fdx';
import './SplitView.css';

/**
 * Split View Component
 *
 * Two modes:
 * 1. Synced Mode (default): Shows script content split into audio/video columns (read-only)
 * 2. Independent Mode: Edit audio/video content independently from main script
 *
 * This format is commonly used for:
 * - Commercial scripts
 * - Music videos
 * - Corporate videos
 * - Documentary narration
 */
export const SplitView = () => {
  const {
    screenplay,
    splitContent,
    toggleSplitIndependent,
    toggleSplitSwapped,
    updateSplitEntry,
    addSplitEntry,
    deleteSplitEntry,
  } = useScreenplayStore();

  // Get content based on mode
  const getSyncedContent = () => {
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

    return groupedElements;
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    column: 'audio' | 'video',
    id: string
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addSplitEntry(column, '');
    } else if (e.key === 'Backspace') {
      const entries = column === 'audio' ? splitContent.audio : splitContent.video;
      const entry = entries.find(e => e.id === id);
      if (entry?.text === '' && entries.length > 1) {
        e.preventDefault();
        deleteSplitEntry(column, id);
      }
    }
  };

  // Labels based on swap state
  const leftLabel = splitContent.swapped ? 'VIDEO' : 'AUDIO';
  const rightLabel = splitContent.swapped ? 'AUDIO' : 'VIDEO';
  const leftHint = splitContent.swapped ? 'Scene, Action, Transitions' : 'Dialogue, V.O., Music';
  const rightHint = splitContent.swapped ? 'Dialogue, V.O., Music' : 'Scene, Action, Transitions';

  // Get correct content for each column
  const leftContent = splitContent.swapped ? splitContent.video : splitContent.audio;
  const rightContent = splitContent.swapped ? splitContent.audio : splitContent.video;
  const leftColumn = splitContent.swapped ? 'video' : 'audio';
  const rightColumn = splitContent.swapped ? 'audio' : 'video';

  return (
    <div className="split-view-container">
      {/* Controls Bar */}
      <div className="split-controls">
        <div className="split-mode-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={splitContent.isIndependent}
              onChange={toggleSplitIndependent}
            />
            <span className="toggle-text">
              {splitContent.isIndependent ? 'Independent Mode' : 'Synced with Script'}
            </span>
          </label>
          <span className="mode-hint">
            {splitContent.isIndependent
              ? 'Edit audio/video separately from main script'
              : 'Shows your script split into audio/video (read-only)'}
          </span>
        </div>
        <button
          className="swap-btn"
          onClick={toggleSplitSwapped}
          title="Swap Audio/Video sides"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16l-4-4 4-4" />
            <path d="M17 8l4 4-4 4" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
          Swap Sides
        </button>
      </div>

      {/* Header */}
      <div className="split-header">
        <div className={`split-column-header ${splitContent.swapped ? 'video-header' : 'audio-header'}`}>
          {leftLabel}
          <span className="header-hint">{leftHint}</span>
        </div>
        <div className={`split-column-header ${splitContent.swapped ? 'audio-header' : 'video-header'}`}>
          {rightLabel}
          <span className="header-hint">{rightHint}</span>
        </div>
      </div>

      {/* Content */}
      <div className="split-content">
        {splitContent.isIndependent ? (
          // Independent editing mode
          <div className="split-row independent-mode">
            {/* Left Column */}
            <div className={`split-column ${splitContent.swapped ? 'video-column' : 'audio-column'}`}>
              {leftContent.map((entry) => (
                <textarea
                  key={entry.id}
                  className="split-textarea"
                  value={entry.text}
                  onChange={(e) => updateSplitEntry(leftColumn as 'audio' | 'video', entry.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, leftColumn as 'audio' | 'video', entry.id)}
                  placeholder={`Enter ${leftLabel.toLowerCase()} content...`}
                  rows={3}
                />
              ))}
              <button
                className="add-entry-btn"
                onClick={() => addSplitEntry(leftColumn as 'audio' | 'video')}
              >
                + Add {leftLabel.toLowerCase()} entry
              </button>
            </div>

            {/* Right Column */}
            <div className={`split-column ${splitContent.swapped ? 'audio-column' : 'video-column'}`}>
              {rightContent.map((entry) => (
                <textarea
                  key={entry.id}
                  className="split-textarea"
                  value={entry.text}
                  onChange={(e) => updateSplitEntry(rightColumn as 'audio' | 'video', entry.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, rightColumn as 'audio' | 'video', entry.id)}
                  placeholder={`Enter ${rightLabel.toLowerCase()} content...`}
                  rows={3}
                />
              ))}
              <button
                className="add-entry-btn"
                onClick={() => addSplitEntry(rightColumn as 'audio' | 'video')}
              >
                + Add {rightLabel.toLowerCase()} entry
              </button>
            </div>
          </div>
        ) : (
          // Synced mode (read-only from script)
          <>
            {getSyncedContent().length === 0 ? (
              <div className="split-empty">
                <p>No content yet.</p>
                <p className="hint">
                  Write your script in the normal view. Audio elements (dialogue, character names)
                  will appear on the left, and visual elements (scenes, action) on the right.
                </p>
                <p className="hint">
                  Or enable <strong>Independent Mode</strong> above to write audio/video content separately.
                </p>
              </div>
            ) : (
              getSyncedContent().map((group, index) => (
                <div key={index} className="split-row">
                  {/* Left Column */}
                  <div className={`split-column ${splitContent.swapped ? 'video-column' : 'audio-column'}`}>
                    {(splitContent.swapped ? group.video : group.audio).map((item) => (
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

                  {/* Right Column */}
                  <div className={`split-column ${splitContent.swapped ? 'audio-column' : 'video-column'}`}>
                    {(splitContent.swapped ? group.audio : group.video).map((item) => (
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
          </>
        )}
      </div>
    </div>
  );
};
