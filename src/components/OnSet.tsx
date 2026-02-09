import React, { useState, useEffect } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { OnSetViewMode } from '../types/screenplay';
import { STRIP_COLOR_HEX } from '../types/screenplay';
import './OnSet.css';

const OnSet: React.FC = () => {
  const {
    darkMode,
    schedule,
    onSet,
    initializeOnSet,
    setOnSetViewMode,
    updateOnSetDisplaySettings,
    startProductionDay,
    markStripComplete,
    markStripInProgress,
    startLunch,
    endLunch,
    addDelay,
    endDelay,
    goLive,
    goOffline,
    getQuickStatus,
  } = useScreenplayStore();

  // Local state
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [delayCategory, setDelayCategory] = useState<'Weather' | 'Technical' | 'Talent' | 'Medical' | 'Other'>('Other');
  const [delayNotes, setDelayNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initialize on mount
  useEffect(() => {
    if (!onSet) {
      initializeOnSet();
    }
  }, [onSet, initializeOnSet]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get current status
  const status = getQuickStatus();

  // Get current day
  const currentDay = onSet?.productionStatus
    ? schedule?.shootDays.find(d => d.id === onSet.productionStatus!.currentDayId)
    : null;

  // Get current and upcoming strips
  const getCurrentStrip = () => {
    if (!onSet?.productionStatus || !currentDay || !schedule) return null;
    const stripId = currentDay.strips[onSet.productionStatus.currentStripIndex];
    return schedule.strips.find(s => s.id === stripId);
  };

  const getNextStrips = (count: number = 3) => {
    if (!onSet?.productionStatus || !currentDay || !schedule) return [];
    const startIndex = onSet.productionStatus.currentStripIndex + 1;
    return currentDay.strips
      .slice(startIndex, startIndex + count)
      .map(id => schedule.strips.find(s => s.id === id))
      .filter(Boolean);
  };

  // Calculate elapsed time for current scene
  const getElapsedTime = () => {
    if (!onSet?.productionStatus?.currentSetupStartedAt) return '00:00';
    const elapsed = (currentTime.getTime() - new Date(onSet.productionStatus.currentSetupStartedAt).getTime()) / 1000;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate lunch countdown
  const getLunchCountdown = () => {
    if (!onSet?.lunchStatus?.isOnLunch || !onSet.lunchStatus.lunchStartedAt) return null;
    const elapsed = (currentTime.getTime() - new Date(onSet.lunchStatus.lunchStartedAt).getTime()) / 60000;
    const remaining = onSet.lunchStatus.scheduledDuration - elapsed;
    if (remaining <= 0) return '00:00';
    const mins = Math.floor(remaining);
    const secs = Math.floor((remaining - mins) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle starting a delay
  const handleAddDelay = () => {
    if (!delayReason.trim()) return;
    addDelay(delayReason, delayCategory, delayNotes || undefined);
    setDelayReason('');
    setDelayNotes('');
    setShowDelayModal(false);
  };

  // Get active delay
  const activeDelay = onSet?.delays.find(d => !d.endedAt);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const currentStrip = getCurrentStrip();
  const viewMode = onSet?.viewMode || 'control';
  const isLive = onSet?.isLive || false;
  const displaySettings = onSet?.displaySettings;

  // Render Display/TV View (scoreboard)
  if (viewMode === 'display' || viewMode === 'crew') {
    return (
      <div className={`onset-container display-mode ${darkMode ? 'dark' : 'light'}`}>
        {/* Large Clock */}
        <div className="display-clock">
          {formatTime(currentTime)}
        </div>

        {/* Current Scene */}
        <div className="display-current">
          {onSet?.lunchStatus?.isOnLunch ? (
            <div className="display-lunch">
              <div className="lunch-label">LUNCH</div>
              {displaySettings?.showLunchCountdown && (
                <div className="lunch-countdown">{getLunchCountdown()}</div>
              )}
            </div>
          ) : (
            <>
              <div className="current-scene-number">
                {status?.currentScene || 'Standby'}
              </div>
              <div className="current-setup">
                {status?.currentSetup || ''}
              </div>
              {displaySettings?.showProgressBar && currentStrip && (
                <div className="elapsed-timer">
                  {getElapsedTime()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Status Bar */}
        <div className="display-status-bar">
          <div className={`status-item ${status?.aheadBehind.startsWith('+') ? 'ahead' : status?.aheadBehind.startsWith('-') ? 'behind' : ''}`}>
            {status?.aheadBehind || 'On Schedule'}
          </div>
          <div className="status-item">
            Wrap: {currentDay?.estimatedWrap || 'TBD'}
          </div>
        </div>

        {/* Next Up */}
        {displaySettings?.showNextShot && (
          <div className="display-next">
            <div className="next-label">NEXT UP</div>
            <div className="next-scene">{status?.nextUp || 'Wrap'}</div>
          </div>
        )}

        {/* Active Delay Warning */}
        {activeDelay && (
          <div className="delay-warning">
            DELAY: {activeDelay.reason}
          </div>
        )}

        {/* Mode toggle for crew */}
        {viewMode === 'crew' && (
          <button
            className="view-toggle"
            onClick={() => setOnSetViewMode('control')}
          >
            Exit Crew View
          </button>
        )}
      </div>
    );
  }

  // Render Control View (AD Panel)
  return (
    <div className={`onset-container control-mode ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <div className="onset-header">
        <div className="header-left">
          <h2>OnSet</h2>
          <div className={`live-indicator ${isLive ? 'live' : ''}`}>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
        <div className="header-clock">
          {formatTime(currentTime)}
        </div>
        <div className="header-actions">
          <select
            value={viewMode}
            onChange={(e) => setOnSetViewMode(e.target.value as OnSetViewMode)}
            className="view-select"
          >
            <option value="control">AD Control</option>
            <option value="display">TV Display</option>
            <option value="crew">Crew View</option>
          </select>
          {!isLive ? (
            <button className="go-live-btn" onClick={goLive}>
              Go Live
            </button>
          ) : (
            <button className="go-offline-btn" onClick={goOffline}>
              Go Offline
            </button>
          )}
        </div>
      </div>

      <div className="onset-body">
        {/* Left Panel - Day Selection & Quick Actions */}
        <div className="onset-sidebar">
          {/* Day Selection */}
          <div className="sidebar-section">
            <h3>Production Day</h3>
            {!onSet?.productionStatus ? (
              <div className="day-selector">
                {schedule?.shootDays.map(day => (
                  <button
                    key={day.id}
                    className="day-btn"
                    onClick={() => startProductionDay(day.id)}
                  >
                    Day {day.dayNumber}
                    {day.date && (
                      <span className="day-date">
                        {new Date(day.date).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))}
                {(!schedule?.shootDays || schedule.shootDays.length === 0) && (
                  <p className="no-days">No shoot days scheduled. Create days in BaseCamp first.</p>
                )}
              </div>
            ) : (
              <div className="current-day-info">
                <div className="day-badge">Day {currentDay?.dayNumber}</div>
                {currentDay?.date && (
                  <div className="day-date">
                    {new Date(currentDay.date).toLocaleDateString()}
                  </div>
                )}
                <div className="day-stats">
                  <span>{onSet.productionStatus.completedStrips.length} / {currentDay?.strips.length || 0} scenes</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="sidebar-section">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              {!onSet?.lunchStatus?.isOnLunch ? (
                <button className="action-btn lunch" onClick={startLunch}>
                  Start Lunch
                </button>
              ) : (
                <button className="action-btn lunch active" onClick={endLunch}>
                  End Lunch ({getLunchCountdown()})
                </button>
              )}
              {!activeDelay ? (
                <button className="action-btn delay" onClick={() => setShowDelayModal(true)}>
                  Log Delay
                </button>
              ) : (
                <button className="action-btn delay active" onClick={() => endDelay(activeDelay.id)}>
                  End Delay
                </button>
              )}
            </div>
          </div>

          {/* Display Settings */}
          <div className="sidebar-section">
            <h3>Display Settings</h3>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={displaySettings?.showLunchCountdown ?? true}
                onChange={(e) => updateOnSetDisplaySettings({ showLunchCountdown: e.target.checked })}
              />
              Show Lunch Countdown
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={displaySettings?.showProgressBar ?? true}
                onChange={(e) => updateOnSetDisplaySettings({ showProgressBar: e.target.checked })}
              />
              Show Elapsed Timer
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={displaySettings?.showNextShot ?? true}
                onChange={(e) => updateOnSetDisplaySettings({ showNextShot: e.target.checked })}
              />
              Show Next Up
            </label>
          </div>

          {/* Status */}
          <div className="sidebar-section status-section">
            <h3>Status</h3>
            <div className={`status-badge ${status?.aheadBehind.startsWith('+') ? 'ahead' : status?.aheadBehind.startsWith('-') ? 'behind' : ''}`}>
              {status?.aheadBehind || 'On Schedule'}
            </div>
            <div className="wrap-estimate">
              Est. Wrap: {currentDay?.estimatedWrap || 'TBD'}
            </div>
          </div>
        </div>

        {/* Main Content - Current Scene & Schedule */}
        <div className="onset-main">
          {/* Current Scene Card */}
          {currentStrip && onSet?.productionStatus && (
            <div className="current-scene-card">
              <div className="scene-header">
                <span className="scene-label">NOW SHOOTING</span>
                <span className="elapsed-time">{getElapsedTime()}</span>
              </div>
              <div
                className="scene-strip"
                style={{
                  backgroundColor: STRIP_COLOR_HEX[currentStrip.color] || '#FFFFFF',
                  color: currentStrip.color === 'Black' || currentStrip.color === 'Blue' ? '#FFFFFF' : '#1a1a1a',
                }}
              >
                <span className="strip-number">{currentStrip.sceneNumber}</span>
                <span className="strip-location">{currentStrip.intExt}. {currentStrip.location}</span>
                <span className="strip-time">{currentStrip.timeOfDay}</span>
              </div>
              <div className="scene-actions">
                <button
                  className="complete-btn"
                  onClick={() => markStripComplete(currentStrip.id)}
                >
                  Mark Complete
                </button>
              </div>
            </div>
          )}

          {/* Lunch Card */}
          {onSet?.lunchStatus?.isOnLunch && (
            <div className="lunch-card">
              <div className="lunch-header">
                <span className="lunch-label">ON LUNCH</span>
                {displaySettings?.showLunchCountdown && (
                  <span className="lunch-timer">{getLunchCountdown()}</span>
                )}
              </div>
              <button className="end-lunch-btn" onClick={endLunch}>
                End Lunch
              </button>
            </div>
          )}

          {/* Up Next */}
          <div className="upcoming-section">
            <h3>Coming Up</h3>
            <div className="upcoming-list">
              {getNextStrips(5).map((strip, index) => (
                <div
                  key={strip!.id}
                  className={`upcoming-strip ${index === 0 ? 'next' : ''}`}
                  style={{
                    backgroundColor: STRIP_COLOR_HEX[strip!.color] || '#FFFFFF',
                    color: strip!.color === 'Black' || strip!.color === 'Blue' ? '#FFFFFF' : '#1a1a1a',
                  }}
                  onClick={() => markStripInProgress(strip!.id)}
                >
                  <span className="strip-number">{strip!.sceneNumber}</span>
                  <span className="strip-location">{strip!.intExt}. {strip!.location}</span>
                  <span className="strip-pages">{strip!.pageCount} pg</span>
                </div>
              ))}
              {getNextStrips(5).length === 0 && (
                <div className="wrap-message">
                  {currentDay?.strips.length === onSet?.productionStatus?.completedStrips.length
                    ? "That's a wrap!"
                    : 'Select a scene to start'}
                </div>
              )}
            </div>
          </div>

          {/* Today's Progress */}
          <div className="progress-section">
            <h3>Today's Progress</h3>
            {currentDay && onSet?.productionStatus && (
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${(onSet.productionStatus.completedStrips.length / currentDay.strips.length) * 100}%`,
                  }}
                />
                <span className="progress-text">
                  {onSet.productionStatus.completedStrips.length} / {currentDay.strips.length} scenes
                </span>
              </div>
            )}
          </div>

          {/* Delays Log */}
          {onSet?.delays && onSet.delays.length > 0 && (
            <div className="delays-section">
              <h3>Delays Today</h3>
              <div className="delays-list">
                {onSet.delays.map(delay => (
                  <div key={delay.id} className={`delay-item ${!delay.endedAt ? 'active' : ''}`}>
                    <span className="delay-reason">{delay.reason}</span>
                    <span className="delay-category">{delay.category}</span>
                    <span className="delay-duration">
                      {delay.duration ? `${delay.duration} min` : 'Ongoing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delay Modal */}
      {showDelayModal && (
        <div className="modal-overlay" onClick={() => setShowDelayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Log Delay</h3>
            <div className="form-group">
              <label>Reason</label>
              <input
                type="text"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="What caused the delay?"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={delayCategory}
                onChange={(e) => setDelayCategory(e.target.value as typeof delayCategory)}
              >
                <option value="Weather">Weather</option>
                <option value="Technical">Technical</option>
                <option value="Talent">Talent</option>
                <option value="Medical">Medical</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={delayNotes}
                onChange={(e) => setDelayNotes(e.target.value)}
                placeholder="Additional details..."
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowDelayModal(false)}>Cancel</button>
              <button className="primary" onClick={handleAddDelay}>
                Start Delay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnSet;
