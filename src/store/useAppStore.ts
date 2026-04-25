import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Dish, Production, InventoryEvent, InventorySnapshot, CatalogItem } from '../data';
import { firebaseService, catalogConverter, dishConverter, productionConverter, inventoryEventConverter } from '../services/firebase.service';
import { syncQueueService } from '../services/syncQueue.service';

export type UIState = {
  activePage: string;
  activeTab: 'traditional' | 'custom';
  view: 'selection' | 'result';
};

export type DraftDish = {
  id: string;
  data: Dish;
  updatedAt: number;
  syncStatus: 'pending' | 'synced' | 'error';
};

interface AppState {
  ui: UIState;
  draftDishes: Record<string, DraftDish>;

  catalog: CatalogItem[];
  dishes: Dish[];
  selectedDish: Dish | null;
  productions: Production[];
  inventoryEvents: InventoryEvent[];
  inventorySnapshots: InventorySnapshot[];
  
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  isOnline: boolean;
  setOnline: (status: boolean) => void;
  
  // Actions
  initSync: () => () => void; // Returns cleanup function
  setUI: (ui: Partial<UIState>) => void;
  setDraftDish: (id: string, draft: DraftDish, actionType?: 'CREATE_DISH' | 'UPDATE_DISH') => Promise<void>;
  removeDraftDish: (id: string) => void;

  setCatalog: (catalog: CatalogItem[]) => void;
  setDishes: (dishes: Dish[]) => void;
  setSelectedDish: (dish: Dish | null) => void;
  addDish: (dish: Dish) => void;
  updateDish: (dish: Dish) => void;
  deleteDish: (dishId: string) => void;
  
  setProductions: (productions: Production[]) => void;
  addProduction: (production: Production) => void;
  
  setInventoryEvents: (events: InventoryEvent[]) => void;
  addInventoryEvent: (event: InventoryEvent) => void;
  addInventoryEvents: (events: InventoryEvent[]) => void;
  
  setInventorySnapshots: (snapshots: InventorySnapshot[]) => void;
  addInventorySnapshot: (snapshot: InventorySnapshot) => void;
  
  deactivateCatalogItem: (id: string) => Promise<void>;
  activateCatalogItem: (id: string) => Promise<void>;
  recalculateDishFlags: () => Promise<void>;
  processSyncQueue: () => Promise<void>;
  getDraftStatus: (id: string) => 'pending' | 'synced' | 'error' | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ui: {
        activePage: 'recipes',
        activeTab: 'traditional',
        view: 'selection',
      },
      draftDishes: {},

      catalog: [],
      dishes: [],
      selectedDish: null,
      productions: [],
      inventoryEvents: [],
      inventorySnapshots: [],
      loading: true,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

      setLoading: (loading) => set({ loading }),
      setOnline: (isOnline) => {
        const wasOffline = !get().isOnline;
        set({ isOnline });
        if (wasOffline && isOnline) {
          get().processSyncQueue();
        }
      },

  initSync: () => {
    let loaded = {
      catalog: false,
      dishes: false,
      productions: false,
      events: false
    };

    const checkLoaded = () => {
      if (Object.values(loaded).every(Boolean)) {
        set({ loading: false });
      }
    };

    const unsubCatalog = firebaseService.subscribeToCollection('catalog', catalogConverter, (catalog) => {
      loaded.catalog = true;
      set({ catalog });
      checkLoaded();
    });
    const unsubDishes = firebaseService.subscribeToCollection('dishes', dishConverter, (dishes) => {
      loaded.dishes = true;
      set({ dishes });
      checkLoaded();
    });
    const unsubProductions = firebaseService.subscribeToCollection('productions', productionConverter, (productions) => {
      loaded.productions = true;
      set({ productions });
      checkLoaded();
    });
    const unsubEvents = firebaseService.subscribeToCollection('inventoryEvents', inventoryEventConverter, (inventoryEvents) => {
      loaded.events = true;
      set({ inventoryEvents });
      checkLoaded();
    });

    return () => {
      unsubCatalog();
      unsubDishes();
      unsubProductions();
      unsubEvents();
    };
  },

  setUI: (uiParams) => set((state) => ({ ui: { ...state.ui, ...uiParams } })),
  setDraftDish: async (id, draft, actionType = 'CREATE_DISH') => {
    set((state) => ({
      draftDishes: { ...state.draftDishes, [id]: draft }
    }));
    
    // Auto-enqueue for sync
    await syncQueueService.enqueue({
      type: actionType,
      payload: draft.data
    });
  },
  removeDraftDish: (id) => set((state) => {
    const newDrafts = { ...state.draftDishes };
    delete newDrafts[id];
    return { draftDishes: newDrafts };
  }),

  setCatalog: (catalog) => set({ catalog }),
  setDishes: (dishes) => set({ dishes }),
  setSelectedDish: (selectedDish) => set({ selectedDish }),
  addDish: async (dish) => {
    await firebaseService.saveItem('dishes', dish, dishConverter);
  },
  updateDish: async (dish) => {
    await firebaseService.saveItem('dishes', dish, dishConverter);
    set((state) => ({
      selectedDish: state.selectedDish?.id === dish.id ? dish : state.selectedDish
    }));
  },
  deleteDish: async (dishId) => {
    await firebaseService.deleteItem('dishes', dishId);
    set((state) => ({
      selectedDish: state.selectedDish?.id === dishId ? null : state.selectedDish,
      ui: {
        ...state.ui,
        view: state.selectedDish?.id === dishId ? 'selection' : state.ui.view
      }
    }));
  },

