import { BaseUnit, InventoryEventType, EventSource } from './types';

export interface InventoryEvent {
  id: string;
  type: InventoryEventType;
  ingredientId: string;
  quantity: number;
  unit: BaseUnit;
  costPerUnit: number;
  totalCost?: number; // Added to prevent rounding errors and facilitate auditing
  timestamp: string;
  source: EventSource;
  referenceId?: string;
  batchId?: string; // For atomic transactions
  idempotencyKey?: string; // To prevent duplicate events
  causality?: string; // Human readable reason (e.g., "Producido: Empanada x8")
}

export interface InventorySnapshot {
  id: string;
  timestamp: string;
  lastEventId: string;
  stock: Record<string, { quantity: number; unit: BaseUnit; cost: number }>;
}
