// ArtCart: items, options/approvals, vendors, shopping lists, budget
import type { StateCreator } from 'zustand';
import type {
  ArtCart,
  ArtCartItem,
  Vendor,
  ShoppingList,
  SourcingStatus,
  ItemPriority,
  ItemOption,
  ArtCartBudget,
  BudgetStatus,
} from '../../types/screenplay';
import { generateId } from '../../utils/fdx';
import type { ScreenplayState, ArtCartSlice } from '../types';

export const createArtCartSlice: StateCreator<ScreenplayState, [], [], ArtCartSlice> = (set, get) => ({
  // ArtCart state
  artCart: null,
  selectedArtCartCategory: null,
  selectedArtCartItemId: null,
  artCartFilterStatus: 'All',

  // ArtCart actions
  initializeArtCart: () => {
    const state = get();
    const artCart: ArtCart = {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown?.id,
      totalBudgetStatus: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ artCart });
  },

  importFromBreakdown: () => {
    const state = get();
    if (!state.breakdown) return;

    // Art-related categories to import
    const artCategories = ['Props', 'Set Dressing', 'Greenery', 'Vehicles', 'Wardrobe', 'Makeup', 'Special Equipment'];
    // Breakdown uses Movie Magic's "Makeup/Hair"; ArtCart calls it "Makeup"
    const toArtCategory = (category: string) => (category === 'Makeup/Hair' ? 'Makeup' : category);

    // Filter breakdown elements to art categories
    const artElements = state.breakdown.elements
      .map(el => ({ ...el, category: toArtCategory(el.category) }))
      .filter(el => artCategories.includes(el.category));

    // Create ArtCartItems from breakdown elements
    const newItems: ArtCartItem[] = artElements.map(el => ({
      id: generateId(),
      name: el.text,
      category: el.category,
      status: 'To Find' as SourcingStatus,
      priority: 'Medium' as ItemPriority,
      quantity: 1,
      options: [],
      needsApproval: false,
      sceneIds: [el.sceneId],
      breakdownElementId: el.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Merge with existing items (avoid duplicates by breakdownElementId)
    const existingIds = new Set(state.artCart?.items.map(i => i.breakdownElementId) || []);
    const uniqueNewItems = newItems.filter(item =>
      item.breakdownElementId && !existingIds.has(item.breakdownElementId)
    );

    const updatedArtCart: ArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, ...uniqueNewItems],
      scriptSync: {
        ...state.artCart.scriptSync,
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown.id,
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: uniqueNewItems,
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      importedFromBreakdownId: state.breakdown.id,
      totalBudgetStatus: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
  },

  checkScriptVersionSync: () => {
    const state = get();
    if (!state.artCart) return;

    // Check if script has changed since last sync
    const currentVersionId = state.activeVersionId || 'main';
    const isOutdated = state.artCart.scriptSync.scriptVersionId !== currentVersionId;

    if (isOutdated) {
      set({
        artCart: {
          ...state.artCart,
          scriptSync: {
            ...state.artCart.scriptSync,
            isOutdated: true,
            latestVersionId: currentVersionId,
            latestVersionName: state.versions.find(v => v.id === currentVersionId)?.name || 'Current',
          },
          updatedAt: new Date(),
        },
      });
    }
  },

  addArtCartItem: (itemData) => {
    const state = get();
    const id = generateId();
    const newItem: ArtCartItem = {
      ...itemData,
      id,
      options: [],
      needsApproval: itemData.needsApproval ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      items: [...state.artCart.items, newItem],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [newItem],
      vendors: [],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateArtCartItem: (itemId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, ...updates, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteArtCartItem: (itemId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        items: state.artCart.items.filter(item => item.id !== itemId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemStatus: (itemId, status) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, status, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setArtCartItemPriority: (itemId, priority) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId ? { ...item, priority, updatedAt: new Date() } : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  addVendor: (vendorData) => {
    const state = get();
    const id = generateId();
    const newVendor: Vendor = { ...vendorData, id };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      vendors: [...state.artCart.vendors, newVendor],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [newVendor],
      shoppingLists: [],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateVendor: (vendorId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedVendors = state.artCart.vendors.map(vendor =>
      vendor.id === vendorId ? { ...vendor, ...updates } : vendor
    );

    set({
      artCart: {
        ...state.artCart,
        vendors: updatedVendors,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteVendor: (vendorId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        vendors: state.artCart.vendors.filter(v => v.id !== vendorId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  createShoppingList: (name, itemIds) => {
    const state = get();
    const id = generateId();
    const newList: ShoppingList = {
      id,
      name,
      itemIds,
      status: 'Draft',
      createdAt: new Date(),
    };

    const updatedArtCart = state.artCart ? {
      ...state.artCart,
      shoppingLists: [...state.artCart.shoppingLists, newList],
      updatedAt: new Date(),
    } : {
      id: generateId(),
      projectName: state.screenplay.title || 'Untitled Project',
      items: [],
      vendors: [],
      shoppingLists: [newList],
      budgets: [],
      scriptSync: {
        scriptVersionId: state.activeVersionId || 'main',
        scriptVersionName: 'Current',
        syncedAt: new Date(),
        isOutdated: false,
      },
      totalBudgetStatus: 'Pending' as BudgetStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({ artCart: updatedArtCart, isDirty: true });
    return id;
  },

  updateShoppingList: (listId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedLists = state.artCart.shoppingLists.map(list =>
      list.id === listId ? { ...list, ...updates } : list
    );

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: updatedLists,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteShoppingList: (listId) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        shoppingLists: state.artCart.shoppingLists.filter(l => l.id !== listId),
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectArtCartCategory: (category) => set({ selectedArtCartCategory: category }),

  selectArtCartItem: (itemId) => set({ selectedArtCartItemId: itemId }),

  setArtCartFilterStatus: (status) => set({ artCartFilterStatus: status }),

  getArtCartItemsByCategory: (category) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.category === category);
  },

  getArtCartItemsByStatus: (status) => {
    const state = get();
    if (!state.artCart) return [];
    return state.artCart.items.filter(item => item.status === status);
  },

  // Item Options actions
  addItemOption: (itemId, optionData) => {
    const state = get();
    if (!state.artCart) return '';

    const optionId = generateId();
    const newOption: ItemOption = {
      ...optionData,
      id: optionId,
      approvalStatus: 'Pending',
      createdAt: new Date(),
    };

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? { ...item, options: [...item.options, newOption], updatedAt: new Date() }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
    return optionId;
  },

  updateItemOption: (itemId, optionId, updates) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            options: item.options.map(opt =>
              opt.id === optionId ? { ...opt, ...updates } : opt
            ),
            updatedAt: new Date(),
          }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  deleteItemOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item =>
      item.id === itemId
        ? {
            ...item,
            options: item.options.filter(opt => opt.id !== optionId),
            selectedOptionId: item.selectedOptionId === optionId ? undefined : item.selectedOptionId,
            updatedAt: new Date(),
          }
        : item
    );

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  approveItemOption: (itemId, optionId, approvedBy, status, notes) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      const updatedOptions = item.options.map(opt =>
        opt.id === optionId
          ? {
              ...opt,
              approvalStatus: status,
              approvedBy,
              approvalDate: new Date(),
              approvalNotes: notes,
            }
          : opt
      );

      // If approved, auto-select this option
      const selectedOptionId = status === 'Approved' ? optionId : item.selectedOptionId;

      // Update item approval status based on option approval
      const approvalStatus = status === 'Approved' || status === 'Indifferent'
        ? status
        : item.approvalStatus;

      return {
        ...item,
        options: updatedOptions,
        selectedOptionId,
        approvalStatus,
        approvedBy: status === 'Approved' ? approvedBy : item.approvedBy,
        approvalDate: status === 'Approved' ? new Date() : item.approvalDate,
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  selectItemOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      const selectedOption = item.options.find(opt => opt.id === optionId);
      if (!selectedOption) return item;

      return {
        ...item,
        selectedOptionId: optionId,
        estimatedCost: selectedOption.price,
        vendorId: selectedOption.vendorId,
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setRecommendedOption: (itemId, optionId) => {
    const state = get();
    if (!state.artCart) return;

    const updatedItems = state.artCart.items.map(item => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        options: item.options.map(opt => ({
          ...opt,
          isRecommended: opt.id === optionId,
        })),
        updatedAt: new Date(),
      };
    });

    set({
      artCart: {
        ...state.artCart,
        items: updatedItems,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  // Budget actions
  setCategoryBudget: (category, allocated, status) => {
    const state = get();
    if (!state.artCart) return;

    const existingBudget = state.artCart.budgets.find(b => b.category === category);
    const spent = existingBudget?.spent || 0;
    const committed = existingBudget?.committed || 0;

    const newBudget: ArtCartBudget = {
      category,
      status,
      allocated,
      spent,
      committed,
      remaining: allocated - spent - committed,
    };

    const updatedBudgets = existingBudget
      ? state.artCart.budgets.map(b => b.category === category ? newBudget : b)
      : [...state.artCart.budgets, newBudget];

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  updateBudgetSpent: (category, spent) => {
    const state = get();
    if (!state.artCart) return;

    const updatedBudgets = state.artCart.budgets.map(b => {
      if (b.category !== category) return b;
      return {
        ...b,
        spent,
        remaining: b.allocated - spent - b.committed,
      };
    });

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  setTotalBudget: (amount, status) => {
    const state = get();
    if (!state.artCart) return;

    set({
      artCart: {
        ...state.artCart,
        totalBudgetAllocated: amount,
        totalBudgetStatus: status,
        updatedAt: new Date(),
      },
      isDirty: true,
    });
  },

  calculateBudgetTotals: () => {
    const state = get();
    if (!state.artCart) return;

    // Calculate spent/committed from items
    const categoryTotals: Record<string, { spent: number; committed: number }> = {};

    state.artCart.items.forEach(item => {
      const category = item.category;
      if (!categoryTotals[category]) {
        categoryTotals[category] = { spent: 0, committed: 0 };
      }

      if (item.actualCost) {
        categoryTotals[category].spent += item.actualCost * item.quantity;
      } else if (item.estimatedCost && (item.status === 'Found' || item.status === 'Researching')) {
        categoryTotals[category].committed += item.estimatedCost * item.quantity;
      }
    });

    const updatedBudgets = state.artCart.budgets.map(b => {
      const totals = categoryTotals[b.category] || { spent: 0, committed: 0 };
      return {
        ...b,
        spent: totals.spent,
        committed: totals.committed,
        remaining: b.allocated - totals.spent - totals.committed,
      };
    });

    set({
      artCart: {
        ...state.artCart,
        budgets: updatedBudgets,
        updatedAt: new Date(),
      },
    });
  },
});
