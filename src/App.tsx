import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { useScreenplayStore } from './store/screenplayStore';
import './App.css';

function App() {
  const { darkMode, isDirty, fileName } = useScreenplayStore();

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

  return (
    <div className="app">
      <Toolbar />
      <Editor />
    </div>
  );
}

export default App;
