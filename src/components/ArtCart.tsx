import { useEffect, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import type { ArtCartItem, SourcingStatus, ItemPriority } from '../types/screenplay';
import './ArtCart.css';

// Category colors matching BreakDown
const CATEGORY_COLORS: Record<string, string> = {
  'Props': '#8B5CF6',
  'Set Dressing': '#7C3AED',
  'Greenery': '#15803D',
  'Vehicles': '#EC4899',
  'Wardrobe': '#92400E',
  'Makeup': '#D97706',
  'Special Equipment': '#64748B',
};

// Status colors
const STATUS_COLORS: Record<SourcingStatus, string> = {
  'To Find': '#EF4444',
  'Researching': '#F97316',
  'Found': '#EAB308',
  'Rented': '#3B82F6',
  'Purchased': '#22C55E',
  'Built': '#8B5CF6',
  'Borrowed': '#06B6D4',
  'On Hand': '#10B981',
};

// Priority colors
const PRIORITY_COLORS: Record<ItemPriority, string> = {
  'Critical': '#EF4444',
  'High': '#F97316',
  'Medium': '#EAB308',
  'Low': '#6B7280',
};

const STATUS_OPTIONS: SourcingStatus[] = [
  'To Find', 'Researching', 'Found', 'Rented', 'Purchased', 'Built', 'Borrowed', 'On Hand'
];

const PRIORITY_OPTIONS: ItemPriority[] = ['Critical', 'High', 'Medium', 'Low'];

const CATEGORY_OPTIONS = ['Props', 'Set Dressing', 'Greenery', 'Vehicles', 'Wardrobe', 'Makeup', 'Special Equipment'];

export const ArtCart = () => {
  const {
    artCart,
    breakdown,
    darkMode,
    selectedArtCartCategory,
    artCartFilterStatus,
    initializeArtCart,
    importFromBreakdown,
    addArtCartItem,
    updateArtCartItem,
    deleteArtCartItem,
    setArtCartItemStatus,
    addVendor,
    selectArtCartCategory,
    setArtCartFilterStatus,
  } = useScreenplayStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ArtCartItem | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Props',
    description: '',
    quantity: 1,
    estimatedCost: 0,
    priority: 'Medium' as ItemPriority,
  });
  const [newVendor, setNewVendor] = useState({
    name: '',
    contact: '',
    phone: '',
    email: '',
  });

  // Initialize ArtCart if not exists
  useEffect(() => {
    if (!artCart) {
      initializeArtCart();
    }
  }, [artCart, initializeArtCart]);

  // Filter items
  const filteredItems = artCart?.items.filter(item => {
    const categoryMatch = !selectedArtCartCategory || item.category === selectedArtCartCategory;
    const statusMatch = artCartFilterStatus === 'All' || item.status === artCartFilterStatus;
    return categoryMatch && statusMatch;
  }) || [];

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ArtCartItem[]>);

  // Calculate totals
  const totalItems = artCart?.items.length || 0;
  const totalEstimatedCost = artCart?.items.reduce((sum, item) =>
    sum + (item.estimatedCost || 0) * item.quantity, 0) || 0;
  const totalActualCost = artCart?.items.reduce((sum, item) =>
    sum + (item.actualCost || 0) * item.quantity, 0) || 0;
  const itemsToFind = artCart?.items.filter(i => i.status === 'To Find').length || 0;

  // Handle add item
  const handleAddItem = () => {
    addArtCartItem({
      name: newItem.name,
      category: newItem.category,
      description: newItem.description,
      status: 'To Find',
      priority: newItem.priority,
      quantity: newItem.quantity,
      estimatedCost: newItem.estimatedCost,
      sceneIds: [],
    });
    setNewItem({
      name: '',
      category: 'Props',
      description: '',
      quantity: 1,
      estimatedCost: 0,
      priority: 'Medium',
    });
    setShowAddModal(false);
  };

  // Handle add vendor
  const handleAddVendor = () => {
    addVendor(newVendor);
    setNewVendor({ name: '', contact: '', phone: '', email: '' });
    setShowVendorModal(false);
  };

  // Handle import from breakdown
  const handleImport = () => {
    if (breakdown) {
      importFromBreakdown();
    }
  };

  return (
    <div className={`artcart-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Sidebar - Categories & Filters */}
      <div className="artcart-sidebar">
        <div className="sidebar-section">
          <h3>Categories</h3>
          <button
            className={`category-filter ${!selectedArtCartCategory ? 'active' : ''}`}
            onClick={() => selectArtCartCategory(null)}
          >
            <span className="category-dot" style={{ background: '#6B7280' }} />
            All Categories
            <span className="count">{totalItems}</span>
          </button>
          {CATEGORY_OPTIONS.map(cat => {
            const count = artCart?.items.filter(i => i.category === cat).length || 0;
            return (
              <button
                key={cat}
                className={`category-filter ${selectedArtCartCategory === cat ? 'active' : ''}`}
                onClick={() => selectArtCartCategory(selectedArtCartCategory === cat ? null : cat)}
              >
                <span className="category-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                {cat}
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section">
          <h3>Status Filter</h3>
          <select
            value={artCartFilterStatus}
            onChange={(e) => setArtCartFilterStatus(e.target.value as SourcingStatus | 'All')}
            className="status-filter-select"
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="sidebar-section stats">
          <h3>Summary</h3>
          <div className="stat-item">
            <span className="stat-label">Total Items</span>
            <span className="stat-value">{totalItems}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">To Find</span>
            <span className="stat-value warning">{itemsToFind}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Est. Budget</span>
            <span className="stat-value">${totalEstimatedCost.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Actual Spent</span>
            <span className="stat-value">${totalActualCost.toLocaleString()}</span>
          </div>
        </div>

        <div className="sidebar-actions">
          {breakdown && (
            <button className="import-btn" onClick={handleImport}>
              Import from BreakDown
            </button>
          )}
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            + Add Item
          </button>
          <button className="vendor-btn" onClick={() => setShowVendorModal(true)}>
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Main Content - Item List */}
      <div className="artcart-main">
        <div className="main-header">
          <h2>
            {selectedArtCartCategory || 'All Items'}
            {artCartFilterStatus !== 'All' && ` - ${artCartFilterStatus}`}
          </h2>
          <span className="item-count">{filteredItems.length} items</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>No items found.</p>
            {breakdown && (
              <button className="import-btn large" onClick={handleImport}>
                Import from BreakDown
              </button>
            )}
          </div>
        ) : (
          <div className="items-list">
            {Object.entries(itemsByCategory).map(([category, items]) => (
              <div key={category} className="category-group">
                <div className="category-header" style={{ borderColor: CATEGORY_COLORS[category] }}>
                  <span className="category-dot" style={{ background: CATEGORY_COLORS[category] }} />
                  <h3>{category}</h3>
                  <span className="count">{items.length}</span>
                </div>
                <div className="items-grid">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={`item-card priority-${item.priority.toLowerCase()}`}
                      onClick={() => setEditingItem(item)}
                    >
                      <div className="item-header">
                        <h4>{item.name}</h4>
                        <span
                          className="priority-badge"
                          style={{ background: PRIORITY_COLORS[item.priority] }}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <div className="item-details">
                        {item.description && (
                          <p className="description">{item.description}</p>
                        )}
                        <div className="item-meta">
                          <span className="quantity">Qty: {item.quantity}</span>
                          {item.estimatedCost && (
                            <span className="cost">${item.estimatedCost}</span>
                          )}
                        </div>
                      </div>

                      <div className="item-status">
                        <select
                          value={item.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            setArtCartItemStatus(item.id, e.target.value as SourcingStatus);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ borderColor: STATUS_COLORS[item.status] }}
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this item?')) {
                            deleteArtCartItem(item.id);
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vendors Panel */}
      <div className="artcart-vendors">
        <h3>Vendors</h3>
        <div className="vendor-list">
          {artCart?.vendors.length === 0 ? (
            <p className="empty-text">No vendors added yet.</p>
          ) : (
            artCart?.vendors.map(vendor => (
              <div key={vendor.id} className="vendor-card">
                <strong>{vendor.name}</strong>
                {vendor.contact && <span>{vendor.contact}</span>}
                {vendor.phone && <span>{vendor.phone}</span>}
                {vendor.email && <span>{vendor.email}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Item</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Item name"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={newItem.priority}
                  onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as ItemPriority })}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Estimated Cost</label>
              <input
                type="number"
                min="0"
                value={newItem.estimatedCost}
                onChange={(e) => setNewItem({ ...newItem, estimatedCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="primary" onClick={handleAddItem} disabled={!newItem.name.trim()}>
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Vendor</h3>
            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                placeholder="Company or store name"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input
                type="text"
                value={newVendor.contact}
                onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })}
                placeholder="Contact name"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={newVendor.phone}
                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={newVendor.email}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowVendorModal(false)}>Cancel</button>
              <button className="primary" onClick={handleAddVendor} disabled={!newVendor.name.trim()}>
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Item</h3>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as SourcingStatus })}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={editingItem.priority}
                  onChange={(e) => setEditingItem({ ...editingItem, priority: e.target.value as ItemPriority })}
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Estimated Cost</label>
                <input
                  type="number"
                  min="0"
                  value={editingItem.estimatedCost || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, estimatedCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Actual Cost</label>
                <input
                  type="number"
                  min="0"
                  value={editingItem.actualCost || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, actualCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Vendor</label>
              <select
                value={editingItem.vendorId || ''}
                onChange={(e) => setEditingItem({ ...editingItem, vendorId: e.target.value || undefined })}
              >
                <option value="">No vendor assigned</option>
                {artCart?.vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={editingItem.notes || ''}
                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setEditingItem(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  updateArtCartItem(editingItem.id, editingItem);
                  setEditingItem(null);
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
