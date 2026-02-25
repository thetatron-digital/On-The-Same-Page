import React, { useState, useEffect, useMemo } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type {
  ShootDay, SceneStrip, ProductionPerson, ProductionLocation, ProductionScene,
  CallSheet, PersonRole, CallSheetScene,
} from '../types/screenplay';
import { STRIP_COLOR_HEX } from '../types/screenplay';
import { fetchWeather, geocodeAddress, generateMapsLink, findNearbyHospitals, lookupTimezone, type WeatherData, type NearestHospitalResult } from '../utils/weather';
import { generateCallSheetPDF } from '../utils/callSheetPdf';
import { DEFAULT_DISCLAIMER } from '../types/screenplay';
import './BaseCamp.css';

// ============================================
// BASECAMP - Production Management & Call Sheets
// ============================================

/** Format a phone string to (000) 000-0000 on blur. Handles 10 or 11-digit US numbers. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Strip leading '1' for US country code
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw; // Return as-is if not a standard 10-digit number
}

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
    importProductionScenesAsStrips,
    createShotPackagesFromViewFinder,
    addShootDay,
    updateShootDay,
    deleteShootDay,
    assignStripToDay,
    unassignStrip,
    selectShootDay,
    selectStrip,
    updateScheduleSettings,
    basecampView,
    setBasecampView,
    productionData,
    addPerson,
    updatePerson,
    deletePerson,
    addLocation,
    updateLocation,
    deleteLocation,
    addProductionScene,
    updateProductionScene,
    deleteProductionScene,
    addCallSheet,
    updateCallSheet,
    deleteCallSheet,
    updateProductionSettings,
  } = useScreenplayStore();

  // State: when a call sheet is generated from strip board, auto-open it for editing
  const [autoEditCallSheetId, setAutoEditCallSheetId] = useState<string | null>(null);

  // Helper: derive key crew roles from People data
  const findPersonByRole = (dept: string, position: string) => {
    return productionData.people.find(p =>
      p.roles.some(r =>
        r.group === 'Crew' &&
        r.department.toLowerCase() === dept.toLowerCase() &&
        r.position.toLowerCase() === position.toLowerCase()
      )
    );
  };
  const getPersonFullName = (p: { firstName: string; lastName: string } | undefined) =>
    p ? `${p.firstName} ${p.lastName}`.trim() : '';

  // Auto-derived key crew — these come from People data, not manual Settings entry
  const derivedProducer = findPersonByRole('Production', 'Producer')
    || findPersonByRole('Production', 'Executive Producer')
    || findPersonByRole('Production', 'Line Producer');
  const derivedDirector = findPersonByRole('Direction', 'Director');
  const derivedFirstAD = findPersonByRole('Direction', '1st Assistant Director');
  const derivedUPM = findPersonByRole('Production', 'Production Manager')
    || findPersonByRole('Production', 'Production Coordinator');

  // Initialize schedule on mount
  useEffect(() => {
    if (!schedule) {
      initializeSchedule();
    }
  }, [schedule, initializeSchedule]);

  // Generate a call sheet from a shoot day's data
  const generateCallSheetFromDay = (day: ShootDay) => {
    const { people, scenes, locations } = productionData;
    const talent = people.filter(p => p.group === 'Talent' || p.roles.some(r => r.group === 'Talent'));
    const crew = people.filter(p => p.group === 'Crew');

    // Get the strips assigned to this day and find matching production scenes
    const dayStrips = day.strips.map(sid => schedule?.strips.find(s => s.id === sid)).filter(Boolean);
    const csScenes: CallSheetScene[] = dayStrips.map(strip => {
      if (!strip) return null;
      // Try to find the production scene for cast info
      const prodScene = scenes.find(s => s.id === strip.sceneId);
      const castDisplay = (prodScene?.castIds || strip.castIds).map(cid => {
        const p = people.find(pp => pp.id === cid);
        if (!p) return '';
        return p.castNumber ? String(p.castNumber) : `${p.firstName[0]}${p.lastName[0]}`;
      }).filter(Boolean).join(', ');

      // Try to resolve location: first from production scene, then by name match
      let locId = prodScene?.locationId;
      if (!locId && strip.location) {
        const matchedLoc = locations.find(l =>
          l.name.toLowerCase() === strip.location.toLowerCase() ||
          l.name.toLowerCase().includes(strip.location.toLowerCase()) ||
          strip.location.toLowerCase().includes(l.name.toLowerCase())
        );
        if (matchedLoc) locId = matchedLoc.id;
      }

      return {
        sceneId: strip.sceneId,
        sceneNumber: strip.sceneNumber,
        setDescription: `${strip.intExt} - ${strip.location}`,
        cast: castDisplay,
        locationId: locId,
        notes: '',
      };
    }).filter(Boolean) as CallSheetScene[];

    // Collect unique location IDs from scenes
    const locationIds = [...new Set(csScenes.map(s => s.locationId).filter(Boolean))] as string[];

    // Get talent that appears in this day's scenes
    const sceneCastIds = new Set(dayStrips.flatMap(strip => {
      if (!strip) return [];
      const prodScene = scenes.find(s => s.id === strip.sceneId);
      return prodScene?.castIds || strip.castIds;
    }));
    const dayTalent = talent.filter(t => sceneCastIds.has(t.id));

    // Auto-populate nearest hospital from the first location that has one
    const nearestHospital = locationIds
      .map(lid => locations.find(l => l.id === lid))
      .find(l => l?.nearestHospital)?.nearestHospital || '';

    const defaultCallTime = productionData.settings.defaultCallTime || '7:00 AM';
    const crewCall = day.callTime || defaultCallTime;

    const csData = {
      title: productionData.settings.projectName || 'Untitled Production',
      date: day.date ? new Date(day.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dayNumber: day.dayNumber,
      totalDays: schedule?.shootDays.length || 1,
      crewCall,
      shootingCall: crewCall,
      firstMeal: day.lunchTime || '12:30 PM',
      estimatedWrap: day.estimatedWrap || '7:00 PM',
      producer: getPersonFullName(derivedProducer),
      director: getPersonFullName(derivedDirector),
      locationIds,
      scenes: csScenes,
      talentCalls: dayTalent.map(t => ({
        personId: t.id,
        callTime: crewCall,
      })),
      crewCalls: crew.map(c => ({
        personId: c.id,
        department: c.roles[0]?.department || '',
        position: c.roles[0]?.position || c.group,
        callTime: crewCall,
      })),
      notes: day.notes || '',
      nearestHospital,
      disclaimer: productionData.settings.defaultDisclaimer || DEFAULT_DISCLAIMER,
      status: 'draft' as const,
    };

    const newId = addCallSheet(csData);
    setAutoEditCallSheetId(newId);
    setBasecampView('callsheets');
  };

  const renderContent = () => {
    switch (basecampView) {
      case 'dashboard':
        return <DashboardView />;
      case 'people':
        return <PeopleView />;
      case 'scenes':
        return <ScenesView />;
      case 'locations':
        return <LocationsView />;
      case 'callsheets':
        return <CallSheetsView />;
      case 'settings':
        return <SettingsView />;
      case 'stripboard':
        return <StripBoardView />;
      default:
        return <DashboardView />;
    }
  };

  // Sidebar nav items
  const navItems: { id: typeof basecampView; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '◎' },
    { id: 'people', label: 'All People', icon: '👥' },
    { id: 'locations', label: 'Locations', icon: '◉' },
    { id: 'scenes', label: 'Scenes', icon: '☰' },
    { id: 'stripboard', label: 'Strip Board', icon: '▥' },
    { id: 'callsheets', label: 'Call Sheets', icon: '▤' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <div className={`basecamp-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Sidebar Navigation */}
      <div className="bc-sidebar">
        <div className="bc-sidebar-header">
          <h2>BaseCamp</h2>
        </div>
        <nav className="bc-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`bc-nav-item ${basecampView === item.id ? 'active' : ''}`}
              onClick={() => setBasecampView(item.id)}
            >
              <span className="bc-nav-icon">{item.icon}</span>
              <span className="bc-nav-label">{item.label}</span>
              {item.id === 'people' && productionData.people.length > 0 && (
                <span className="bc-nav-badge">{productionData.people.length}</span>
              )}
              {item.id === 'callsheets' && productionData.callSheets.length > 0 && (
                <span className="bc-nav-badge">{productionData.callSheets.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="bc-main">
        {renderContent()}
      </div>
    </div>
  );

  // ==========================================
  // DASHBOARD VIEW
  // ==========================================
  function DashboardView() {
    const { people, scenes, locations, callSheets, settings } = productionData;
    const crew = people.filter(p => p.group === 'Crew');
    const talent = people.filter(p => p.group === 'Talent');

    const checklist = [
      { label: 'Name Project', done: !!settings.projectName, weight: 5 },
      { label: 'Add People', done: people.length > 0, weight: 20 },
      { label: 'Add Cast', done: talent.length > 0, weight: 10 },
      { label: 'Add Crew', done: crew.length > 0, weight: 15 },
      { label: 'Add Locations', done: locations.length > 0, weight: 10 },
      { label: 'Add Scenes', done: scenes.length > 0, weight: 15 },
      { label: 'Add Schedule', done: (schedule?.shootDays.length || 0) > 0, weight: 10 },
      { label: 'Add First Callsheet', done: callSheets.length > 0, weight: 15 },
    ];

    const progress = checklist.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);

    return (
      <div className="bc-dashboard">
        {/* Welcome Banner */}
        <div className="bc-welcome-banner">
          <div className="bc-welcome-left">
            <h1>Welcome to BaseCamp!</h1>
            <p>Complete the steps below to get your project up to speed!</p>
            <div className="bc-progress-circle">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="white" strokeWidth="8"
                  strokeDasharray={`${(progress / 100) * 327} 327`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="65" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">{progress}%</text>
              </svg>
            </div>

            <div className="bc-checklist">
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className={`bc-checklist-item ${item.done ? 'done' : ''}`}
                  onClick={() => {
                    if (!item.done) {
                      if (item.label === 'Name Project') setBasecampView('settings');
                      else if (item.label === 'Add People' || item.label === 'Add Cast' || item.label === 'Add Crew') setBasecampView('people');
                      else if (item.label === 'Add Locations') setBasecampView('locations');
                      else if (item.label === 'Add Scenes') setBasecampView('scenes');
                      else if (item.label === 'Add Schedule') setBasecampView('stripboard');
                      else if (item.label === 'Add First Callsheet') setBasecampView('callsheets');
                    }
                  }}
                >
                  <span className="bc-check-icon">{item.done ? '✓' : '○'}</span>
                  <span className="bc-check-label">{item.label}</span>
                  {!item.done && <span className="bc-check-weight">+ {item.weight}%</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="bc-welcome-right">
            <div className="bc-summary-cards">
              <div className="bc-card bc-card-people" onClick={() => setBasecampView('people')}>
                <div className="bc-card-number">{people.length}</div>
                <div className="bc-card-label">People</div>
              </div>
              <div className="bc-card bc-card-scenes" onClick={() => setBasecampView('scenes')}>
                <div className="bc-card-number">{scenes.length}</div>
                <div className="bc-card-label">Scenes</div>
              </div>
              <div className="bc-card bc-card-crew" onClick={() => setBasecampView('people')}>
                <div className="bc-card-number">{crew.length}</div>
                <div className="bc-card-label">Crew</div>
              </div>
              <div className="bc-card bc-card-talent" onClick={() => setBasecampView('people')}>
                <div className="bc-card-number">{talent.length}</div>
                <div className="bc-card-label">Talent</div>
              </div>
              <div className="bc-card bc-card-locations" onClick={() => setBasecampView('locations')}>
                <div className="bc-card-number">{locations.length}</div>
                <div className="bc-card-label">Locations</div>
              </div>
              <div className="bc-card bc-card-callsheets" onClick={() => setBasecampView('callsheets')}>
                <div className="bc-card-number">{callSheets.length}</div>
                <div className="bc-card-label">Callsheets</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PEOPLE VIEW
  // ==========================================
  function PeopleView() {
    const [showModal, setShowModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState<ProductionPerson | null>(null);
    const [activeTab, setActiveTab] = useState<'basic' | 'details'>('basic');
    const [filterGroup, setFilterGroup] = useState<'All' | 'Crew' | 'Talent' | 'Client'>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const { people, departments } = productionData;
    const crew = people.filter(p => p.group === 'Crew');
    const talent = people.filter(p => p.group === 'Talent');
    const clients = people.filter(p => p.group === 'Client');

    const filteredPeople = people.filter(p => {
      if (filterGroup !== 'All' && p.group !== filterGroup) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.roles.some(r => r.position.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const getInitials = (p: ProductionPerson) => {
      return `${p.firstName[0] || ''}${p.lastName[0] || ''}`.toUpperCase();
    };

    const getNextCastNumber = (): number => {
      const usedNumbers = people.filter(p => p.castNumber).map(p => p.castNumber!);
      let n = 1;
      while (usedNumbers.includes(n)) n++;
      return n;
    };

    const emptyPerson = (): Omit<ProductionPerson, 'id' | 'avatarColor'> => ({
      firstName: '', lastName: '', email: '', phone: '',
      group: 'Crew', roles: [], tags: [], notes: '', location: '',
      availability: { blockedDates: [] },
    });

    // Derive the person's group from their roles
    const deriveGroup = (roles: PersonRole[]): 'Crew' | 'Talent' | 'Client' => {
      if (roles.length === 0) return 'Crew';
      // Talent takes priority, then Client, then Crew
      if (roles.some(r => r.group === 'Talent')) return 'Talent';
      if (roles.some(r => r.group === 'Client')) return 'Client';
      return 'Crew';
    };

    const [formData, setFormData] = useState(emptyPerson());
    const openCreate = () => {
      setEditingPerson(null);
      setFormData(emptyPerson());
      setActiveTab('basic');
      setShowModal(true);
    };

    const openEdit = (person: ProductionPerson) => {
      setEditingPerson(person);
      setFormData({
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        group: person.group,
        roles: [...person.roles],
        tags: [...person.tags],
        notes: person.notes,
        location: person.location,
        castNumber: person.castNumber,
        payRate: person.payRate ? { ...person.payRate } : undefined,
        availability: person.availability ? {
          ...person.availability,
          blockedDates: [...(person.availability.blockedDates || [])],
        } : { blockedDates: [] },
      });
      setActiveTab('basic');
      setShowModal(true);
    };

    const handleSave = (andAddAnother: boolean) => {
      // Auto-derive group from roles
      const derivedGroup = deriveGroup(formData.roles);
      const dataToSave = { ...formData, group: derivedGroup };
      // Auto-assign cast number for Talent if not set
      if (derivedGroup === 'Talent' && !dataToSave.castNumber) {
        dataToSave.castNumber = getNextCastNumber();
      }
      // Clear cast number if not Talent
      if (derivedGroup !== 'Talent') {
        delete dataToSave.castNumber;
      }
      if (editingPerson) {
        updatePerson(editingPerson.id, dataToSave);
      } else {
        addPerson(dataToSave);
      }
      if (andAddAnother) {
        setEditingPerson(null);
        setFormData(emptyPerson());
        setActiveTab('basic');
      } else {
        setShowModal(false);
      }
    };

    const addRoleToForm = () => {
      setFormData({
        ...formData,
        roles: [...formData.roles, { group: 'Crew', department: '', position: '' }],
      });
    };

    const updateRole = (index: number, updates: Partial<PersonRole>) => {
      const newRoles = [...formData.roles];
      newRoles[index] = { ...newRoles[index], ...updates };
      setFormData({ ...formData, roles: newRoles });
    };

    const removeRole = (index: number) => {
      setFormData({ ...formData, roles: formData.roles.filter((_, i) => i !== index) });
    };

    return (
      <div className="bc-people">
        <div className="bc-people-sidebar">
          <h3 className="bc-section-title">GROUPS</h3>
          <button
            className={`bc-group-item ${filterGroup === 'All' ? 'active' : ''}`}
            onClick={() => setFilterGroup('All')}
          >
            <span className="bc-group-icon">👥</span>
            <span>All People</span>
            <span className="bc-group-count">{people.length}</span>
          </button>
          <button
            className={`bc-group-item ${filterGroup === 'Crew' ? 'active' : ''}`}
            onClick={() => setFilterGroup('Crew')}
          >
            <span className="bc-group-icon">🔧</span>
            <span>Crew</span>
            <span className="bc-group-count">{crew.length}</span>
          </button>
          <button
            className={`bc-group-item ${filterGroup === 'Talent' ? 'active' : ''}`}
            onClick={() => setFilterGroup('Talent')}
          >
            <span className="bc-group-icon">⭐</span>
            <span>Talent</span>
            <span className="bc-group-count">{talent.length}</span>
          </button>
          <button
            className={`bc-group-item ${filterGroup === 'Client' ? 'active' : ''}`}
            onClick={() => setFilterGroup('Client')}
          >
            <span className="bc-group-icon">📋</span>
            <span>Clients</span>
            <span className="bc-group-count">{clients.length}</span>
          </button>
        </div>

        <div className="bc-people-main">
          <div className="bc-page-header">
            <h2>All People</h2>
            <div className="bc-header-actions">
              <button className="bc-btn bc-btn-primary" onClick={openCreate}>+ New Person</button>
              <div className="bc-search-box">
                <input
                  type="text"
                  placeholder="Type to search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <table className="bc-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}></th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Roles</th>
                <th>Email</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={6} className="bc-empty-row">
                    {people.length === 0
                      ? 'No people added yet. Click "+ New Person" to get started.'
                      : 'No people match your search.'}
                  </td>
                </tr>
              ) : (
                filteredPeople.map(person => (
                  <tr key={person.id} className="bc-table-row">
                    <td>
                      <div className="bc-avatar" style={{ backgroundColor: person.avatarColor }}>
                        {getInitials(person)}
                      </div>
                    </td>
                    <td className="bc-name-cell">{person.firstName}</td>
                    <td>{person.lastName}</td>
                    <td>
                      <div className="bc-roles-cell">
                        {person.roles.map((role, i) => (
                          <span key={i} className={`bc-role-badge ${role.group.toLowerCase()}`}>
                            {role.group === 'Crew' ? '🔧' : role.group === 'Talent' ? '⭐' : '📋'}
                            {role.group === 'Talent'
                              ? `${person.castNumber ? `#${person.castNumber} ` : ''}${role.characterName || 'Talent'}`
                              : (role.position || role.department || role.group)}
                          </span>
                        ))}
                        {person.roles.length === 0 && (
                          <span className="bc-role-badge empty">{person.group}</span>
                        )}
                      </div>
                    </td>
                    <td className="bc-email-cell">{person.email}</td>
                    <td>
                      <div className="bc-row-actions">
                        <button className="bc-icon-btn" onClick={() => openEdit(person)} title="Edit">✎</button>
                        <button
                          className="bc-icon-btn danger"
                          onClick={() => {
                            if (confirm(`Delete ${person.firstName} ${person.lastName}?`)) {
                              deletePerson(person.id);
                            }
                          }}
                          title="Delete"
                        >×</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filteredPeople.length > 0 && (
            <div className="bc-table-footer">
              {filteredPeople.length} of {people.length} people
            </div>
          )}
        </div>

        {/* Add/Edit Person Modal */}
        {showModal && (
          <div className="bc-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="bc-modal" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header">
                <h3>{editingPerson ? 'Edit Person' : 'Add A Person'}</h3>
                <button className="bc-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <div className="bc-modal-tabs">
                <button
                  className={`bc-modal-tab ${activeTab === 'basic' ? 'active' : ''}`}
                  onClick={() => setActiveTab('basic')}
                >
                  BASIC INFO
                </button>
                <button
                  className={`bc-modal-tab ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  MORE DETAILS
                </button>
              </div>

              <div className="bc-modal-body">
                {activeTab === 'basic' ? (
                  <>
                    <div className="bc-form-row">
                      <div className="bc-form-group">
                        <label>FIRST NAME</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                          placeholder="First name"
                          autoFocus
                        />
                      </div>
                      <div className="bc-form-group">
                        <label>LAST NAME</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    <div className="bc-form-group">
                      <label>EMAIL ADDRESS</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="bc-form-group">
                      <label>PHONE NUMBER</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        onBlur={e => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                        placeholder="(555) 000-0000"
                      />
                    </div>

                    <div className="bc-form-group">
                      <label>ROLE(S)</label>
                      {formData.roles.map((role, i) => (
                        <div key={i} className="bc-role-row">
                          <select
                            value={role.group}
                            onChange={e => {
                              const newGroup = e.target.value as PersonRole['group'];
                              // Clear department/position when switching to Talent/Client
                              if (newGroup !== 'Crew') {
                                updateRole(i, { group: newGroup, department: '', position: '' });
                              } else {
                                updateRole(i, { group: newGroup });
                              }
                            }}
                          >
                            <option value="Crew">Crew</option>
                            <option value="Talent">Talent</option>
                            <option value="Client">Client</option>
                          </select>
                          {role.group === 'Crew' && (
                            <>
                              <select
                                value={role.department}
                                onChange={e => updateRole(i, { department: e.target.value })}
                              >
                                <option value="">-- Department --</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                              <select
                                value={role.position}
                                onChange={e => updateRole(i, { position: e.target.value })}
                              >
                                <option value="">-- Position --</option>
                                {departments
                                  .find(d => d.name === role.department)
                                  ?.positions.map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                  ))}
                              </select>
                            </>
                          )}
                          {role.group === 'Talent' && (
                            <>
                            <input
                              type="text"
                              value={role.characterName || ''}
                              onChange={e => updateRole(i, { characterName: e.target.value })}
                              placeholder="Character name (e.g., Ted)"
                              className="bc-role-input"
                            />
                            <input
                              type="number"
                              value={formData.castNumber || ''}
                              onChange={e => setFormData({ ...formData, castNumber: parseInt(e.target.value) || undefined })}
                              placeholder={`Cast # (${getNextCastNumber()})`}
                              className="bc-role-input bc-cast-number-input"
                              min="1"
                            />
                            </>
                          )}
                          {role.group === 'Client' && (
                            <input
                              type="text"
                              value={role.position || ''}
                              onChange={e => updateRole(i, { position: e.target.value })}
                              placeholder="Title (e.g., Executive Producer)"
                              className="bc-role-input"
                            />
                          )}
                          <button className="bc-icon-btn danger" onClick={() => removeRole(i)}>×</button>
                        </div>
                      ))}
                      <button className="bc-link-btn" onClick={addRoleToForm}>+ Add Another Role</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bc-form-group">
                      <label>PAY RATE</label>
                      <div className="bc-form-row">
                        <input
                          type="number"
                          value={formData.payRate?.amount || ''}
                          onChange={e => setFormData({
                            ...formData,
                            payRate: {
                              amount: Number(e.target.value),
                              currency: formData.payRate?.currency || 'USD',
                              period: formData.payRate?.period || 'Per Day',
                            },
                          })}
                          placeholder="Amount"
                          style={{ flex: 1 }}
                        />
                        <select
                          value={formData.payRate?.period || 'Per Day'}
                          onChange={e => setFormData({
                            ...formData,
                            payRate: {
                              amount: formData.payRate?.amount || 0,
                              currency: 'USD',
                              period: e.target.value as 'Per Day' | 'Per Hour' | 'Per Week' | 'Flat',
                            },
                          })}
                          style={{ flex: 1 }}
                        >
                          <option value="Per Day">Per Day</option>
                          <option value="Per Hour">Per Hour</option>
                          <option value="Per Week">Per Week</option>
                          <option value="Flat">Flat</option>
                        </select>
                      </div>
                    </div>

                    <div className="bc-form-group">
                      <label>LOCATION</label>
                      <input
                        type="text"
                        value={formData.location || ''}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Type to search..."
                      />
                    </div>

                    <div className="bc-form-group">
                      <label>TAGS</label>
                      <input
                        type="text"
                        value={formData.tags.join(', ')}
                        onChange={e => setFormData({
                          ...formData,
                          tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                        })}
                        placeholder="Add tags using commas to separate them..."
                      />
                    </div>

                    <div className="bc-form-group">
                      <label>NOTES</label>
                      <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Add notes..."
                        rows={5}
                      />
                      <span className="bc-form-hint">(Notes are internal and not visible to the contact)</span>
                    </div>

                    <h4 className="bc-form-section-title">Availability</h4>
                    <div className="bc-form-row">
                      <div className="bc-form-group">
                        <label>AVAILABLE FROM</label>
                        <input
                          type="date"
                          value={formData.availability?.startDate || ''}
                          onChange={e => setFormData({
                            ...formData,
                            availability: {
                              ...formData.availability!,
                              startDate: e.target.value || undefined,
                            },
                          })}
                        />
                      </div>
                      <div className="bc-form-group">
                        <label>AVAILABLE UNTIL</label>
                        <input
                          type="date"
                          value={formData.availability?.endDate || ''}
                          onChange={e => setFormData({
                            ...formData,
                            availability: {
                              ...formData.availability!,
                              endDate: e.target.value || undefined,
                            },
                          })}
                        />
                      </div>
                    </div>
                    <div className="bc-form-group">
                      <label>BLOCKED DATES (unavailable)</label>
                      <div className="bc-blocked-dates">
                        {(formData.availability?.blockedDates || []).map((date, i) => (
                          <span key={i} className="bc-tag">
                            {date}
                            <button onClick={() => {
                              const newDates = [...(formData.availability?.blockedDates || [])];
                              newDates.splice(i, 1);
                              setFormData({
                                ...formData,
                                availability: { ...formData.availability!, blockedDates: newDates },
                              });
                            }}>×</button>
                          </span>
                        ))}
                        <input
                          type="date"
                          onChange={e => {
                            if (e.target.value) {
                              const current = formData.availability?.blockedDates || [];
                              if (!current.includes(e.target.value)) {
                                setFormData({
                                  ...formData,
                                  availability: {
                                    ...formData.availability!,
                                    blockedDates: [...current, e.target.value].sort(),
                                  },
                                });
                              }
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="bc-form-group">
                      <label>AVAILABILITY NOTES</label>
                      <input
                        type="text"
                        value={formData.availability?.notes || ''}
                        onChange={e => setFormData({
                          ...formData,
                          availability: { ...formData.availability!, notes: e.target.value },
                        })}
                        placeholder="e.g., Only available after 2pm on Tuesdays"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="bc-modal-footer">
                <button className="bc-btn bc-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="bc-btn bc-btn-outline" onClick={() => handleSave(true)}>
                  {editingPerson ? 'Save & Add Another' : 'Create & Add Another'}
                </button>
                <button className="bc-btn bc-btn-success" onClick={() => handleSave(false)}>
                  {editingPerson ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SCENES VIEW
  // ==========================================
  function ScenesView() {
    const [showModal, setShowModal] = useState(false);
    const [editingScene, setEditingScene] = useState<ProductionScene | null>(null);
    const { scenes, people, locations } = productionData;

    const emptyScene = (): Omit<ProductionScene, 'id'> => ({
      sceneNumber: '', intExt: 'INT', dayNight: 'Day', set: '',
      description: '', castIds: [], locationId: undefined, pageCount: 0,
      storyDay: '', extrasCount: 0, notes: '',
    });

    const [formData, setFormData] = useState(emptyScene());

    const openCreate = () => {
      setEditingScene(null);
      setFormData(emptyScene());
      setShowModal(true);
    };

    const openEdit = (scene: ProductionScene) => {
      setEditingScene(scene);
      setFormData({
        sceneNumber: scene.sceneNumber,
        intExt: scene.intExt,
        dayNight: scene.dayNight,
        set: scene.set,
        description: scene.description,
        castIds: [...scene.castIds],
        locationId: scene.locationId,
        pageCount: scene.pageCount,
        storyDay: scene.storyDay,
        extrasCount: scene.extrasCount,
        notes: scene.notes,
      });
      setShowModal(true);
    };

    const handleSave = (andAddAnother: boolean) => {
      if (editingScene) {
        updateProductionScene(editingScene.id, formData);
      } else {
        addProductionScene(formData);
      }
      if (andAddAnother) {
        setEditingScene(null);
        setFormData(emptyScene());
      } else {
        setShowModal(false);
      }
    };

    const toggleCast = (personId: string) => {
      const newCast = formData.castIds.includes(personId)
        ? formData.castIds.filter(id => id !== personId)
        : [...formData.castIds, personId];
      setFormData({ ...formData, castIds: newCast });
    };

    // Find talent: people whose group is Talent OR who have any Talent role
    const talent = people.filter(p =>
      p.group === 'Talent' || p.roles.some(r => r.group === 'Talent')
    );
    const getLocationName = (id?: string) => locations.find(l => l.id === id)?.name || '';

    return (
      <div className="bc-content-area">
        <div className="bc-page-header">
          <h2>Scenes</h2>
          <div className="bc-header-actions">
            <button className="bc-btn bc-btn-primary" onClick={openCreate}>+ Add Scene</button>
            {breakdownScenes.length > 0 && scenes.length === 0 && (
              <button
                className="bc-btn bc-btn-outline"
                onClick={() => {
                  breakdownScenes.forEach(bs => {
                    addProductionScene({
                      sceneNumber: bs.sceneNumber,
                      intExt: (bs.intExt as ProductionScene['intExt']) || 'INT',
                      dayNight: (bs.timeOfDay === 'DAY' ? 'Day' : bs.timeOfDay === 'NIGHT' ? 'Night' : 'Day') as ProductionScene['dayNight'],
                      set: bs.location || '',
                      description: bs.description || '',
                      castIds: [],
                      pageCount: (bs.eighths || 0) / 8,
                      storyDay: '',
                      extrasCount: 0,
                      notes: '',
                    });
                  });
                }}
              >
                Import from BreakDown
              </button>
            )}
          </div>
        </div>

        <table className="bc-table">
          <thead>
            <tr>
              <th>Scene #</th>
              <th>INT/EXT</th>
              <th>Set</th>
              <th>Description</th>
              <th>Story Day</th>
              <th>Page Count</th>
              <th>Cast</th>
              <th>Location</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scenes.length === 0 ? (
              <tr>
                <td colSpan={9} className="bc-empty-row">
                  No scenes added yet. Click "+ Add Scene" to get started.
                </td>
              </tr>
            ) : (
              scenes.map(scene => (
                <tr key={scene.id} className="bc-table-row">
                  <td className="bc-bold">{scene.sceneNumber}</td>
                  <td>{scene.intExt}</td>
                  <td>{scene.set}</td>
                  <td className="bc-desc-cell">{scene.description}</td>
                  <td>{scene.storyDay}</td>
                  <td>{scene.pageCount}</td>
                  <td className="bc-cast-cell">{scene.castIds.map(cid => {
                    const p = people.find(pp => pp.id === cid);
                    if (!p) return '';
                    return p.castNumber ? String(p.castNumber) : `${p.firstName[0]}${p.lastName[0]}`;
                  }).filter(Boolean).join(', ')}</td>
                  <td>{getLocationName(scene.locationId)}</td>
                  <td>
                    <div className="bc-row-actions">
                      <button className="bc-icon-btn" onClick={() => openEdit(scene)} title="Edit">✎</button>
                      <button
                        className="bc-icon-btn danger"
                        onClick={() => {
                          if (confirm(`Delete Scene ${scene.sceneNumber}?`)) {
                            deleteProductionScene(scene.id);
                          }
                        }}
                        title="Delete"
                      >×</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Add/Edit Scene Modal */}
        {showModal && (
          <div className="bc-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="bc-modal bc-modal-wide" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header">
                <h3>{editingScene ? 'Edit Scene' : 'Add A Scene'}</h3>
                <button className="bc-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <div className="bc-modal-body">
                <div className="bc-form-row bc-form-row-3">
                  <div className="bc-form-group">
                    <label>SCENE NUMBER</label>
                    <input
                      type="text"
                      value={formData.sceneNumber}
                      onChange={e => setFormData({ ...formData, sceneNumber: e.target.value })}
                      placeholder="1"
                      autoFocus
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>INT / EXT</label>
                    <select
                      value={formData.intExt}
                      onChange={e => setFormData({ ...formData, intExt: e.target.value as ProductionScene['intExt'] })}
                    >
                      <option value="INT">INT</option>
                      <option value="EXT">EXT</option>
                      <option value="INT/EXT">INT/EXT</option>
                    </select>
                  </div>
                  <div className="bc-form-group">
                    <label>DAY / NIGHT</label>
                    <select
                      value={formData.dayNight}
                      onChange={e => setFormData({ ...formData, dayNight: e.target.value as ProductionScene['dayNight'] })}
                    >
                      <option value="Day">Day</option>
                      <option value="Night">Night</option>
                      <option value="Dawn">Dawn</option>
                      <option value="Dusk">Dusk</option>
                    </select>
                  </div>
                </div>

                <div className="bc-form-group">
                  <label>SET</label>
                  <input
                    type="text"
                    value={formData.set}
                    onChange={e => setFormData({ ...formData, set: e.target.value })}
                    placeholder="Location/Set name"
                  />
                </div>

                <div className="bc-form-group">
                  <label>DESCRIPTION</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Scene description..."
                    rows={3}
                  />
                </div>

                <div className="bc-form-group">
                  <label>CAST MEMBERS</label>
                  <div className="bc-cast-tags">
                    {talent.map(t => {
                      const charName = t.roles.find(r => r.group === 'Talent')?.characterName;
                      return (
                        <button
                          key={t.id}
                          className={`bc-cast-tag ${formData.castIds.includes(t.id) ? 'selected' : ''}`}
                          onClick={() => toggleCast(t.id)}
                        >
                          {t.castNumber ? `#${t.castNumber} ` : ''}{t.firstName} {t.lastName}{charName ? ` (${charName})` : ''}
                        </button>
                      );
                    })}
                    {talent.length === 0 && <span className="bc-form-hint">Add talent in All People first</span>}
                  </div>
                </div>

                <div className="bc-form-group">
                  <label>SHOOTING LOCATION</label>
                  <select
                    value={formData.locationId || ''}
                    onChange={e => setFormData({ ...formData, locationId: e.target.value || undefined })}
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.city ? `- ${loc.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bc-form-row bc-form-row-3">
                  <div className="bc-form-group">
                    <label>PAGE COUNT</label>
                    <input
                      type="number"
                      value={formData.pageCount || ''}
                      onChange={e => setFormData({ ...formData, pageCount: Number(e.target.value) })}
                      placeholder="0"
                      step="0.125"
                      min="0"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>STORY DAY</label>
                    <input
                      type="text"
                      value={formData.storyDay}
                      onChange={e => setFormData({ ...formData, storyDay: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>EXTRAS COUNT</label>
                    <input
                      type="number"
                      value={formData.extrasCount || ''}
                      onChange={e => setFormData({ ...formData, extrasCount: Number(e.target.value) })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <div className="bc-form-group">
                  <label>NOTES</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Scene notes..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="bc-modal-footer">
                <button className="bc-btn bc-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="bc-btn bc-btn-outline" onClick={() => handleSave(true)}>
                  {editingScene ? 'Save & Add Another' : 'Create & Add Another'}
                </button>
                <button className="bc-btn bc-btn-success" onClick={() => handleSave(false)}>
                  {editingScene ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LOCATIONS VIEW
  // ==========================================
  function LocationsView() {
    const [showModal, setShowModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<ProductionLocation | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const [nearbyHospitals, setNearbyHospitals] = useState<NearestHospitalResult[]>([]);
    const { locations } = productionData;

    const emptyLocation = (): Omit<ProductionLocation, 'id'> => ({
      name: '', streetAddress: '', city: '', state: '', postalCode: '', phone: '', nearestHospital: '',
    });

    const formatHospitalStr = (h: NearestHospitalResult) => [
      h.name,
      h.address,
      h.phone ? `Ph: ${h.phone}` : '',
    ].filter(Boolean).join('\n');

    const handleGeocode = async () => {
      // Build geocoding query from address fields only (not the custom location name)
      const query = [formData.streetAddress, formData.city, formData.state, formData.postalCode]
        .filter(Boolean).join(', ');
      if (!query) return;
      setGeocoding(true);
      const result = await geocodeAddress(query);
      if (result) {
        const updates: Partial<typeof formData> = {
          latitude: result.latitude,
          longitude: result.longitude,
        };
        // Fetch nearby hospitals for dropdown
        const hospitals = await findNearbyHospitals(result.latitude, result.longitude);
        setNearbyHospitals(hospitals);
        if (!formData.nearestHospital && hospitals.length > 0) {
          updates.nearestHospital = formatHospitalStr(hospitals[0]);
        }
        if (!formData.timezone) {
          const tz = await lookupTimezone(result.latitude, result.longitude);
          if (tz) updates.timezone = tz;
        }
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setGeocoding(false);
    };

    const [formData, setFormData] = useState(emptyLocation());

    const openCreate = () => {
      setEditingLocation(null);
      setFormData(emptyLocation());
      setShowModal(true);
    };

    const openEdit = (loc: ProductionLocation) => {
      setEditingLocation(loc);
      setFormData({
        name: loc.name,
        streetAddress: loc.streetAddress,
        city: loc.city,
        state: loc.state,
        postalCode: loc.postalCode,
        phone: loc.phone,
        latitude: loc.latitude,
        longitude: loc.longitude,
        mapLink: loc.mapLink,
        nearestHospital: loc.nearestHospital || '',
      });
      setShowModal(true);
    };

    const handleSave = async (andAddAnother: boolean) => {
      let dataToSave = { ...formData };
      // Auto-geocode on save if address exists but no coordinates yet
      if (!dataToSave.latitude && !dataToSave.longitude) {
        const addrQuery = [dataToSave.streetAddress, dataToSave.city, dataToSave.state, dataToSave.postalCode]
          .filter(Boolean).join(', ');
        if (addrQuery) {
          const result = await geocodeAddress(addrQuery);
          if (result) {
            dataToSave = { ...dataToSave, latitude: result.latitude, longitude: result.longitude };
          }
        }
      }
      // Auto-find nearest hospital and timezone if we have coords
      const saveLat = dataToSave.latitude;
      const saveLng = dataToSave.longitude;
      if (saveLat && saveLng) {
        if (!dataToSave.nearestHospital) {
          const hospitals = await findNearbyHospitals(saveLat, saveLng);
          setNearbyHospitals(hospitals);
          if (hospitals.length > 0) {
            dataToSave = { ...dataToSave, nearestHospital: formatHospitalStr(hospitals[0]) };
          }
        }
        if (!dataToSave.timezone) {
          const tz = await lookupTimezone(saveLat, saveLng);
          if (tz) dataToSave = { ...dataToSave, timezone: tz };
        }
      }
      if (editingLocation) {
        updateLocation(editingLocation.id, dataToSave);
      } else {
        addLocation(dataToSave);
      }
      if (andAddAnother) {
        setEditingLocation(null);
        setFormData(emptyLocation());
      } else {
        setShowModal(false);
      }
    };

    return (
      <div className="bc-content-area">
        <div className="bc-page-header">
          <h2>Locations</h2>
          <div className="bc-header-actions">
            <button className="bc-btn bc-btn-primary" onClick={openCreate}>+ Add Location</button>
          </div>
        </div>

        <table className="bc-table">
          <thead>
            <tr>
              <th>Location Name</th>
              <th>Address</th>
              <th>City</th>
              <th>State</th>
              <th>Phone</th>
              <th>Map</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={7} className="bc-empty-row">
                  No locations added yet. Click "+ Add Location" to get started.
                </td>
              </tr>
            ) : (
              locations.map(loc => {
                const mapsUrl = generateMapsLink(loc);
                return (
                <tr key={loc.id} className="bc-table-row">
                  <td className="bc-bold">{loc.name}</td>
                  <td>{loc.streetAddress}</td>
                  <td>{loc.city}</td>
                  <td>{loc.state}</td>
                  <td>{loc.phone}</td>
                  <td>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="bc-map-link" title="Open in Google Maps">
                        📍
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="bc-row-actions">
                      <button className="bc-icon-btn" onClick={() => openEdit(loc)} title="Edit">✎</button>
                      <button
                        className="bc-icon-btn danger"
                        onClick={() => {
                          if (confirm(`Delete ${loc.name}?`)) {
                            deleteLocation(loc.id);
                          }
                        }}
                        title="Delete"
                      >×</button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Add/Edit Location Modal */}
        {showModal && (
          <div className="bc-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="bc-modal" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header">
                <h3>{editingLocation ? 'Edit Location' : 'Add A Location'}</h3>
                <button className="bc-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <div className="bc-modal-body">
                <div className="bc-form-group">
                  <label>LOCATION NAME *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Location name"
                    autoFocus
                  />
                </div>

                <h4 className="bc-form-section-title">Location Address</h4>

                <div className="bc-form-group">
                  <label>STREET ADDRESS</label>
                  <input
                    type="text"
                    value={formData.streetAddress}
                    onChange={e => setFormData({ ...formData, streetAddress: e.target.value })}
                    placeholder="Street address"
                  />
                </div>

                <div className="bc-form-row">
                  <div className="bc-form-group">
                    <label>CITY</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>STATE / PROVINCE / REGION</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="bc-form-row">
                  <div className="bc-form-group">
                    <label>POSTAL CODE</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="Postal code"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>PHONE</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      onBlur={e => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                      placeholder="(201) 555-0123"
                    />
                  </div>
                </div>

                <h4 className="bc-form-section-title">Coordinates & Map</h4>

                <div className="bc-form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="bc-form-group">
                    <label>LATITUDE</label>
                    <input
                      type="number"
                      value={formData.latitude || ''}
                      onChange={e => setFormData({ ...formData, latitude: Number(e.target.value) || undefined })}
                      placeholder="Latitude"
                      step="any"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>LONGITUDE</label>
                    <input
                      type="number"
                      value={formData.longitude || ''}
                      onChange={e => setFormData({ ...formData, longitude: Number(e.target.value) || undefined })}
                      placeholder="Longitude"
                      step="any"
                    />
                  </div>
                  <button
                    className="bc-btn bc-btn-outline"
                    onClick={handleGeocode}
                    disabled={geocoding}
                    style={{ marginBottom: 0, whiteSpace: 'nowrap' }}
                  >
                    {geocoding ? 'Looking up...' : 'Auto-fill from address'}
                  </button>
                </div>
                {formData.latitude && formData.longitude && (
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={generateMapsLink(formData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bc-link-btn"
                    >
                      View on Google Maps ↗
                    </a>
                  </div>
                )}

                <div className="bc-form-group" style={{ marginTop: 12 }}>
                  <label>MAP LINK OVERRIDE</label>
                  <input
                    type="text"
                    value={formData.mapLink || ''}
                    onChange={e => setFormData({ ...formData, mapLink: e.target.value })}
                    placeholder="Custom map link (overrides auto-generated Google Maps link)"
                  />
                </div>

                <h4 className="bc-form-section-title">Safety</h4>
                <div className="bc-form-group">
                  <label>NEAREST HOSPITAL / ER</label>
                  {nearbyHospitals.length > 0 ? (
                    <>
                      <select
                        value={formData.nearestHospital || ''}
                        onChange={e => setFormData({ ...formData, nearestHospital: e.target.value })}
                      >
                        <option value="">-- Select Hospital --</option>
                        {nearbyHospitals.map((h, i) => (
                          <option key={i} value={formatHospitalStr(h)}>
                            {h.name}{h.distance ? ` (${h.distance})` : ''}
                          </option>
                        ))}
                      </select>
                      {formData.nearestHospital && (
                        <div className="bc-hospital-preview">{formData.nearestHospital}</div>
                      )}
                    </>
                  ) : (
                    <input
                      type="text"
                      value={formData.nearestHospital || ''}
                      onChange={e => setFormData({ ...formData, nearestHospital: e.target.value })}
                      placeholder="Auto-populates when address is geocoded, or enter manually"
                    />
                  )}
                </div>
              </div>

              <div className="bc-modal-footer">
                <button className="bc-btn bc-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="bc-btn bc-btn-outline" onClick={() => handleSave(true)}>
                  {editingLocation ? 'Save & Add Another' : 'Create & Add Another'}
                </button>
                <button className="bc-btn bc-btn-success" onClick={() => handleSave(false)}>
                  {editingLocation ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CALL SHEETS VIEW
  // ==========================================
  function CallSheetsView() {
    const [showEditor, setShowEditor] = useState(false);
    const [editingCS, setEditingCS] = useState<CallSheet | null>(null);
    const { callSheets, people, scenes, locations, settings } = productionData;
    const talent = people.filter(p => p.group === 'Talent' || p.roles.some(r => r.group === 'Talent'));
    const crew = people.filter(p => p.group === 'Crew');

    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    // Auto-open editor when a call sheet was generated from strip board
    useEffect(() => {
      if (autoEditCallSheetId) {
        const cs = callSheets.find(c => c.id === autoEditCallSheetId);
        if (cs) {
          openEdit(cs);
        }
        setAutoEditCallSheetId(null);
      }
    }, [autoEditCallSheetId, callSheets]);

    const emptyCallSheet = (): Omit<CallSheet, 'id' | 'createdAt' | 'updatedAt'> => {
      const defaultHospital = locations.find(l => l.nearestHospital)?.nearestHospital || '';
      const defaultCallTime = settings.defaultCallTime || '7:00 AM';
      return {
        title: settings.projectName || 'Untitled Production',
        date: new Date().toISOString().split('T')[0],
        dayNumber: callSheets.length + 1,
        totalDays: callSheets.length + 1,
        crewCall: defaultCallTime,
        shootingCall: defaultCallTime,
        firstMeal: '12:30 PM',
        estimatedWrap: '7:00 PM',
        producer: getPersonFullName(derivedProducer),
        director: getPersonFullName(derivedDirector),
        locationIds: [],
        scenes: [],
        talentCalls: talent.map(t => ({ personId: t.id, callTime: defaultCallTime })),
        crewCalls: crew.map(c => ({
          personId: c.id,
          department: c.roles[0]?.department || '',
          position: c.roles[0]?.position || c.group,
          callTime: defaultCallTime,
        })),
        notes: '',
        nearestHospital: defaultHospital,
        disclaimer: settings.defaultDisclaimer || DEFAULT_DISCLAIMER,
        status: 'draft',
      };
    };

    const [formData, setFormData] = useState(emptyCallSheet());

    // Fetch weather when editor is open and we have a date + location with coords
    const fetchWeatherForCallSheet = async (date: string, locIds: string[]) => {
      if (!date) { setWeatherData(null); return; }
      // Find first location with coordinates
      const locWithCoords = locIds
        .map(lid => locations.find(l => l.id === lid))
        .find(l => l?.latitude && l?.longitude);
      if (!locWithCoords?.latitude || !locWithCoords?.longitude) {
        setWeatherData(null);
        return;
      }
      setWeatherLoading(true);
      const weather = await fetchWeather(locWithCoords.latitude, locWithCoords.longitude, date);
      setWeatherData(weather);
      setWeatherLoading(false);
    };

    const openCreate = () => {
      setEditingCS(null);
      setFormData(emptyCallSheet());
      setWeatherData(null);
      setShowEditor(true);
    };

    const openEdit = (cs: CallSheet) => {
      setEditingCS(cs);
      setFormData({
        title: cs.title,
        date: cs.date,
        dayNumber: cs.dayNumber,
        totalDays: cs.totalDays,
        crewCall: cs.crewCall,
        shootingCall: cs.shootingCall,
        firstMeal: cs.firstMeal,
        estimatedWrap: cs.estimatedWrap,
        producer: cs.producer,
        director: cs.director,
        locationIds: [...cs.locationIds],
        scenes: [...cs.scenes],
        talentCalls: [...cs.talentCalls],
        crewCalls: [...cs.crewCalls],
        notes: cs.notes,
        nearestHospital: cs.nearestHospital,
        disclaimer: cs.disclaimer || DEFAULT_DISCLAIMER,
        status: cs.status,
      });
      setShowEditor(true);
    };

    // Auto-fetch weather when date or locations change in the editor
    useEffect(() => {
      if (showEditor && formData.date && formData.locationIds.length > 0) {
        fetchWeatherForCallSheet(formData.date, formData.locationIds);
      }
    }, [showEditor, formData.date, formData.locationIds.length]);

    const handleSave = () => {
      if (editingCS) {
        updateCallSheet(editingCS.id, formData);
      } else {
        addCallSheet(formData);
      }
      setShowEditor(false);
    };

    const addSceneToCS = (sceneId: string) => {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;
      // Resolve locationId and auto-add to call sheet locationIds if new
      let locId = scene.locationId;
      if (!locId && scene.set) {
        const matchedLoc = locations.find(l =>
          l.name.toLowerCase() === scene.set.toLowerCase() ||
          l.name.toLowerCase().includes(scene.set.toLowerCase()) ||
          scene.set.toLowerCase().includes(l.name.toLowerCase())
        );
        if (matchedLoc) locId = matchedLoc.id;
      }
      const csScene: CallSheetScene = {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        setDescription: `${scene.intExt} - ${scene.set}`,
        cast: scene.castIds.map(cid => {
          const p = people.find(pp => pp.id === cid);
          if (!p) return '';
          return p.castNumber ? String(p.castNumber) : `${p.firstName[0]}${p.lastName[0]}`;
        }).filter(Boolean).join(', '),
        locationId: locId,
        notes: '',
      };
      // Auto-add the location to the call sheet header if not already there
      const newLocationIds = locId && !formData.locationIds.includes(locId)
        ? [...formData.locationIds, locId]
        : formData.locationIds;
      // Auto-add talent from this scene to talent calls (skip duplicates)
      const existingTalentIds = new Set(formData.talentCalls.map(tc => tc.personId));
      const newTalentCalls = [...formData.talentCalls];
      scene.castIds.forEach(cid => {
        const person = people.find(pp => pp.id === cid);
        if (person && !existingTalentIds.has(cid) &&
            (person.group === 'Talent' || person.roles.some(r => r.group === 'Talent'))) {
          newTalentCalls.push({ personId: cid, callTime: formData.crewCall || '7:00 AM' });
        }
      });
      // Also update nearest hospital from the new location
      let newHospital = formData.nearestHospital;
      if (!newHospital && locId) {
        const loc = locations.find(l => l.id === locId);
        if (loc?.nearestHospital) newHospital = loc.nearestHospital;
      }
      setFormData({
        ...formData,
        scenes: [...formData.scenes, csScene],
        locationIds: newLocationIds,
        talentCalls: newTalentCalls,
        nearestHospital: newHospital,
      });
    };

    const removeSceneFromCS = (index: number) => {
      setFormData({ ...formData, scenes: formData.scenes.filter((_, i) => i !== index) });
    };

    const getPersonName = (id: string) => {
      const p = people.find(pp => pp.id === id);
      return p ? `${p.firstName} ${p.lastName}` : '';
    };

    const getLocationById = (id?: string) => locations.find(l => l.id === id);

    // Group crew by department for the preview
    const crewByDept = useMemo(() => {
      const map: Record<string, typeof formData.crewCalls> = {};
      formData.crewCalls.forEach(cc => {
        const dept = cc.department || 'Unassigned';
        if (!map[dept]) map[dept] = [];
        map[dept].push(cc);
      });
      return map;
    }, [formData.crewCalls]);

    if (showEditor) {
      return (
        <div className="bc-callsheet-editor">
          <div className="bc-cs-toolbar">
            <button className="bc-btn bc-btn-secondary" onClick={() => setShowEditor(false)}>Back to List</button>
            <h3>{editingCS ? 'Editing Call Sheet' : 'New Call Sheet'}</h3>
            <div className="bc-cs-toolbar-actions">
              <button
                className="bc-btn bc-btn-outline"
                onClick={() => {
                  const pdf = generateCallSheetPDF({
                    callSheet: { ...formData, id: editingCS?.id || 'preview', createdAt: new Date(), updatedAt: new Date() } as CallSheet,
                    people,
                    locations,
                    weather: weatherData,
                    disclaimer: formData.disclaimer || '',
                  });
                  const fileName = `Call_Sheet_Day${formData.dayNumber}_${formData.date || 'draft'}.pdf`;
                  pdf.save(fileName);
                }}
              >
                Export PDF
              </button>
              <button className="bc-btn bc-btn-success" onClick={handleSave}>Save</button>
            </div>
          </div>

          <div className="bc-cs-layout">
            {/* Left: Form */}
            <div className="bc-cs-form">
              <h4>Header Info</h4>
              <div className="bc-form-row">
                <div className="bc-form-group">
                  <label>PRODUCTION TITLE</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="bc-form-group">
                  <label>DATE</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>
              <div className="bc-form-row bc-form-row-3">
                <div className="bc-form-group">
                  <label>DAY #</label>
                  <input type="number" value={formData.dayNumber} onChange={e => setFormData({ ...formData, dayNumber: Number(e.target.value) })} />
                </div>
                <div className="bc-form-group">
                  <label>OF TOTAL DAYS</label>
                  <input type="number" value={formData.totalDays} onChange={e => setFormData({ ...formData, totalDays: Number(e.target.value) })} />
                </div>
                <div className="bc-form-group">
                  <label>CREW CALL</label>
                  <input type="text" value={formData.crewCall} onChange={e => setFormData({ ...formData, crewCall: e.target.value })} />
                </div>
              </div>
              <div className="bc-form-row bc-form-row-3">
                <div className="bc-form-group">
                  <label>SHOOTING CALL</label>
                  <input type="text" value={formData.shootingCall} onChange={e => setFormData({ ...formData, shootingCall: e.target.value })} />
                </div>
                <div className="bc-form-group">
                  <label>FIRST MEAL</label>
                  <input type="text" value={formData.firstMeal} onChange={e => setFormData({ ...formData, firstMeal: e.target.value })} />
                </div>
                <div className="bc-form-group">
                  <label>EST. WRAP</label>
                  <input type="text" value={formData.estimatedWrap} onChange={e => setFormData({ ...formData, estimatedWrap: e.target.value })} />
                </div>
              </div>
              <div className="bc-form-row">
                <div className="bc-form-group">
                  <label>PRODUCER {derivedProducer && <span className="bc-auto-tag">from People</span>}</label>
                  <input type="text" value={formData.producer} onChange={e => setFormData({ ...formData, producer: e.target.value })} placeholder={getPersonFullName(derivedProducer) || 'Add a Producer in People'} />
                </div>
                <div className="bc-form-group">
                  <label>DIRECTOR {derivedDirector && <span className="bc-auto-tag">from People</span>}</label>
                  <input type="text" value={formData.director} onChange={e => setFormData({ ...formData, director: e.target.value })} placeholder={getPersonFullName(derivedDirector) || 'Add a Director in People'} />
                </div>
              </div>

              <h4>Locations {formData.locationIds.length > 0 && <span className="bc-auto-tag">from Scenes</span>}</h4>
              <div className="bc-form-group">
                <select onChange={e => {
                  if (e.target.value && !formData.locationIds.includes(e.target.value)) {
                    setFormData({ ...formData, locationIds: [...formData.locationIds, e.target.value] });
                  }
                  e.target.value = '';
                }}>
                  <option value="">+ Add Location</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <div className="bc-tag-list">
                  {formData.locationIds.map(lid => {
                    const loc = getLocationById(lid);
                    return (
                      <span key={lid} className="bc-tag">
                        {loc?.name || lid}
                        <button onClick={() => setFormData({ ...formData, locationIds: formData.locationIds.filter(id => id !== lid) })}>×</button>
                      </span>
                    );
                  })}
                </div>
              </div>

              <h4>Today's Schedule</h4>
              <div className="bc-form-group">
                <select onChange={e => {
                  if (e.target.value) addSceneToCS(e.target.value);
                  e.target.value = '';
                }}>
                  <option value="">+ Add Scene</option>
                  {scenes.map(s => (
                    <option key={s.id} value={s.id}>Sc. {s.sceneNumber} - {s.intExt} {s.set}</option>
                  ))}
                </select>
                {formData.scenes.length > 0 && (
                  <table className="bc-mini-table">
                    <thead>
                      <tr>
                        <th>Scene</th>
                        <th>Set / Description</th>
                        <th>Cast</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.scenes.map((s, i) => (
                        <tr key={i}>
                          <td>{s.sceneNumber}</td>
                          <td>{s.setDescription}</td>
                          <td>{s.cast}</td>
                          <td><button className="bc-icon-btn danger small" onClick={() => removeSceneFromCS(i)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <h4>Talent Calls</h4>
              {formData.talentCalls.map((tc, i) => (
                <div key={i} className="bc-form-row">
                  <span className="bc-form-static">{getPersonName(tc.personId)}</span>
                  <div className="bc-form-group" style={{ maxWidth: 120 }}>
                    <input
                      type="text"
                      value={tc.callTime}
                      onChange={e => {
                        const newCalls = [...formData.talentCalls];
                        newCalls[i] = { ...newCalls[i], callTime: e.target.value };
                        setFormData({ ...formData, talentCalls: newCalls });
                      }}
                      placeholder="Call time"
                    />
                  </div>
                </div>
              ))}

              <h4>Notes</h4>
              <div className="bc-form-group">
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="bc-form-group">
                <label>NEAREST HOSPITAL {formData.nearestHospital && formData.locationIds.length > 0 && <span className="bc-auto-tag">from Location</span>}</label>
                <input
                  type="text"
                  value={formData.nearestHospital}
                  onChange={e => setFormData({ ...formData, nearestHospital: e.target.value })}
                  placeholder="Auto-fills from Location data"
                />
              </div>

              <h4>Set Rules / Disclaimer</h4>
              <div className="bc-form-group">
                <textarea
                  value={formData.disclaimer || ''}
                  onChange={e => setFormData({ ...formData, disclaimer: e.target.value })}
                  placeholder="Disclaimer text that appears on the call sheet..."
                  rows={3}
                />
                <div className="bc-disclaimer-presets">
                  <span className="bc-form-hint">Quick add:</span>
                  {['NO VISITORS WITHOUT PRIOR APPROVAL', 'NO PHOTOS ON SET', 'CELLPHONES ON SILENT', 'CLOSED SET', 'NO DRONES', 'NO SOCIAL MEDIA POSTS FROM SET'].map(rule => (
                    <button
                      key={rule}
                      className="bc-disclaimer-chip"
                      onClick={() => {
                        const current = formData.disclaimer || '';
                        if (!current.includes(rule)) {
                          setFormData({
                            ...formData,
                            disclaimer: current ? `${current} | ${rule}` : rule,
                          });
                        }
                      }}
                    >
                      + {rule}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="bc-cs-preview">
              <div className="bc-cs-page">
                {/* === ROW 1: Title | Crew Call | Date === */}
                <div className="cs-row1">
                  <div className="cs-title-col">
                    <h2 className="cs-production-title">{formData.title || 'Untitled'}</h2>
                    {productionData.settings.projectName && formData.title !== productionData.settings.projectName && (
                      <div className="cs-company-name">{productionData.settings.projectName}</div>
                    )}
                  </div>
                  <div className="cs-crewcall-col">
                    <div className="cs-crewcall-label">Crew Call</div>
                    <div className="cs-crewcall-time">{formData.crewCall}</div>
                  </div>
                  <div className="cs-date-col">
                    <div className="cs-date-full">
                      {formData.date ? new Date(formData.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      }) : 'Date TBD'}
                    </div>
                    <div className="cs-day-of">Day {formData.dayNumber} of {formData.totalDays}</div>
                  </div>
                </div>

                {/* === ROW 2: Producer | Hospital | Locations | Times + Weather === */}
                <div className="cs-row2">
                  <div className="cs-producer-col">
                    <div><strong>Producer</strong></div>
                    <div>{formData.producer || '—'}</div>
                    {formData.director && (
                      <>
                        <div style={{ marginTop: 4 }}><strong>Director</strong></div>
                        <div>{formData.director}</div>
                      </>
                    )}
                  </div>

                  <div className="cs-hospital-col">
                    <div className="cs-hospital-header">Nearest Hospital</div>
                    <div className="cs-hospital-body">
                      {formData.nearestHospital ? (
                        <div>{formData.nearestHospital}</div>
                      ) : (
                        <div className="cs-placeholder">Not set</div>
                      )}
                    </div>
                  </div>

                  <div className="cs-locations-col">
                    {formData.locationIds.map(lid => {
                      const loc = getLocationById(lid);
                      if (!loc) return null;
                      const mapsUrl = generateMapsLink(loc);
                      return (
                        <div key={lid} className="cs-loc-card">
                          <strong>{loc.name}</strong>
                          {mapsUrl ? (
                            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="cs-loc-address">
                              {[loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean).join('\n')}
                            </a>
                          ) : (
                            <div className="cs-loc-address-plain">
                              {[loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean).join('\n')}
                            </div>
                          )}
                          {loc.phone && <div>Ph: {loc.phone}</div>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="cs-times-weather-col">
                    <div className="cs-times-list">
                      <div><span className="cs-time-label">Crew Call:</span> {formData.crewCall}</div>
                      <div><span className="cs-time-label">Shooting Call:</span> {formData.shootingCall}</div>
                      <div><span className="cs-time-label">First Meal:</span> {formData.firstMeal}</div>
                      <div><strong><span className="cs-time-label">Est. Wrap:</span> {formData.estimatedWrap}</strong></div>
                    </div>
                    {weatherData && (
                      <div className="cs-weather-box">
                        <div className="cs-weather-temps">
                          <span className="cs-temp-low">{weatherData.tempLow}°F</span>
                          <span className="cs-temp-divider">/</span>
                          <span className="cs-temp-high">{weatherData.tempHigh}°F</span>
                        </div>
                        <div className="cs-temp-labels">
                          <span>low</span>
                          <span>high</span>
                        </div>
                        <div className="cs-weather-desc">
                          {weatherData.description}. Wind {weatherData.windSpeed}mph.
                          {weatherData.precipChance > 0 && ` ${weatherData.precipChance}% precip.`}
                        </div>
                        <div className="cs-sun-times">
                          <span>Sunrise: {weatherData.sunrise}</span>
                          <span>Sunset: {weatherData.sunset}</span>
                        </div>
                      </div>
                    )}
                    {weatherLoading && <div className="cs-weather-box cs-loading">Loading weather...</div>}
                  </div>
                </div>

                {/* === DISCLAIMER BANNER === */}
                {formData.disclaimer && (
                  <div className="cs-disclaimer">
                    {formData.disclaimer}
                  </div>
                )}

                {/* === TODAY'S SCHEDULE === */}
                {formData.scenes.length > 0 && (
                  <div className="cs-section">
                    <div className="cs-section-header">
                      Today's Schedule
                    </div>
                    <table className="cs-table">
                      <thead>
                        <tr>
                          <th className="cs-th-scene">SCENE</th>
                          <th>SET / DESCRIPTION</th>
                          <th>CAST</th>
                          <th>LOCATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.scenes.map((s, i) => {
                          const loc = getLocationById(s.locationId);
                          const mapsUrl = loc ? generateMapsLink(loc) : '';
                          return (
                            <tr key={i}>
                              <td className="cs-scene-num">{s.sceneNumber}</td>
                              <td>
                                <strong>{s.setDescription}</strong>
                                {s.notes && <div className="cs-scene-note">{s.notes}</div>}
                              </td>
                              <td>{s.cast}</td>
                              <td>
                                {loc ? (
                                  <div>
                                    <strong>{loc.name}</strong>
                                    {mapsUrl ? (
                                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="cs-loc-address">
                                        {[loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean).join('\n')}
                                      </a>
                                    ) : (
                                      loc.streetAddress && <div>{loc.streetAddress}</div>
                                    )}
                                  </div>
                                ) : (
                                  s.setDescription.includes(' - ') && <span>{s.setDescription.split(' - ').slice(1).join(' - ')}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* === TALENT === */}
                {formData.talentCalls.length > 0 && (
                  <div className="cs-section">
                    <div className="cs-section-header">
                      Talent
                    </div>
                    <table className="cs-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>ID</th>
                          <th>TALENT</th>
                          <th>ROLE</th>
                          <th>CALL</th>
                          <th>CONTACT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.talentCalls.map((tc, i) => {
                          const p = people.find(pp => pp.id === tc.personId);
                          const talentRole = p?.roles.find(r => r.group === 'Talent');
                          return (
                            <tr key={i}>
                              <td className="cs-talent-id">{p ? (p.castNumber ? String(p.castNumber) : `${p.firstName[0]}${p.lastName[0]}`) : ''}</td>
                              <td>{getPersonName(tc.personId)}</td>
                              <td>{talentRole?.characterName || talentRole?.position || 'Talent'}</td>
                              <td>{tc.callTime}</td>
                              <td className="cs-contact-cell">
                                {p?.phone && <div>{p.phone}</div>}
                                {p?.email && <div className="cs-email">{p.email}</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* === CREW BY DEPARTMENT (multi-column grid) === */}
                {Object.keys(crewByDept).length > 0 && (
                  <div className="cs-crew-grid">
                    {Object.entries(crewByDept).map(([dept, calls]) => (
                      <div key={dept} className="cs-dept-box">
                        <div className="cs-dept-header">
                          <span>{dept.toUpperCase()}</span>
                          <span className="cs-dept-call-label">CALL</span>
                        </div>
                        <div className="cs-dept-body">
                          {calls.map((cc, i) => {
                            const p = people.find(pp => pp.id === cc.personId);
                            return (
                              <div key={i} className="cs-crew-row">
                                <div className="cs-crew-position"><strong>{cc.position}</strong></div>
                                <div className="cs-crew-name">{getPersonName(cc.personId)}</div>
                                <div className="cs-crew-phone">{p?.phone || ''}</div>
                                <div className="cs-crew-call">{cc.callTime}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* === NOTES === */}
                {formData.notes && (
                  <div className="cs-notes">
                    <strong>Additional Notes:</strong>
                    <p>{formData.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // List view
    return (
      <div className="bc-content-area">
        <div className="bc-page-header">
          <h2>Call Sheets</h2>
          <div className="bc-header-actions">
            <button className="bc-btn bc-btn-primary" onClick={openCreate}>+ New Call Sheet</button>
          </div>
        </div>

        {callSheets.length === 0 ? (
          <div className="bc-empty-state">
            <p>No call sheets yet. Create your first one!</p>
            <button className="bc-btn bc-btn-primary" onClick={openCreate}>+ Create Call Sheet</button>
          </div>
        ) : (
          <table className="bc-table">
            <thead>
              <tr>
                <th>Day #</th>
                <th>Date</th>
                <th>Title</th>
                <th>Scenes</th>
                <th>Status</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {callSheets.map(cs => (
                <tr key={cs.id} className="bc-table-row">
                  <td className="bc-bold">Day {cs.dayNumber}</td>
                  <td>{cs.date}</td>
                  <td>{cs.title}</td>
                  <td>{cs.scenes.length} scenes</td>
                  <td>
                    <span className={`bc-status-badge ${cs.status}`}>{cs.status}</span>
                  </td>
                  <td>
                    <div className="bc-row-actions">
                      <button className="bc-icon-btn" onClick={() => openEdit(cs)} title="Edit">✎</button>
                      <button
                        className="bc-icon-btn danger"
                        onClick={() => {
                          if (confirm(`Delete Day ${cs.dayNumber} call sheet?`)) {
                            deleteCallSheet(cs.id);
                          }
                        }}
                        title="Delete"
                      >×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // ==========================================
  // SETTINGS VIEW
  // ==========================================
  function SettingsView() {
    const { settings } = productionData;

    // Show auto-detected key crew from People data
    const keyRoles = [
      { label: 'Producer', person: derivedProducer },
      { label: 'Director', person: derivedDirector },
      { label: '1st AD', person: derivedFirstAD },
      { label: 'UPM / PC', person: derivedUPM },
    ];

    return (
      <div className="bc-content-area">
        <div className="bc-page-header">
          <h2>Settings</h2>
        </div>

        <div className="bc-settings-form">
          <div className="bc-form-group">
            <label>PROJECT NAME</label>
            <input
              type="text"
              value={settings.projectName}
              onChange={e => updateProductionSettings({ projectName: e.target.value })}
              placeholder="Enter project name"
            />
          </div>

          <h4 className="bc-form-section-title">Key Crew (auto-detected from People)</h4>
          <div className="bc-derived-crew-list">
            {keyRoles.map(({ label, person }) => (
              <div key={label} className="bc-derived-crew-row">
                <span className="bc-derived-label">{label}</span>
                {person ? (
                  <span className="bc-derived-value">{person.firstName} {person.lastName}{person.phone ? ` - ${person.phone}` : ''}</span>
                ) : (
                  <span className="bc-derived-empty">Not assigned — add a person with this role in All People</span>
                )}
              </div>
            ))}
          </div>
          <span className="bc-form-hint">These roles are pulled from your People list and auto-populate call sheets. To change them, edit the person's role in All People.</span>

          <h4 className="bc-form-section-title" style={{ marginTop: 20 }}>Defaults</h4>
          <div className="bc-form-row">
            <div className="bc-form-group">
              <label>DEFAULT CALL TIME</label>
              <input
                type="text"
                value={settings.defaultCallTime}
                onChange={e => updateProductionSettings({ defaultCallTime: e.target.value })}
                placeholder="7:00 AM"
              />
            </div>
            <div className="bc-form-group">
              <label>DEFAULT LUNCH DURATION (minutes)</label>
              <input
                type="number"
                value={settings.defaultLunchDuration}
                onChange={e => updateProductionSettings({ defaultLunchDuration: Number(e.target.value) || 30 })}
              />
            </div>
          </div>

          <div className="bc-form-group" style={{ marginTop: 16 }}>
            <label>DEFAULT CALL SHEET DISCLAIMER</label>
            <textarea
              value={settings.defaultDisclaimer || ''}
              onChange={e => updateProductionSettings({ defaultDisclaimer: e.target.value })}
              placeholder="Default disclaimer text for new call sheets..."
              rows={3}
            />
            <span className="bc-form-hint">This text will pre-fill the disclaimer on new call sheets. You can customize it per sheet.</span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STRIP BOARD VIEW (preserved from original)
  // ==========================================
  function StripBoardView() {
    const [showDayModal, setShowDayModal] = useState(false);
    const [editingDay, setEditingDay] = useState<ShootDay | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [draggedStrip, setDraggedStrip] = useState<string | null>(null);
    const [conflictWarning, setConflictWarning] = useState<{ stripId: string; dayId: string; conflicts: string[] } | null>(null);

    const getStrip = (stripId: string): SceneStrip | undefined => {
      return schedule?.strips.find(s => s.id === stripId);
    };

    const getShotCountForScene = (sceneId: string): number => {
      if (!viewFinder?.shots) return 0;
      return viewFinder.shots.filter(s => s.sceneId === sceneId).length;
    };

    // Check talent availability conflicts for a strip on a given day
    const checkConflicts = (stripId: string, dayId: string): string[] => {
      const strip = getStrip(stripId);
      const day = schedule?.shootDays.find(d => d.id === dayId);
      if (!strip || !day || !day.date) return [];

      const dayDate = new Date(day.date).toISOString().split('T')[0];
      const conflicts: string[] = [];

      // Check each cast member's availability
      strip.castIds.forEach(castId => {
        const person = productionData.people.find(p => p.id === castId);
        if (!person?.availability) return;

        const avail = person.availability;
        const name = `${person.firstName} ${person.lastName}`;

        // Check blocked dates
        if (avail.blockedDates?.includes(dayDate)) {
          conflicts.push(`${name} is blocked on ${dayDate}`);
          return;
        }

        // Check date range
        if (avail.startDate && dayDate < avail.startDate) {
          conflicts.push(`${name} not available until ${avail.startDate}`);
        }
        if (avail.endDate && dayDate > avail.endDate) {
          conflicts.push(`${name} not available after ${avail.endDate}`);
        }
      });

      return conflicts;
    };

    const handleDragStart = (e: React.DragEvent, stripId: string) => {
      setDraggedStrip(stripId);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnDay = (e: React.DragEvent, dayId: string) => {
      e.preventDefault();
      if (draggedStrip) {
        const conflicts = checkConflicts(draggedStrip, dayId);
        if (conflicts.length > 0) {
          // Show warning but allow override
          setConflictWarning({ stripId: draggedStrip, dayId, conflicts });
        } else {
          assignStripToDay(draggedStrip, dayId);
        }
        setDraggedStrip(null);
      }
    };

    const handleDropOnUnscheduled = (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedStrip) {
        unassignStrip(draggedStrip);
        setDraggedStrip(null);
      }
    };

    const calculateDayTotals = (day: ShootDay) => {
      let totalPages = 0;
      day.strips.forEach(stripId => {
        const strip = getStrip(stripId);
        if (strip) totalPages += strip.pageCount;
      });
      return { scenes: day.strips.length, pages: totalPages.toFixed(1) };
    };

    const formatPageCount = (pages: number): string => {
      const wholePages = Math.floor(pages);
      const eighths = Math.round((pages - wholePages) * 8);
      if (eighths === 0) return `${wholePages}`;
      if (wholePages === 0) return `${eighths}/8`;
      return `${wholePages} ${eighths}/8`;
    };

    const renderStrip = (stripId: string) => {
      const strip = getStrip(stripId);
      if (!strip) return null;
      const bgColor = STRIP_COLOR_HEX[strip.color] || '#FFFFFF';
      const isDark = strip.color === 'Black' || strip.color === 'Blue';
      const shotCount = getShotCountForScene(strip.sceneId);

      return (
        <div
          key={strip.id}
          className={`strip ${selectedStripId === strip.id ? 'selected' : ''} ${strip.isLocked ? 'locked' : ''}`}
          style={{ backgroundColor: bgColor, color: isDark ? '#FFFFFF' : '#1a1a1a' }}
          draggable={!strip.isLocked}
          onDragStart={(e) => handleDragStart(e, strip.id)}
          onClick={() => selectStrip(strip.id)}
        >
          <span className="strip-scene">{strip.sceneNumber}</span>
          <span className="strip-int-ext">{strip.intExt}</span>
          <span className="strip-location">{strip.location}</span>
          <span className="strip-time">{strip.timeOfDay}</span>
          <span className="strip-pages">{formatPageCount(strip.pageCount)}</span>
          {shotCount > 0 && <span className="strip-shots">🎬{shotCount}</span>}
          {strip.isLocked && <span className="strip-lock">🔒</span>}
          {strip.hasStunts && <span className="strip-flag">⚡</span>}
          {strip.hasVFX && <span className="strip-flag">✨</span>}
        </div>
      );
    };

    const stats = {
      totalScenes: schedule?.strips.length || 0,
      scheduledScenes: schedule?.strips.filter(s => s.scheduledDayId).length || 0,
      unscheduledScenes: schedule?.unscheduledStrips.length || 0,
      totalDays: schedule?.shootDays.length || 0,
      totalPages: schedule?.strips.reduce((sum, s) => sum + s.pageCount, 0) || 0,
    };

    return (
      <div className="bc-stripboard">
        {/* Sidebar */}
        <div className="bc-sb-sidebar">
          <div className="sidebar-section stats">
            <h3>Schedule Overview</h3>
            <div className="stat-item"><span>Total Scenes</span><span>{stats.totalScenes}</span></div>
            <div className="stat-item"><span>Scheduled</span><span>{stats.scheduledScenes}</span></div>
            <div className="stat-item"><span>Unscheduled</span><span className="warning">{stats.unscheduledScenes}</span></div>
            <div className="stat-item"><span>Shoot Days</span><span>{stats.totalDays}</span></div>
            <div className="stat-item"><span>Total Pages</span><span>{formatPageCount(stats.totalPages)}</span></div>
          </div>

          <div className="sidebar-section unscheduled">
            <h3>Unscheduled ({schedule?.unscheduledStrips.length || 0})</h3>
            <div className="unscheduled-area" onDragOver={handleDragOver} onDrop={handleDropOnUnscheduled}>
              {schedule?.unscheduledStrips.length === 0 ? (
                <div className="empty-text">
                  {schedule?.strips.length === 0
                    ? (productionData.scenes.length > 0
                      ? 'Click "Import from Scenes" to add strips'
                      : 'Add scenes first, then import them here')
                    : 'All scenes scheduled!'}
                </div>
              ) : (
                <div className="strip-list vertical">
                  {schedule?.unscheduledStrips.map(stripId => renderStrip(stripId))}
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-actions">
            {productionData.scenes.length > 0 && (
              <button className="import-btn" onClick={importProductionScenesAsStrips}>
                Import from Scenes ({productionData.scenes.length})
              </button>
            )}
            {breakdownScenes.length > 0 && (
              <button className="import-btn" onClick={importStripsFromBreakdown}>Import from Breakdown</button>
            )}
            {viewFinder && viewFinder.shots.length > 0 && (
              <button className="sync-btn" onClick={createShotPackagesFromViewFinder}>Sync Shots from ViewFinder</button>
            )}
            <button className="add-day-btn" onClick={() => addShootDay()}>+ Add Shoot Day</button>
            <button className="settings-btn" onClick={() => setShowSettingsModal(true)}>Schedule Settings</button>
          </div>
        </div>

        {/* Main Strip Board */}
        <div className="bc-sb-main">
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
              <button className="add-day-btn large" onClick={() => addShootDay()}>Create First Shoot Day</button>
            </div>
          ) : (
            <div className="days-board">
              {schedule?.shootDays.map(day => {
                const totals = calculateDayTotals(day);
                return (
                  <div key={day.id} className={`day-column ${selectedShootDayId === day.id ? 'selected' : ''}`} onClick={() => selectShootDay(day.id)}>
                    <div className="day-header">
                      <div className="day-number">Day {day.dayNumber}</div>
                      <div className="day-date">{day.date ? new Date(new Date(day.date).toISOString().split('T')[0] + 'T12:00:00').toLocaleDateString() : 'TBD'}{(() => {
                        const tz = day.timezone || productionData.locations.find(l =>
                          day.location && (l.name.toLowerCase() === day.location.toLowerCase() ||
                            l.name.toLowerCase().includes(day.location.toLowerCase()) ||
                            day.location.toLowerCase().includes(l.name.toLowerCase()))
                        )?.timezone;
                        if (!tz) return null;
                        const short = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
                        return <span className="day-tz"> ({short})</span>;
                      })()}</div>
                      <div className="day-info"><span>{totals.scenes} scenes</span><span>{totals.pages} pgs</span></div>
                      <div className="day-times">
                        <span>Call: {day.callTime}</span>
                        {day.lunchTime && <span>Lunch: {day.lunchTime} ({day.lunchDuration || 30}m)</span>}
                      </div>
                      <div className="day-actions">
                        {day.strips.length > 0 && (
                          <button
                            className="callsheet-btn"
                            onClick={e => { e.stopPropagation(); generateCallSheetFromDay(day); }}
                            title="Generate Call Sheet from this day"
                          >
                            📋 Call Sheet
                          </button>
                        )}
                        <button className="edit-btn" onClick={e => { e.stopPropagation(); setEditingDay(day); setShowDayModal(true); }}>Edit</button>
                        <button className="delete-btn" onClick={e => { e.stopPropagation(); if (confirm(`Delete Day ${day.dayNumber}?`)) deleteShootDay(day.id); }}>×</button>
                      </div>
                    </div>
                    <div className="day-strips" onDragOver={handleDragOver} onDrop={e => handleDropOnDay(e, day.id)}>
                      {day.strips.length === 0 ? (
                        <div className="drop-zone">Drop scenes here</div>
                      ) : (
                        <div className="strip-list">{day.strips.map(stripId => renderStrip(stripId))}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Day Modal */}
        {showDayModal && editingDay && (
          <div className="bc-modal-overlay" onClick={() => { setShowDayModal(false); setEditingDay(null); }}>
            <div className="bc-modal" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header"><h3>Edit Day {editingDay.dayNumber}</h3><button className="bc-modal-close" onClick={() => { setShowDayModal(false); setEditingDay(null); }}>×</button></div>
              <div className="bc-modal-body">
                <div className="bc-form-group">
                  <label>SHOOT DATE</label>
                  <input type="date" value={editingDay.date ? new Date(editingDay.date).toISOString().split('T')[0] : ''} onChange={e => setEditingDay({ ...editingDay, date: e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined })} />
                </div>
                <div className="bc-form-row">
                  <div className="bc-form-group">
                    <label>CALL TIME</label>
                    <input type="text" value={editingDay.callTime} onChange={e => setEditingDay({ ...editingDay, callTime: e.target.value })} placeholder="7:00 AM" />
                  </div>
                  <div className="bc-form-group">
                    <label>EST. WRAP</label>
                    <input type="text" value={editingDay.estimatedWrap} onChange={e => setEditingDay({ ...editingDay, estimatedWrap: e.target.value })} placeholder="7:00 PM" />
                  </div>
                </div>

                <h4 className="bc-form-section-title">Lunch & Breaks</h4>
                <div className="bc-form-row">
                  <div className="bc-form-group">
                    <label>LUNCH TIME</label>
                    <input type="text" value={editingDay.lunchTime || ''} onChange={e => setEditingDay({ ...editingDay, lunchTime: e.target.value })} placeholder="12:30 PM" />
                  </div>
                  <div className="bc-form-group">
                    <label>LUNCH DURATION (min)</label>
                    <input type="number" value={editingDay.lunchDuration || schedule?.defaultLunchDuration || 30} onChange={e => setEditingDay({ ...editingDay, lunchDuration: parseInt(e.target.value) || 30 })} min="15" step="15" />
                  </div>
                </div>
                <span className="bc-form-hint">
                  Adjust lunch time if you need to accommodate actor arrivals or wrap early scenes first.
                </span>

                <div className="bc-form-group" style={{ marginTop: 12 }}>
                  <label>LOCATION</label>
                  <input type="text" value={editingDay.location || ''} onChange={e => setEditingDay({ ...editingDay, location: e.target.value })} placeholder="Main location" />
                </div>
                <div className="bc-form-group">
                  <label>NOTES</label>
                  <textarea value={editingDay.notes || ''} onChange={e => setEditingDay({ ...editingDay, notes: e.target.value })} placeholder="Day notes... (e.g., early lunch due to actor schedule, long lunch for company move)" rows={3} />
                </div>

                <div className="bc-form-group" style={{ marginTop: 16, borderTop: '1px solid var(--bc-border, #ddd)', paddingTop: 12 }}>
                  <label>TIMEZONE {(() => {
                    // Derive timezone from location
                    const locMatch = productionData.locations.find(l =>
                      editingDay.location && (l.name.toLowerCase() === editingDay.location.toLowerCase() ||
                        l.name.toLowerCase().includes(editingDay.location.toLowerCase()) ||
                        editingDay.location.toLowerCase().includes(l.name.toLowerCase()))
                    );
                    const derivedTz = locMatch?.timezone;
                    if (derivedTz && !editingDay.timezone) return <span className="bc-auto-tag">from {locMatch.name}</span>;
                    if (editingDay.timezone) return <span className="bc-auto-tag">override</span>;
                    return null;
                  })()}</label>
                  <select
                    value={editingDay.timezone || (() => {
                      const locMatch = productionData.locations.find(l =>
                        editingDay.location && (l.name.toLowerCase() === editingDay.location.toLowerCase() ||
                          l.name.toLowerCase().includes(editingDay.location.toLowerCase()) ||
                          editingDay.location.toLowerCase().includes(l.name.toLowerCase()))
                      );
                      return locMatch?.timezone || '';
                    })()}
                    onChange={e => setEditingDay({ ...editingDay, timezone: e.target.value || undefined })}
                  >
                    <option value="">Auto (from location)</option>
                    <optgroup label="US Timezones">
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                      <option value="America/Anchorage">Alaska (AKT)</option>
                      <option value="Pacific/Honolulu">Hawaii (HT)</option>
                    </optgroup>
                    <optgroup label="Canada">
                      <option value="America/Toronto">Eastern (Toronto)</option>
                      <option value="America/Vancouver">Pacific (Vancouver)</option>
                      <option value="America/Edmonton">Mountain (Edmonton)</option>
                      <option value="America/Halifax">Atlantic (Halifax)</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="Europe/London">UK (GMT/BST)</option>
                      <option value="Europe/Paris">Central Europe (CET)</option>
                      <option value="Europe/Berlin">Germany (CET)</option>
                    </optgroup>
                    <optgroup label="Asia/Pacific">
                      <option value="Asia/Tokyo">Japan (JST)</option>
                      <option value="Asia/Shanghai">China (CST)</option>
                      <option value="Asia/Kolkata">India (IST)</option>
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                      <option value="Pacific/Auckland">New Zealand (NZST)</option>
                    </optgroup>
                  </select>
                  <span className="bc-form-hint">Locked to shoot location by default. Override only if shooting in a different timezone.</span>
                </div>
              </div>
              <div className="bc-modal-footer">
                <button className="bc-btn bc-btn-secondary" onClick={() => { setShowDayModal(false); setEditingDay(null); }}>Cancel</button>
                <button className="bc-btn bc-btn-success" onClick={() => { updateShootDay(editingDay.id, editingDay); setShowDayModal(false); setEditingDay(null); }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="bc-modal-overlay" onClick={() => setShowSettingsModal(false)}>
            <div className="bc-modal" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header"><h3>Schedule Settings</h3><button className="bc-modal-close" onClick={() => setShowSettingsModal(false)}>×</button></div>
              <div className="bc-modal-body">
                <div className="bc-form-group"><label>Default Call Time</label><input type="text" value={schedule?.defaultCallTime || '7:00 AM'} onChange={e => updateScheduleSettings({ defaultCallTime: e.target.value })} /></div>
                <div className="bc-form-group"><label>Default Lunch Duration (minutes)</label><input type="number" value={schedule?.defaultLunchDuration || 30} onChange={e => updateScheduleSettings({ defaultLunchDuration: parseInt(e.target.value) || 30 })} /></div>
              </div>
              <div className="bc-modal-footer"><button className="bc-btn bc-btn-secondary" onClick={() => setShowSettingsModal(false)}>Close</button></div>
            </div>
          </div>
        )}

        {/* Conflict Warning Modal */}
        {conflictWarning && (
          <div className="bc-modal-overlay" onClick={() => setConflictWarning(null)}>
            <div className="bc-modal bc-conflict-modal" onClick={e => e.stopPropagation()}>
              <div className="bc-modal-header bc-conflict-header">
                <h3>⚠ Scheduling Conflict</h3>
                <button className="bc-modal-close" onClick={() => setConflictWarning(null)}>×</button>
              </div>
              <div className="bc-modal-body">
                <p>The following talent availability conflicts were detected:</p>
                <ul className="bc-conflict-list">
                  {conflictWarning.conflicts.map((conflict, i) => (
                    <li key={i}>{conflict}</li>
                  ))}
                </ul>
                <p className="bc-form-hint">
                  You can override this and schedule anyway, or cancel and adjust the schedule.
                  Consider adjusting call times or moving scenes later in the day.
                </p>
              </div>
              <div className="bc-modal-footer">
                <button className="bc-btn bc-btn-secondary" onClick={() => setConflictWarning(null)}>Cancel</button>
                <button
                  className="bc-btn bc-btn-warning"
                  onClick={() => {
                    assignStripToDay(conflictWarning.stripId, conflictWarning.dayId);
                    setConflictWarning(null);
                  }}
                >
                  Schedule Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default BaseCamp;
