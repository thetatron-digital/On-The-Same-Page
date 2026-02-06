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

export const Toolbar = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
    stats,
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
    downloadPDF(screenplay, pdfFileName);
  };

  const handleElementTypeChange = (type: ElementType) => {
    setCurrentElementType(type);
    if (selectedElementId) {
      updateElementType(selectedElementId, type);
    }
  };

  return (
    <div className="toolbar">
      {/* Main Menu Bar */}
      <div className="toolbar-row menu-bar">
        <div className="menu-section">
          <div className="toolbar-brand">
            <span className="brand-icon">R</span>
            <span className="brand-name">Re-writer</span>
          </div>
        </div>

        <div className="menu-section menu-center">
          <button className="menu-btn" onClick={handleNew} title="New Script (Ctrl+N)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>New</span>
          </button>

          <button className="menu-btn" onClick={handleOpen} title="Open Script (Ctrl+O)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Open</span>
          </button>

          <button className="menu-btn" onClick={handleSave} title="Save Script (Ctrl+S)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>Save</span>
          </button>

          <div className="menu-divider" />

          {/* Panels Dropdown */}
          <div className="dropdown-container">
            <button
              className={`menu-btn dropdown-trigger ${openDropdown === 'panels' ? 'active' : ''}`}
              onClick={() => toggleDropdown('panels')}
              title="Show/Hide Panels"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>Panels</span>
              <svg className="dropdown-arrow" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 4l4 4 4-4" />
              </svg>
            </button>
            {openDropdown === 'panels' && (
              <div className="dropdown-menu" onClick={closeDropdowns}>
                <button
                  className={`dropdown-item ${panels.navigator ? 'checked' : ''}`}
                  onClick={() => togglePanel('navigator')}
                >
                  <span className="check-mark">{panels.navigator ? '✓' : ''}</span>
                  Navigator
                </button>
                <button
                  className={`dropdown-item ${panels.writingStats ? 'checked' : ''}`}
                  onClick={() => togglePanel('writingStats')}
                >
                  <span className="check-mark">{panels.writingStats ? '✓' : ''}</span>
                  Writing Stats
                </button>
                <button
                  className={`dropdown-item ${panels.elements ? 'checked' : ''}`}
                  onClick={() => togglePanel('elements')}
                >
                  <span className="check-mark">{panels.elements ? '✓' : ''}</span>
                  Elements
                </button>
                <div className="dropdown-divider" />
                <button
                  className={`dropdown-item ${panels.titlePage ? 'checked' : ''}`}
                  onClick={() => togglePanel('titlePage')}
                >
                  <span className="check-mark">{panels.titlePage ? '✓' : ''}</span>
                  Title Page
                </button>
              </div>
            )}
          </div>

          <div className="menu-divider" />

          <button className="menu-btn" onClick={handleExportPDF} title="Export to PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
            <span>PDF</span>
          </button>
        </div>

        <div className="menu-section menu-right">
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
      </div>

      {/* Secondary Toolbar - Element & Formatting */}
      <div className="toolbar-row format-bar">
        <div className="format-section">
          <select
            value={currentElementType}
            onChange={(e) => handleElementTypeChange(e.target.value as ElementType)}
            className="element-dropdown"
          >
            {ELEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="format-section format-center">
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
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".fdx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
