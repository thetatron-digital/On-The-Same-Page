import { useRef, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { downloadPDF } from '../utils/pdf';
import type { ElementType } from '../types/screenplay';
import './Toolbar.css';

const ELEMENT_TYPES: ElementType[] = [
  'Scene Heading',
  'Action',
  'Character',
  'Dialogue',
  'Parenthetical',
  'Transition',
];

// App configuration
const APPS = {
  blueprint: {
    name: 'BluePrint',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    description: 'Story Development',
  },
  corkboard: {
    name: 'CorkBoard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="9" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    description: 'Visual Planning',
  },
  rewriter: {
    name: 'ReWriter',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    description: 'Screenwriting',
  },
  breakdown: {
    name: 'BreakDown',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="15" cy="15" r="2" />
      </svg>
    ),
    description: 'Script Breakdown',
  },
} as const;

export const Toolbar = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeDropdowns = () => {
    setOpenDropdown(null);
  };

  const {
    screenplay,
    currentElementType,
    isDirty,
    fileName,
    darkMode,
    panels,
    visibility,
    stats,
    activeApp,
    viewMode,
    versions,
    activeVersionId,
    showSceneNumbers,
    watermarkSettings,
    newScreenplay,
    loadFromFDX,
    exportToFDX,
    setFileName,
    setDirty,
    setCurrentElementType,
    selectedElementId,
    updateElementType,
    toggleDarkMode,
    togglePanel,
    toggleVisibility,
    setActiveApp,
    setViewMode,
    createVersion,
    switchVersion,
    deleteVersion,
    toggleSceneNumbers,
    generateSceneNumbers,
    clearSceneNumbers,
    setWatermarkSettings,
    toggleWatermark,
  } = useScreenplayStore();

  const handleNew = () => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Create a new document anyway?')) {
        return;
      }
    }
    newScreenplay();
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDirty) {
      if (!confirm('You have unsaved changes. Open a new file anyway?')) {
        e.target.value = '';
        return;
      }
    }

    try {
      const content = await file.text();
      loadFromFDX(content);
      setFileName(file.name);
    } catch (error) {
      alert('Failed to open file. Please ensure it is a valid FDX file.');
    }

    e.target.value = '';
  };

  const handleSave = () => {
    const fdxContent = exportToFDX();
    const blob = new Blob([fdxContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.fdx') ? fileName : `${fileName}.fdx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDirty(false);
  };

  const handleExportPDF = () => {
    const pdfFileName = fileName.replace(/\.fdx$/i, '') + '.pdf';
    downloadPDF(screenplay, pdfFileName, {
      showSceneNumbers,
      watermark: watermarkSettings,
    });
  };

  const handleElementTypeChange = (type: ElementType) => {
    setCurrentElementType(type);
    if (selectedElementId) {
      updateElementType(selectedElementId, type);
    }
    closeDropdowns();
  };

  const handleCreateVersion = () => {
    if (newVersionName.trim()) {
      createVersion(newVersionName.trim());
      setNewVersionName('');
      setShowVersionModal(false);
    }
  };

  // Render app-specific toolbar content
  const renderBlueprintToolbar = () => (
    <>
      <div className="menu-section menu-left">
        {/* File operations */}
        <button className="menu-btn" onClick={handleNew} title="New Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>New</span>
        </button>

        <button className="menu-btn" onClick={handleOpen} title="Open Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
        </button>

        <button className="menu-btn" onClick={handleSave} title="Save Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Plot, Characters, Acts, Beats</div>
      </div>

      <div className="menu-section menu-right">
        {/* Dark Mode Toggle */}
        <button
          className="menu-btn icon-only"
          onClick={toggleDarkMode}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );

  const renderCorkboardToolbar = () => (
    <>
      <div className="menu-section menu-left">
        {/* File operations */}
        <button className="menu-btn" onClick={handleNew} title="New Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>New</span>
        </button>

        <button className="menu-btn" onClick={handleOpen} title="Open Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
        </button>

        <button className="menu-btn" onClick={handleSave} title="Save Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Visual Scene Planning</div>
      </div>

      <div className="menu-section menu-right">
        {/* Dark Mode Toggle */}
        <button
          className="menu-btn icon-only"
          onClick={toggleDarkMode}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );

  const renderBreakdownToolbar = () => (
    <>
      <div className="menu-section menu-left">
        {/* File operations */}
        <button className="menu-btn" onClick={handleNew} title="New Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>New</span>
        </button>

        <button className="menu-btn" onClick={handleOpen} title="Open Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
        </button>

        <button className="menu-btn" onClick={handleSave} title="Save Project">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Tag elements for production scheduling</div>
      </div>

      <div className="menu-section menu-right">
        {/* Dark Mode Toggle */}
        <button
          className="menu-btn icon-only"
          onClick={toggleDarkMode}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );

  const renderRewriterToolbar = () => (
    <>
      <div className="menu-section menu-left">
        <button className="menu-btn" onClick={handleNew} title="New Script">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>New</span>
        </button>

        <button className="menu-btn" onClick={handleOpen} title="Open Script">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open</span>
        </button>

        <button className="menu-btn" onClick={handleSave} title="Save Script">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>

        <button className="menu-btn" onClick={handleExportPDF} title="Export to PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M12 18v-6" />
            <path d="M9 15l3 3 3-3" />
          </svg>
          <span>PDF</span>
        </button>

        <div className="menu-divider" />

        {/* Split View */}
        <button
          className={`menu-btn ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => setViewMode(viewMode === 'split' ? 'script' : 'split')}
          title="Split View (Audio/Visual)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
          <span>Split</span>
        </button>

        {/* Title Page */}
        <button
          className={`menu-btn ${panels.titlePage ? 'active' : ''}`}
          onClick={() => togglePanel('titlePage')}
          title="Title Page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
          </svg>
          <span>Title Page</span>
        </button>
      </div>

      {/* Center Section - Element Type Dropdown */}
      <div className="menu-section menu-center">
        <div className="dropdown-container element-dropdown-container">
          <button
            className={`element-type-btn ${openDropdown === 'elements' ? 'active' : ''}`}
            onClick={() => toggleDropdown('elements')}
            title="Element Type"
          >
            <span className="element-type-label">{currentElementType.toUpperCase()}</span>
            <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {openDropdown === 'elements' && (
            <div className="dropdown-menu element-menu">
              {ELEMENT_TYPES.map((type) => (
                <button
                  key={type}
                  className={`dropdown-item ${currentElementType === type ? 'checked' : ''}`}
                  onClick={() => handleElementTypeChange(type)}
                >
                  <span className="check-mark">{currentElementType === type ? '✓' : ''}</span>
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Utility Tools */}
      <div className="menu-section menu-right">
        {/* Writing Stats */}
        <button
          className={`menu-btn ${panels.writingStats ? 'active' : ''}`}
          onClick={() => togglePanel('writingStats')}
          title="Writing Stats"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Stats</span>
        </button>

        {/* Show/Hide Dropdown */}
        <div className="dropdown-container">
          <button
            className={`menu-btn dropdown-trigger ${openDropdown === 'showhide' ? 'active' : ''}`}
            onClick={() => toggleDropdown('showhide')}
            title="Show/Hide"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Show/Hide</span>
            <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {openDropdown === 'showhide' && (
            <div className="dropdown-menu" onClick={closeDropdowns}>
              <button
                className={`dropdown-item ${visibility.ruler ? 'checked' : ''}`}
                onClick={() => toggleVisibility('ruler')}
              >
                <span className="check-mark">{visibility.ruler ? '✓' : ''}</span>
                Ruler
              </button>
              <button
                className={`dropdown-item ${visibility.sceneNavigator ? 'checked' : ''}`}
                onClick={() => toggleVisibility('sceneNavigator')}
              >
                <span className="check-mark">{visibility.sceneNavigator ? '✓' : ''}</span>
                Scene Navigator
              </button>
              <button
                className={`dropdown-item ${visibility.scriptNotes ? 'checked' : ''}`}
                onClick={() => toggleVisibility('scriptNotes')}
              >
                <span className="check-mark">{visibility.scriptNotes ? '✓' : ''}</span>
                Script Notes
              </button>
            </div>
          )}
        </div>

        {/* Production Features Dropdown */}
        <div className="dropdown-container">
          <button
            className={`menu-btn dropdown-trigger ${openDropdown === 'production' ? 'active' : ''}`}
            onClick={() => toggleDropdown('production')}
            title="Production Features"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <span>Production</span>
            <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {openDropdown === 'production' && (
            <div className="dropdown-menu production-menu" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-section-title">Scene Numbers</div>
              <button
                className={`dropdown-item ${showSceneNumbers ? 'checked' : ''}`}
                onClick={() => {
                  if (!showSceneNumbers) {
                    generateSceneNumbers();
                  } else {
                    toggleSceneNumbers();
                  }
                }}
              >
                <span className="check-mark">{showSceneNumbers ? '✓' : ''}</span>
                Show Scene Numbers
              </button>
              {showSceneNumbers && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    clearSceneNumbers();
                    closeDropdowns();
                  }}
                >
                  <span className="check-mark"></span>
                  Clear Scene Numbers
                </button>
              )}
              <div className="dropdown-divider" />
              <div className="dropdown-section-title">Watermark</div>
              <button
                className={`dropdown-item ${watermarkSettings.enabled ? 'checked' : ''}`}
                onClick={toggleWatermark}
              >
                <span className="check-mark">{watermarkSettings.enabled ? '✓' : ''}</span>
                Enable Watermark
              </button>
              {watermarkSettings.enabled && (
                <>
                  <div className="dropdown-item watermark-input">
                    <input
                      type="text"
                      value={watermarkSettings.text}
                      onChange={(e) => setWatermarkSettings({ text: e.target.value })}
                      placeholder="Watermark text"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="dropdown-item watermark-select">
                    <select
                      value={watermarkSettings.position}
                      onChange={(e) => setWatermarkSettings({ position: e.target.value as 'diagonal' | 'center' | 'header' | 'footer' })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="diagonal">Diagonal</option>
                      <option value="center">Center</option>
                      <option value="header">Header</option>
                      <option value="footer">Footer</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Version Management Dropdown */}
        <div className="dropdown-container">
          <button
            className={`menu-btn dropdown-trigger ${openDropdown === 'versions' ? 'active' : ''}`}
            onClick={() => toggleDropdown('versions')}
            title="Script Versions"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Versions</span>
            <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {openDropdown === 'versions' && (
            <div className="dropdown-menu versions-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="dropdown-item create-version"
                onClick={() => setShowVersionModal(true)}
              >
                <span className="check-mark">+</span>
                Create New Version
              </button>
              {versions.length > 0 && <div className="dropdown-divider" />}
              {versions.map((version) => (
                <div key={version.id} className="version-item">
                  <button
                    className={`dropdown-item ${activeVersionId === version.id ? 'checked' : ''}`}
                    onClick={() => {
                      switchVersion(version.id);
                      closeDropdowns();
                    }}
                  >
                    <span className="check-mark">{activeVersionId === version.id ? '✓' : ''}</span>
                    <span className="version-name">{version.name}</span>
                  </button>
                  <button
                    className="version-delete"
                    onClick={() => deleteVersion(version.id)}
                    title="Delete version"
                  >
                    ×
                  </button>
                </div>
              ))}
              {versions.length === 0 && (
                <div className="dropdown-item disabled">No versions saved</div>
              )}
            </div>
          )}
        </div>

        <div className="menu-divider" />

        {/* Dark Mode Toggle */}
        <button
          className="menu-btn icon-only"
          onClick={toggleDarkMode}
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );

  const currentApp = APPS[activeApp];

  return (
    <div className="toolbar">
      {/* Main Menu Bar */}
      <div className="toolbar-row menu-bar">
        {/* App Switcher Dropdown */}
        <div className="app-switcher">
          <div className="dropdown-container">
            <button
              className={`app-switcher-btn ${openDropdown === 'app-switcher' ? 'active' : ''}`}
              onClick={() => toggleDropdown('app-switcher')}
            >
              <span className="app-icon">{currentApp.icon}</span>
              <span className="app-name">{currentApp.name}</span>
              <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            {openDropdown === 'app-switcher' && (
              <div className="dropdown-menu app-menu">
                {(Object.keys(APPS) as Array<keyof typeof APPS>).map((appKey) => {
                  const app = APPS[appKey];
                  return (
                    <button
                      key={appKey}
                      className={`dropdown-item app-item ${activeApp === appKey ? 'active' : ''}`}
                      onClick={() => {
                        setActiveApp(appKey);
                        closeDropdowns();
                      }}
                    >
                      <span className="app-item-icon">{app.icon}</span>
                      <div className="app-item-info">
                        <span className="app-item-name">{app.name}</span>
                        <span className="app-item-desc">{app.description}</span>
                      </div>
                      {activeApp === appKey && <span className="check-mark">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="menu-divider" />

        {/* App-specific toolbar content */}
        {activeApp === 'blueprint' && renderBlueprintToolbar()}
        {activeApp === 'corkboard' && renderCorkboardToolbar()}
        {activeApp === 'rewriter' && renderRewriterToolbar()}
        {activeApp === 'breakdown' && renderBreakdownToolbar()}
      </div>

      {/* Secondary Bar - File Info and Stats (only for Re-writer) */}
      {activeApp === 'rewriter' && (
        <div className="toolbar-row format-bar">
          <div className="format-section">
            <div className="file-info">
              <span className="file-name">{fileName}</span>
              {isDirty && <span className="dirty-indicator">*</span>}
            </div>
          </div>

          <div className="format-section format-right">
            <div className="page-info">
              <span>{stats.pageCount} {stats.pageCount === 1 ? 'page' : 'pages'}</span>
              <span className="info-separator">|</span>
              <span>{stats.estimatedRuntime}</span>
              <span className="info-separator">|</span>
              <span>{stats.sceneCount} scenes</span>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".fdx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Version Creation Modal */}
      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Version</h3>
            <input
              type="text"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="Version name (e.g., Draft 2, Final, etc.)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateVersion();
                if (e.key === 'Escape') setShowVersionModal(false);
              }}
            />
            <div className="modal-buttons">
              <button onClick={() => setShowVersionModal(false)}>Cancel</button>
              <button className="primary" onClick={handleCreateVersion}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
