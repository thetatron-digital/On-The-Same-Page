import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { Breakdown } from './components/Breakdown';
import { ArtCart } from './components/ArtCart';
import ViewFinder from './components/ViewFinder';
import BaseCamp from './components/BaseCamp';
import OnSet from './components/OnSet';
import SuperVisor from './components/SuperVisor';
import { Home } from './components/Home';
import { useScreenplayStore } from './store/screenplayStore';
import { useAuthStore } from './services/projectService';
import './App.css';

function App() {
  const { darkMode, isDirty, fileName, activeApp } = useScreenplayStore();

  // Apply theme to document
  useEffect(() => {
    const themeToApply = darkMode ? 'default-dark' : 'default';
    document.documentElement.setAttribute('data-theme', themeToApply);
  }, [darkMode]);

  // Update document title with filename
  useEffect(() => {
    const baseName = fileName.replace('.fdx', '');
    document.title = isDirty ? `${baseName}* - OTSP` : `${baseName} - OTSP`;
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

  // Initialize auth on mount
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  // Render the appropriate app based on activeApp
  const renderApp = () => {
    switch (activeApp) {
      case 'home':
        return <Home />;
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

  // Home page has its own layout, don't show toolbar
  if (activeApp === 'home') {
    return <Home />;
  }

  return (
    <div className="app">
      <Toolbar />
      {renderApp()}
    </div>
  );
}

export default App;
