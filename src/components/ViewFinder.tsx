import React, { useState, useEffect } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { Shot, ShotSize, CameraAngle, CameraMovement, ShotStatus } from '../types/screenplay';
import { SHOT_SIZE_INFO } from '../types/screenplay';
import './ViewFinder.css';

// Shot size options
const SHOT_SIZES: ShotSize[] = [
  'EWS', 'WS', 'FS', 'MWS', 'MS', 'MCU', 'CU', 'BCU', 'ECU',
  'Insert', 'Cutaway', 'POV', 'OTS', '2-Shot', 'Group'
];

// Camera angles
const CAMERA_ANGLES: CameraAngle[] = [
  'Eye Level', 'Low Angle', 'High Angle', "Bird's Eye", "Worm's Eye", 'Dutch Angle', 'Overhead'
];

// Camera movements
const CAMERA_MOVEMENTS: CameraMovement[] = [
  'Static', 'Pan', 'Tilt', 'Dolly In', 'Dolly Out', 'Dolly', 'Truck',
  'Crane Up', 'Crane Down', 'Handheld', 'Steadicam', 'Gimbal',
  'Zoom In', 'Zoom Out', 'Push In', 'Pull Out', 'Arc', 'Tracking', 'Whip Pan', 'Roll', 'Vertigo'
];

// Shot statuses with colors
const SHOT_STATUS_COLORS: Record<ShotStatus, string> = {
  'Planned': '#6B7280',
  'Storyboarded': '#8B5CF6',
  'Approved': '#3B82F6',
  'Setup': '#F59E0B',
  'Filming': '#EF4444',
  'Completed': '#22C55E',
  'Cut': '#9CA3AF',
};

