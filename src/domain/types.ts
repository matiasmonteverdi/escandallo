export type BaseUnit = 'g' | 'ml' | 'ud';
export type Unit = BaseUnit | 'kg' | 'l';
export type RecipeUnit = Unit | 'raciones';

export type InventoryEventType = 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT';

export type EventSource = 'production' | 'manual' | 'purchase';

export type IndirectCostType = 'fixed' | 'percentage';
