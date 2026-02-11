import React, { useState, useEffect } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { ShootDay, SceneStrip } from '../types/screenplay';
import { STRIP_COLOR_HEX } from '../types/screenplay';
import './BaseCamp.css';

const BaseCamp: React.FC = () => {
  const {
    darkMode,
    schedule,
    breakdownScenes,
    viewFinder,
    selectedShootDayId,
    selectedStripId,
    initializeSchedule,
    importStripsFromBreakdown,
    createShotPackagesFromViewFinder,
    addShootDay,
    updateShootDay,
    deleteShootDay,
    assignStripToDay,
    unassignStrip,
    lockStrip,
    selectShootDay,
    selectStrip,
    updateScheduleSettings,
    addDayTask,
    toggleDayTask,
    deleteDayTask,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
  } = useScreenplayStore();

  // Modal states
  const [showDayModal, setShowDayModal] = useState(false);
  const [editingDay, setEditingDay] = useState<ShootDay | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDayDetailModal, setShowDayDetailModal] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Drag state
  const [draggedStrip, setDraggedStrip] = useState<string | null>(null);

  // Initialize schedule on mount
  useEffect(() => {
    if (!schedule) {
      initializeSchedule();
    }
  }, [schedule, initializeSchedule]);

  // Get strip by ID
  const getStrip = (stripId: string): SceneStrip | undefined => {
    return schedule?.strips.find(s => s.id === stripId);
  };

  // Get shot count for a scene
  const getShotCountForScene = (sceneId: string): number => {
    if (!viewFinder?.shots) return 0;
    return viewFinder.shots.filter(s => s.sceneId === sceneId).length;
  };

  // Get shot package for a scene
  const getShotPackageForScene = (sceneId: string) => {
    return schedule?.shotPackages.find(p => p.sceneId === sceneId);
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, stripId: string) => {
    setDraggedStrip(stripId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop on day
  const handleDropOnDay = (e: React.DragEvent, dayId: string) => {
    e.preventDefault();
    if (draggedStrip) {
      assignStripToDay(draggedStrip, dayId);
      setDraggedStrip(null);
    }
  };

  // Handle drop on unscheduled
  const handleDropOnUnscheduled = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedStrip) {
      unassignStrip(draggedStrip);
      setDraggedStrip(null);
    }
  };

  // Calculate day totals
  const calculateDayTotals = (day: ShootDay) => {
    let totalPages = 0;
    day.strips.forEach(stripId => {
      const strip = getStrip(stripId);
      if (strip) {
        totalPages += strip.pageCount;
      }
    });
    return {
      scenes: day.strips.length,
      pages: totalPages.toFixed(1),
    };
  };

  // Format page count as eighths
  const formatPageCount = (pages: number): string => {
    const wholePages = Math.floor(pages);
    const eighths = Math.round((pages - wholePages) * 8);
    if (eighths === 0) return `${wholePages}`;
    if (wholePages === 0) return `${eighths}/8`;
    return `${wholePages} ${eighths}/8`;
  };

  // Render strip
  const renderStrip = (stripId: string, _inDay: boolean = false) => {
    const strip = getStrip(stripId);
    if (!strip) return null;

    const bgColor = STRIP_COLOR_HEX[strip.color] || '#FFFFFF';
    const isDark = strip.color === 'Black' || strip.color === 'Blue';
    const shotCount = getShotCountForScene(strip.sceneId);

    return (
      <div
        key={strip.id}
        className={`strip ${selectedStripId === strip.id ? 'selected' : ''} ${strip.isLocked ? 'locked' : ''}`}
        style={{
          backgroundColor: bgColor,
          color: isDark ? '#FFFFFF' : '#1a1a1a',
        }}
        draggable={!strip.isLocked}
        onDragStart={(e) => handleDragStart(e, strip.id)}
        onClick={() => selectStrip(strip.id)}
      >
        <span className="strip-scene">{strip.sceneNumber}</span>
        <span className="strip-int-ext">{strip.intExt}</span>
        <span className="strip-location">{strip.location}</span>
        <span className="strip-time">{strip.timeOfDay}</span>
        <span className="strip-pages">{formatPageCount(strip.pageCount)}</span>
        {shotCount > 0 && <span className="strip-shots" title={`${shotCount} shots planned`}>🎬{shotCount}</span>}
        {strip.isLocked && <span className="strip-lock">🔒</span>}
        {strip.hasStunts && <span className="strip-flag">⚡</span>}
        {strip.hasVFX && <span className="strip-flag">✨</span>}
      </div>
    );
  };

  // Stats
  const totalShots = viewFinder?.shots?.length || 0;
  const stats = {
    totalScenes: schedule?.strips.length || 0,
    scheduledScenes: schedule?.strips.filter(s => s.scheduledDayId).length || 0,
    unscheduledScenes: schedule?.unscheduledStrips.length || 0,
    totalDays: schedule?.shootDays.length || 0,
    totalPages: schedule?.strips.reduce((sum, s) => sum + s.pageCount, 0) || 0,
    totalShots,
    shotPackages: schedule?.shotPackages.length || 0,
  };

  return (
    <div className={`basecamp-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Sidebar */}
      <div className="basecamp-sidebar">
        {/* Stats */}
        <div className="sidebar-section stats">
          <h3>Schedule Overview</h3>
          <div className="stat-item">
            <span className="stat-label">Total Scenes</span>
            <span className="stat-value">{stats.totalScenes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Scheduled</span>
            <span className="stat-value">{stats.scheduledScenes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Unscheduled</span>
            <span className="stat-value warning">{stats.unscheduledScenes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Shoot Days</span>
            <span className="stat-value">{stats.totalDays}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Pages</span>
            <span className="stat-value">{formatPageCount(stats.totalPages)}</span>
          </div>
          {stats.totalShots > 0 && (
            <div className="stat-item highlight">
              <span className="stat-label">Planned Shots</span>
              <span className="stat-value">{stats.totalShots}</span>
            </div>
          )}
        </div>

        {/* Unscheduled Strips */}
        <div className="sidebar-section unscheduled">
          <h3>Unscheduled ({schedule?.unscheduledStrips.length || 0})</h3>
          <div
            className="unscheduled-area"
            onDragOver={handleDragOver}
            onDrop={handleDropOnUnscheduled}
          >
            {schedule?.unscheduledStrips.length === 0 ? (
              <div className="empty-text">
                {schedule?.strips.length === 0
                  ? 'Import scenes from Breakdown first'
                  : 'All scenes scheduled!'}
              </div>
            ) : (
              <div className="strip-list vertical">
                {schedule?.unscheduledStrips.map(stripId => renderStrip(stripId))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          {schedule?.strips.length === 0 && breakdownScenes.length > 0 && (
            <button className="import-btn" onClick={importStripsFromBreakdown}>
              Import from Breakdown
            </button>
          )}
          {viewFinder && viewFinder.shots.length > 0 && (
            <button className="sync-btn" onClick={createShotPackagesFromViewFinder}>
              Sync Shots from ViewFinder
            </button>
          )}
          <button className="add-day-btn" onClick={() => {
            addShootDay();
          }}>
            + Add Shoot Day
          </button>
          <button className="settings-btn" onClick={() => setShowSettingsModal(true)}>
            Schedule Settings
          </button>
        </div>
      </div>

      {/* Main Content - Strip Board */}
      <div className="basecamp-main">
        <div className="main-header">
          <h2>Strip Board</h2>
          <div className="strip-legend">
            <span className="legend-item" style={{ backgroundColor: STRIP_COLOR_HEX['White'] }}>Day Ext</span>
            <span className="legend-item" style={{ backgroundColor: STRIP_COLOR_HEX['Yellow'] }}>Day Int</span>
            <span className="legend-item" style={{ backgroundColor: STRIP_COLOR_HEX['Blue'], color: 'white' }}>Night Ext</span>
            <span className="legend-item" style={{ backgroundColor: STRIP_COLOR_HEX['Black'], color: 'white' }}>Night Int</span>
          </div>
        </div>

        {schedule?.shootDays.length === 0 ? (
          <div className="empty-state">
            <p>No shoot days created yet.</p>
            <button className="add-day-btn large" onClick={() => addShootDay()}>
              Create First Shoot Day
            </button>
          </div>
        ) : (
          <div className="days-board">
            {schedule?.shootDays.map(day => {
              const totals = calculateDayTotals(day);

              return (
                <div
                  key={day.id}
                  className={`day-column ${selectedShootDayId === day.id ? 'selected' : ''}`}
                  onClick={() => selectShootDay(day.id)}
                >
                  {/* Day Header */}
                  <div className="day-header">
                    <div className="day-number">Day {day.dayNumber}</div>
                    <div className="day-date">
                      {day.date ? new Date(day.date).toLocaleDateString() : 'TBD'}
                    </div>
                    <div className="day-info">
                      <span>{totals.scenes} scenes</span>
                      <span>{totals.pages} pgs</span>
                    </div>
                    <div className="day-times">
                      <span>Call: {day.callTime}</span>
                    </div>
                    <div className="day-actions">
                      <button
                        className="tasks-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDayDetailModal(day.id);
                        }}
                      >
                        Tasks
                      </button>
                      <button
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDay(day);
                          setShowDayModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete Day ${day.dayNumber}?`)) {
                            deleteShootDay(day.id);
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Day Strips */}
                  <div
                    className="day-strips"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDay(e, day.id)}
                  >
                    {day.strips.length === 0 ? (
                      <div className="drop-zone">
                        Drop scenes here
                      </div>
                    ) : (
                      <div className="strip-list">
                        {day.strips.map(stripId => renderStrip(stripId, true))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strip Details Panel */}
      {selectedStripId && (
        <div className="basecamp-panel">
          {(() => {
            const strip = getStrip(selectedStripId);
            if (!strip) return null;

            return (
              <>
                <div className="panel-header">
                  <h3>Scene {strip.sceneNumber}</h3>
                  <button className="close-btn" onClick={() => selectStrip(null)}>×</button>
                </div>

                <div className="panel-content">
                  <div className="info-group">
                    <label>Location</label>
                    <p>{strip.intExt}. {strip.location}</p>
                  </div>

                  <div className="info-group">
                    <label>Time of Day</label>
                    <p>{strip.timeOfDay}</p>
                  </div>

                  <div className="info-group">
                    <label>Page Count</label>
                    <p>{formatPageCount(strip.pageCount)} pages</p>
                  </div>

                  <div className="info-group">
                    <label>Description</label>
                    <p>{strip.description || 'No description'}</p>
                  </div>

                  <div className="info-group">
                    <label>Cast Required</label>
                    <p>{strip.castIds.length} cast members</p>
                  </div>

                  {/* ViewFinder Integration */}
                  {(() => {
                    const shotCount = getShotCountForScene(strip.sceneId);
                    const shotPackage = getShotPackageForScene(strip.sceneId);
                    if (shotCount === 0) return null;
                    return (
                      <div className="info-group viewfinder-info">
                        <label>Shot Coverage</label>
                        <p>{shotCount} shots planned</p>
                        {shotPackage && (
                          <p className="shot-duration">
                            Est. {shotPackage.estimatedDuration.toFixed(0)} min
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="panel-flags">
                    <label>
                      <input
                        type="checkbox"
                        checked={strip.hasStunts}
                        onChange={() => {
                          // Would need updateStrip action
                        }}
                        disabled
                      />
                      Has Stunts
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={strip.hasVFX}
                        disabled
                      />
                      Has VFX
                    </label>
                  </div>

                  <div className="panel-actions">
                    <button
                      className={`lock-btn ${strip.isLocked ? 'locked' : ''}`}
                      onClick={() => lockStrip(strip.id, !strip.isLocked)}
                    >
                      {strip.isLocked ? '🔒 Unlock' : '🔓 Lock Position'}
                    </button>
                    {strip.scheduledDayId && (
                      <button
                        className="unassign-btn"
                        onClick={() => unassignStrip(strip.id)}
                        disabled={strip.isLocked}
                      >
                        Remove from Day
                      </button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Edit Day Modal */}
      {showDayModal && editingDay && (
        <div className="modal-overlay" onClick={() => {
          setShowDayModal(false);
          setEditingDay(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Day {editingDay.dayNumber}</h3>

            <div className="form-group">
              <label>Shoot Date</label>
              <input
                type="date"
                value={editingDay.date ? new Date(editingDay.date).toISOString().split('T')[0] : ''}
                onChange={(e) => setEditingDay({
                  ...editingDay,
                  date: e.target.value ? new Date(e.target.value) : undefined,
                })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Call Time</label>
                <input
                  type="text"
                  value={editingDay.callTime}
                  onChange={(e) => setEditingDay({
                    ...editingDay,
                    callTime: e.target.value,
                  })}
                  placeholder="7:00 AM"
                />
              </div>
              <div className="form-group">
                <label>Est. Wrap</label>
                <input
                  type="text"
                  value={editingDay.estimatedWrap}
                  onChange={(e) => setEditingDay({
                    ...editingDay,
                    estimatedWrap: e.target.value,
                  })}
                  placeholder="7:00 PM"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={editingDay.location || ''}
                onChange={(e) => setEditingDay({
                  ...editingDay,
                  location: e.target.value,
                })}
                placeholder="Main location for the day"
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={editingDay.notes || ''}
                onChange={(e) => setEditingDay({
                  ...editingDay,
                  notes: e.target.value,
                })}
                placeholder="Day notes..."
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => {
                setShowDayModal(false);
                setEditingDay(null);
              }}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  updateShootDay(editingDay.id, editingDay);
                  setShowDayModal(false);
                  setEditingDay(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule Settings</h3>

            <div className="form-group">
              <label>Default Call Time</label>
              <input
                type="text"
                value={schedule?.defaultCallTime || '7:00 AM'}
                onChange={(e) => updateScheduleSettings({ defaultCallTime: e.target.value })}
                placeholder="7:00 AM"
              />
            </div>

            <div className="form-group">
              <label>Default Lunch Duration (minutes)</label>
              <input
                type="number"
                value={schedule?.defaultLunchDuration || 30}
                onChange={(e) => updateScheduleSettings({ defaultLunchDuration: parseInt(e.target.value) || 30 })}
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={schedule?.showLunchOnBoard ?? true}
                  onChange={(e) => updateScheduleSettings({ showLunchOnBoard: e.target.checked })}
                />
                Show Lunch Countdown on Production Board
              </label>
              <span className="form-hint">Toggle off if you don't want crew watching the clock</span>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowSettingsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Day Detail / Tasks Modal */}
      {showDayDetailModal && (() => {
        const day = schedule?.shootDays.find(d => d.id === showDayDetailModal);
        if (!day) return null;

        const tasks = day.tasks || [];
        // Calculate progress: each subtask counts as a fraction of its parent task's weight
        // Each task has equal weight (1/totalTasks). If a task has subtasks, each subtask
        // contributes (1/totalTasks) * (1/subtaskCount) to the progress.
        let totalUnits = 0;
        let completedUnits = 0;
        tasks.forEach(task => {
          if (task.subtasks.length === 0) {
            totalUnits += 1;
            if (task.completed) completedUnits += 1;
          } else {
            totalUnits += task.subtasks.length;
            completedUnits += task.subtasks.filter(st => st.completed).length;
          }
        });
        const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

        const dateStr = day.date
          ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          : `Day ${day.dayNumber}`;

        return (
          <div className="modal-overlay" onClick={() => {
            setShowDayDetailModal(null);
            setNewTaskTitle('');
            setAddingSubtaskFor(null);
            setNewSubtaskTitle('');
          }}>
            <div className="day-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="day-detail-header">
                <div>
                  <h3>{dateStr}</h3>
                  {day.location && <div className="day-detail-location">{day.location}</div>}
                </div>
                <button className="day-detail-close" onClick={() => {
                  setShowDayDetailModal(null);
                  setNewTaskTitle('');
                  setAddingSubtaskFor(null);
                  setNewSubtaskTitle('');
                }}>
                  ×
                </button>
              </div>

              {/* Progress bar */}
              <div className="day-detail-progress">
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="progress-label">
                  {completedUnits}/{totalUnits} done ({progressPercent}%)
                </div>
              </div>

              {/* Tasks list */}
              <div className="day-detail-tasks">
                {tasks.map(task => {
                  const taskSubtasks = task.subtasks;
                  const taskCompletedCount = taskSubtasks.filter(st => st.completed).length;

                  return (
                    <div key={task.id} className="task-item">
                      <div className="task-header">
                        <label className="task-checkbox-label">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleDayTask(day.id, task.id)}
                            className="task-checkbox"
                          />
                          <span className={`task-title ${task.completed ? 'completed' : ''}`}>
                            {task.title}
                          </span>
                        </label>
                        <div className="task-meta">
                          {taskSubtasks.length > 0 && (
                            <span className="task-subtask-count">
                              {taskCompletedCount}/{taskSubtasks.length}
                            </span>
                          )}
                          <button
                            className="task-delete"
                            onClick={() => deleteDayTask(day.id, task.id)}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Subtasks */}
                      {taskSubtasks.length > 0 && (
                        <div className="subtask-list">
                          {taskSubtasks.map(st => (
                            <div key={st.id} className="subtask-item">
                              <label className="subtask-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={st.completed}
                                  onChange={() => toggleSubTask(day.id, task.id, st.id)}
                                  className="subtask-checkbox"
                                />
                                <span className={`subtask-title ${st.completed ? 'completed' : ''}`}>
                                  {st.title}
                                </span>
                              </label>
                              <button
                                className="subtask-delete"
                                onClick={() => deleteSubTask(day.id, task.id, st.id)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add subtask */}
                      {addingSubtaskFor === task.id ? (
                        <div className="add-subtask-input">
                          <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                                addSubTask(day.id, task.id, newSubtaskTitle.trim());
                                setNewSubtaskTitle('');
                              }
                              if (e.key === 'Escape') {
                                setAddingSubtaskFor(null);
                                setNewSubtaskTitle('');
                              }
                            }}
                            placeholder="Add subtask..."
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="add-subtask-btn"
                          onClick={() => {
                            setAddingSubtaskFor(task.id);
                            setNewSubtaskTitle('');
                          }}
                        >
                          + Add subtask
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add task */}
                <div className="add-task-input">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskTitle.trim()) {
                        addDayTask(day.id, newTaskTitle.trim());
                        setNewTaskTitle('');
                      }
                    }}
                    placeholder="Add a task..."
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BaseCamp;
