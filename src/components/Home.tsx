import { useEffect, useState } from 'react';
import { useAuthStore, useProjectsStore } from '../services/projectService';
import { googleAuth } from '../services/googleAuth';
import { useScreenplayStore } from '../store/screenplayStore';
import type { Project, ProjectData } from '../types/user';
import './Home.css';

export const Home = () => {
  const { user, isLoading: authLoading, signIn, signOut } = useAuthStore();
  const {
    projects,
    isLoading: projectsLoading,
    isSaving,
    error,
    fetchProjects,
    createProject,
    loadProject,
    deleteProject,
    renameProject,
    duplicateProject,
    clearError,
  } = useProjectsStore();

  const {
    screenplay,
    storyOutline,
    beatBoards,
    versions,
    scriptNotes,
    splitContent,
    breakdown,
    artCart,
    viewFinder,
    schedule,
    onSet,
    superVisor,
    showSceneNumbers,
    sceneNumberStyle,
    pageLocks,
    watermarkSettings,
    setActiveApp,
    loadFromProjectData,
    resetToNew,
  } = useScreenplayStore();

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Initialize auth and fetch projects
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [user]);

  // Get current project data
  const getCurrentProjectData = (): ProjectData => ({
    screenplay,
    storyOutline,
    beatBoards,
    versions,
    scriptNotes,
    splitContent,
    breakdown: breakdown || undefined,
    artCart: artCart || undefined,
    viewFinder: viewFinder || undefined,
    schedule: schedule || undefined,
    onSet: onSet || undefined,
    superVisor: superVisor || undefined,
    showSceneNumbers,
    sceneNumberStyle,
    pageLocks,
    watermarkSettings,
    version: 1,
    savedAt: new Date(),
  });

  // Handle create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      // Reset store to new screenplay
      resetToNew();

      // Get fresh data after reset
      const data = getCurrentProjectData();
      data.screenplay.title = newProjectName;

      await createProject(newProjectName, data);
      setShowNewProject(false);
      setNewProjectName('');

      // Go to editor
      setActiveApp('rewriter');
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  // Handle open project
  const handleOpenProject = async (project: Project) => {
    try {
      const data = await loadProject(project.id);
      loadFromProjectData(data);
      setActiveApp('rewriter');
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  // Handle rename
  const handleRename = async (projectId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    try {
      await renameProject(projectId, renameValue);
      setRenamingId(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename:', error);
    }
  };

  // Handle duplicate
  const handleDuplicate = async (project: Project) => {
    try {
      await duplicateProject(project.id, `${project.name} (Copy)`);
    } catch (error) {
      console.error('Failed to duplicate:', error);
    }
  };

  // Handle delete
  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isConfigured = googleAuth.isConfigured();

  return (
    <div className="home">
      {/* Header */}
      <header className="home-header">
        <div className="home-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>OTSP</span>
        </div>

        <div className="home-user">
          {authLoading ? (
            <div className="loading-spinner" />
          ) : user ? (
            <div className="user-info">
              {user.picture && (
                <img src={user.picture} alt={user.name} className="user-avatar" />
              )}
              <span className="user-name">{user.name}</span>
              <button className="btn-secondary" onClick={signOut}>
                Sign Out
              </button>
            </div>
          ) : isConfigured ? (
            <button className="btn-primary google-signin" onClick={signIn}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          ) : (
            <div className="setup-hint">
              <span>Cloud sync available with Google account</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <h1>Welcome to OTSP</h1>
          <p>Your complete film production ecosystem</p>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <button
            className="action-card primary"
            onClick={() => {
              resetToNew();
              setActiveApp('rewriter');
            }}
          >
            <div className="action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="action-text">
              <h3>Start Writing</h3>
              <p>Create a new screenplay</p>
            </div>
          </button>

          <button
            className="action-card"
            onClick={() => setShowNewProject(true)}
          >
            <div className="action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </div>
            <div className="action-text">
              <h3>New Project</h3>
              <p>Save to {user ? 'cloud' : 'browser'}</p>
            </div>
          </button>

          <label className="action-card">
            <input
              type="file"
              accept=".fdx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Trigger file open in store
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.fdx';
                  // This will be handled by Toolbar's file handler
                  setActiveApp('rewriter');
                }
              }}
            />
            <div className="action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="action-text">
              <h3>Open FDX</h3>
              <p>Import Final Draft file</p>
            </div>
          </label>
        </section>

        {/* Projects Section */}
        <section className="projects-section">
          <div className="projects-header">
            <h2>Your Projects</h2>
            <div className="projects-controls">
              <button
                className={`view-btn ${view === 'grid' ? 'active' : ''}`}
                onClick={() => setView('grid')}
                title="Grid view"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                className={`view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {projectsLoading ? (
            <div className="projects-loading">
              <div className="loading-spinner large" />
              <p>Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="projects-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <h3>No projects yet</h3>
              <p>
                {user
                  ? 'Create a new project to save your work to Google Drive'
                  : 'Sign in to sync your projects across devices'}
              </p>
            </div>
          ) : (
            <div className={`projects-${view}`}>
              {projects.map((project) => (
                <div key={project.id} className="project-card">
                  {renamingId === project.id ? (
                    <div className="project-rename">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(project.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(project.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        className="project-content"
                        onClick={() => handleOpenProject(project)}
                      >
                        <div className="project-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {project.isLocal && (
                            <span className="local-badge" title="Saved locally">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="14" rx="2" />
                                <polyline points="17 2 12 7 7 2" />
                              </svg>
                            </span>
                          )}
                          {project.isShared && (
                            <span className="shared-badge" title="Shared">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="project-info">
                          <h3>{project.name}</h3>
                          <p>Last modified {formatDate(project.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="project-actions">
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameValue(project.name);
                            setRenamingId(project.id);
                          }}
                          title="Rename"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(project);
                          }}
                          title="Duplicate"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          className="action-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(project.id);
                          }}
                          title="Delete"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* App Showcase */}
        <section className="apps-section">
          <h2>Production Tools</h2>
          <div className="apps-grid">
            {[
              { id: 'blueprint', name: 'BluePrint', desc: 'Story Development' },
              { id: 'corkboard', name: 'CorkBoard', desc: 'Visual Planning' },
              { id: 'rewriter', name: 'ReWriter', desc: 'Screenwriting' },
              { id: 'breakdown', name: 'BreakDown', desc: 'Script Breakdown' },
              { id: 'artcart', name: 'ArtCart', desc: 'Art Department' },
              { id: 'viewfinder', name: 'ViewFinder', desc: 'Shot Planning' },
              { id: 'basecamp', name: 'BaseCamp', desc: 'Scheduling' },
              { id: 'onset', name: 'OnSet', desc: 'Live Production' },
              { id: 'supervisor', name: 'SuperVisor', desc: 'Script Supervisor' },
            ].map((app) => (
              <button
                key={app.id}
                className="app-card"
                onClick={() => setActiveApp(app.id as any)}
              >
                <span className="app-name">{app.name}</span>
                <span className="app-desc">{app.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Info Section */}
        {!user && isConfigured && (
          <section className="info-section">
            <div className="info-card">
              <h3>Why sign in?</h3>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Save projects to your Google Drive (your free 15GB)
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Access your work from any device
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Share projects with collaborators
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  You own your data - stored in your Drive
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="modal-overlay" onClick={() => setShowNewProject(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Project</h2>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setShowNewProject(false);
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewProject(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isSaving}
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Project</h2>
            <p>Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="error-toast" onClick={clearError}>
          <span>{error}</span>
          <button>&times;</button>
        </div>
      )}
    </div>
  );
};
