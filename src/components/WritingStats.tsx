import { useScreenplayStore } from '../store/screenplayStore';
import './WritingStats.css';

export const WritingStats = () => {
  const { stats, togglePanel } = useScreenplayStore();

  return (
    <div className="stats-panel">
      <div className="panel-header">
        <h3>Writing Stats</h3>
        <button className="panel-close" onClick={() => togglePanel('writingStats')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="panel-content">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats.pageCount}</span>
            <span className="stat-label">Pages</span>
          </div>

          <div className="stat-item">
            <span className="stat-value">{stats.estimatedRuntime}</span>
            <span className="stat-label">Est. Runtime</span>
          </div>

          <div className="stat-item">
            <span className="stat-value">{stats.sceneCount}</span>
            <span className="stat-label">Scenes</span>
          </div>

          <div className="stat-item">
            <span className="stat-value">{stats.dialogueCount}</span>
            <span className="stat-label">Dialogue Blocks</span>
          </div>

          <div className="stat-item full-width">
            <span className="stat-value">{stats.wordCount.toLocaleString()}</span>
            <span className="stat-label">Words</span>
          </div>

          <div className="stat-item full-width">
            <span className="stat-value">{stats.characterCount.toLocaleString()}</span>
            <span className="stat-label">Characters</span>
          </div>
        </div>

        <div className="stats-info">
          <p>Industry standard: 1 page ≈ 1 minute of screen time</p>
          <p>55 lines per page for 1/8th page calculations</p>
        </div>
      </div>
    </div>
  );
};
