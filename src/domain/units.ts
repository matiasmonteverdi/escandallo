import { Unit, BaseUnit } from './types';

export const CONVERSIONS: Record<Exclude<Unit, BaseUnit>, { to: BaseUnit; factor: number }> = {
  'kg': { to: 'g', factor: 1000 },
  'l': { to: 'ml', factor: 1000 },
};

export type UnitFamily = 'mass' | 'volume' | 'unit';

export function getUnitFamily(unit: Unit): UnitFamily {
  if (unit === 'g' || unit === 'kg') return 'mass';
  if (unit === 'ml' || unit === 'l') return 'volume';
  return 'unit';
}

export function convertUnit(value: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return value;
  
  const familyFrom = getUnitFamily(fromUnit);
  const familyTo = getUnitFamily(toUnit);
  
  if (familyFrom !== familyTo) {
    throw new Error(`Cannot convert from ${familyFrom} to ${familyTo}`);
  }

  // Convert to base unit first
  let baseValue = value;
  if (fromUnit === 'kg' || fromUnit === 'l') {
    baseValue = value * 1000;
  }

  // Convert from base unit to target unit
  if (toUnit === 'kg' || toUnit === 'l') {
    return baseValue / 1000;
  }

  return baseValue;
}

export function isCompatibleUnit(from: Unit, to: BaseUnit): boolean {
  if (from === to) return true;
  if (from in CONVERSIONS) {
    return CONVERSIONS[from as keyof typeof CONVERSIONS].to === to;
  }
  return false;
}

export function normalizeQuantity(quantity: number, unit: Unit): { quantity: number; unit: BaseUnit } {
  if (unit === 'g' || unit === 'ml' || unit === 'ud') {
    return { quantity, unit };
  }

  const conversion = CONVERSIONS[unit as keyof typeof CONVERSIONS];
  if (!conversion) {
    throw new Error(`Unsupported unit conversion for: ${unit}`);
  }

  return {
    quantity: quantity * conversion.factor,
    unit: conversion.to
  };
}

export function normalizeCost(costPerUnit: number, unit: Unit): number {
  if (unit === 'g' || unit === 'ml' || unit === 'ud') {
    return costPerUnit;
  }

  const conversion = CONVERSIONS[unit as keyof typeof CONVERSIONS];
  if (!conversion) {
    throw new Error(`Unsupported unit conversion for: ${unit}`);
  }

  // If 1kg costs 2€, costPerUnit is 2.
  // We want cost per g. So 2 / 1000 = 0.002 €/g.
  return costPerUnit / conversion.factor;
}

export interface DisplayQuantity {
  value: number;
  unit: string;
  baseValue: number;
  baseUnit: BaseUnit;
}

export function formatNumber(num: number, maxDecimals: number = 2): string {
  return Number(num.toFixed(maxDecimals)).toString();
}

export function formatQuantityForDisplay(qty: number, baseUnit: BaseUnit): DisplayQuantity {
  const absQty = Math.abs(qty);
  if (baseUnit === 'g' && absQty >= 1000) {
    return { value: qty / 1000, unit: 'kg', baseValue: qty, baseUnit };
  }
  if (baseUnit === 'ml' && absQty >= 1000) {
    return { value: qty / 1000, unit: 'l', baseValue: qty, baseUnit };
  }
  return { value: qty, unit: baseUnit, baseValue: qty, baseUnit };
}

export function formatCostForDisplay(costPerBaseUnit: number, baseUnit: BaseUnit): DisplayQuantity {
  if (baseUnit === 'g') {
    return { value: costPerBaseUnit * 1000, unit: 'kg', baseValue: costPerBaseUnit, baseUnit };
  }
  if (baseUnit === 'ml') {
    return { value: costPerBaseUnit * 1000, unit: 'l', baseValue: costPerBaseUnit, baseUnit };
  }
  return { value: costPerBaseUnit, unit: baseUnit, baseValue: costPerBaseUnit, baseUnit };
}
