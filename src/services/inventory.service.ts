import { InventoryEvent, InventorySnapshot } from '../domain/inventory';
import { assertValidEvent } from '../domain/invariants';

export function computeStockProjection(
  events: InventoryEvent[],
  snapshot: InventorySnapshot | null
): Record<string, { quantity: number; unit: string; cost: number }> {
  
  const baseStock = snapshot ? { ...snapshot.stock } : {};
  
  const eventsToProcess = snapshot 
    ? events.filter(ev => new Date(ev.timestamp) > new Date(snapshot.timestamp))
    : events;

  return eventsToProcess.reduce((acc, ev) => {
    assertValidEvent(ev);

    if (!acc[ev.ingredientId]) {
      // If we don't know the cost, default to 0. It will be updated by the first PURCHASE.
      acc[ev.ingredientId] = { quantity: 0, unit: ev.unit, cost: 0 };
    }

    const previousQuantity = acc[ev.ingredientId].quantity;
    const previousCost = acc[ev.ingredientId].cost;

    acc[ev.ingredientId].quantity += ev.quantity;
    
    // Weighted Average Cost (WAC) logic
    // Only update cost when NEW stock enters (quantity > 0) and it has a defined cost
    if ((ev.type === 'PURCHASE' || (ev.type === 'ADJUSTMENT' && ev.quantity > 0)) && ev.costPerUnit > 0) {
       if (previousQuantity <= 0) {
           // If stock was 0 or negative, reset the average cost to this new purchase cost
           acc[ev.ingredientId].cost = ev.costPerUnit;
       } else {
           // WAC Calculation: (Old Value + New Value) / Total New Quantity
           const totalValue = (previousQuantity * previousCost) + (ev.quantity * ev.costPerUnit);
           const totalQuantity = previousQuantity + ev.quantity;
           acc[ev.ingredientId].cost = totalValue / totalQuantity;
       }
    }

    return acc;
  }, baseStock);
}
