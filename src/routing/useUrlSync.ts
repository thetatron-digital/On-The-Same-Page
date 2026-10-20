// Keeps the URL and the open app/project in step:
//   - on startup, opens the project named in the URL (reload, shared link)
//   - back/forward switch apps
//   - switching apps or projects updates the URL
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useScreenplayStore } from '../store/screenplayStore';
import { useAuthStore, useProjectsStore } from '../services/projectService';
import { openProject } from '../services/openProject';
import { buildPath, HOME, parsePath } from './routes';

export function useUrlSync(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const activeApp = useScreenplayStore((s) => s.activeApp);
  const setActiveApp = useScreenplayStore((s) => s.setActiveApp);
  const currentProjectId = useProjectsStore((s) => s.currentProjectId);
  const authReady = useAuthStore((s) => s.isInitialized);

  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // 1. Startup: the URL decides what is open
  useEffect(() => {
    if (!authReady || startedRef.current) return;
    startedRef.current = true;
    const target = parsePath(location.pathname) ?? HOME;

    (async () => {
      if (target.projectId) {
        try {
          await openProject(target.projectId, target.app);
        } catch (error) {
          console.error('Failed to open project from URL:', error);
          setActiveApp('home');
        }
      } else {
        // Don't stay attached to the last session's project while
        // showing a blank document (Save/auto-save would overwrite it)
        useProjectsStore.getState().setCurrentProject(null);
        setActiveApp(target.app);
      }
      setReady(true);
    })();
  }, [authReady, location.pathname, setActiveApp]);

  // 2. URL -> app (back/forward, typed URLs)
  useEffect(() => {
    if (!ready) return;
    const target = parsePath(location.pathname);
    if (!target) {
      navigate(buildPath({ app: activeApp, projectId: currentProjectId }), { replace: true });
      return;
    }
    if (target.projectId && target.projectId !== currentProjectId) {
      openProject(target.projectId, target.app).catch((error) => {
        console.error('Failed to open project from URL:', error);
        setActiveApp('home');
      });
      return;
    }
    if (target.app !== activeApp) setActiveApp(target.app);
    // Only react to URL changes here; app/project changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, location.pathname]);

  // 3. app/project -> URL
  useEffect(() => {
    if (!ready) return;
    const path = buildPath({ app: activeApp, projectId: currentProjectId });
    if (path !== location.pathname) navigate(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeApp, currentProjectId]);
}
