import QRCode from 'qrcode';
import { Dish, CatalogItem } from '../data';
import { calculateDishCost } from '../App';
import { formatCostForDisplay, formatQuantityForDisplay } from '../domain/units';

export interface PDFIngredient {
  name: string;
  quantity: string;
  unit: string;
  costPerHumanUnit: string;
  humanUnit: string;
  totalCost: string;
  isMain: boolean;
}

export interface PDFModel {
  identity: {
    id: string;
    name: string;
    portions: number;
    generatedAt: string;
    version: string;
    qrDataUrl: string;
  };
  kitchen: {
    ingredients: PDFIngredient[];
    instructions: string;
    notes: string;
    allergens: string[];
    hasChecklist: boolean;
  };
  manager: {
    ingredientsCost: string;
    subRecipesCost: string;
    variantsCost: string;
    indirectCostsValue: string;
    directCost: string;
    totalCost: string;
    costPerPortion: string;
    costSnapshotSource: 'manual' | 'inventory_wac';
  };
}

/**
 * Mapea un Dish a un modelo determinista optimizado para el PDF.
 * Realiza conversiones a unidades humanas (€/kg, €/l) y genera el QR localmente.
 */
export async function mapRecipeToPDFModel(
  dish: Dish,
  catalog: CatalogItem[],
  selectedVariants: Record<string, number>,
  inventoryStock: Record<string, { cost: number }>
): Promise<PDFModel> {
  const { 
    totalCost, 
    costPerPortion, 
    ingredientsCost, 
    subRecipesCost, 
    variantsCost, 
    indirectCostsValue, 
    directCost 
  } = calculateDishCost(dish, selectedVariants, inventoryStock);

  // Determinar la fuente predominante de los costes
  const hasLiveStock = Object.keys(inventoryStock).length > 0;
  const costSnapshotSource = hasLiveStock ? 'inventory_wac' : 'manual';

  // Generar QR de forma LOCAL (DataURL) apuntando al escandallo específico via hash
  const appUrl = window.location.origin + window.location.pathname;
  const qrDataUrl = await QRCode.toDataURL(`${appUrl}#dish=${dish.id}`);

  // Mapear ingredientes a formato humano
  const ingredients: PDFIngredient[] = dish.ingredients.map(ing => {
    const catalogItem = catalog.find(c => c.id === ing.catalogId);
    const name = catalogItem?.name || 'Ingrediente desconocido';
    
    const displayQty = formatQuantityForDisplay(ing.quantity, ing.unit as any);
    const displayCost = formatCostForDisplay(ing.costPerUnit, ing.unit as any);
    
    const itemTotal = ing.quantity * ing.costPerUnit;

    return {
      name,
      quantity: displayQty.value.toFixed(2),
      unit: displayQty.unit,
      costPerHumanUnit: displayCost.value.toFixed(2),
      humanUnit: displayCost.unit,
      totalCost: itemTotal.toFixed(2),
      isMain: true
    };
  });

  // Mapear alérgenos activos
  const activeAllergens = Object.entries(dish.allergens || {})
    .filter(([_, active]) => active)
    .map(([name, _]) => name);

  return {
    identity: {
      id: dish.id,
      name: dish.name,
      portions: dish.portions,
      generatedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      version: dish.version || '1.0.0',
      qrDataUrl
    },
    kitchen: {
      ingredients,
      instructions: dish.instructions || 'Sin instrucciones de preparación registradas.',
      notes: dish.notes || '',
      allergens: activeAllergens,
      hasChecklist: true
    },
    manager: {
      ingredientsCost: ingredientsCost.toFixed(2),
      subRecipesCost: subRecipesCost.toFixed(2),
      variantsCost: variantsCost.toFixed(2),
      indirectCostsValue: indirectCostsValue.toFixed(2),
      directCost: directCost.toFixed(2),
      totalCost: totalCost.toFixed(2),
      costPerPortion: costPerPortion.toFixed(2),
      costSnapshotSource
    }
  };
}
