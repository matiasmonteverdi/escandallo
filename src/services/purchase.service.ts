import { PurchaseInput } from '../domain/purchase';
import { InventoryEvent } from '../domain/inventory';
import { normalizeQuantity } from '../domain/units';

export function createPurchaseEvent(input: PurchaseInput): InventoryEvent {
  // 1. Normalize quantity to BaseUnit (e.g., 2kg -> 2000g)
  const { quantity: normalizedQty, unit: baseUnit } = normalizeQuantity(input.quantity, input.unit);
  
  if (normalizedQty <= 0) {
    throw new Error("La cantidad de compra debe ser mayor que 0.");
  }

  // 2. Calculate cost per normalized unit (e.g., 4€ / 2000g = 0.002 €/g)
  // CRITICAL: This avoids the €/kg vs €/g bug.
  const costPerUnit = input.totalCost / normalizedQty;
  
  const eventId = `ev_pur_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: eventId,
    type: 'PURCHASE',
    ingredientId: input.ingredientId,
    quantity: normalizedQty,
    unit: baseUnit,
    costPerUnit,
    totalCost: input.totalCost, // Store exact total cost for auditing
    timestamp: new Date().toISOString(),
    source: 'purchase',
    batchId: `batch_${eventId}`, // Single event batch for manual purchases
    idempotencyKey: `idemp_${eventId}`, // In a real app, this might come from the client request
    causality: `Compra manual: ${input.quantity}${input.unit} por ${input.totalCost}€`
  };
}
