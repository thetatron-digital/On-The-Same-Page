import { useRef, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { useAuthStore, useProjectsStore } from '../services/projectService';
import { googleAuth } from '../services/googleAuth';
import { downloadPDF } from '../utils/pdf';
import { downloadOTSP, generateBreakdownXML, generateScheduleXML, generateShotListXML, generateSupervisorXML, generateArtCartCSV } from '../utils/exportFormats';
import { detectFileType, importFDX, importBreakdownXML, importScheduleXML, importShotListXML, importMMS, importALE, importArtCartCSV } from '../utils/importFormats';
import type { ElementType } from '../types/screenplay';
import './Toolbar.css';

// Export format options
type ScreenplayExportFormat = 'fdx' | 'pdf';

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
  artcart: {
    name: 'ArtCart',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="10" y1="11" x2="14" y2="11" />
      </svg>
    ),
    description: 'Art Department',
  },
  viewfinder: {
    name: 'ViewFinder',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <circle cx="12" cy="11" r="3" />
        <line x1="12" y1="4" x2="12" y2="8" />
        <line x1="12" y1="14" x2="12" y2="18" />
        <line x1="2" y1="11" x2="9" y2="11" />
        <line x1="15" y1="11" x2="22" y2="11" />
      </svg>
    ),
    description: 'Shot Planning',
  },
  basecamp: {
    name: 'BaseCamp',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="8" x2="21" y2="8" />
        <line x1="8" y1="8" x2="8" y2="20" />
        <line x1="3" y1="12" x2="8" y2="12" />
        <line x1="3" y1="16" x2="8" y2="16" />
      </svg>
    ),
    description: 'Scheduling',
  },
  onset: {
    name: 'OnSet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
      </svg>
    ),
    description: 'Live Production',
  },
  supervisor: {
    name: 'SuperVisor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
    description: 'Script Supervisor',
  },
} as const;

