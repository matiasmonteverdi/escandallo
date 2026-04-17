import { Unit } from './domain/types';
import { InventoryEvent, InventorySnapshot } from './domain/inventory';
import { Production } from './domain/production';

// CATÁLOGO MAESTRO (Fuente de verdad)
export type CatalogItem = {
  id: string; // UUID
  name: string; // "Harina de trigo", "Limón"
  defaultUnit: Unit;
  baseCost: number; // Coste de referencia
};

// INGREDIENTE EN ESCANDALLO
export type Ingredient = {
  catalogId: string; // Apunta al CatalogItem.id
  quantity: number;
  unit: Unit;
  costPerUnit: number; // Coste teórico estático usado para referencias
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
};

export { type InventoryEvent, type InventorySnapshot, type Production };

// ---- DATOS INICALES MOCKEADOS CON UUIDS ---- //

export const CATALOG: CatalogItem[] = [
  { id: 'cat_harina', name: 'Harina de trigo', defaultUnit: 'kg', baseCost: 1.20 },
  { id: 'cat_mantequilla', name: 'Mantequilla', defaultUnit: 'kg', baseCost: 8.00 },
  { id: 'cat_agua', name: 'Agua', defaultUnit: 'l', baseCost: 0.10 },
  { id: 'cat_sal', name: 'Sal', defaultUnit: 'kg', baseCost: 0.50 },
  { id: 'cat_huevo', name: 'Huevo (M)', defaultUnit: 'ud', baseCost: 0.25 },
  { id: 'cat_carne_picada', name: 'Carne Picada', defaultUnit: 'kg', baseCost: 9.00 },
  { id: 'cat_atun', name: 'Atún en lata', defaultUnit: 'kg', baseCost: 15.00 },
  { id: 'cat_espinacas', name: 'Espinacas frescas', defaultUnit: 'kg', baseCost: 11.00 },
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
    ]
  }
];
