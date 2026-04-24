import { ProductionMode } from './types';

export interface Production {
  id: string;
  recipeId: string;
  date: string;
  expectedQuantity: number;
  quantityProduced: number;
  notes?: string;
  variantSelection?: Record<string, number>;
  mode?: ProductionMode;
  isDemoData?: boolean;
}
