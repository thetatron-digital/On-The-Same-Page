import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useScreenplayStore } from '../store/screenplayStore';
import type { CharacterRole, CharacterArc, CharacterArchetype } from '../types/screenplay';
import { InfoTooltip, TOOLTIP_DATA, OPTIONS_DATA, getBeatTooltip } from './InfoTooltip';
import './StoryMode.css';

type StoryTab = 'plot' | 'characters' | 'acts' | 'beats';

// Predefined options for dropdowns
const THEMES = ['Redemption', 'Love', 'Sacrifice', 'Identity', 'Freedom', 'Power', 'Family', 'Survival', 'Justice', 'Truth', 'Growth', 'Loss', 'Hope', 'Fear', 'Betrayal'];
const STORY_TYPES = ['Coming of Age', 'Quest', 'Redemption', 'Rags to Riches', 'Tragedy', 'Rebirth', 'Voyage and Return', 'Monster', 'Comedy', 'Overcoming the Monster'];
const GENRES = ['Drama', 'Comedy', 'Thriller', 'Horror', 'Romance', 'Action', 'Sci-Fi', 'Fantasy', 'Western', 'Crime', 'Mystery', 'Documentary', 'Animation', 'Musical', 'War'];
const TONES = ['Light', 'Dark', 'Satirical', 'Dramatic', 'Comedic', 'Suspenseful', 'Romantic', 'Melancholic', 'Hopeful', 'Gritty', 'Whimsical'];
const ROLES: CharacterRole[] = ['Protagonist', 'Antagonist', 'Love Interest', 'Mentor', 'Sidekick', 'Ally', 'Guardian', 'Other'];
const CHARACTER_ARCS: CharacterArc[] = ['Positive', 'Flat', 'Negative', 'Corruption', 'Spiral', 'Fall', 'Redemption'];
const ARCHETYPES: CharacterArchetype[] = ['Hero', 'Rebel', 'Lover', 'Caregiver', 'Jester', 'Sage', 'Magician', 'Ruler', 'Creator', 'Innocent', 'Explorer', 'Outlaw', 'Other'];

