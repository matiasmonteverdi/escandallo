import { Unit } from './domain/types';
import { InventoryEvent, InventorySnapshot } from './domain/inventory';
import { Production } from './domain/production';

// CATÁLOGO MAESTRO (Fuente de verdad)
export type CatalogItem = {
  id: string; // UUID
  name: string; // "Harina de trigo", "Limón"
  defaultUnit: Unit;
  baseCost: number; // Coste de referencia
  active: boolean; // Mandatory for ERP consistency
  deletedAt?: string;
  isDemoData?: boolean;
};


// INGREDIENTE EN ESCANDALLO
export type Ingredient = {
  catalogId: string; // Apunta al CatalogItem.id
  quantity: number;
  unit: Unit;
  costPerUnit: number; // Coste teórico estático usado para referencias
  priceSource?: 'inventory' | 'manual';
  consumeStock?: boolean;
  wastePercentage?: number;
  purchasePrice?: number;
  purchaseQuantity?: number;
  purchaseUnit?: Unit;
};

export type SubRecipeUsage = {
  dishId: string;
  name: string;
  quantity: number;
  unit: Unit;
  costPerUnit: number;
};

export type VariantOption = {
  dishId?: string;
  catalogId?: string; // Para ligarlo a un ingrediente en caso de variantes puras
  name: string;
  quantity: number;
  unit: Unit;
  costPerUnit: number;
};

export type VariantGroup = {
  name: string;
  options: VariantOption[];
};

export type IndirectCost = {
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
};

export type Dish = {
  id: string;
  name: string;
  portions: number;
  ingredients: Ingredient[];
  subRecipes?: SubRecipeUsage[];
  variants?: VariantGroup[];
  indirectCosts?: IndirectCost[];
  defaultConsumeStock?: boolean;
  sellingPrice?: number; // PVP — precio de venta al público
  hasInactiveIngredients?: boolean; // Optimization flag
  instructions?: string;
  notes?: string;
  allergens?: Record<string, boolean>; // 14 EU Allergens
  version?: string;
  lastUpdated?: string;
  isDemoData?: boolean;
};

export const ALLERGENS_LIST = [
  'Gluten', 'Crustáceos', 'Huevos', 'Pescado', 'Cacahuetes', 'Soja', 'Lácteos', 
  'Frutos secos', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces', 'Moluscos'
] as const;


export { type InventoryEvent, type InventorySnapshot, type Production };

// ---- DATOS INICALES MOCKEADOS CON UUIDS ---- //

export const CATALOG: CatalogItem[] = [
  { id: 'cat_harina', name: 'Harina de trigo', defaultUnit: 'kg', baseCost: 1.20, active: true },
  { id: 'cat_mantequilla', name: 'Mantequilla', defaultUnit: 'kg', baseCost: 8.00, active: true },
  { id: 'cat_agua', name: 'Agua', defaultUnit: 'l', baseCost: 0.10, active: true },
  { id: 'cat_sal', name: 'Sal', defaultUnit: 'kg', baseCost: 0.50, active: true },
  { id: 'cat_huevo', name: 'Huevo (M)', defaultUnit: 'ud', baseCost: 0.25, active: true },
  { id: 'cat_carne_picada', name: 'Carne Picada', defaultUnit: 'kg', baseCost: 9.00, active: true },
  { id: 'cat_atun', name: 'Atún en lata', defaultUnit: 'kg', baseCost: 15.00, active: true },
  { id: 'cat_espinacas', name: 'Espinacas frescas', defaultUnit: 'kg', baseCost: 11.00, active: true },
];


export const TRADITIONAL_DISHES: Dish[] = [
  {
    id: 'empanada_artesanal',
    name: 'Empanada Artesanal',
    portions: 8,
    ingredients: [
      { catalogId: 'cat_harina', quantity: 500, unit: 'g', costPerUnit: 0.0012 },
      { catalogId: 'cat_mantequilla', quantity: 250, unit: 'g', costPerUnit: 0.008 },
      { catalogId: 'cat_agua', quantity: 150, unit: 'ml', costPerUnit: 0.0001 },
      { catalogId: 'cat_sal', quantity: 10, unit: 'g', costPerUnit: 0.0005 },
      { catalogId: 'cat_huevo', quantity: 1, unit: 'ud', costPerUnit: 0.25 },
    ],
    variants: [
      {
        name: 'Tipo de Relleno',
        options: [
          { catalogId: 'cat_carne_picada', name: 'Carne Picada y Huevo', quantity: 600, unit: 'g', costPerUnit: 0.009 },
          { catalogId: 'cat_atun', name: 'Atún y Pimiento', quantity: 500, unit: 'g', costPerUnit: 0.015 },
          { catalogId: 'cat_espinacas', name: 'Espinacas y Queso de Cabra', quantity: 550, unit: 'g', costPerUnit: 0.011 },
        ]
      }
    ],
    indirectCosts: [
      { name: 'Packaging (Caja)', type: 'fixed', value: 0.50 }
    ],
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    instructions: '1. Preparar la masa con harina y mantequilla.\n2. Dejar reposar.\n3. Rellenar y hornear a 180ºC durante 45 min.',
    allergens: { 'Gluten': true, 'Huevos': true, 'Lácteos': true }
  }
];
