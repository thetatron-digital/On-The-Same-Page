import React, { useState, useEffect } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { TakeEntry } from '../types/screenplay';
import './SuperVisor.css';

type ViewTab = 'takes' | 'continuity' | 'reports';

const SuperVisor: React.FC = () => {
  const {
    darkMode,
    schedule,
    breakdownScenes,
    superVisor,
    initializeSuperVisor,
    startSupervisorSession,
    endSupervisorSession,
    logTake,
    updateTake,
    deleteTake,
    circleTake,
    addContinuityLog,
    updateContinuityLog,
    generateDailyReport,
    selectSuperVisorScene,
    setSuperVisorCameraFilter,
    getTakesForScene,
    getCircledTakes,
  } = useScreenplayStore();

  // Local state
  const [activeTab, setActiveTab] = useState<ViewTab>('takes');
  const [showTakeModal, setShowTakeModal] = useState(false);
  const [editingTake, setEditingTake] = useState<TakeEntry | null>(null);
  const [newTake, setNewTake] = useState<Partial<TakeEntry>>({
    sceneNumber: '',
    shotNumber: '',
    takeNumber: 1,
    camera: 'A',
    circled: false,
    rating: '',
    directorNotes: '',
    editorNotes: '',
  });

  // Initialize on mount
  useEffect(() => {
    if (!superVisor) {
      initializeSuperVisor();
    }
  }, [superVisor, initializeSuperVisor]);

  // Get current session
  const session = superVisor?.currentSession;

  // Get scenes with takes
  const scenesWithTakes = React.useMemo(() => {
    if (!session) return [];
    const sceneNumbers = new Set(session.takes.map(t => t.sceneNumber));
    return Array.from(sceneNumbers).sort();
  }, [session]);

  // Filter takes
  const filteredTakes = React.useMemo(() => {
    if (!session) return [];
    let takes = session.takes;

    if (superVisor?.selectedSceneId) {
      const scene = breakdownScenes.find(s => s.id === superVisor.selectedSceneId);
      if (scene) {
        takes = takes.filter(t => t.sceneNumber === scene.sceneNumber);
      }
    }

    if (superVisor?.filterCamera && superVisor.filterCamera !== 'All') {
      takes = takes.filter(t => t.camera === superVisor.filterCamera);
    }

    return takes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [session, superVisor, breakdownScenes]);

  // Handle starting a new session
  const handleStartSession = (dayId: string) => {
    startSupervisorSession(dayId);
  };

  // Handle logging a take
  const handleLogTake = () => {
    if (!newTake.sceneNumber || !newTake.shotNumber) return;

    logTake({
      sceneNumber: newTake.sceneNumber,
      shotId: newTake.shotId || '',
      shotNumber: newTake.shotNumber,
      takeNumber: newTake.takeNumber || 1,
      camera: newTake.camera || 'A',
      timecodeIn: newTake.timecodeIn,
      timecodeOut: newTake.timecodeOut,
      duration: newTake.duration,
      circled: newTake.circled || false,
      rating: newTake.rating || '',
      directorNotes: newTake.directorNotes,
      editorNotes: newTake.editorNotes,
      technicalNotes: newTake.technicalNotes,
      continuityNotes: newTake.continuityNotes,
      screenDirection: newTake.screenDirection,
    });

    // Reset form but keep scene/shot and increment take
    setNewTake({
      ...newTake,
      takeNumber: (newTake.takeNumber || 1) + 1,
      circled: false,
      rating: '',
      directorNotes: '',
      editorNotes: '',
      technicalNotes: '',
    });
  };

  // Handle updating a take
  const handleUpdateTake = () => {
    if (!editingTake) return;
    updateTake(editingTake.id, editingTake);
    setEditingTake(null);
    setShowTakeModal(false);
  };

  // Cameras in use
  const camerasInUse = React.useMemo(() => {
    if (!session) return ['A'];
    const cameras = new Set(session.takes.map(t => t.camera));
    if (cameras.size === 0) cameras.add('A');
    return Array.from(cameras).sort();
  }, [session]);

  // Stats
  const stats = {
    totalTakes: session?.totalTakes || 0,
    totalPrints: session?.totalPrints || 0,
    totalNG: session?.takes.filter(t => t.rating === 'NG').length || 0,
    scenesLogged: scenesWithTakes.length,
  };

  return (
    <div className={`supervisor-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <div className="supervisor-header">
        <div className="header-left">
          <h2>SuperVisor</h2>
          {session && (
            <span className="session-badge">
              Day {schedule?.shootDays.find(d => d.id === session.shootDayId)?.dayNumber || '?'}
            </span>
          )}
        </div>

        <div className="header-tabs">
          <button
            className={`tab ${activeTab === 'takes' ? 'active' : ''}`}
            onClick={() => setActiveTab('takes')}
          >
            Take Log
          </button>
          <button
            className={`tab ${activeTab === 'continuity' ? 'active' : ''}`}
            onClick={() => setActiveTab('continuity')}
          >
            Continuity
          </button>
          <button
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>

        <div className="header-actions">
          {!session ? (
            <select
              className="session-select"
              onChange={(e) => e.target.value && handleStartSession(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Start Session...</option>
              {schedule?.shootDays.map(day => (
                <option key={day.id} value={day.id}>
                  Day {day.dayNumber} {day.date ? `- ${new Date(day.date).toLocaleDateString()}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <button className="end-session-btn" onClick={endSupervisorSession}>
              End Session
            </button>
          )}
        </div>
      </div>

      {/* No session state */}
      {!session && (
        <div className="no-session">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
          </div>
          <h3>No Active Session</h3>
          <p>Start a supervisor session for a shoot day to begin logging takes.</p>
        </div>
      )}

      {/* Take Log Tab */}
      {session && activeTab === 'takes' && (
        <div className="supervisor-body takes-view">
          {/* Sidebar - Scene Filter */}
          <div className="supervisor-sidebar">
            <div className="sidebar-section">
              <h3>Stats</h3>
              <div className="stat-grid">
                <div className="stat">
                  <span className="stat-value">{stats.totalTakes}</span>
                  <span className="stat-label">Takes</span>
                </div>
                <div className="stat print">
                  <span className="stat-value">{stats.totalPrints}</span>
                  <span className="stat-label">Prints</span>
                </div>
                <div className="stat ng">
                  <span className="stat-value">{stats.totalNG}</span>
                  <span className="stat-label">NG</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{stats.scenesLogged}</span>
                  <span className="stat-label">Scenes</span>
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Filter by Scene</h3>
              <div className="scene-filter">
                <button
                  className={`filter-btn ${!superVisor?.selectedSceneId ? 'active' : ''}`}
                  onClick={() => selectSuperVisorScene(null)}
                >
                  All Scenes
                </button>
                {breakdownScenes.map(scene => (
                  <button
                    key={scene.id}
                    className={`filter-btn ${superVisor?.selectedSceneId === scene.id ? 'active' : ''}`}
                    onClick={() => selectSuperVisorScene(scene.id)}
                  >
                    Scene {scene.sceneNumber}
                    {getTakesForScene(scene.sceneNumber).length > 0 && (
                      <span className="take-count">
                        {getTakesForScene(scene.sceneNumber).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Filter by Camera</h3>
              <div className="camera-filter">
                <button
                  className={`filter-btn ${superVisor?.filterCamera === 'All' ? 'active' : ''}`}
                  onClick={() => setSuperVisorCameraFilter('All')}
                >
                  All
                </button>
                {camerasInUse.map(cam => (
                  <button
                    key={cam}
                    className={`filter-btn ${superVisor?.filterCamera === cam ? 'active' : ''}`}
                    onClick={() => setSuperVisorCameraFilter(cam)}
                  >
                    {cam}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="supervisor-main">
            {/* Quick Entry Form */}
            <div className="quick-entry">
              <div className="entry-row">
                <div className="entry-field">
                  <label>Scene</label>
                  <select
                    value={newTake.sceneNumber || ''}
                    onChange={(e) => setNewTake({ ...newTake, sceneNumber: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {breakdownScenes.map(scene => (
                      <option key={scene.id} value={scene.sceneNumber}>
                        {scene.sceneNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="entry-field">
                  <label>Shot</label>
                  <input
                    type="text"
                    value={newTake.shotNumber || ''}
                    onChange={(e) => setNewTake({ ...newTake, shotNumber: e.target.value })}
                    placeholder="1A"
                  />
                </div>

                <div className="entry-field">
                  <label>Take</label>
                  <input
                    type="number"
                    value={newTake.takeNumber || 1}
                    onChange={(e) => setNewTake({ ...newTake, takeNumber: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>

                <div className="entry-field">
                  <label>Camera</label>
                  <select
                    value={newTake.camera || 'A'}
                    onChange={(e) => setNewTake({ ...newTake, camera: e.target.value })}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div className="entry-field rating-field">
                  <label>Rating</label>
                  <div className="rating-buttons">
                    <button
                      className={`rating-btn print ${newTake.circled ? 'active' : ''}`}
                      onClick={() => setNewTake({ ...newTake, circled: !newTake.circled, rating: !newTake.circled ? 'Print' : '' })}
                    >
                      PRINT
                    </button>
                    <button
                      className={`rating-btn ng ${newTake.rating === 'NG' ? 'active' : ''}`}
                      onClick={() => setNewTake({ ...newTake, rating: newTake.rating === 'NG' ? '' : 'NG', circled: false })}
                    >
                      NG
                    </button>
                  </div>
                </div>
              </div>

              <div className="entry-row notes-row">
                <div className="entry-field flex-1">
                  <label>Director Notes</label>
                  <input
                    type="text"
                    value={newTake.directorNotes || ''}
                    onChange={(e) => setNewTake({ ...newTake, directorNotes: e.target.value })}
                    placeholder="e.g., Use first half"
                  />
                </div>

                <div className="entry-field flex-1">
                  <label>Editor Notes</label>
                  <input
                    type="text"
                    value={newTake.editorNotes || ''}
                    onChange={(e) => setNewTake({ ...newTake, editorNotes: e.target.value })}
                    placeholder="e.g., Best performance"
                  />
                </div>

                <button
                  className="log-take-btn"
                  onClick={handleLogTake}
                  disabled={!newTake.sceneNumber || !newTake.shotNumber}
                >
                  Log Take
                </button>
              </div>
            </div>

            {/* Takes List */}
            <div className="takes-list">
              <div className="takes-header">
                <span className="col-scene">Scene</span>
                <span className="col-shot">Shot</span>
                <span className="col-take">Take</span>
                <span className="col-camera">Cam</span>
                <span className="col-rating">Rating</span>
                <span className="col-notes">Notes</span>
                <span className="col-actions">Actions</span>
              </div>

              {filteredTakes.length === 0 ? (
                <div className="no-takes">
                  No takes logged yet. Use the form above to log takes.
                </div>
              ) : (
                filteredTakes.map(take => (
                  <div
                    key={take.id}
                    className={`take-row ${take.circled ? 'circled' : ''} ${take.rating === 'NG' ? 'ng' : ''}`}
                  >
                    <span className="col-scene">{take.sceneNumber}</span>
                    <span className="col-shot">{take.shotNumber}</span>
                    <span className="col-take">{take.takeNumber}</span>
                    <span className="col-camera">{take.camera}</span>
                    <span className="col-rating">
                      {take.circled && <span className="badge print">PRINT</span>}
                      {take.rating === 'Hold' && <span className="badge hold">HOLD</span>}
                      {take.rating === 'NG' && <span className="badge ng">NG</span>}
                    </span>
                    <span className="col-notes">
                      {take.directorNotes && <span className="note director">{take.directorNotes}</span>}
                      {take.editorNotes && <span className="note editor">{take.editorNotes}</span>}
                    </span>
                    <span className="col-actions">
                      <button
                        className={`circle-btn ${take.circled ? 'active' : ''}`}
                        onClick={() => circleTake(take.id, !take.circled)}
                        title={take.circled ? 'Uncircle' : 'Circle'}
                      >
                        ○
                      </button>
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingTake(take);
                          setShowTakeModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => {
                          if (confirm('Delete this take?')) {
                            deleteTake(take.id);
                          }
                        }}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Circled Takes Panel */}
          <div className="supervisor-panel">
            <h3>Circled Takes ({getCircledTakes().length})</h3>
            <div className="circled-list">
              {getCircledTakes().map(take => (
                <div key={take.id} className="circled-take">
                  <span className="take-info">
                    {take.sceneNumber} / {take.shotNumber} T{take.takeNumber}
                  </span>
                  <span className="take-camera">{take.camera}</span>
                </div>
              ))}
              {getCircledTakes().length === 0 && (
                <div className="no-circled">No circled takes yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Continuity Tab */}
      {session && activeTab === 'continuity' && (
        <div className="supervisor-body continuity-view">
          <div className="continuity-grid">
            {breakdownScenes.map(scene => {
              const log = superVisor?.continuityLogs.find(l => l.sceneId === scene.id);
              return (
                <div key={scene.id} className="continuity-card">
                  <div className="card-header">
                    <span className="scene-number">Scene {scene.sceneNumber}</span>
                    {!log && (
                      <button
                        className="add-log-btn"
                        onClick={() => addContinuityLog(scene.id)}
                      >
                        + Add Log
                      </button>
                    )}
                  </div>
                  {log && (
                    <div className="card-content">
                      <div className="log-field">
                        <label>Wardrobe</label>
                        <textarea
                          value={log.wardrobeNotes}
                          onChange={(e) => updateContinuityLog(log.id, { wardrobeNotes: e.target.value })}
                          placeholder="Wardrobe notes..."
                        />
                      </div>
                      <div className="log-field">
                        <label>Props</label>
                        <textarea
                          value={log.propsNotes}
                          onChange={(e) => updateContinuityLog(log.id, { propsNotes: e.target.value })}
                          placeholder="Props notes..."
                        />
                      </div>
                      <div className="log-field">
                        <label>Hair/Makeup</label>
                        <textarea
                          value={log.hairMakeupNotes}
                          onChange={(e) => updateContinuityLog(log.id, { hairMakeupNotes: e.target.value })}
                          placeholder="Hair/Makeup notes..."
                        />
                      </div>
                      <div className="log-field">
                        <label>Action/Blocking</label>
                        <textarea
                          value={log.actionNotes}
                          onChange={(e) => updateContinuityLog(log.id, { actionNotes: e.target.value })}
                          placeholder="Action notes..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {session && activeTab === 'reports' && (
        <div className="supervisor-body reports-view">
          <div className="reports-header">
            <h3>Daily Reports</h3>
            <button
              className="generate-btn"
              onClick={() => generateDailyReport(session.shootDayId)}
            >
              Generate Report
            </button>
          </div>

          <div className="reports-list">
            {superVisor?.dailyReports.map(report => (
              <div key={report.id} className={`report-card ${report.approved ? 'approved' : ''}`}>
                <div className="report-header">
                  <span className="report-date">
                    {new Date(report.date).toLocaleDateString()}
                  </span>
                  {report.approved && (
                    <span className="approved-badge">Approved</span>
                  )}
                </div>

                <div className="report-stats">
                  <div className="stat">
                    <span className="value">{report.takesTotal}</span>
                    <span className="label">Takes</span>
                  </div>
                  <div className="stat">
                    <span className="value">{report.printsTotal}</span>
                    <span className="label">Prints</span>
                  </div>
                  <div className="stat">
                    <span className="value">{report.ngTotal}</span>
                    <span className="label">NG</span>
                  </div>
                  <div className="stat">
                    <span className="value">{report.scenesCompleted.length}</span>
                    <span className="label">Scenes</span>
                  </div>
                </div>

                <div className="camera-breakdown">
                  <h4>By Camera</h4>
                  <div className="camera-stats">
                    {report.cameraInventory.map(cam => (
                      <div key={cam.camera} className="camera-stat">
                        <span className="camera-name">{cam.camera}</span>
                        <span className="camera-takes">{cam.takes} takes</span>
                        <span className="camera-prints">{cam.prints} prints</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {superVisor?.dailyReports.length === 0 && (
              <div className="no-reports">
                No reports generated yet. Click "Generate Report" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Take Modal */}
      {showTakeModal && editingTake && (
        <div className="modal-overlay" onClick={() => setShowTakeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Take</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Scene</label>
                <input type="text" value={editingTake.sceneNumber} readOnly />
              </div>
              <div className="form-group">
                <label>Shot</label>
                <input type="text" value={editingTake.shotNumber} readOnly />
              </div>
              <div className="form-group">
                <label>Take</label>
                <input type="number" value={editingTake.takeNumber} readOnly />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Rating</label>
                <select
                  value={editingTake.rating}
                  onChange={(e) => setEditingTake({
                    ...editingTake,
                    rating: e.target.value as TakeEntry['rating'],
                    circled: e.target.value === 'Print',
                  })}
                >
                  <option value="">None</option>
                  <option value="Print">Print</option>
                  <option value="Hold">Hold</option>
                  <option value="NG">NG</option>
                </select>
              </div>
              <div className="form-group">
                <label>Timecode In</label>
                <input
                  type="text"
                  value={editingTake.timecodeIn || ''}
                  onChange={(e) => setEditingTake({ ...editingTake, timecodeIn: e.target.value })}
                  placeholder="00:00:00:00"
                />
              </div>
              <div className="form-group">
                <label>Timecode Out</label>
                <input
                  type="text"
                  value={editingTake.timecodeOut || ''}
                  onChange={(e) => setEditingTake({ ...editingTake, timecodeOut: e.target.value })}
                  placeholder="00:00:00:00"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Director Notes</label>
              <textarea
                value={editingTake.directorNotes || ''}
                onChange={(e) => setEditingTake({ ...editingTake, directorNotes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Editor Notes</label>
              <textarea
                value={editingTake.editorNotes || ''}
                onChange={(e) => setEditingTake({ ...editingTake, editorNotes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Technical Notes</label>
              <textarea
                value={editingTake.technicalNotes || ''}
                onChange={(e) => setEditingTake({ ...editingTake, technicalNotes: e.target.value })}
                placeholder="e.g., Boom in shot at 0:23"
              />
            </div>

            <div className="form-group">
              <label>Continuity Notes</label>
              <textarea
                value={editingTake.continuityNotes || ''}
                onChange={(e) => setEditingTake({ ...editingTake, continuityNotes: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowTakeModal(false)}>Cancel</button>
              <button className="primary" onClick={handleUpdateTake}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperVisor;