const ViewFinder: React.FC = () => {
  const {
    darkMode,
    viewFinder,
    breakdownScenes,
    selectedViewFinderSceneId,
    selectedShotId,
    viewFinderFilterStatus,
    initializeViewFinder,
    importScenesForViewFinder,
    addShot,
    updateShot,
    deleteShot,
    setShotStatus,
    duplicateShot,
    selectViewFinderScene,
    selectShot,
    setViewFinderFilterStatus,
    getShotsByScene,
    markSceneCoverageComplete,
  } = useScreenplayStore();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // New shot form
  const [newShot, setNewShot] = useState({
    shotNumber: '',
    size: 'MS' as ShotSize,
    angle: 'Eye Level' as CameraAngle,
    movement: 'Static' as CameraMovement,
    subject: '',
    description: '',
    duration: 5,
    directorNotes: '',
    dpNotes: '',
  });

  // Initialize ViewFinder on mount
  useEffect(() => {
    if (!viewFinder) {
      initializeViewFinder();
    }
  }, [viewFinder, initializeViewFinder]);

  // Get filtered shots
  const getFilteredShots = () => {
    if (!viewFinder) return [];
    let shots = selectedViewFinderSceneId
      ? getShotsByScene(selectedViewFinderSceneId)
      : viewFinder.shots;

    if (viewFinderFilterStatus !== 'All') {
      shots = shots.filter(s => s.status === viewFinderFilterStatus);
    }

    return shots.sort((a, b) => a.priority - b.priority);
  };

  const filteredShots = getFilteredShots();

  // Get scene info
  const selectedScene = breakdownScenes.find(s => s.id === selectedViewFinderSceneId);

  // Handle add shot
  const handleAddShot = () => {
    if (!selectedViewFinderSceneId || !newShot.subject) return;

    const existingShots = getShotsByScene(selectedViewFinderSceneId);

    addShot({
      sceneId: selectedViewFinderSceneId,
      sceneNumber: selectedScene?.sceneNumber || '1',
      shotNumber: newShot.shotNumber || `${existingShots.length + 1}`,
      size: newShot.size,
      angle: newShot.angle,
      movement: newShot.movement,
      subject: newShot.subject,
      description: newShot.description,
      equipment: {},
      duration: newShot.duration,
      status: 'Planned',
      priority: existingShots.length + 1,
      directorNotes: newShot.directorNotes,
      dpNotes: newShot.dpNotes,
    });

    // Reset form
    setNewShot({
      shotNumber: '',
      size: 'MS',
      angle: 'Eye Level',
      movement: 'Static',
      subject: '',
      description: '',
      duration: 5,
      directorNotes: '',
      dpNotes: '',
    });
    setShowAddModal(false);
  };

  // Handle update shot
  const handleUpdateShot = () => {
    if (!editingShot) return;

    updateShot(editingShot.id, {
      shotNumber: editingShot.shotNumber,
      size: editingShot.size,
      angle: editingShot.angle,
      movement: editingShot.movement,
      subject: editingShot.subject,
      description: editingShot.description,
      duration: editingShot.duration,
      directorNotes: editingShot.directorNotes,
      dpNotes: editingShot.dpNotes,
    });

    setEditingShot(null);
  };

  // Get scene coverage
  const getSceneCoverage = (sceneId: string) => {
    if (!viewFinder) return null;
    return viewFinder.sceneCoverage.find(c => c.sceneId === sceneId);
  };

  // Calculate stats
  const stats = {
    totalShots: viewFinder?.shots.length || 0,
    planned: viewFinder?.shots.filter(s => s.status === 'Planned').length || 0,
    completed: viewFinder?.shots.filter(s => s.status === 'Completed').length || 0,
    totalDuration: viewFinder?.shots.reduce((sum, s) => sum + (s.duration || 0), 0) || 0,
    scenesWithShots: new Set(viewFinder?.shots.map(s => s.sceneId) || []).size,
  };

  return (
    <div className={`viewfinder-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Sidebar */}
      <div className="viewfinder-sidebar">
        {/* Stats */}
        <div className="sidebar-section stats">
          <h3>Shot Statistics</h3>
          <div className="stat-item">
            <span className="stat-label">Total Shots</span>
            <span className="stat-value">{stats.totalShots}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Planned</span>
            <span className="stat-value">{stats.planned}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.completed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Est. Duration</span>
            <span className="stat-value">{Math.floor(stats.totalDuration / 60)}m {stats.totalDuration % 60}s</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Scenes Covered</span>
            <span className="stat-value">{stats.scenesWithShots}/{breakdownScenes.length}</span>
          </div>
        </div>

        {/* Status Filter */}
        <div className="sidebar-section">
          <h3>Filter by Status</h3>
          <select
            className="status-filter-select"
            value={viewFinderFilterStatus}
            onChange={(e) => setViewFinderFilterStatus(e.target.value as ShotStatus | 'All')}
          >
            <option value="All">All Shots</option>
            <option value="Planned">Planned</option>
            <option value="Storyboarded">Storyboarded</option>
            <option value="Approved">Approved</option>
            <option value="Setup">In Setup</option>
            <option value="Filming">Filming</option>
            <option value="Completed">Completed</option>
            <option value="Cut">Cut</option>
          </select>
        </div>

        {/* Scene List */}
        <div className="sidebar-section scenes">
          <h3>Scenes</h3>
          {breakdownScenes.length === 0 ? (
            <div className="empty-text">
              <p>No scenes available.</p>
              <p>Import from Breakdown first.</p>
            </div>
          ) : (
            <div className="scene-list">
              <button
                className={`scene-item ${!selectedViewFinderSceneId ? 'active' : ''}`}
                onClick={() => selectViewFinderScene(null)}
              >
                <span className="scene-number">All</span>
                <span className="scene-shots">{viewFinder?.shots.length || 0} shots</span>
              </button>
              {breakdownScenes.map(scene => {
                const coverage = getSceneCoverage(scene.id);
                const shotCount = coverage?.shotCount || 0;

                return (
                  <button
                    key={scene.id}
                    className={`scene-item ${selectedViewFinderSceneId === scene.id ? 'active' : ''}`}
                    onClick={() => selectViewFinderScene(scene.id)}
                  >
                    <span className="scene-number">{scene.sceneNumber}</span>
                    <span className="scene-name" title={`${scene.intExt}. ${scene.location} - ${scene.timeOfDay}`}>
                      {scene.location.substring(0, 20)}...
                    </span>
                    <span className="scene-shots">
                      {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
                      {coverage?.coverageComplete && <span className="complete-badge">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          {breakdownScenes.length === 0 && (
            <button className="import-btn large" onClick={importScenesForViewFinder}>
              Import Scenes from Breakdown
            </button>
          )}
          <button className="camera-btn" onClick={() => setShowCameraModal(true)}>
            Camera Packages
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="viewfinder-main">
        {/* Header */}
        <div className="main-header">
          <div className="header-left">
            <h2>
              {selectedScene
                ? `Scene ${selectedScene.sceneNumber}: ${selectedScene.location.substring(0, 35)}...`
                : 'All Shots'}
            </h2>
            <span className="shot-count">{filteredShots.length} shots</span>
          </div>
          <div className="header-right">
            {selectedViewFinderSceneId && (
              <>
                <button
                  className="add-shot-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Shot
                </button>
                <button
                  className={`coverage-btn ${getSceneCoverage(selectedViewFinderSceneId)?.coverageComplete ? 'complete' : ''}`}
                  onClick={() => {
                    const coverage = getSceneCoverage(selectedViewFinderSceneId);
                    markSceneCoverageComplete(selectedViewFinderSceneId, !coverage?.coverageComplete);
                  }}
                >
                  {getSceneCoverage(selectedViewFinderSceneId)?.coverageComplete
                    ? '✓ Coverage Complete'
                    : 'Mark Coverage Complete'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Shot List */}
        {filteredShots.length === 0 ? (
          <div className="empty-state">
            <p>No shots yet for this scene.</p>
            {selectedViewFinderSceneId && (
              <button className="add-shot-btn large" onClick={() => setShowAddModal(true)}>
                Add First Shot
              </button>
            )}
          </div>
        ) : (
          <div className="shots-grid">
            {filteredShots.map((shot) => (
              <div
                key={shot.id}
                className={`shot-card ${selectedShotId === shot.id ? 'selected' : ''}`}
                onClick={() => selectShot(shot.id)}
              >
                {/* Shot Header */}
                <div className="shot-header">
                  <span className="shot-number">{shot.shotNumber}</span>
                  <div className="shot-badges">
                    <span
                      className="size-badge"
                      title={SHOT_SIZE_INFO[shot.size]?.description || ''}
                    >
                      {shot.size}
                    </span>
                    <span className="movement-badge">{shot.movement}</span>
                  </div>
                </div>

                {/* Shot Preview (placeholder for storyboard) */}
                <div className="shot-preview">
                  {shot.storyboardFrame ? (
                    <img src={shot.storyboardFrame} alt={`Shot ${shot.shotNumber}`} />
                  ) : (
                    <div className="preview-placeholder">
                      <span className="preview-icon">🎬</span>
                      <span className="preview-text">{shot.size}</span>
                    </div>
                  )}
                </div>

                {/* Shot Details */}
                <div className="shot-details">
                  <p className="shot-subject">{shot.subject}</p>
                  {shot.description && (
                    <p className="shot-description">{shot.description}</p>
                  )}
                </div>

                {/* Shot Meta */}
                <div className="shot-meta">
                  <span className="angle">{shot.angle}</span>
                  {shot.duration && <span className="duration">{shot.duration}s</span>}
                </div>

                {/* Status */}
                <div className="shot-status">
                  <select
                    value={shot.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      setShotStatus(shot.id, e.target.value as ShotStatus);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ borderColor: SHOT_STATUS_COLORS[shot.status] }}
                  >
                    <option value="Planned">Planned</option>
                    <option value="Storyboarded">Storyboarded</option>
                    <option value="Approved">Approved</option>
                    <option value="Setup">Setup</option>
                    <option value="Filming">Filming</option>
                    <option value="Completed">Completed</option>
                    <option value="Cut">Cut</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="shot-actions">
                  <button
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingShot(shot);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="duplicate-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateShot(shot.id);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this shot?')) {
                        deleteShot(shot.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shot Info Panel */}
      {selectedShotId && (
        <div className="viewfinder-panel">
          {(() => {
            const shot = viewFinder?.shots.find(s => s.id === selectedShotId);
            if (!shot) return null;

            return (
              <>
                <div className="panel-header">
                  <h3>Shot {shot.shotNumber}</h3>
                  <button className="close-btn" onClick={() => selectShot(null)}>×</button>
                </div>

                <div className="panel-content">
                  <div className="info-group">
                    <label>Subject</label>
                    <p>{shot.subject}</p>
                  </div>

                  <div className="info-group">
                    <label>Description</label>
                    <p>{shot.description || 'No description'}</p>
                  </div>

                  <div className="info-row">
                    <div className="info-group">
                      <label>Size</label>
                      <p>{SHOT_SIZE_INFO[shot.size]?.name || shot.size}</p>
                    </div>
                    <div className="info-group">
                      <label>Angle</label>
                      <p>{shot.angle}</p>
                    </div>
                  </div>

                  <div className="info-row">
                    <div className="info-group">
                      <label>Movement</label>
                      <p>{shot.movement}</p>
                    </div>
                    <div className="info-group">
                      <label>Duration</label>
                      <p>{shot.duration || 0}s</p>
                    </div>
                  </div>

                  {shot.directorNotes && (
                    <div className="info-group">
                      <label>Director Notes</label>
                      <p className="notes">{shot.directorNotes}</p>
                    </div>
                  )}

                  {shot.dpNotes && (
                    <div className="info-group">
                      <label>DP Notes</label>
                      <p className="notes">{shot.dpNotes}</p>
                    </div>
                  )}

                  <div className="panel-actions">
                    <button
                      className="edit-btn"
                      onClick={() => setEditingShot(shot)}
                    >
                      Edit Shot
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Add Shot Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Shot</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Shot Number</label>
                <input
                  type="text"
                  placeholder="e.g., 1A, 2, 3B"
                  value={newShot.shotNumber}
                  onChange={(e) => setNewShot({ ...newShot, shotNumber: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  value={newShot.duration}
                  onChange={(e) => setNewShot({ ...newShot, duration: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                placeholder="What/who is being shot"
                value={newShot.subject}
                onChange={(e) => setNewShot({ ...newShot, subject: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Shot description..."
                value={newShot.description}
                onChange={(e) => setNewShot({ ...newShot, description: e.target.value })}
              />
            </div>

            <div className="form-row three-col">
              <div className="form-group">
                <label>Shot Size</label>
                <select
                  value={newShot.size}
                  onChange={(e) => setNewShot({ ...newShot, size: e.target.value as ShotSize })}
                >
                  {SHOT_SIZES.map(size => (
                    <option key={size} value={size}>
                      {size} - {SHOT_SIZE_INFO[size]?.name || size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Camera Angle</label>
                <select
                  value={newShot.angle}
                  onChange={(e) => setNewShot({ ...newShot, angle: e.target.value as CameraAngle })}
                >
                  {CAMERA_ANGLES.map(angle => (
                    <option key={angle} value={angle}>{angle}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Camera Movement</label>
                <select
                  value={newShot.movement}
                  onChange={(e) => setNewShot({ ...newShot, movement: e.target.value as CameraMovement })}
                >
                  {CAMERA_MOVEMENTS.map(movement => (
                    <option key={movement} value={movement}>{movement}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Director Notes</label>
              <textarea
                placeholder="Notes for the director..."
                value={newShot.directorNotes}
                onChange={(e) => setNewShot({ ...newShot, directorNotes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>DP Notes</label>
              <textarea
                placeholder="Notes for the DP/cinematographer..."
                value={newShot.dpNotes}
                onChange={(e) => setNewShot({ ...newShot, dpNotes: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={handleAddShot}
                disabled={!newShot.subject}
              >
                Add Shot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shot Modal */}
      {editingShot && (
        <div className="modal-overlay" onClick={() => setEditingShot(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Shot {editingShot.shotNumber}</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Shot Number</label>
                <input
                  type="text"
                  value={editingShot.shotNumber}
                  onChange={(e) => setEditingShot({ ...editingShot, shotNumber: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  value={editingShot.duration || 5}
                  onChange={(e) => setEditingShot({ ...editingShot, duration: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Subject</label>
              <input
                type="text"
                value={editingShot.subject}
                onChange={(e) => setEditingShot({ ...editingShot, subject: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editingShot.description}
                onChange={(e) => setEditingShot({ ...editingShot, description: e.target.value })}
              />
            </div>

            <div className="form-row three-col">
              <div className="form-group">
                <label>Shot Size</label>
                <select
                  value={editingShot.size}
                  onChange={(e) => setEditingShot({ ...editingShot, size: e.target.value as ShotSize })}
                >
                  {SHOT_SIZES.map(size => (
                    <option key={size} value={size}>
                      {size} - {SHOT_SIZE_INFO[size]?.name || size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Camera Angle</label>
                <select
                  value={editingShot.angle}
                  onChange={(e) => setEditingShot({ ...editingShot, angle: e.target.value as CameraAngle })}
                >
                  {CAMERA_ANGLES.map(angle => (
                    <option key={angle} value={angle}>{angle}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Camera Movement</label>
                <select
                  value={editingShot.movement}
                  onChange={(e) => setEditingShot({ ...editingShot, movement: e.target.value as CameraMovement })}
                >
                  {CAMERA_MOVEMENTS.map(movement => (
                    <option key={movement} value={movement}>{movement}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Director Notes</label>
              <textarea
                value={editingShot.directorNotes || ''}
                onChange={(e) => setEditingShot({ ...editingShot, directorNotes: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>DP Notes</label>
              <textarea
                value={editingShot.dpNotes || ''}
                onChange={(e) => setEditingShot({ ...editingShot, dpNotes: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setEditingShot(null)}>Cancel</button>
              <button className="danger" onClick={() => {
                if (confirm('Delete this shot?')) {
                  deleteShot(editingShot.id);
                  setEditingShot(null);
                }
              }}>
                Delete
              </button>
              <button className="primary" onClick={handleUpdateShot}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Packages Modal */}
      {showCameraModal && (
        <div className="modal-overlay" onClick={() => setShowCameraModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Camera Packages</h3>

            {viewFinder?.cameraPackages.length === 0 ? (
              <div className="empty-text">
                <p>No camera packages configured.</p>
                <p>Add your available cameras and lenses.</p>
              </div>
            ) : (
              <div className="camera-list">
                {viewFinder?.cameraPackages.map(pkg => (
                  <div key={pkg.id} className="camera-card">
                    <h4>{pkg.name}</h4>
                    {pkg.cameras.length > 0 && (
                      <div className="camera-item">
                        <label>Cameras:</label>
                        <p>{pkg.cameras.join(', ')}</p>
                      </div>
                    )}
                    {pkg.lenses.length > 0 && (
                      <div className="camera-item">
                        <label>Lenses:</label>
                        <p>{pkg.lenses.join(', ')}</p>
                      </div>
                    )}
                    {pkg.notes && (
                      <div className="camera-item">
                        <label>Notes:</label>
                        <p>{pkg.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setShowCameraModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewFinder;
