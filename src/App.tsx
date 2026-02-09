import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { Breakdown } from './components/Breakdown';
import { ArtCart } from './components/ArtCart';
import ViewFinder from './components/ViewFinder';
import BaseCamp from './components/BaseCamp';
import OnSet from './components/OnSet';
import { useScreenplayStore } from './store/screenplayStore';
import './App.css';

function App() {
  const { darkMode, isDirty, fileName, activeApp } = useScreenplayStore();

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
