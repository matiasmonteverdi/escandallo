import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { InventoryPage } from './pages/InventoryPage';
import { ProductionPage } from './pages/ProductionPage';
import { DebugLedgerPage } from './pages/DebugLedgerPage';
import { RecipesPage } from './pages/RecipesPage';
import { DashboardPage } from './pages/DashboardPage';
import { normalizeQuantity } from './domain/units';

// We keep this exported for any other components that might need it, 
// though ideally it should be in a service.
export const calculateDishCost = (dish: any, selectedVariants: Record<string, number> = {}, inventoryStock: Record<string, {cost: number}> = {}) => {
  const ingredientsCost = dish.ingredients.reduce((acc: number, ing: any) => {
    const waste = ing.wastePercentage || 0;
    const grossQuantity = ing.quantity / (1 - (waste / 100));
    
    const liveBaseCost = inventoryStock[ing.name]?.cost;
    if (liveBaseCost && liveBaseCost > 0) {
      const { quantity: baseQty } = normalizeQuantity(grossQuantity, ing.unit);
      return acc + (baseQty * liveBaseCost);
    }
    
    return acc + (grossQuantity * ing.costPerUnit);
  }, 0);

  const subRecipesCost = (dish.subRecipes || []).reduce((acc: number, sub: any) => {
    // Si usamos recursividad real deberíamos recalcular la subreceta, pero por ahora permitimos usar sub.costPerUnit
    return acc + (sub.quantity * sub.costPerUnit);
  }, 0);

  let variantsCost = 0;
  if (dish.variants) {
    dish.variants.forEach((group: any) => {
      const selectedIdx = selectedVariants[group.name] || 0;
      const option = group.options[selectedIdx];
      if (option && option.name !== 'Sin variante') {
        const liveBaseCost = inventoryStock[option.name]?.cost;
        if (liveBaseCost && liveBaseCost > 0) {
          const { quantity: baseQty } = normalizeQuantity(option.quantity, option.unit);
          variantsCost += baseQty * liveBaseCost;
        } else {
          variantsCost += option.quantity * option.costPerUnit;
        }
      }
    });
  }

  const directCost = ingredientsCost + subRecipesCost + variantsCost;

  const indirectCostsValue = (dish.indirectCosts || []).reduce((acc: number, ic: any) => {
    if (ic.type === 'fixed') return acc + ic.value;
    if (ic.type === 'percentage') return acc + (directCost * (ic.value / 100));
    return acc;
  }, 0);

  const totalCost = directCost + indirectCostsValue;
  const costPerPortion = totalCost / dish.portions;

  return { totalCost, costPerPortion, ingredientsCost, subRecipesCost, variantsCost, indirectCostsValue, directCost };
};

function App() {
  const [activePage, setActivePage] = useState<string>('dashboard');

  return (
    <Layout activePage={activePage} onPageChange={setActivePage}>
      {activePage === 'dashboard' && <DashboardPage onNavigate={setActivePage} />}
      {activePage === 'recipes' && <RecipesPage />}
      {activePage === 'production' && <ProductionPage />}
      {activePage === 'inventory' && <InventoryPage />}
      {activePage === 'debug' && <DebugLedgerPage />}

      {activePage !== 'dashboard' && activePage !== 'recipes' && activePage !== 'production' && activePage !== 'inventory' && activePage !== 'debug' && (
        <div className="p-6 md:p-8 flex items-center justify-center h-full text-slate-400">
          Módulo en construcción
        </div>
      )}
    </Layout>
  );
}

export default App;
