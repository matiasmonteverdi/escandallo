import { InventoryEvent } from './inventory';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function assertValidEvent(event: InventoryEvent): void {
  if (event.quantity === 0 && event.type !== 'ADJUSTMENT') {
    throw new DomainError(`Event quantity cannot be zero unless it's a cost adjustment. Event ID: ${event.id}`);
  }

  if (event.type === 'CONSUMPTION' && event.quantity > 0) {
    throw new DomainError(`CONSUMPTION events must have negative quantity. Event ID: ${event.id}`);
  }

  if (event.type === 'PURCHASE' && event.quantity < 0) {
    throw new DomainError(`PURCHASE events must have positive quantity. Event ID: ${event.id}`);
  }

  if (event.costPerUnit < 0) {
    throw new DomainError(`Cost per unit cannot be negative. Event ID: ${event.id}`);
  }

  if (!event.ingredientId) {
    throw new DomainError(`Ingredient ID is required. Event ID: ${event.id}`);
  }
}
