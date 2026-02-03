import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { useScreenplayStore } from './store/screenplayStore';
import './App.css';

function App() {
  const { darkMode, isDirty } = useScreenplayStore();

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      <footer className="app-footer">
        <div className="shortcuts-hint">
          <span><kbd>Tab</kbd> Cycle element types</span>
          <span><kbd>Enter</kbd> New element</span>
          <span><kbd>Ctrl+1-6</kbd> Quick element switch</span>
          <span><kbd>Ctrl+S</kbd> Save</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
