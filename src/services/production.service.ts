import { Dish, CatalogItem } from '../data';

import { InventoryEvent } from '../domain/inventory';
import { Production } from '../domain/production';
import { ProductionMode } from '../domain/types';
import { normalizeQuantity, normalizeCost } from '../domain/units';

export interface PreFlightResult {
  canProduce: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProductionResult {
  events: InventoryEvent[];
  simulated: boolean;
  skippedIngredientIds: string[];
}

function normalizeIngredient<T extends { consumeStock?: boolean }>(ingredient: T): T & { consumeStock: boolean } {
  return {
    ...ingredient,
    consumeStock: ingredient.consumeStock ?? true
  };
}

export function validateRecipeAvailability(
  dish: Dish,
  quantityProduced: number,
  allDishes: Dish[],
  catalog: CatalogItem[],
  stockProjection: Record<string, number>,
  variantSelection?: Record<string, number>,
  mode: ProductionMode = 'real'
): PreFlightResult {
  const result: PreFlightResult = { canProduce: true, errors: [], warnings: [] };
  const mockProd: Production = {
    id: 'mock',
    recipeId: dish.id,
    date: '',
    expectedQuantity: dish.portions,
    quantityProduced,
    variantSelection: variantSelection || {},
    mode
  };

  // 1. Check inactive explicitly to gather all errors
  const checkInactive = (currentDish: Dish) => {
    currentDish.ingredients.forEach(ing => {
      const catItem = catalog.find(c => c.id === ing.catalogId);
      if (!catItem || !catItem.active) {
        if (!result.errors.includes(`La receta usa '${catItem?.name || ing.catalogId}' (Ingrediente desactivado / obsoleto).`)) {
          result.errors.push(`La receta usa '${catItem?.name || ing.catalogId}' (Ingrediente desactivado / obsoleto).`);
        }
      }
    });

    if (currentDish.subRecipes) {
      currentDish.subRecipes.forEach(subReq => {
        const subDish = allDishes.find(d => d.id === subReq.dishId);
        if (subDish) checkInactive(subDish);
      });
    }

    if (currentDish.variants && currentDish.id === dish.id) {
       currentDish.variants.forEach(group => {
        const selectedIdx = variantSelection?.[group.name] || 0;
        const option = group.options[selectedIdx];
        if (option && option.catalogId) {
          const catItem = catalog.find(c => c.id === option.catalogId);
          if (!catItem || !catItem.active) {
             if (!result.errors.includes(`La variante '${option.name}' usa un ingrediente desactivado.`)) {
                result.errors.push(`La variante '${option.name}' usa un ingrediente desactivado.`);
             }
          }
        }
      });
    }
  };

  checkInactive(dish);

  if (result.errors.length > 0) {
    result.canProduce = false;
    return result; 
  }

  // 2. Simulate consumption assuming active valid data
  try {
    const productionResult = generateProductionResult(mockProd, dish, allDishes, catalog);
    if (productionResult.simulated) {
      return result;
    }

    const events = productionResult.events;
    const consumptionByItem: Record<string, number> = {};
    events.forEach(ev => {
      if (ev.type === 'CONSUMPTION') {
        consumptionByItem[ev.ingredientId] = (consumptionByItem[ev.ingredientId] || 0) + Math.abs(ev.quantity);
      }
    });

    for (const [ingId, qtyNeeded] of Object.entries(consumptionByItem)) {
      const currentStock = stockProjection[ingId] || 0;
      if (qtyNeeded > currentStock) {
        const catItem = catalog.find(c => c.id === ingId);
        result.warnings.push(`Stock insuficiente de ${catItem?.name || ingId}: Requieres ${qtyNeeded.toFixed(2)}, tienes ${currentStock.toFixed(2)}.`);
      }
    }
  } catch (e) {
    result.errors.push((e as Error).message);
    result.canProduce = false;
  }

  return result;
}

export function generateConsumptionEventsForProduction(
  production: Production,
  dish: Dish,
  allDishes: Dish[],
  catalog: CatalogItem[]
): InventoryEvent[] {
  return generateProductionResult(production, dish, allDishes, catalog).events;
}

export function generateProductionResult(
  production: Production,
  dish: Dish,
  allDishes: Dish[],
  catalog: CatalogItem[]
): ProductionResult {
  const mode = production.mode ?? 'real';

  if (mode === 'theoretical') {
    return {
      events: [],
      simulated: true,
      skippedIngredientIds: []
    };
  }

  const { events, skippedIngredientIds } = generateConsumptionEventsInternal(production, dish, allDishes, catalog, mode);
  return {
    events,
    simulated: false,
    skippedIngredientIds
  };
}

function generateConsumptionEventsInternal(
  production: Production,
  dish: Dish,
  allDishes: Dish[],
  catalog: CatalogItem[],
  mode: ProductionMode
): { events: InventoryEvent[]; skippedIngredientIds: string[] } {
  if (mode === 'theoretical') {
    return { events: [], skippedIngredientIds: [] };
  }

  // --- DOMAIN VALIDATION (Fuente de Verdad) ---
  const validateInactive = (currentDish: Dish, variantSelection?: Record<string, number>) => {
    // 1. Ingredients
    currentDish.ingredients.forEach(ing => {
      const catItem = catalog.find(c => c.id === ing.catalogId);
      if (!catItem || !catItem.active) {
        throw new Error(`La receta '${dish.name}' utiliza el ingrediente '${catItem?.name || ing.catalogId}' que está desactivado.`);
      }
    });

    // 2. Subrecipes
    if (currentDish.subRecipes) {
      currentDish.subRecipes.forEach(subReq => {
        const subDish = allDishes.find(d => d.id === subReq.dishId);
        if (subDish) validateInactive(subDish);
      });
    }

    // 3. Variants
    if (currentDish.variants) {
      currentDish.variants.forEach(group => {
        const selectedIdx = variantSelection?.[group.name] || 0;
        const option = group.options[selectedIdx];
        if (option && option.catalogId) {
          const catItem = catalog.find(c => c.id === option.catalogId);
          if (!catItem || !catItem.active) {
            throw new Error(`La variante '${option.name}' de la receta '${dish.name}' utiliza un ingrediente desactivado.`);
          }
        }
      });
    }
  };

  validateInactive(dish, production.variantSelection);
  // ------------------------------------------

  const newEvents: InventoryEvent[] = [];
  const skippedIngredientIds = new Set<string>();

  const batchId = `batch_${production.id}`;
  const idempotencyKey = `prod_${production.id}`;
  const ratio = production.quantityProduced / dish.portions;

  function consumeRecipe(currentDish: Dish, currentRatio: number, variantSelection?: Record<string, number>) {
    // 1. Base ingredients
    currentDish.ingredients.forEach(rawIngredient => {
      const ing = normalizeIngredient(rawIngredient);
      if (!ing.consumeStock) {
        skippedIngredientIds.add(ing.catalogId);
        return;
      }

      const waste = ing.wastePercentage || 0;
      const grossQuantity = ing.quantity / (1 - (waste / 100));
      const consumedQty = grossQuantity * currentRatio;
      
      // Normalize to BaseUnit before creating the event
      const { quantity: normalizedQty, unit: baseUnit } = normalizeQuantity(consumedQty, ing.unit);
      // Cost in ledger goes to base unit as well
      const normalizedCost = normalizeCost(ing.costPerUnit, ing.unit);

      newEvents.push({
        id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'CONSUMPTION',
        ingredientId: ing.catalogId,
        quantity: -normalizedQty, // Negative for consumption
        unit: baseUnit,
        costPerUnit: normalizedCost,
        timestamp: new Date().toISOString(),
        source: 'production',
        referenceId: production.id,
        batchId,
        idempotencyKey,
        causality: currentDish.id === dish.id 
          ? `Producido: ${dish.name} x${production.quantityProduced}`
          : `Producido: ${dish.name} x${production.quantityProduced} (vía Subreceta: ${currentDish.name})`
      });
    });

    // 2. Subrecipes (Recursive consumption)
    if (currentDish.subRecipes) {
      currentDish.subRecipes.forEach(subReq => {
        const subDish = allDishes.find(d => d.id === subReq.dishId);
        if (subDish) {
          // subReq.quantity is in "raciones". 
          // We figure out the scaling factor for the subrecipe based on how many portions of it we need
          const subRatio = (subReq.quantity / subDish.portions) * currentRatio;
          consumeRecipe(subDish, subRatio); // Variants selection usually doesn't cascade, so passed as undefined
        }
      });
    }

    // 3. Variant ingredients (only apply at the top level dish for now)
    if (currentDish.variants && currentDish.id === dish.id) {
      currentDish.variants.forEach(group => {
        const selectedIdx = variantSelection?.[group.name] || 0;
        const option = group.options[selectedIdx];
        if (option && option.name !== 'Sin variante') {
          const consumedQty = option.quantity * currentRatio;
          
          const { quantity: normalizedQty, unit: baseUnit } = normalizeQuantity(consumedQty, option.unit);
          const normalizedCost = normalizeCost(option.costPerUnit, option.unit);

          if (option.catalogId) {
            newEvents.push({
              id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'CONSUMPTION',
              ingredientId: option.catalogId,
              quantity: -normalizedQty,
              unit: baseUnit,
              costPerUnit: normalizedCost,
              timestamp: new Date().toISOString(),
              source: 'production',
              referenceId: production.id,
              batchId,
              idempotencyKey,
              causality: `Producido: ${dish.name} x${production.quantityProduced} (${option.name})`
            });
          }
        }
      });
    }
  }

  // Start recursion
  consumeRecipe(dish, ratio, production.variantSelection);

  return {
    events: newEvents,
    skippedIngredientIds: Array.from(skippedIngredientIds)
  };
}
