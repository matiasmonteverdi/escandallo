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
}));
