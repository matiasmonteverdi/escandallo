import { create } from 'zustand';
import { Dish, Production, InventoryEvent, InventorySnapshot, CatalogItem } from '../data';
import { firebaseService, catalogConverter, dishConverter, productionConverter, inventoryEventConverter } from '../services/firebase.service';

interface AppState {
  activePage: string;
  activeTab: 'traditional' | 'custom';
  view: 'selection' | 'result';
  catalog: CatalogItem[];
  dishes: Dish[];
  selectedDish: Dish | null;
  productions: Production[];
  inventoryEvents: InventoryEvent[];
  inventorySnapshots: InventorySnapshot[];
  
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Actions
  initSync: () => () => void; // Returns cleanup function
  setActivePage: (page: string) => void;
  setActiveTab: (tab: 'traditional' | 'custom') => void;
  setView: (view: 'selection' | 'result') => void;
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
}



export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'recipes',
  activeTab: 'traditional',
  view: 'selection',
  catalog: [],
  dishes: [],
  selectedDish: null,
  productions: [],
  inventoryEvents: [],
  inventorySnapshots: [],
  loading: true,

  setLoading: (loading) => set({ loading }),

  initSync: () => {
    const unsubCatalog = firebaseService.subscribeToCollection('catalog', catalogConverter, (catalog) => set({ catalog }));
    const unsubDishes = firebaseService.subscribeToCollection('dishes', dishConverter, (dishes) => set({ dishes }));
    const unsubProductions = firebaseService.subscribeToCollection('productions', productionConverter, (productions) => set({ productions }));
    const unsubEvents = firebaseService.subscribeToCollection('inventoryEvents', inventoryEventConverter, (inventoryEvents) => {
      set({ inventoryEvents, loading: false });
    });

    return () => {
      unsubCatalog();
      unsubDishes();
      unsubProductions();
      unsubEvents();
    };
  },

  setActivePage: (activePage) => set({ activePage }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setView: (view) => set({ view }),
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
      view: state.selectedDish?.id === dishId ? 'selection' : state.view
    }));
  },

  setProductions: (productions) => set({ productions }),
  addProduction: async (production) => {
    await firebaseService.saveItem('productions', production, productionConverter);
  },

  setInventoryEvents: (inventoryEvents) => set({ inventoryEvents }),
  addInventoryEvent: async (event) => {
    await firebaseService.saveItem('inventoryEvents', event, inventoryEventConverter);
  },
  addInventoryEvents: async (events) => {
    for (const event of events) {
      await firebaseService.saveItem('inventoryEvents', event, inventoryEventConverter);
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
      const needsUpdate = checkInactive(dish);
      if (dish.hasInactiveIngredients !== needsUpdate) {
        const updatedDish = { ...dish, hasInactiveIngredients: needsUpdate };
        await firebaseService.saveItem('dishes', updatedDish, dishConverter);
      }
    }
  }
}));

