import { useEffect, Suspense, lazy } from 'react';
import { AppMenuBar } from './components/AppMenuBar';
import { DialogHost } from './components/DialogHost';
import { SharedProjectPrompt } from './components/SharedProjectPrompt';
import { OfflineNotice } from './components/OfflineNotice';
import { Toolbar } from './components/Toolbar';
import { Editor } from './components/Editor';
import { Home } from './components/Home';
import { useScreenplayStore } from './store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useProjectsStore } from './services/projectService';
import { startAutoSave } from './services/autoSave';
import { startRemoteSync } from './services/projectSync';
import { useUrlSync } from './routing/useUrlSync';
import './App.css';

// Apps load when opened (ReWriter and Home are in the first download)
const Breakdown = lazy(() => import('./components/Breakdown').then((m) => ({ default: m.Breakdown })));
const ArtCart = lazy(() => import('./components/ArtCart').then((m) => ({ default: m.ArtCart })));
const ViewFinder = lazy(() => import('./components/ViewFinder'));
const BaseCamp = lazy(() => import('./components/BaseCamp'));
const OnSet = lazy(() => import('./components/OnSet'));
const SuperVisor = lazy(() => import('./components/SuperVisor'));
const BottomLine = lazy(() => import('./components/budget/BottomLine'));

function App() {
  const {
    darkMode,
    isDirty,
    fileName,
    activeApp,
  } = useScreenplayStore(
    useShallow((s) => ({
      darkMode: s.darkMode,
      isDirty: s.isDirty,
      fileName: s.fileName,
      activeApp: s.activeApp,
    }))
  );

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

  // Keep the URL and the open app/project in step
  useUrlSync();

  // Save the open project 30 s after the last change
  useEffect(() => startAutoSave(), []);
  // Shared Drive projects: pull collaborators' saves while open
  useEffect(() => startRemoteSync(() => useProjectsStore.getState().currentProjectId), []);

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
      case 'bottomline':
        return <BottomLine />;
      default:
        return <Editor />;
    }
  };


  // Home page has its own layout, don't show toolbar
  if (activeApp === 'home') {
    return (
      <>
        <Home />
        <OfflineNotice />
      </>
    );
  }

  return (
    <div className="app">
      {activeApp === 'rewriter' && <AppMenuBar />}
      <Toolbar />
      <Suspense fallback={<div className="app-loading" role="status">Loading…</div>}>{renderApp()}</Suspense>
      <DialogHost />
      <SharedProjectPrompt />
      <OfflineNotice />
    </div>
  );
}

export default App;
