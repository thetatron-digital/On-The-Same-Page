import { useScreenplayStore } from '../store/screenplayStore';
import { getPlainText } from '../utils/fdx';
import './Navigator.css';

export const Navigator = () => {
  const { screenplay, selectedElementId, selectElement, togglePanel } = useScreenplayStore();

  // Get all scene headings for navigation
  const scenes = screenplay.elements
    .filter((el) => el.type === 'Scene Heading')
    .map((el, index) => ({
      id: el.id,
      number: index + 1,
      text: getPlainText(el.content) || 'Untitled Scene',
    }));

  const handleSceneClick = (id: string) => {
    selectElement(id);
    // Scroll to element
    const element = document.querySelector(`[data-element-id="${id}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="navigator-panel">
      <div className="panel-header">
        <h3>Navigator</h3>
        <button className="panel-close" onClick={() => togglePanel('navigator')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="panel-content">
        <div className="nav-section">
          <h4>Scenes ({scenes.length})</h4>
          <ul className="scene-list">
            {scenes.length === 0 ? (
              <li className="empty-state">No scenes yet</li>
            ) : (
              scenes.map((scene) => (
                <li
                  key={scene.id}
                  className={`scene-item ${selectedElementId === scene.id ? 'active' : ''}`}
                  onClick={() => handleSceneClick(scene.id)}
                >
                  <span className="scene-number">{scene.number}.</span>
                  <span className="scene-text">{scene.text}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
