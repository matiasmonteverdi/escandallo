import { InventoryEvent, Production } from '../data';
import { firebaseService, catalogConverter, dishConverter, productionConverter, inventoryEventConverter } from './firebase.service';
import { CATALOG, TRADITIONAL_DISHES } from '../data';

const INITIAL_EVENTS: InventoryEvent[] = [
  { id: 'ev_1', type: 'PURCHASE', ingredientId: 'cat_harina', quantity: 5000, unit: 'g', costPerUnit: 0.0012, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_2', type: 'PURCHASE', ingredientId: 'cat_mantequilla', quantity: 2000, unit: 'g', costPerUnit: 0.008, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_3', type: 'PURCHASE', ingredientId: 'cat_carne_picada', quantity: 3000, unit: 'g', costPerUnit: 0.009, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_4', type: 'PURCHASE', ingredientId: 'cat_agua', quantity: 10000, unit: 'ml', costPerUnit: 0.0001, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_5', type: 'PURCHASE', ingredientId: 'cat_sal', quantity: 1000, unit: 'g', costPerUnit: 0.0005, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
  { id: 'ev_6', type: 'PURCHASE', ingredientId: 'cat_huevo', quantity: 30, unit: 'ud', costPerUnit: 0.25, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), source: 'purchase' },
];

const INITIAL_PRODUCTIONS: Production[] = [
  {
    id: 'prod_initial_1',
    recipeId: 'empanada_artesanal',
    date: new Date(Date.now() - 86400000).toISOString(),
    expectedQuantity: 8,
    quantityProduced: 8,
    notes: 'Prueba inicial de producción',
    variantSelection: {
      'Tipo de Relleno': 0
    }
  }
];
import { CATALOG, TRADITIONAL_DISHES } from '../data';

// Note: INITIAL_EVENTS and INITIAL_PRODUCTIONS are currently defined in useAppStore.ts
// In a real migration, we might want to move them here or just use what's in useAppStore.ts
// For now, let's seed the main Master Data.

export const seedDatabase = async () => {
  try {
    // 1. Seed Catalog
    const isCatalogEmpty = await firebaseService.isCollectionEmpty('catalog');
    if (isCatalogEmpty) {
      console.log('Seeding Catalog...');
      for (const item of CATALOG) {
        await firebaseService.saveItem('catalog', item, catalogConverter);
      }
    }

    // 2. Seed Dishes
    const isDishesEmpty = await firebaseService.isCollectionEmpty('dishes');
    if (isDishesEmpty) {
      console.log('Seeding Dishes...');
      for (const dish of TRADITIONAL_DISHES) {
        await firebaseService.saveItem('dishes', dish, dishConverter);
      }
    }

    // 3. Seed Productions
    const isProductionsEmpty = await firebaseService.isCollectionEmpty('productions');
    if (isProductionsEmpty) {
      console.log('Seeding Productions...');
      for (const prod of INITIAL_PRODUCTIONS) {
        await firebaseService.saveItem('productions', prod, productionConverter);
      }
    }

    // 4. Seed Inventory Events
    const isEventsEmpty = await firebaseService.isCollectionEmpty('inventoryEvents');
    if (isEventsEmpty) {
      console.log('Seeding Inventory Events...');
      for (const event of INITIAL_EVENTS) {
        await firebaseService.saveItem('inventoryEvents', event, inventoryEventConverter);
      }
    }

    console.log('Firebase Seeding Check Complete.');
  } catch (error) {
    console.error('Error seeding firebase:', error);
  }
};
