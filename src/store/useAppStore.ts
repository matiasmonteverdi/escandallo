import { create } from 'zustand';
import { Dish, Production, InventoryEvent, InventorySnapshot, TRADITIONAL_DISHES, CatalogItem, CATALOG } from '../data';

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
  
  // Actions
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

const INITIAL_EVENTS: InventoryEvent[] = [
  { id: 'ev_1', type: 'PURCHASE', ingredientId: 'cat_harina', quantity: 5000, unit: 'g', costPerUnit: 0.0012, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_2', type: 'PURCHASE', ingredientId: 'cat_mantequilla', quantity: 2000, unit: 'g', costPerUnit: 0.008, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_3', type: 'PURCHASE', ingredientId: 'cat_carne_picada', quantity: 3000, unit: 'g', costPerUnit: 0.009, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_4', type: 'PURCHASE', ingredientId: 'cat_agua', quantity: 10000, unit: 'ml', costPerUnit: 0.0001, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_5', type: 'PURCHASE', ingredientId: 'cat_sal', quantity: 1000, unit: 'g', costPerUnit: 0.0005, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_6', type: 'PURCHASE', ingredientId: 'cat_huevo', quantity: 30, unit: 'ud', costPerUnit: 0.25, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
];

const INITIAL_PRODUCTIONS: Production[] = [
  {
    id: '1',
    recipeId: 'empanada_artesanal',
    date: new Date(Date.now() - 86400000).toISOString(),
    expectedQuantity: 8,
    quantityProduced: 8,
    notes: 'Prueba inicial de producción',
    variantSelection: {
      'Tipo de Relleno': 0
    }
  }
];

export const useAppStore = create<AppState>((set) => ({
  activePage: 'recipes',
  activeTab: 'traditional',
  view: 'selection',
  catalog: CATALOG,
  dishes: TRADITIONAL_DISHES,
  selectedDish: null,
  productions: INITIAL_PRODUCTIONS,
  inventoryEvents: INITIAL_EVENTS,
  inventorySnapshots: [],

  setActivePage: (activePage) => set({ activePage }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setView: (view) => set({ view }),
  setCatalog: (catalog) => set({ catalog }),
  setDishes: (dishes) => set({ dishes }),
  setSelectedDish: (selectedDish) => set({ selectedDish }),
  addDish: (dish) => set((state) => ({ dishes: [...state.dishes, dish] })),
  updateDish: (dish) => set((state) => ({
    dishes: state.dishes.map((d) => (d.id === dish.id ? dish : d)),
    selectedDish: state.selectedDish?.id === dish.id ? dish : state.selectedDish
  })),
  deleteDish: (dishId) => set((state) => ({
    dishes: state.dishes.filter((d) => d.id !== dishId),
    selectedDish: state.selectedDish?.id === dishId ? null : state.selectedDish,
    view: state.selectedDish?.id === dishId ? 'selection' : state.view
  })),

  setProductions: (productions) => set({ productions }),
  addProduction: (production) => set((state) => ({ productions: [...state.productions, production] })),

  setInventoryEvents: (inventoryEvents) => set({ inventoryEvents }),
  addInventoryEvent: (event) => set((state) => ({ inventoryEvents: [...state.inventoryEvents, event] })),
  addInventoryEvents: (events) => set((state) => ({ inventoryEvents: [...state.inventoryEvents, ...events] })),

  setInventorySnapshots: (inventorySnapshots) => set({ inventorySnapshots }),
  addInventorySnapshot: (snapshot) => set((state) => ({ inventorySnapshots: [...state.inventorySnapshots, snapshot] })),
}));