export const StoryMode = () => {
  const [activeTab, setActiveTab] = useState<StoryTab>('plot');
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  const {
    storyOutline,
    updatePlotOverview,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    updateActs,
    updateBeatContent,
    initializeBeats,
  } = useScreenplayStore();

  // Initialize beats on first load
  useEffect(() => {
    initializeBeats();
  }, [initializeBeats]);

  // Tag input component for multi-select fields
  const TagInput = ({
    label,
    options,
    selected,
    onChange,
    tooltipKey,
  }: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (tags: string[]) => void;
    tooltipKey?: keyof typeof TOOLTIP_DATA;
  }) => (
    <div className="form-field">
      <label>
        {label}
        {tooltipKey && TOOLTIP_DATA[tooltipKey] && (
          <InfoTooltip content={TOOLTIP_DATA[tooltipKey]} />
        )}
      </label>
      <div className="tag-selector">
        {options.map((option) => (
          <button
            key={option}
            className={`tag-btn ${selected.includes(option) ? 'selected' : ''}`}
            onClick={() => {
              if (selected.includes(option)) {
                onChange(selected.filter((t) => t !== option));
              } else {
                onChange([...selected, option]);
              }
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );

  // Generate button (disabled, coming soon)
  const GenerateButton = ({ label }: { label: string }) => (
    <button className="generate-btn disabled" title="Coming Soon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      {label}
    </button>
  );

  // Archetype button with hover tooltip
  const ArchetypeButton = ({
    archetype,
    isSelected,
    onClick,
  }: {
    archetype: string;
    isSelected: boolean;
    onClick: () => void;
  }) => {
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
    const optionData = OPTIONS_DATA.archetypes.find((a) => a.name === archetype);

    return (
      <>
        <button
          className={`tag-btn ${isSelected ? 'selected' : ''}`}
          onClick={onClick}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoverPos({ x: rect.left, y: rect.bottom + 8 });
          }}
          onMouseLeave={() => setHoverPos(null)}
        >
          {archetype}
        </button>
        {hoverPos && optionData && ReactDOM.createPortal(
          <div
            className="option-hover-tooltip"
            style={{
              left: Math.min(hoverPos.x, window.innerWidth - 300),
              top: hoverPos.y,
            }}
          >
            <div className="option-desc">{optionData.description}</div>
          </div>,
          document.body
        )}
      </>
    );
  };

  // Archetype selector with individual hover tooltips
  const ArchetypeSelector = ({
    selected,
    onChange,
  }: {
    selected: CharacterArchetype[];
    onChange: (archetypes: CharacterArchetype[]) => void;
  }) => (
    <div className="tag-selector small">
      {ARCHETYPES.map((archetype) => (
        <ArchetypeButton
          key={archetype}
          archetype={archetype}
          isSelected={selected.includes(archetype)}
          onClick={() => {
            if (selected.includes(archetype)) {
              onChange(selected.filter((a) => a !== archetype));
            } else {
              onChange([...selected, archetype]);
            }
          }}
        />
      ))}
    </div>
  );

  const renderPlotTab = () => (
    <div className="story-section">
      <div className="section-header">
        <h2>Plot Overview</h2>
        <GenerateButton label="Generate" />
      </div>

      <div className="form-grid">
        <div className="form-field full-width">
          <label>
            Title
            <InfoTooltip content={TOOLTIP_DATA.title} />
          </label>
          <input
            type="text"
            value={storyOutline.plot.title}
            onChange={(e) => updatePlotOverview({ title: e.target.value })}
            placeholder="Your story's title..."
          />
        </div>

        <div className="form-field full-width">
          <label>
            Logline
            <InfoTooltip content={TOOLTIP_DATA.logline} />
          </label>
          <textarea
            value={storyOutline.plot.logline}
            onChange={(e) => updatePlotOverview({ logline: e.target.value })}
            placeholder="When [protagonist] encounters [inciting incident], they must [goal] before [stakes]..."
            rows={3}
          />
        </div>

        <TagInput
          label="Themes"
          options={THEMES}
          selected={storyOutline.plot.themes}
          onChange={(themes) => updatePlotOverview({ themes })}
          tooltipKey="themes"
        />

        <TagInput
          label="Story Types"
          options={STORY_TYPES}
          selected={storyOutline.plot.storyTypes}
          onChange={(storyTypes) => updatePlotOverview({ storyTypes })}
          tooltipKey="storyTypes"
        />

        <TagInput
          label="Genres"
          options={GENRES}
          selected={storyOutline.plot.genres}
          onChange={(genres) => updatePlotOverview({ genres })}
          tooltipKey="genres"
        />

        <div className="form-field">
          <label>
            Tone
            <InfoTooltip content={TOOLTIP_DATA.tone} />
          </label>
          <select
            value={storyOutline.plot.tone}
            onChange={(e) => updatePlotOverview({ tone: e.target.value })}
          >
            <option value="">Select tone...</option>
            {TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>
            Audience
            <InfoTooltip content={TOOLTIP_DATA.audience} />
          </label>
          <input
            type="text"
            value={storyOutline.plot.audience}
            onChange={(e) => updatePlotOverview({ audience: e.target.value })}
            placeholder="e.g., Young adults, General audiences..."
          />
        </div>

        <div className="form-field full-width">
          <label>
            Setting
            <InfoTooltip content={TOOLTIP_DATA.setting} />
          </label>
          <textarea
            value={storyOutline.plot.setting}
            onChange={(e) => updatePlotOverview({ setting: e.target.value })}
            placeholder="Time period, location, world details..."
            rows={2}
          />
        </div>

        <div className="form-field full-width">
          <label>
            B Story
            <InfoTooltip content={TOOLTIP_DATA.bStory} />
          </label>
          <textarea
            value={storyOutline.plot.bStory}
            onChange={(e) => updatePlotOverview({ bStory: e.target.value })}
            placeholder="Describe the subplot or secondary storyline..."
            rows={2}
          />
        </div>

        <div className="form-field full-width">
          <label>Other Details</label>
          <textarea
            value={storyOutline.plot.otherDetails}
            onChange={(e) => updatePlotOverview({ otherDetails: e.target.value })}
            placeholder="Any additional notes about your story..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  const renderCharactersTab = () => (
    <div className="story-section">
      <div className="section-header">
        <h2>Characters</h2>
        <button className="add-btn" onClick={() => addCharacter()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Character
        </button>
      </div>

      {storyOutline.characters.length === 0 ? (
        <div className="empty-state">
          <p>No characters yet. Click "Add Character" to start developing your cast.</p>
        </div>
      ) : (
        <div className="character-list">
          {storyOutline.characters.map((character) => (
            <div
              key={character.id}
              className={`character-card ${expandedCharacter === character.id ? 'expanded' : ''}`}
            >
              <div
                className="character-header"
                onClick={() =>
                  setExpandedCharacter(expandedCharacter === character.id ? null : character.id)
                }
              >
                <div className="character-summary">
                  <span className="character-name">
                    {character.name || 'Unnamed Character'}
                  </span>
                  <span className="character-role">{character.role}</span>
                </div>
                <div className="character-actions">
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this character?')) {
                        deleteCharacter(character.id);
                      }
                    }}
                    title="Delete character"
                  >
                    ×
                  </button>
                  <svg
                    className="expand-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {expandedCharacter === character.id && (
                <div className="character-details">
                  <div className="form-grid">
                    <div className="form-field">
                      <label>
                        Name
                        <InfoTooltip content={TOOLTIP_DATA.characterName} />
                      </label>
                      <input
                        type="text"
                        value={character.name}
                        onChange={(e) =>
                          updateCharacter(character.id, { name: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Role</label>
                      <select
                        value={character.role}
                        onChange={(e) =>
                          updateCharacter(character.id, {
                            role: e.target.value as CharacterRole,
                          })
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Character Arc</label>
                      <select
                        value={character.characterArc}
                        onChange={(e) =>
                          updateCharacter(character.id, {
                            characterArc: e.target.value as CharacterArc,
                          })
                        }
                      >
                        {CHARACTER_ARCS.map((arc) => (
                          <option key={arc} value={arc}>
                            {arc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field full-width">
                      <label>
                        Archetypes
                        <InfoTooltip content={TOOLTIP_DATA.archetypesExamples} />
                      </label>
                      <ArchetypeSelector
                        selected={character.archetypes}
                        onChange={(archetypes) =>
                          updateCharacter(character.id, { archetypes })
                        }
                      />
                    </div>

                    <div className="form-field full-width">
                      <label>
                        Physical Description
                        <InfoTooltip content={TOOLTIP_DATA.physicalDescription} />
                      </label>
                      <textarea
                        value={character.physicalDescription}
                        onChange={(e) =>
                          updateCharacter(character.id, {
                            physicalDescription: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field full-width">
                      <label>
                        Personality
                        <InfoTooltip content={TOOLTIP_DATA.personality} />
                      </label>
                      <textarea
                        value={character.personality}
                        onChange={(e) =>
                          updateCharacter(character.id, { personality: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field">
                      <label>
                        Want
                        <InfoTooltip content={TOOLTIP_DATA.want} />
                      </label>
                      <textarea
                        value={character.want}
                        onChange={(e) =>
                          updateCharacter(character.id, { want: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field">
                      <label>
                        Need
                        <InfoTooltip content={TOOLTIP_DATA.need} />
                      </label>
                      <textarea
                        value={character.need}
                        onChange={(e) =>
                          updateCharacter(character.id, { need: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field">
                      <label>
                        Lie
                        <InfoTooltip content={TOOLTIP_DATA.lie} />
                      </label>
                      <textarea
                        value={character.lie}
                        onChange={(e) =>
                          updateCharacter(character.id, { lie: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field">
                      <label>
                        Ghost
                        <InfoTooltip content={TOOLTIP_DATA.ghost} />
                      </label>
                      <textarea
                        value={character.ghost}
                        onChange={(e) =>
                          updateCharacter(character.id, { ghost: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="form-field full-width">
                      <label>Other Details</label>
                      <textarea
                        value={character.notes}
                        onChange={(e) =>
                          updateCharacter(character.id, { notes: e.target.value })
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActsTab = () => (
    <div className="story-section">
      <div className="section-header">
        <h2>Acts Overview</h2>
        <GenerateButton label="Generate" />
      </div>

      <div className="acts-grid">
        <div className="act-card">
          <div className="act-header">
            <span className="act-label">ACT 1</span>
            <span className="act-subtitle">Setup (0-25%)</span>
          </div>
          <textarea
            value={storyOutline.acts.act1}
            onChange={(e) => updateActs({ act1: e.target.value })}
            placeholder="Introduce the protagonist in their ordinary world. Establish the status quo, then disrupt it with the inciting incident. End with the protagonist committing to the journey..."
            rows={8}
          />
        </div>

        <div className="act-card">
          <div className="act-header">
            <span className="act-label">ACT 2A</span>
            <span className="act-subtitle">Rising Action (25-50%)</span>
          </div>
          <textarea
            value={storyOutline.acts.act2a}
            onChange={(e) => updateActs({ act2a: e.target.value })}
            placeholder="The protagonist enters a new world. Introduce the B-story. Fun and games - the promise of the premise. Early trials and victories leading to the midpoint..."
            rows={8}
          />
        </div>

        <div className="act-card">
          <div className="act-header">
            <span className="act-label">ACT 2B</span>
            <span className="act-subtitle">Complications (50-75%)</span>
          </div>
          <textarea
            value={storyOutline.acts.act2b}
            onChange={(e) => updateActs({ act2b: e.target.value })}
            placeholder="Consequences of the midpoint. Rising stakes and harder obstacles. Things fall apart. All is lost moment. Dark night of the soul. Moment of clarity..."
            rows={8}
          />
        </div>

        <div className="act-card">
          <div className="act-header">
            <span className="act-label">ACT 3</span>
            <span className="act-subtitle">Resolution (75-100%)</span>
          </div>
          <textarea
            value={storyOutline.acts.act3}
            onChange={(e) => updateActs({ act3: e.target.value })}
            placeholder="The protagonist rallies and creates a final plan. The climax - final confrontation. Proof of growth. Resolution and the new normal..."
            rows={8}
          />
        </div>
      </div>
    </div>
  );

  const renderBeatsTab = () => {
    // Group beats by act
    const act1Beats = storyOutline.beats.filter((b) => b.act === 'act1');
    const act2aBeats = storyOutline.beats.filter((b) => b.act === 'act2a');
    const act2bBeats = storyOutline.beats.filter((b) => b.act === 'act2b');
    const act3Beats = storyOutline.beats.filter((b) => b.act === 'act3');

    const renderBeatList = (beats: typeof storyOutline.beats, actLabel: string) => (
      <div className="beat-section">
        <h3>{actLabel}</h3>
        <div className="beat-list">
          {beats.map((beat) => {
            const tooltipContent = getBeatTooltip(beat.name);
            return (
              <div key={beat.id} className="beat-item">
                <div className="beat-header">
                  <span className="beat-name">{beat.name}</span>
                  <InfoTooltip content={tooltipContent} />
                </div>
                <textarea
                  value={beat.description}
                  onChange={(e) => updateBeatContent(beat.id, e.target.value)}
                  rows={2}
                />
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="story-section">
        <div className="section-header">
          <h2>Beat Sheet</h2>
          <GenerateButton label="Generate" />
        </div>

        {storyOutline.beats.length === 0 ? (
          <div className="empty-state">
            <p>Beat sheet is loading...</p>
          </div>
        ) : (
          <div className="beats-container">
            {renderBeatList(act1Beats, 'Act 1 - Setup')}
            {renderBeatList(act2aBeats, 'Act 2A - Rising Action')}
            {renderBeatList(act2bBeats, 'Act 2B - Complications')}
            {renderBeatList(act3Beats, 'Act 3 - Resolution')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="story-mode-container">
      {/* Tab Navigation */}
      <div className="story-tabs">
        <button
          className={`story-tab ${activeTab === 'plot' ? 'active' : ''}`}
          onClick={() => setActiveTab('plot')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Plot
        </button>
        <button
          className={`story-tab ${activeTab === 'characters' ? 'active' : ''}`}
          onClick={() => setActiveTab('characters')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Characters
        </button>
        <button
          className={`story-tab ${activeTab === 'acts' ? 'active' : ''}`}
          onClick={() => setActiveTab('acts')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          Acts
        </button>
        <button
          className={`story-tab ${activeTab === 'beats' ? 'active' : ''}`}
          onClick={() => setActiveTab('beats')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="4" cy="6" r="2" fill="currentColor" />
            <circle cx="4" cy="12" r="2" fill="currentColor" />
            <circle cx="4" cy="18" r="2" fill="currentColor" />
          </svg>
          Beats
        </button>
      </div>

      {/* Tab Content */}
      <div className="story-content">
        {activeTab === 'plot' && renderPlotTab()}
        {activeTab === 'characters' && renderCharactersTab()}
        {activeTab === 'acts' && renderActsTab()}
        {activeTab === 'beats' && renderBeatsTab()}
      </div>
    </div>
  );
};
