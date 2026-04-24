import { Dish } from '../data';
import { calculateDishCost } from '../App';

export interface BreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  type: 'ingredient' | 'subrecipe' | 'indirect';
}

export interface DishBreakdown {
  items: BreakdownItem[];
  directCost: number;
  indirectCost: number;
  totalCost: number;
}

/**
 * Generates a scaled breakdown of a dish's components.
 * Considers ingredients, sub-recipes, and indirect costs.
 */
export function getScaledDishBreakdown(
  dish: Dish,
  portionsToUse: number,
  inventoryStock: Record<string, { cost: number }> = {},
  catalog: any[] = []
): DishBreakdown {
  const factor = portionsToUse / dish.portions;
  const items: BreakdownItem[] = [];

  // 1. Ingredients
  dish.ingredients.forEach(ing => {
    const waste = ing.wastePercentage || 0;
    const grossQuantity = ing.quantity / (1 - (waste / 100));
    
    // Resolve name from catalog if possible
    const catItem = catalog.find(c => c.id === ing.catalogId);
    const name = catItem?.name || ing.catalogId;

    // Use a mini-calculation for this ingredient to get the exact cost used in the system
    // This handles live pricing logic automatically
    const tempDish: Dish = {
      ...dish,
      portions: 1,
      ingredients: [ing],
      subRecipes: [],
      variants: [],
      indirectCosts: []
    };
    
    const { totalCost } = calculateDishCost(tempDish, {}, inventoryStock);
    
    items.push({
      name,
      quantity: grossQuantity * factor,
      unit: ing.unit,
      cost: totalCost * factor,
      type: 'ingredient'
    });
  });

  // 2. Immediate Sub-recipes (as individual lines)
  (dish.subRecipes || []).forEach(sub => {
    items.push({
      name: `[Sub] ${sub.name}`,
      quantity: sub.quantity * factor,
      unit: 'raciones',
      cost: sub.costPerUnit * sub.quantity * factor,
      type: 'subrecipe'
    });
  });

  const fullResult = calculateDishCost(dish, {}, inventoryStock);

  return {
    items,
    directCost: fullResult.directCost * factor,
    indirectCost: fullResult.indirectCostsValue * factor,
    totalCost: fullResult.totalCost * factor
  };
}
