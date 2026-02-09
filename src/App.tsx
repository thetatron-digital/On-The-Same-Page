import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { Breakdown } from './components/Breakdown';
import { ArtCart } from './components/ArtCart';
import ViewFinder from './components/ViewFinder';
import BaseCamp from './components/BaseCamp';
import OnSet from './components/OnSet';
import SuperVisor from './components/SuperVisor';
import { useScreenplayStore } from './store/screenplayStore';
import { THEMES } from './types/screenplay';
import './App.css';

function App() {
  const { darkMode, isDirty, fileName, activeApp, activeTheme } = useScreenplayStore();

  // Apply theme to document
  useEffect(() => {
    // Get the theme config
    const theme = THEMES.find(t => t.id === activeTheme);

    // Determine the actual theme to apply (can include -dark variants)
    let themeToApply: string = activeTheme;

    // Handle dark mode toggle for themes that have dark variants
    if (activeTheme === 'default') {
      themeToApply = darkMode ? 'default-dark' : 'default';
    } else if (activeTheme === 'macos-minimal') {
      themeToApply = darkMode ? 'macos-minimal-dark' : 'macos-minimal';
    } else if (theme?.isDark) {
      // Theme is inherently dark, ignore darkMode toggle
      themeToApply = activeTheme;
    }

    document.documentElement.setAttribute('data-theme', themeToApply);
  }, [darkMode, activeTheme]);

  // Update document title with filename
  useEffect(() => {
    const baseName = fileName.replace('.fdx', '');
    document.title = isDirty ? `${baseName}* - Re-writer` : `${baseName} - Re-writer`;
  }, [fileName, isDirty]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Render the appropriate app based on activeApp
  const renderApp = () => {
    switch (activeApp) {
      case 'breakdown':
        return <Breakdown />;
      case 'artcart':
        return <ArtCart />;
      case 'viewfinder':
        return <ViewFinder />;
      case 'basecamp':
        return <BaseCamp />;
      case 'onset':
        return <OnSet />;
      case 'supervisor':
        return <SuperVisor />;
      default:
        return <Editor />;
    }
  };

  return (
    <div className="app">
      <Toolbar />
      {renderApp()}
    </div>
  );
}

export default App;
