import React, { useState, useEffect, useMemo } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type {
  ShootDay, SceneStrip, ProductionPerson, ProductionLocation, ProductionScene,
  Department, CallSheet, PersonRole, CallSheetScene, TalentCallEntry, CrewCallEntry,
} from '../types/screenplay';
import { STRIP_COLOR_HEX, AVATAR_COLORS } from '../types/screenplay';
import './BaseCamp.css';

// ============================================
// BASECAMP - Production Management & Call Sheets
// ============================================

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
    addDepartment,
    updateDepartment,
    deleteDepartment,
    addPosition,
    removePosition,
    addCallSheet,
    updateCallSheet,
    deleteCallSheet,
    updateProductionSettings,
  } = useScreenplayStore();

  // Initialize schedule on mount
  useEffect(() => {
    if (!schedule) {
      initializeSchedule();
    }
  }, [schedule, initializeSchedule]);

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
      case 'departments':
        return <DepartmentsView />;
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
    { id: 'callsheets', label: 'Call Sheets', icon: '▤' },
    { id: 'people', label: 'All People', icon: '👥' },
    { id: 'scenes', label: 'Scenes', icon: '☰' },
    { id: 'locations', label: 'Locations', icon: '◉' },
    { id: 'departments', label: 'Departments', icon: '⚙' },
    { id: 'stripboard', label: 'Strip Board', icon: '▥' },
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

    const emptyPerson = (): Omit<ProductionPerson, 'id' | 'avatarColor'> => ({
      firstName: '', lastName: '', email: '', phone: '',
      group: 'Crew', roles: [], tags: [], notes: '', location: '',
    });

    const [formData, setFormData] = useState(emptyPerson());
    const [addAnother, setAddAnother] = useState(false);

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
        payRate: person.payRate ? { ...person.payRate } : undefined,
      });
      setActiveTab('basic');
      setShowModal(true);
    };

    const handleSave = (andAddAnother: boolean) => {
      if (editingPerson) {
        updatePerson(editingPerson.id, formData);
      } else {
        addPerson(formData);
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
                            {role.position || role.department || role.group}
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
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div className="bc-form-group">
                      <label>ROLE(S)</label>
                      {formData.roles.map((role, i) => (
                        <div key={i} className="bc-role-row">
                          <select
                            value={role.group}
                            onChange={e => updateRole(i, { group: e.target.value as PersonRole['group'] })}
                          >
                            <option value="Crew">Crew</option>
                            <option value="Talent">Talent</option>
                            <option value="Client">Client</option>
                          </select>
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

    const talent = people.filter(p => p.group === 'Talent');
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
              <th>Location</th>
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scenes.length === 0 ? (
              <tr>
                <td colSpan={8} className="bc-empty-row">
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
                    {talent.map(t => (
                      <button
                        key={t.id}
                        className={`bc-cast-tag ${formData.castIds.includes(t.id) ? 'selected' : ''}`}
                        onClick={() => toggleCast(t.id)}
                      >
                        {t.firstName} {t.lastName}
                      </button>
                    ))}
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
    const { locations } = productionData;

    const emptyLocation = (): Omit<ProductionLocation, 'id'> => ({
      name: '', streetAddress: '', city: '', state: '', postalCode: '', phone: '',
    });

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
      });
      setShowModal(true);
    };

    const handleSave = (andAddAnother: boolean) => {
      if (editingLocation) {
        updateLocation(editingLocation.id, formData);
      } else {
        addLocation(formData);
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
              <th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={6} className="bc-empty-row">
                  No locations added yet. Click "+ Add Location" to get started.
                </td>
              </tr>
            ) : (
              locations.map(loc => (
                <tr key={loc.id} className="bc-table-row">
                  <td className="bc-bold">{loc.name}</td>
                  <td>{loc.streetAddress}</td>
                  <td>{loc.city}</td>
                  <td>{loc.state}</td>
                  <td>{loc.phone}</td>
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
              ))
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
                      placeholder="(201) 555-0123"
                    />
                  </div>
                </div>

                <h4 className="bc-form-section-title">Precision Details (optional)</h4>

                <div className="bc-form-row">
                  <div className="bc-form-group">
                    <label>LATITUDE</label>
                    <input
                      type="number"
                      value={formData.latitude || ''}
                      onChange={e => setFormData({ ...formData, latitude: Number(e.target.value) || undefined })}
                      placeholder="Latitude coordinates"
                      step="any"
                    />
                  </div>
                  <div className="bc-form-group">
                    <label>LONGITUDE</label>
                    <input
                      type="number"
                      value={formData.longitude || ''}
                      onChange={e => setFormData({ ...formData, longitude: Number(e.target.value) || undefined })}
                      placeholder="Longitude coordinates"
                      step="any"
                    />
                  </div>
                </div>

                <div className="bc-form-group">
                  <label>MAP LINK OVERRIDE</label>
                  <input
                    type="text"
                    value={formData.mapLink || ''}
                    onChange={e => setFormData({ ...formData, mapLink: e.target.value })}
                    placeholder="Custom map link (defaults to Google Maps)"
                  />
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
  // DEPARTMENTS VIEW
  // ==========================================
  function DepartmentsView() {
    const [expandedDept, setExpandedDept] = useState<string | null>(null);
    const [newDeptName, setNewDeptName] = useState('');
    const [newPositionName, setNewPositionName] = useState('');
    const { departments } = productionData;

    return (
      <div className="bc-content-area">
        <div className="bc-page-header">
          <h2>Departments</h2>
        </div>

        <div className="bc-departments-list">
          {departments.map(dept => (
            <div key={dept.id} className={`bc-dept-item ${expandedDept === dept.id ? 'expanded' : ''}`}>
              <div
                className="bc-dept-header"
                onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
              >
                <span className="bc-dept-arrow">{expandedDept === dept.id ? '▾' : '▸'}</span>
                <span className="bc-dept-name">{dept.name}</span>
                <span className="bc-dept-count">{dept.positions.length} positions</span>
                {!dept.isDefault && (
                  <button
                    className="bc-icon-btn danger"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete ${dept.name} department?`)) {
                        deleteDepartment(dept.id);
                      }
                    }}
                  >×</button>
                )}
              </div>

              {expandedDept === dept.id && (
                <div className="bc-dept-positions">
                  {dept.positions.map((pos, i) => (
                    <div key={i} className="bc-position-item">
                      <span>{pos}</span>
                      <button
                        className="bc-icon-btn danger small"
                        onClick={() => removePosition(dept.id, pos)}
                      >×</button>
                    </div>
                  ))}
                  <div className="bc-add-position">
                    <input
                      type="text"
                      value={newPositionName}
                      onChange={e => setNewPositionName(e.target.value)}
                      placeholder="New position name..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newPositionName.trim()) {
                          addPosition(dept.id, newPositionName.trim());
                          setNewPositionName('');
                        }
                      }}
                    />
                    <button
                      className="bc-btn bc-btn-primary small"
                      onClick={() => {
                        if (newPositionName.trim()) {
                          addPosition(dept.id, newPositionName.trim());
                          setNewPositionName('');
                        }
                      }}
                    >+ Add</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="bc-add-department">
            <input
              type="text"
              value={newDeptName}
              onChange={e => setNewDeptName(e.target.value)}
              placeholder="New department name..."
              onKeyDown={e => {
                if (e.key === 'Enter' && newDeptName.trim()) {
                  addDepartment(newDeptName.trim());
                  setNewDeptName('');
                }
              }}
            />
            <button
              className="bc-btn bc-btn-primary"
              onClick={() => {
                if (newDeptName.trim()) {
                  addDepartment(newDeptName.trim());
                  setNewDeptName('');
                }
              }}
            >+ Add Department</button>
          </div>
        </div>
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
    const talent = people.filter(p => p.group === 'Talent');
    const crew = people.filter(p => p.group === 'Crew');

    const emptyCallSheet = (): Omit<CallSheet, 'id' | 'createdAt' | 'updatedAt'> => ({
      title: settings.projectName || 'Untitled Production',
      date: new Date().toISOString().split('T')[0],
      dayNumber: callSheets.length + 1,
      totalDays: callSheets.length + 1,
      crewCall: settings.defaultCallTime || '8:00 AM',
      shootingCall: '8:15 AM',
      firstMeal: '2:00 PM',
      estimatedWrap: '7:00 PM',
      producer: settings.producer || '',
      director: settings.director || '',
      locationIds: [],
      scenes: [],
      talentCalls: talent.map(t => ({ personId: t.id, callTime: '8:00 AM' })),
      crewCalls: crew.map(c => ({
        personId: c.id,
        department: c.roles[0]?.department || '',
        position: c.roles[0]?.position || c.group,
        callTime: settings.defaultCallTime || '8:00 AM',
      })),
      notes: '',
      nearestHospital: '',
      status: 'draft',
    });

    const [formData, setFormData] = useState(emptyCallSheet());

    const openCreate = () => {
      setEditingCS(null);
      setFormData(emptyCallSheet());
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
        status: cs.status,
      });
      setShowEditor(true);
    };

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
      const csScene: CallSheetScene = {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        setDescription: `${scene.intExt} - ${scene.set}`,
        cast: scene.castIds.map(cid => {
          const p = people.find(pp => pp.id === cid);
          return p ? `${p.firstName[0]}${p.lastName[0]}` : '';
        }).filter(Boolean).join(', '),
        locationId: scene.locationId,
        notes: '',
      };
      setFormData({ ...formData, scenes: [...formData.scenes, csScene] });
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
            <button className="bc-btn bc-btn-success" onClick={handleSave}>Save</button>
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
                  <label>PRODUCER</label>
                  <input type="text" value={formData.producer} onChange={e => setFormData({ ...formData, producer: e.target.value })} />
                </div>
                <div className="bc-form-group">
                  <label>DIRECTOR</label>
                  <input type="text" value={formData.director} onChange={e => setFormData({ ...formData, director: e.target.value })} />
                </div>
              </div>

              <h4>Locations</h4>
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
                <label>NEAREST HOSPITAL</label>
                <input
                  type="text"
                  value={formData.nearestHospital}
                  onChange={e => setFormData({ ...formData, nearestHospital: e.target.value })}
                  placeholder="Hospital name and address"
                />
              </div>
            </div>

            {/* Right: Preview */}
            <div className="bc-cs-preview">
              <div className="bc-cs-page">
                {/* Header */}
                <div className="bc-cs-header-section">
                  <div className="bc-cs-title-block">
                    <h2>{formData.title || 'Untitled'}</h2>
                    <div className="bc-cs-crew-call">
                      <div className="bc-cs-call-label">Crew Call</div>
                      <div className="bc-cs-call-time">{formData.crewCall}</div>
                    </div>
                  </div>
                  <div className="bc-cs-date-block">
                    <div>{formData.date}</div>
                    <div>Day {formData.dayNumber} of {formData.totalDays}</div>
                  </div>
                  <div className="bc-cs-times-block">
                    <div>Crew Call: {formData.crewCall}</div>
                    <div>Shooting Call: {formData.shootingCall}</div>
                    <div>First Meal: {formData.firstMeal}</div>
                    <div>Est. Wrap: {formData.estimatedWrap}</div>
                  </div>
                </div>

                <div className="bc-cs-meta-row">
                  <div><strong>Producer:</strong> {formData.producer}</div>
                  <div><strong>Director:</strong> {formData.director}</div>
                </div>

                {/* Locations */}
                {formData.locationIds.length > 0 && (
                  <div className="bc-cs-locations-section">
                    {formData.locationIds.map(lid => {
                      const loc = getLocationById(lid);
                      if (!loc) return null;
                      return (
                        <div key={lid} className="bc-cs-location-card">
                          <strong>{loc.name}</strong>
                          {loc.streetAddress && <div>{loc.streetAddress}</div>}
                          {(loc.city || loc.state) && <div>{[loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')}</div>}
                          {loc.phone && <div>{loc.phone}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Schedule */}
                {formData.scenes.length > 0 && (
                  <div className="bc-cs-schedule-section">
                    <h4>Today's Schedule</h4>
                    <table className="bc-cs-table">
                      <thead>
                        <tr>
                          <th>SCENE</th>
                          <th>SET / DESCRIPTION</th>
                          <th>CAST</th>
                          <th>LOCATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.scenes.map((s, i) => {
                          const loc = getLocationById(s.locationId);
                          return (
                            <tr key={i}>
                              <td>{s.sceneNumber}</td>
                              <td>{s.setDescription}</td>
                              <td>{s.cast}</td>
                              <td>{loc ? `${loc.name}${loc.streetAddress ? `\n${loc.streetAddress}` : ''}` : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Talent */}
                {formData.talentCalls.length > 0 && (
                  <div className="bc-cs-talent-section">
                    <h4>Talent</h4>
                    <table className="bc-cs-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>TALENT</th>
                          <th>ROLE</th>
                          <th>CALL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.talentCalls.map((tc, i) => {
                          const p = people.find(pp => pp.id === tc.personId);
                          return (
                            <tr key={i}>
                              <td>{p ? `${p.firstName[0]}${p.lastName[0]}` : ''}</td>
                              <td>{getPersonName(tc.personId)}</td>
                              <td>{p?.roles.find(r => r.group === 'Talent')?.position || 'Talent'}</td>
                              <td>{tc.callTime}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Crew by Department */}
                {Object.keys(crewByDept).length > 0 && (
                  <div className="bc-cs-crew-section">
                    {Object.entries(crewByDept).map(([dept, calls]) => (
                      <div key={dept} className="bc-cs-dept-block">
                        <h5>{dept.toUpperCase()}</h5>
                        <table className="bc-cs-table">
                          <tbody>
                            {calls.map((cc, i) => (
                              <tr key={i}>
                                <td><strong>{cc.position}</strong></td>
                                <td>{getPersonName(cc.personId)}</td>
                                <td>{cc.callTime}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {formData.notes && (
                  <div className="bc-cs-notes-section">
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

          <div className="bc-form-row">
            <div className="bc-form-group">
              <label>PRODUCER</label>
              <input
                type="text"
                value={settings.producer}
                onChange={e => updateProductionSettings({ producer: e.target.value })}
                placeholder="Producer name"
              />
            </div>
            <div className="bc-form-group">
              <label>DIRECTOR</label>
              <input
                type="text"
                value={settings.director}
                onChange={e => updateProductionSettings({ director: e.target.value })}
                placeholder="Director name"
              />
            </div>
          </div>

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

    const getStrip = (stripId: string): SceneStrip | undefined => {
      return schedule?.strips.find(s => s.id === stripId);
    };

    const getShotCountForScene = (sceneId: string): number => {
      if (!viewFinder?.shots) return 0;
      return viewFinder.shots.filter(s => s.sceneId === sceneId).length;
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
        assignStripToDay(draggedStrip, dayId);
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
                  {schedule?.strips.length === 0 ? 'Import scenes from Breakdown first' : 'All scenes scheduled!'}
                </div>
              ) : (
                <div className="strip-list vertical">
                  {schedule?.unscheduledStrips.map(stripId => renderStrip(stripId))}
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-actions">
            {schedule?.strips.length === 0 && breakdownScenes.length > 0 && (
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
                      <div className="day-date">{day.date ? new Date(day.date).toLocaleDateString() : 'TBD'}</div>
                      <div className="day-info"><span>{totals.scenes} scenes</span><span>{totals.pages} pgs</span></div>
                      <div className="day-times"><span>Call: {day.callTime}</span></div>
                      <div className="day-actions">
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
                <div className="bc-form-group"><label>Shoot Date</label><input type="date" value={editingDay.date ? new Date(editingDay.date).toISOString().split('T')[0] : ''} onChange={e => setEditingDay({ ...editingDay, date: e.target.value ? new Date(e.target.value) : undefined })} /></div>
                <div className="bc-form-row">
                  <div className="bc-form-group"><label>Call Time</label><input type="text" value={editingDay.callTime} onChange={e => setEditingDay({ ...editingDay, callTime: e.target.value })} placeholder="7:00 AM" /></div>
                  <div className="bc-form-group"><label>Est. Wrap</label><input type="text" value={editingDay.estimatedWrap} onChange={e => setEditingDay({ ...editingDay, estimatedWrap: e.target.value })} placeholder="7:00 PM" /></div>
                </div>
                <div className="bc-form-group"><label>Location</label><input type="text" value={editingDay.location || ''} onChange={e => setEditingDay({ ...editingDay, location: e.target.value })} placeholder="Main location" /></div>
                <div className="bc-form-group"><label>Notes</label><textarea value={editingDay.notes || ''} onChange={e => setEditingDay({ ...editingDay, notes: e.target.value })} placeholder="Day notes..." /></div>
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
      </div>
    );
  }
};

export default BaseCamp;
