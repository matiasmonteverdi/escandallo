import { Dish } from '../data';
import { InventoryEvent } from '../domain/inventory';
import { Production } from '../domain/production';
import { normalizeQuantity, normalizeCost } from '../domain/units';

export function generateConsumptionEventsForProduction(
  production: Production,
  dish: Dish,
  allDishes: Dish[]
): InventoryEvent[] {
  const newEvents: InventoryEvent[] = [];
  const batchId = `batch_${production.id}`;
  const idempotencyKey = `prod_${production.id}`;
  const ratio = production.quantityProduced / dish.portions;

  function consumeRecipe(currentDish: Dish, currentRatio: number, variantSelection?: Record<string, number>) {
    // 1. Base ingredients
    currentDish.ingredients.forEach(ing => {
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

  return newEvents;
}
