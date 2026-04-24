import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { CatalogItem, Dish, Ingredient, Production, InventoryEvent } from '../data';
import { firebaseService, catalogConverter, dishConverter, productionConverter, inventoryEventConverter } from './firebase.service';
import { generateConsumptionEventsForProduction } from './production.service';

export const exampleDataService = {
  /**
   * Drops all content to reset the entire database to an empty state.
   */
  async wipeDatabase() {
    console.log('Wiping all database collections...');
    const collectionsToClean = ['inventoryEvents', 'productions', 'catalog', 'dishes', 'inventorySnapshots'];
    
    for (const collName of collectionsToClean) {
      const q = collection(db, collName);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      const totalDocs = docs.length;
      
      if (totalDocs === 0) continue;

      for (let i = 0; i < totalDocs; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  },

  /**
   * Clears only the data marked as demo.
   */
  async clearDemoData() {
    console.log('Clearing existing demo data...');
    const collections = ['catalog', 'dishes', 'productions', 'inventoryEvents'];
    
    for (const collName of collections) {
      const q = query(collection(db, collName), where('isDemoData', '==', true));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      
      if (docs.length === 0) continue;

      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  },

  /**
   * Seeds the professional example dataset.
   * Idempotent: Clears demo data first.
   */
  async seedDemoDataset() {
    // 1. Clean previous demo data to avoid duplicates
    await this.clearDemoData();

    // 2. Define Catalog (Professional Demo)
    const catalogItems: CatalogItem[] = [
      { id: 'demo_cat_harina', name: '[DEMO] Harina de trigo', defaultUnit: 'kg', baseCost: 1.20, active: true, isDemoData: true },
      { id: 'demo_cat_mantequilla', name: '[DEMO] Mantequilla', defaultUnit: 'kg', baseCost: 8.00, active: true, isDemoData: true },
      { id: 'demo_cat_agua', name: '[DEMO] Agua', defaultUnit: 'l', baseCost: 0.10, active: true, isDemoData: true },
      { id: 'demo_cat_sal', name: '[DEMO] Sal', defaultUnit: 'kg', baseCost: 0.50, active: true, isDemoData: true },
      { id: 'demo_cat_huevo', name: '[DEMO] Huevo (M)', defaultUnit: 'ud', baseCost: 0.25, active: true, isDemoData: true },
      { id: 'demo_cat_carne_picada', name: '[DEMO] Carne Picada', defaultUnit: 'kg', baseCost: 9.00, active: true, isDemoData: true },
      { id: 'demo_cat_atun', name: '[DEMO] Atún en lata', defaultUnit: 'kg', baseCost: 15.00, active: true, isDemoData: true },
      { id: 'demo_cat_espinacas', name: '[DEMO] Espinacas frescas', defaultUnit: 'kg', baseCost: 11.00, active: true, isDemoData: true },
      { id: 'demo_cat_cebolla', name: '[DEMO] Cebolla', defaultUnit: 'kg', baseCost: 1.50, active: true, isDemoData: true },
      { id: 'demo_cat_aceite_oliva', name: '[DEMO] Aceite de Oliva', defaultUnit: 'l', baseCost: 9.00, active: true, isDemoData: true },
    ];

    for (const item of catalogItems) {
      await firebaseService.saveItem('catalog', item, catalogConverter);
    }

    // 3. Define Recipes (Professional Demo with Sub-recipes and Variants)
    
    // Sub-recipe: Masa
    const masa: Dish = {
      id: 'demo_masa_artesana',
      name: '[DEMO] Masa Artesana',
      portions: 10,
      ingredients: [
        { catalogId: 'demo_cat_harina', quantity: 500, unit: 'g', costPerUnit: 0.0012, priceSource: 'inventory', consumeStock: true },
        { catalogId: 'demo_cat_mantequilla', quantity: 250, unit: 'g', costPerUnit: 0.008, priceSource: 'inventory', consumeStock: true },
        { catalogId: 'demo_cat_agua', quantity: 150, unit: 'ml', costPerUnit: 0.0001, priceSource: 'manual', consumeStock: false },
        { catalogId: 'demo_cat_sal', quantity: 10, unit: 'g', costPerUnit: 0.0005, priceSource: 'manual', consumeStock: false },
      ],
      instructions: '1. Amasar todos los ingredientes. 2. Reposar 1 hora.',
      isDemoData: true,
      lastUpdated: new Date().toISOString()
    };

    // Sub-recipe: Sofrito
    const sofrito: Dish = {
      id: 'demo_sofrito_base',
      name: '[DEMO] Sofrito Base',
      portions: 1,
      ingredients: [
        { catalogId: 'demo_cat_cebolla', quantity: 200, unit: 'g', costPerUnit: 0.0015, priceSource: 'inventory', consumeStock: true, wastePercentage: 15 },
        { catalogId: 'demo_cat_aceite_oliva', quantity: 50, unit: 'ml', costPerUnit: 0.009, priceSource: 'inventory', consumeStock: true },
      ],
      instructions: '1. Picar y sofreír.',
      isDemoData: true,
      lastUpdated: new Date().toISOString()
    };

    // Main Dish: Empanada Pro
    const empanada: Dish = {
      id: 'demo_empanada_pro',
      name: '[DEMO] Empanada Premium',
      portions: 1,
      ingredients: [
        { catalogId: 'demo_cat_huevo', quantity: 1, unit: 'ud', costPerUnit: 0.25, priceSource: 'inventory', consumeStock: true }
      ],
      subRecipes: [
        { dishId: 'demo_masa_artesana', name: 'Masa Artesana', quantity: 0.1, unit: 'ud', costPerUnit: 0.26 },
        { dishId: 'demo_sofrito_base', name: 'Sofrito Base', quantity: 0.2, unit: 'ud', costPerUnit: 0.75 }
      ],
      variants: [
        {
          name: 'Sabor del Relleno',
          options: [
            { catalogId: 'demo_cat_carne_picada', name: 'Carne Picada', quantity: 150, unit: 'g', costPerUnit: 0.009 },
            { catalogId: 'demo_cat_atun', name: 'Atún', quantity: 150, unit: 'g', costPerUnit: 0.015 },
            { catalogId: 'demo_cat_espinacas', name: 'Espinacas', quantity: 150, unit: 'g', costPerUnit: 0.011 },
          ]
        }
      ],
      indirectCosts: [
        { name: 'Caja de Cartón', type: 'fixed', value: 0.40 }
      ],
      isDemoData: true,
      lastUpdated: new Date().toISOString(),
      allergens: { 'Gluten': true, 'Huevos': true }
    };

    const allDishes = [masa, sofrito, empanada];
    for (const dish of allDishes) {
      await firebaseService.saveItem('dishes', dish, dishConverter);
    }

    // 4. Initial Inventory Purchases (Large batches for positive stock)
    const initialPurchases: InventoryEvent[] = [
      { id: 'demo_ev_1', type: 'PURCHASE', ingredientId: 'demo_cat_harina', quantity: 50000, unit: 'g', costPerUnit: 0.0012, totalCost: 60.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_2', type: 'PURCHASE', ingredientId: 'demo_cat_mantequilla', quantity: 20000, unit: 'g', costPerUnit: 0.008, totalCost: 160.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_3', type: 'PURCHASE', ingredientId: 'demo_cat_carne_picada', quantity: 15000, unit: 'g', costPerUnit: 0.009, totalCost: 135.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_4', type: 'PURCHASE', ingredientId: 'demo_cat_atun', quantity: 10000, unit: 'g', costPerUnit: 0.015, totalCost: 150.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_5', type: 'PURCHASE', ingredientId: 'demo_cat_cebolla', quantity: 10000, unit: 'g', costPerUnit: 0.0015, totalCost: 15.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_6', type: 'PURCHASE', ingredientId: 'demo_cat_aceite_oliva', quantity: 5000, unit: 'ml', costPerUnit: 0.009, totalCost: 45.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
      { id: 'demo_ev_7', type: 'PURCHASE', ingredientId: 'demo_cat_huevo', quantity: 60, unit: 'ud', costPerUnit: 0.25, totalCost: 15.00, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), source: 'purchase', isDemoData: true },
    ];

    for (const ev of initialPurchases) {
      await firebaseService.saveItem('inventoryEvents', ev, inventoryEventConverter);
    }

    // 5. Generate History of Productions
    const productionScenarios = [
      { variantIdx: 0, qty: 10, daysAgo: 2 }, // Carne
      { variantIdx: 1, qty: 5, daysAgo: 1 },  // Atún
    ];

    for (const scenario of productionScenarios) {
      const date = new Date();
      date.setDate(date.getDate() - scenario.daysAgo);

      const production: Production = {
        id: `demo_prod_${Date.now()}_${scenario.variantIdx}`,
        recipeId: 'demo_empanada_pro',
        date: date.toISOString(),
        expectedQuantity: 1,
        quantityProduced: scenario.qty,
        variantSelection: {
          'Sabor del Relleno': scenario.variantIdx
        },
        isDemoData: true
      };

      await firebaseService.saveItem('productions', production, productionConverter);

      // Generate Consumption Events
      const events = generateConsumptionEventsForProduction(production, empanada, allDishes, catalogItems);
      for (const event of events) {
        await firebaseService.saveItem('inventoryEvents', { ...event, isDemoData: true }, inventoryEventConverter);
      }
    }

    console.log('Demo dataset seeded successfully!');
  }
};