export const Toolbar = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ScreenplayExportFormat>('fdx');
  const [isExporting, setIsExporting] = useState(false);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeDropdowns = () => {
    setOpenDropdown(null);
  };

  // Reusable Dark/Light mode toggle
  const renderThemePicker = () => (
    <button
      className="menu-btn icon-only"
      onClick={() => toggleDarkMode()}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );

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
    getProjectData,
  } = useScreenplayStore();

  // Auth and projects state
  const { user, signIn, signOut } = useAuthStore();
  const { currentProjectId, isSaving, saveProject } = useProjectsStore();
  const isGoogleConfigured = googleAuth.isConfigured();

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

    if (isDirty && activeApp === 'rewriter') {
      if (!confirm('You have unsaved changes. Open a new file anyway?')) {
        e.target.value = '';
        return;
      }
    }

    try {
      const content = await file.text();
      const fileType = detectFileType(file.name, content);

      // Handle based on current app and file type
      if (activeApp === 'rewriter' && (fileType === 'fdx' || file.name.endsWith('.fdx'))) {
        // FDX import for screenplay
        const result = importFDX(content);
        if (result.success && result.data) {
          loadFromFDX(content);
          setFileName(file.name);
        } else {
          throw new Error(result.error || 'Failed to parse FDX file');
        }
      } else if (activeApp === 'breakdown' && fileType === 'xml') {
        // XML import for breakdown
        const result = importBreakdownXML(content);
        if (result.success && result.data) {
          // Store will handle setting the breakdown
          alert('Breakdown data imported successfully!');
        } else {
          throw new Error(result.error || 'Failed to parse breakdown file');
        }
      } else if (activeApp === 'basecamp' && (fileType === 'mms' || fileType === 'xml')) {
        // MMS/XML import for schedule
        const result = fileType === 'mms' ? importMMS(content) : importScheduleXML(content);
        if (result.success && result.data) {
          alert('Schedule data imported successfully!' + (result.warnings ? `\n\nWarnings:\n${result.warnings.join('\n')}` : ''));
        } else {
          throw new Error(result.error || 'Failed to parse schedule file');
        }
      } else if (activeApp === 'viewfinder' && fileType === 'xml') {
        // XML import for shot list
        const result = importShotListXML(content);
        if (result.success && result.data) {
          alert('Shot list imported successfully!');
        } else {
          throw new Error(result.error || 'Failed to parse shot list file');
        }
      } else if (activeApp === 'supervisor' && fileType === 'ale') {
        // ALE import for takes
        const result = importALE(content);
        if (result.success && result.data) {
          alert(`Imported ${result.data.length} takes successfully!`);
        } else {
          throw new Error(result.error || 'Failed to parse ALE file');
        }
      } else if (activeApp === 'artcart' && fileType === 'csv') {
        // CSV import for ArtCart
        const result = importArtCartCSV(content);
        if (result.success && result.data) {
          alert(`Imported ${result.data.length} items successfully!`);
        } else {
          throw new Error(result.error || 'Failed to parse CSV file');
        }
      } else {
        // Default fallback - try FDX for screenplay
        loadFromFDX(content);
        setFileName(file.name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open file';
      alert(message);
    }

    e.target.value = '';
  };

  const handleSave = () => {
    // Show export modal when in ReWriter app
    if (activeApp === 'rewriter') {
      setShowExportModal(true);
    } else {
      // Direct save for other apps
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
    }
  };

  const handleExportScreenplay = (format: ScreenplayExportFormat) => {
    setShowExportModal(false);

    if (format === 'pdf') {
      const pdfFileName = fileName.replace(/\.fdx$/i, '') + '.pdf';
      downloadPDF(screenplay, pdfFileName, {
        showSceneNumbers,
        watermark: watermarkSettings,
      });
    } else {
      // FDX export
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
    }

    setDirty(false);
  };

  const handleExportProject = async () => {
    setIsExporting(true);
    try {
      const data = getProjectData();
      const projectName = screenplay.title || fileName.replace(/\.fdx$/i, '') || 'Untitled Project';
      await downloadOTSP(data, projectName);
    } catch (error) {
      alert('Failed to export project: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Get accepted file types based on current app
  const getAcceptedFileTypes = () => {
    switch (activeApp) {
      case 'rewriter':
        return '.fdx,.xml';
      case 'breakdown':
        return '.xml';
      case 'basecamp':
        return '.xml,.mms,.sex'; // .sex is Schedule Exchange format
      case 'viewfinder':
        return '.xml';
      case 'supervisor':
        return '.ale,.xml';
      case 'artcart':
        return '.csv,.xml';
      default:
        return '.fdx,.xml,.mms,.csv,.ale';
    }
  };

  const handleSaveToCloud = async () => {
    if (!currentProjectId) {
      // No project loaded, go to home to create one
      setActiveApp('home');
      return;
    }

    try {
      const data = getProjectData();
      await saveProject(currentProjectId, data);
      setDirty(false);
    } catch (error) {
      alert('Failed to save to cloud. Please try again.');
    }
  };

  // Export app-specific data to industry formats
  const handleExportAppData = () => {
    const projectName = screenplay.title || 'Untitled';

    switch (activeApp) {
      case 'breakdown': {
        const data = getProjectData();
        if (data.breakdown) {
          const xml = generateBreakdownXML(data.breakdown);
          const blob = new Blob([xml], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}_breakdown.xml`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('No breakdown data to export');
        }
        break;
      }
      case 'basecamp': {
        const data = getProjectData();
        if (data.schedule) {
          const xml = generateScheduleXML(data.schedule);
          const blob = new Blob([xml], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}_schedule.xml`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('No schedule data to export');
        }
        break;
      }
      case 'viewfinder': {
        const data = getProjectData();
        if (data.viewFinder) {
          const xml = generateShotListXML(data.viewFinder);
          const blob = new Blob([xml], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}_shots.xml`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('No shot list data to export');
        }
        break;
      }
      case 'supervisor': {
        const data = getProjectData();
        if (data.superVisor) {
          const xml = generateSupervisorXML(data.superVisor);
          const blob = new Blob([xml], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}_supervisor.xml`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('No supervisor data to export');
        }
        break;
      }
      case 'artcart': {
        const data = getProjectData();
        if (data.artCart) {
          const csv = generateArtCartCSV(data.artCart);
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}_artcart.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('No ArtCart data to export');
        }
        break;
      }
    }
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
        {renderThemePicker()}
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
        {renderThemePicker()}
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

        <button className="menu-btn" onClick={handleOpen} title="Import Breakdown (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import</span>
        </button>

        <button className="menu-btn" onClick={handleExportAppData} title="Export Breakdown (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Tag elements for production scheduling</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
      </div>
    </>
  );

  const renderArtCartToolbar = () => (
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

        <button className="menu-btn" onClick={handleOpen} title="Import Items (CSV)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import</span>
        </button>

        <button className="menu-btn" onClick={handleExportAppData} title="Export Items (CSV)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Art department sourcing & tracking (CSV)</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
      </div>
    </>
  );

  const renderViewFinderToolbar = () => (
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

        <button className="menu-btn" onClick={handleOpen} title="Import Shot List (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import</span>
        </button>

        <button className="menu-btn" onClick={handleExportAppData} title="Export Shot List (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Shot planning & cinematography</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
      </div>
    </>
  );

  const renderBaseCampToolbar = () => (
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

        <button className="menu-btn" onClick={handleOpen} title="Import Schedule (XML/MMS)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import</span>
        </button>

        <button className="menu-btn" onClick={handleExportAppData} title="Export Schedule (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Production scheduling & AD tools (Import MMS/XML)</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
      </div>
    </>
  );

  const renderOnSetToolbar = () => (
    <>
      <div className="menu-section menu-left">
        {/* Live production controls */}
        <button className="menu-btn" onClick={handleOpen} title="Import Data">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Live production board</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
      </div>
    </>
  );

  const renderSuperVisorToolbar = () => (
    <>
      <div className="menu-section menu-left">
        {/* Script supervisor operations */}
        <button className="menu-btn" onClick={handleOpen} title="Import Takes (ALE)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>Import ALE</span>
        </button>

        <button className="menu-btn" onClick={handleExportAppData} title="Export Logs (XML)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>
      </div>

      <div className="menu-section menu-center">
        <div className="app-subtitle">Script supervisor logs (ALE/XML)</div>
      </div>

      <div className="menu-section menu-right">
        {renderThemePicker()}
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

        <button className="menu-btn" onClick={() => setShowExportModal(true)} title="Export Screenplay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
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

        {renderThemePicker()}
      </div>
    </>
  );

  // Get current app config (default to rewriter if home or not found)
  const currentApp = activeApp !== 'home' && activeApp in APPS
    ? APPS[activeApp as keyof typeof APPS]
    : APPS.rewriter;

  return (
    <div className="toolbar">
      {/* Main Menu Bar */}
      <div className="toolbar-row menu-bar">
        {/* Home Button */}
        <button
          className="menu-btn icon-only home-btn"
          onClick={() => setActiveApp('home')}
          title="Home - Projects"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        <div className="menu-divider" />

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
        {activeApp === 'artcart' && renderArtCartToolbar()}
        {activeApp === 'viewfinder' && renderViewFinderToolbar()}
        {activeApp === 'basecamp' && renderBaseCampToolbar()}
        {activeApp === 'onset' && renderOnSetToolbar()}
        {activeApp === 'supervisor' && renderSuperVisorToolbar()}

        {/* Spacer to push user controls to the right */}
        <div style={{ flex: 1 }} />

        {/* Cloud Save Button */}
        {user && (
          <button
            className={`menu-btn icon-only ${isSaving ? 'saving' : ''}`}
            onClick={currentProjectId ? handleSaveToCloud : () => setActiveApp('home')}
            disabled={isSaving}
            title={isSaving ? 'Saving...' : currentProjectId ? 'Save to Cloud' : 'Go to Projects to enable cloud save'}
          >
            {isSaving ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
          </button>
        )}

        {/* User Controls */}
        <div className="user-controls">
          {user ? (
            <div className="user-menu dropdown-container">
              <button
                className={`user-btn ${openDropdown === 'user-menu' ? 'active' : ''}`}
                onClick={() => toggleDropdown('user-menu')}
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="user-avatar" />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              {openDropdown === 'user-menu' && (
                <div className="dropdown-menu user-dropdown">
                  <div className="user-info-header">
                    <span className="user-name">{user.name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setActiveApp('home');
                      closeDropdowns();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    My Projects
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      signOut();
                      closeDropdowns();
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : isGoogleConfigured ? (
            <button className="menu-btn sign-in-btn" onClick={signIn}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign In
            </button>
          ) : null}
        </div>
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
        accept={getAcceptedFileTypes()}
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

      {/* Export Format Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Screenplay</h3>
            <p className="modal-description">Choose your export format:</p>
            <div className="export-options">
              <button
                className={`export-option ${exportFormat === 'fdx' ? 'selected' : ''}`}
                onClick={() => setExportFormat('fdx')}
              >
                <div className="export-option-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M8 13h8M8 17h5" />
                  </svg>
                </div>
                <div className="export-option-info">
                  <span className="export-option-name">Final Draft (FDX)</span>
                  <span className="export-option-desc">Industry-standard screenplay format. Compatible with Final Draft, WriterSolo, and other screenwriting software.</span>
                </div>
                {exportFormat === 'fdx' && <span className="export-check">✓</span>}
              </button>
              <button
                className={`export-option ${exportFormat === 'pdf' ? 'selected' : ''}`}
                onClick={() => setExportFormat('pdf')}
              >
                <div className="export-option-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M12 18v-6" />
                    <path d="M9 15l3 3 3-3" />
                  </svg>
                </div>
                <div className="export-option-info">
                  <span className="export-option-name">PDF Document</span>
                  <span className="export-option-desc">Portable document for reading and printing. Includes watermarks and scene numbers if enabled.</span>
                </div>
                {exportFormat === 'pdf' && <span className="export-check">✓</span>}
              </button>
            </div>
            <div className="modal-divider" />
            <div className="export-project-section">
              <p className="modal-description">Or export entire project:</p>
              <button
                className="export-project-btn"
                onClick={handleExportProject}
                disabled={isExporting}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M12 12v6" />
                  <path d="M9 15l3-3 3 3" />
                  <path d="M8 4v4h8V4" />
                </svg>
                <span>{isExporting ? 'Exporting...' : 'Export Project (OTSP)'}</span>
              </button>
              <span className="export-project-hint">Exports all project data (screenplay, breakdown, schedule, shots, etc.) in industry-standard formats (FDX, XML, CSV)</span>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="primary" onClick={() => handleExportScreenplay(exportFormat)}>Export</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
