import { Unit } from './types';

export interface PurchaseInput {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  totalCost: number;
}