  setProductions: (productions) => set({ productions }),
  addProduction: async (production) => {
    const { isOnline } = get();
    if (!isOnline) {
      throw new Error('No se puede registrar producción sin conexión (ERP Guard)');
    }
    await firebaseService.saveItem('productions', production, productionConverter);
  },

  setInventoryEvents: (inventoryEvents) => set({ inventoryEvents }),
  addInventoryEvent: async (event) => {
    await firebaseService.saveItem('inventoryEvents', event, inventoryEventConverter);
  },
  addInventoryEvents: async (events) => {
    for (const event of events) {
      try {
        await firebaseService.saveItem('inventoryEvents', event, inventoryEventConverter);
      } catch (e) {
        console.error('Partial failure in batch', e);
        break;
      }
    }
  },

  setInventorySnapshots: (inventorySnapshots) => set({ inventorySnapshots }),
  addInventorySnapshot: (snapshot) => set((state) => ({ inventorySnapshots: [...state.inventorySnapshots, snapshot] })),

  deactivateCatalogItem: async (id) => {
    const { catalog, dishes, recalculateDishFlags } = get();
    const item = catalog.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, active: false, deletedAt: new Date().toISOString() };
    await firebaseService.saveItem('catalog', updatedItem, catalogConverter);
    
    // Immediate UI feedback (Optimistic-ish)
    set((state) => ({
      catalog: state.catalog.map(i => i.id === id ? updatedItem : i)
    }));

    await recalculateDishFlags();
  },

  activateCatalogItem: async (id) => {
    const { catalog, recalculateDishFlags } = get();
    const item = catalog.find(i => i.id === id);
    if (!item) return;

    const updatedItem = { ...item, active: true };
    await firebaseService.saveItem('catalog', updatedItem, catalogConverter);
    
    // Immediate UI feedback (Optimistic-ish)
    set((state) => ({
      catalog: state.catalog.map(i => i.id === id ? updatedItem : i)
    }));

    await recalculateDishFlags();
  },

  recalculateDishFlags: async () => {
    const { catalog, dishes } = get();
    
    // Recursive check function
    const checkInactive = (dish: Dish): boolean => {
      // Check ingredients
      const hasInactiveIng = dish.ingredients.some(ing => {
        const catItem = catalog.find(c => c.id === ing.catalogId);
        return catItem ? !catItem.active : true; // Missing from catalog = inactive
      });
      if (hasInactiveIng) return true;

      // Check sub-recipes recursively
      if (dish.subRecipes) {
        for (const sub of dish.subRecipes) {
          const subDish = dishes.find(d => d.id === sub.dishId);
          if (subDish && checkInactive(subDish)) return true;
        }
      }

      return false;
    };

    for (const dish of dishes) {
      if (!dish.id) continue;
      const needsUpdate = checkInactive(dish);
      if (dish.hasInactiveIngredients !== needsUpdate) {
        const updatedDish = { ...dish, hasInactiveIngredients: needsUpdate };
        await firebaseService.saveItem('dishes', updatedDish, dishConverter);
      }
    }
  },

  processSyncQueue: async () => {
    if (!navigator.onLine) return;
    
    const { removeDraftDish } = get();
    const queue = await syncQueueService.getQueue();
    if (queue.length === 0) return;

    for (const action of queue) {
      if (action.processed) continue;
      if (action.retryCount > 3) {
        console.warn('Action failed too many times, skipping:', action.id);
        // Could mark as 'error' in draftDishes here
        continue;
      }

      try {
        switch (action.type) {
          case 'CREATE_DISH':
            await firebaseService.saveItem('dishes', action.payload, dishConverter);
            removeDraftDish(action.payload.id);
            break;
          case 'UPDATE_DISH':
            await firebaseService.saveItem('dishes', action.payload, dishConverter);
            removeDraftDish(action.payload.id);
            break;
          case 'DELETE_DISH':
            await firebaseService.deleteItem('dishes', action.payload);
            break;
          case 'ADD_INVENTORY':
            await firebaseService.saveItem('inventoryEvents', action.payload, inventoryEventConverter);
            break;
          case 'ADD_PRODUCTION':
            await firebaseService.saveItem('productions', action.payload, productionConverter);
            break;
        }
        await syncQueueService.markProcessed(action.id);
        await syncQueueService.dequeue(action.id);
      } catch (error) {
        console.error('Sync error:', error);
        await syncQueueService.incrementRetry(action.id);
        break;
      }
    }
  },
  getDraftStatus: (id) => {
    const draft = get().draftDishes[id];
    return draft ? draft.syncStatus : null;
  }
}),
{
  name: 'escandallo-storage',
      partialize: (state) => ({
        ui: state.ui,
        draftDishes: Object.fromEntries(
          Object.entries(state.draftDishes).slice(-20)
        )
      })
    }
  )
);
