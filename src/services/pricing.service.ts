import { Unit } from '../domain/types';
import { normalizeQuantity } from '../domain/units';

export interface ResolveIngredientCostInput {
  wacPerBaseUnit?: number;
  manualCostPerUsageUnit?: number;
  usageUnit: Unit;
  preferInventoryPrice: boolean;
}

export interface ResolvedIngredientCost {
  costPerUsageUnit: number;
  source: 'inventory' | 'manual';
}

export function resolveIngredientCost(input: ResolveIngredientCostInput): ResolvedIngredientCost {
  const { wacPerBaseUnit, manualCostPerUsageUnit, usageUnit, preferInventoryPrice } = input;

  if (preferInventoryPrice && wacPerBaseUnit && wacPerBaseUnit > 0) {
    const { quantity: usageQtyInBase } = normalizeQuantity(1, usageUnit);
    return {
      costPerUsageUnit: wacPerBaseUnit * usageQtyInBase,
      source: 'inventory'
    };
  }

  if (!manualCostPerUsageUnit || manualCostPerUsageUnit <= 0) {
    throw new Error('Debes indicar un coste manual mayor que 0 cuando no hay precio de inventario disponible.');
  }

  return {
    costPerUsageUnit: manualCostPerUsageUnit,
    source: 'manual'
  };
}
