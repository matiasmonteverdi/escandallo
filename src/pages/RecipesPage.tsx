import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, ArrowLeft, Download, TrendingUp, PieChart, DollarSign, Plus, Trash2, Layers, Calculator, Edit, Info } from 'lucide-react';
import { Dish, Ingredient, IndirectCost, SubRecipeUsage, VariantGroup, VariantOption } from '../data';
import { useAppStore } from '../store/useAppStore';
import { calculateDishCost } from '../App';
import { convertUnit, normalizeQuantity } from '../domain/units';
import { computeStockProjection } from '../services/inventory.service';
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import RecipePDF from '../components/RecipePDF';
import { mapRecipeToPDFModel, PDFModel } from '../services/pdfAdapter.service';
import { X, ExternalLink, Eye, EyeOff, Printer, Loader2, Clock, AlertCircle } from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity';
import { syncQueueService } from '../services/syncQueue.service';
import { resolveIngredientCost } from '../services/pricing.service';
import { getScaledDishBreakdown } from '../services/breakdown.service';

// --- HELPERS & SUBCOMPONENTS ---

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);

    // Modern browsers use addEventListener
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      (media as any).addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        (media as any).removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}

interface MobilePDFFallbackProps {
  document: React.ReactElement;
  fileName: string;
}

const MobilePDFFallback: React.FC<MobilePDFFallbackProps> = ({ document, fileName }) => {
  const [generating, setGenerating] = useState(false);

  const handleAction = async (action: 'open' | 'download') => {
    try {
      setGenerating(true);
      const blob = await pdf(document).toBlob();
      const url = URL.createObjectURL(blob);

      if (action === 'open') {
        window.open(url, '_blank');
      } else {
        const link = window.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 text-center flex flex-col items-center gap-6 max-w-sm mx-auto">
      <div className="w-20 h-20 bg-[#06b6d4]/10 rounded-full flex items-center justify-center text-[#06b6d4]">
        <Printer size={40} />
      </div>
      <div>
        <h3 className="text-white font-bold text-lg mb-2">Ficha lista para procesar</h3>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Para garantizar la mejor calidad en dispositivos móviles, abre el documento en una pestaña dedicada o descárgalo directamente.
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => handleAction('open')}
            disabled={generating}
            className="w-full bg-[#06b6d4] hover:bg-[#0891b2] disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            {generating ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <ExternalLink size={20} />
            )}
            VER FICHA COMPLETA
          </button>

          <button
            onClick={() => handleAction('download')}
            disabled={generating}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3"
          >
            {generating ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Download size={20} />
            )}
            DESCARGAR PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export const RecipesPage: React.FC = () => {
  const {
    ui, setUI, dishes, setDishes, selectedDish, setSelectedDish,
    addDish, updateDish, deleteDish, catalog, setCatalog,
    inventoryEvents, inventorySnapshots,
    draftDishes, setDraftDish, removeDraftDish
  } = useAppStore();

  const activeTab = ui.activeTab;
  const view = ui.view;
  const setActiveTab = (tab: 'traditional' | 'custom') => setUI({ activeTab: tab });
  const { isOnline } = useConnectivity();

  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);

  // Merge real dishes with drafts
  const allDishes = useMemo(() => {
    const combined = [...dishes];
    Object.values(draftDishes).forEach(draft => {
      const idx = combined.findIndex(d => d.id === draft.id);
      if (idx !== -1) {
        combined[idx] = draft.data;
      } else {
        combined.push(draft.data);
      }
    });
    return combined;
  }, [dishes, draftDishes]);
  const [marginPercent, setMarginPercent] = useState<number>(43);

  const hasFloatingFooter = false; // TODO: activar cuando añadamos acciones sticky (Save/CTA)

  // Custom dish form state
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState<string>('');
  const [dishPortions, setDishPortions] = useState<number>(1);

  // Custom ingredient form state
  const [customIngredients, setCustomIngredients] = useState<Ingredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  // Recipe Usage
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('g');
  const [newWaste, setNewWaste] = useState('');

  // Purchase Price
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [newPurchaseQuantity, setNewPurchaseQuantity] = useState('1');
  const [newPurchaseUnit, setNewPurchaseUnit] = useState('kg');
  const [useInventoryPrice, setUseInventoryPrice] = useState(true);
  const [consumeStock, setConsumeStock] = useState(true);
  const normalizedIngredientSearch = ingredientSearch.trim().toLowerCase();
  const filteredCatalogItems = React.useMemo(() => {
    if (!normalizedIngredientSearch) return [];
    return catalog
      .filter(c => c.active && c.name.toLowerCase().includes(normalizedIngredientSearch))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [catalog, normalizedIngredientSearch]);
  const selectedCatalogItem = React.useMemo(
    () => (selectedCatalogId ? catalog.find(c => c.id === selectedCatalogId) || null : null),
    [catalog, selectedCatalogId]
  );
  const isFromCatalog = !!selectedCatalogItem;
  const hasInventoryWac = !!(selectedCatalogItem && stockProjection[selectedCatalogItem.id]?.cost);
  const priceLocked = isFromCatalog && useInventoryPrice && hasInventoryWac;

  // Custom subrecipe form state
  const [customSubRecipes, setCustomSubRecipes] = useState<SubRecipeUsage[]>([]);
  const [newSubRecipeId, setNewSubRecipeId] = useState('');
  const [newSubRecipeQty, setNewSubRecipeQty] = useState('');

  // Custom variants state
  const [customVariants, setCustomVariants] = useState<VariantGroup[]>([]);
  const [newVariantGroupName, setNewVariantGroupName] = useState('');
  const [activeVariantGroup, setActiveVariantGroup] = useState<string>('');
  const [newVariantOptionName, setNewVariantOptionName] = useState('');
  const [newVariantOptionQty, setNewVariantOptionQty] = useState('');
  const [newVariantOptionUnit, setNewVariantOptionUnit] = useState('g');
  const [newVariantOptionCost, setNewVariantOptionCost] = useState('');

  // Result view state for selected variants
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});

  // Custom indirect costs form state
  const [customIndirectCosts, setCustomIndirectCosts] = useState<IndirectCost[]>([]);
  const [newIcName, setNewIcName] = useState('');
  const [newIcType, setNewIcType] = useState<'fixed' | 'percentage'>('percentage');
  const [newIcValue, setNewIcValue] = useState('');

  // Operational fields
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [dishAllergens, setDishAllergens] = useState<Record<string, boolean>>({});
  const [dishVersion, setDishVersion] = useState('1.0.0');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfData, setPdfData] = useState<PDFModel | null>(null);
  const [pdfViewMode, setPdfViewMode] = useState<'kitchen' | 'manager'>('kitchen');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [expandedSubRecipeIdx, setExpandedSubRecipeIdx] = useState<number | null>(null);
  const [variantGroupError, setVariantGroupError] = useState(false);
  const variantGroupInputRef = React.useRef<HTMLInputElement>(null);

  // Layout detection (Adaptive Rendering)
  const isCompact = useMediaQuery('(max-width: 768px)');

  React.useEffect(() => {
    if (!normalizedIngredientSearch) {
      setSelectedCatalogId(null);
      return;
    }

    const exactMatch = catalog.find(c => c.active && c.name.trim().toLowerCase() === normalizedIngredientSearch);
    if (exactMatch) {
      setSelectedCatalogId(exactMatch.id);
      setIngredientSearch(exactMatch.name);
    } else if (selectedCatalogItem && selectedCatalogItem.name.trim().toLowerCase() !== normalizedIngredientSearch) {
      setSelectedCatalogId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedIngredientSearch, catalog]);

  React.useEffect(() => {
    if (!isFromCatalog && useInventoryPrice) {
      setUseInventoryPrice(false);
      setConsumeStock(false);
    }
  }, [isFromCatalog, useInventoryPrice]);

  React.useEffect(() => {
    if (!isFromCatalog || !useInventoryPrice) return;

    const wacPerBase = stockProjection[selectedCatalogItem.id]?.cost;
    if (!wacPerBase || wacPerBase <= 0) {
      setUseInventoryPrice(false);
      setConsumeStock(false);
      return;
    }

    const resolvedCost = resolveIngredientCost({
      wacPerBaseUnit: wacPerBase,
      manualCostPerUsageUnit: undefined,
      usageUnit: newUnit as any,
      preferInventoryPrice: true
    });
    setNewPurchasePrice(resolvedCost.costPerUsageUnit.toFixed(4));
  }, [isFromCatalog, useInventoryPrice, selectedCatalogItem, stockProjection, newUnit]);

  const handleCalculateTraditional = (dish: Dish) => {
    setSelectedDish(dish);
    setSelectedVariants({});
    setUI({ view: 'result' });
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishPortions(dish.portions);
    setCustomIngredients(dish.ingredients || []);
    setCustomSubRecipes(dish.subRecipes || []);
    setCustomVariants(dish.variants || []);
    setCustomIndirectCosts(dish.indirectCosts || []);
    setInstructions(dish.instructions || '');
    setNotes(dish.notes || '');
    setDishAllergens(dish.allergens || {});
    setDishVersion(dish.version || '1.0.0');
    setUI({ activeTab: 'custom', view: 'selection' });
  };

  const resetForm = () => {
    setEditingDishId(null);
    setDishName('');
    setDishPortions(1);
    setCustomIngredients([]);
    setIngredientSearch('');
    setSelectedCatalogId(null);
    setCustomSubRecipes([]);
    setCustomVariants([]);
    setCustomIndirectCosts([]);
    setInstructions('');
    setNotes('');
    setDishAllergens({});
    setDishVersion('1.0.0');
  };

  const handleSaveAndCalculate = async () => {
    if (!dishName.trim()) {
      alert('Por favor, introduce un nombre para el plato.');
      return;
    }
    if (dishPortions <= 0) {
      alert('Las raciones que rinde deben ser mayores a 0.');
      return;
    }
    if (customIngredients.length === 0 && customSubRecipes.length === 0) {
      alert('Debes añadir al menos un ingrediente o sub-receta.');
      return;
    }

    const newDish: Dish = {
      id: editingDishId || Date.now().toString(),
      name: dishName,
      portions: dishPortions,
      ingredients: customIngredients,
      subRecipes: customSubRecipes,
      variants: customVariants,
      indirectCosts: customIndirectCosts,
      instructions,
      notes,
      allergens: dishAllergens,
      version: dishVersion,
      lastUpdated: new Date().toISOString()
    };

    if (!isOnline) {
      const draftId = editingDishId || `draft_${Date.now()}`;
      newDish.id = draftId; // Ensure draft has ID

      setDraftDish(draftId, {
        id: draftId,
        data: newDish,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      });

      await syncQueueService.enqueue({
        type: editingDishId ? 'UPDATE_DISH' : 'CREATE_DISH',
        payload: newDish
      });

      alert('Escandallo guardado localmente (Offline). Se sincronizará al volver online.');
    } else {
      if (editingDishId) {
        await updateDish(newDish);
      } else {
        await addDish(newDish);
      }
    }

    setSelectedDish(newDish);
    setSelectedVariants({});
    setUI({ view: 'result' });
  };

  const validateIngredientDraft = (): string | null => {
    if (!ingredientSearch.trim()) return 'Selecciona o crea el ingrediente.';
    if (!newQuantity || parseFloat(newQuantity) <= 0) return 'La cantidad debe ser mayor a 0.';
    if (!newPurchaseQuantity || parseFloat(newPurchaseQuantity) <= 0) return 'La cantidad de compra debe ser mayor a 0.';
    if (!newUnit) return 'Debes seleccionar unidad de uso.';
    if (!useInventoryPrice && consumeStock) return 'No puedes consumir inventario con precio manual.';
    if (!isFromCatalog && useInventoryPrice) return 'Un ingrediente nuevo no puede usar WAC hasta existir en inventario.';
    if (!useInventoryPrice && (!newPurchasePrice || parseFloat(newPurchasePrice) <= 0)) {
      return 'Debes indicar un precio manual mayor que 0.';
    }
    return null;
  };

  const handleAddCustomIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateIngredientDraft();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      const pPrice = parseFloat(newPurchasePrice || '0');
      const pQty = parseFloat(newPurchaseQuantity);

      const purchaseQtyInUsageUnit = convertUnit(pQty, newPurchaseUnit as any, newUnit as any);
      const manualCostPerUsageUnit = pPrice / purchaseQtyInUsageUnit;

      const cleanName = ingredientSearch.trim();
      const normalizedName = cleanName.toLowerCase();
      let targetCat = selectedCatalogItem || catalog.find(c => c.name.trim().toLowerCase() === normalizedName);
      let catId = targetCat?.id;

      if (!targetCat) {
        catId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newCatItem = {
          id: catId,
          name: cleanName,
          defaultUnit: newPurchaseUnit as any,
          baseCost: manualCostPerUsageUnit,
          active: true
        };
        setCatalog([...catalog, newCatItem]);
      }

      const resolvedCost = resolveIngredientCost({
        wacPerBaseUnit: targetCat ? stockProjection[targetCat.id]?.cost : undefined,
        manualCostPerUsageUnit,
        usageUnit: newUnit as any,
        preferInventoryPrice: useInventoryPrice
      });

      const ingredientToAdd: Ingredient = {
        catalogId: catId!,
        quantity: parseFloat(newQuantity),
        unit: newUnit as any,
        costPerUnit: resolvedCost.costPerUsageUnit,
        priceSource: resolvedCost.source,
        consumeStock,
        wastePercentage: newWaste ? parseFloat(newWaste) : 0,
        purchasePrice: pPrice,
        purchaseQuantity: pQty,
        purchaseUnit: newPurchaseUnit as any,
      };

      setCustomIngredients([...customIngredients, ingredientToAdd]);
      setIngredientSearch('');
      setSelectedCatalogId(null);
      setNewQuantity('');
      setNewPurchasePrice('');
      setNewPurchaseQuantity('1');
      setNewWaste('');
      setUseInventoryPrice(true);
      setConsumeStock(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al convertir unidades.');
    }
  };

  const handleAddSubRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubRecipeId || !newSubRecipeQty) return;

    const baseDish = dishes.find(d => d.id === newSubRecipeId);
    if (!baseDish) return;

    const { costPerPortion } = calculateDishCost(baseDish, {}, stockProjection);

    const subRecipeToAdd: SubRecipeUsage = {
      dishId: baseDish.id,
      name: baseDish.name,
      quantity: parseFloat(newSubRecipeQty),
      unit: 'raciones' as any,
      costPerUnit: costPerPortion,
    };

    setCustomSubRecipes([...customSubRecipes, subRecipeToAdd]);
    setNewSubRecipeId('');
    setNewSubRecipeQty('');
  };

  const handleAddIndirectCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIcName || !newIcValue) return;

    const icToAdd: IndirectCost = {
      name: newIcName,
      type: newIcType,
      value: parseFloat(newIcValue),
    };

    setCustomIndirectCosts([...customIndirectCosts, icToAdd]);
    setNewIcName('');
    setNewIcValue('');
  };

  const handleAddVariantGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantGroupName.trim()) {
      setVariantGroupError(true);
      variantGroupInputRef.current?.focus();
      return;
    }
    setVariantGroupError(false);
    setCustomVariants([...customVariants, {
      name: newVariantGroupName,
      options: [
        { name: 'Sin variante', quantity: 0, unit: '-' as any, costPerUnit: 0 }
      ]
    }]);
    setNewVariantGroupName('');
  };

  const handleAddVariantOption = (groupName: string) => {
    if (!newVariantOptionName || !newVariantOptionQty || !newVariantOptionCost) return;

    const optionToAdd: VariantOption = {
      name: newVariantOptionName,
      quantity: parseFloat(newVariantOptionQty),
      unit: newVariantOptionUnit as any,
      costPerUnit: parseFloat(newVariantOptionCost),
    };

    setCustomVariants(customVariants.map(g => {
      if (g.name === groupName) {
        return { ...g, options: [...g.options, optionToAdd] };
      }
      return g;
    }));

    setNewVariantOptionName('');
    setNewVariantOptionQty('');
    setNewVariantOptionUnit('g');
    setNewVariantOptionCost('');
    setActiveVariantGroup('');
  };

  const resetView = () => {
    setUI({ view: 'selection' });
    setSelectedDish(null);
  };

  const handleDeleteDish = () => {
    if (!selectedDish) return;
    deleteDish(selectedDish.id);
    setShowDeleteConfirm(false);
    resetView();
  };

  const renderResult = () => {
    if (!selectedDish) return null;

    const { totalCost, ingredientsCost, subRecipesCost, variantsCost, indirectCostsValue, directCost } = calculateDishCost(selectedDish, selectedVariants, stockProjection);

    const suggestedPrice = totalCost / (1 - (marginPercent / 100));
    const profitMargin = suggestedPrice - totalCost;

    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#1e293b] text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-serif tracking-wide">{selectedDish.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Análisis de escandallo profesional</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleEditDish(selectedDish)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Edit size={16} />
              <span className="hidden sm:inline">Editar</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
            <button
              onClick={resetView}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Volver</span>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-red-50 rounded-xl p-6 flex flex-col items-center justify-center border border-red-100">
              <DollarSign className="text-red-500 mb-2" size={32} />
              <span className="text-red-600 font-medium text-sm mb-1">Coste Total</span>
              <span className="text-red-600 font-bold text-3xl">{totalCost.toFixed(2)}€</span>
            </div>
            <div className="bg-blue-50 rounded-xl p-6 flex flex-col items-center justify-center border border-blue-100">
              <TrendingUp className="text-blue-500 mb-2" size={32} />
              <span className="text-blue-600 font-medium text-sm mb-1">Precio Sugerido</span>
              <span className="text-blue-600 font-bold text-3xl">{suggestedPrice.toFixed(2)}€</span>
            </div>
            <div className="bg-green-50 rounded-xl p-6 flex flex-col items-center justify-center border border-green-100">
              <PieChart className="text-green-500 mb-2" size={32} />
              <span className="text-green-600 font-medium text-sm mb-1">Margen de Beneficio</span>
              <span className="text-green-600 font-bold text-3xl">{profitMargin.toFixed(2)}€</span>
              <span className="text-green-600/80 text-xs mt-1">{marginPercent.toFixed(1)}%</span>
            </div>
          </div>

          {/* Slider */}
          <div className="mb-10 bg-slate-50 p-5 sm:p-6 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-serif font-bold text-slate-800">Ajustar Margen</h2>
              <span className="text-lg font-bold text-[#06b6d4] bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-100">
                {marginPercent.toFixed(1)}%
              </span>
            </div>

            <div className="py-2 mb-6">
              <input
                type="range"
                min="0"
                max="99"
                step="1"
                value={marginPercent}
                onChange={(e) => setMarginPercent(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#06b6d4]"
              />
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200">
              <div className="text-center flex-1 border-r border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Precio Venta</p>
                <p className="font-bold text-slate-800 text-lg">{suggestedPrice.toFixed(2)}€</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-slate-500 mb-1">Beneficio Neto</p>
                <p className="font-bold text-green-600 text-lg">+{profitMargin.toFixed(2)}€</p>
              </div>
            </div>
          </div>

          {/* Variant Selectors and Comparison */}
          {selectedDish.variants && selectedDish.variants.length > 0 && (
            <div className="mb-8 space-y-6">
              <h3 className="text-lg font-serif font-bold text-slate-800 flex items-center gap-2">
                <Layers size={20} className="text-[#06b6d4]" />
                Comparativa de Rentabilidad por Variante
              </h3>

              {selectedDish.variants.map((group, idx) => {
                const baseOption = { name: 'Sin variante', quantity: 0, unit: '-' as any, costPerUnit: 0 };
                const effectiveOptions = group.options.some(o => o.name === 'Sin variante')
                  ? group.options
                  : [baseOption, ...group.options];

                const optionsAnalysis = effectiveOptions.map((opt, uiIdx) => {
                  // Mapeamos el índice de la UI al índice real de los datos
                  // Si no existe (es el 'Sin variante' virtual), usamos -1
                  const dataIdx = group.options.findIndex(o => o.name === opt.name);

                  const tempSelection = { ...selectedVariants, [group.name]: dataIdx };
                  const { totalCost } = calculateDishCost(selectedDish, tempSelection, stockProjection);
                  const suggestedPrice = totalCost / (1 - (marginPercent / 100));
                  const profitMargin = suggestedPrice - totalCost;
                  return { opt, dataIdx, totalCost, profitMargin };
                });



                const maxMargin = Math.max(...optionsAnalysis.map(o => o.profitMargin));
                const minMargin = Math.min(...optionsAnalysis.map(o => o.profitMargin));

                return (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-700">Impacto de: {group.name}</span>
                      <span className="text-xs text-slate-500 hidden sm:block">Selecciona una opción para ver el desglose completo</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {optionsAnalysis.map(analysis => {
                        const isSelected = (selectedVariants[group.name] ?? -1) === analysis.dataIdx;
                        return (
                          <div
                            key={analysis.dataIdx}
                            onClick={() => setSelectedVariants({ ...selectedVariants, [group.name]: analysis.dataIdx })}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer transition-colors hover:bg-slate-50 gap-3 ${isSelected ? 'bg-blue-50/50 border-l-4 border-l-[#06b6d4]' : 'border-l-4 border-l-transparent'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#06b6d4]' : 'border-slate-300'}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-[#06b6d4]" />}
                              </div>
                              <div>
                                <p className={`font-medium ${isSelected ? 'text-[#06b6d4]' : 'text-slate-800'}`}>
                                  {analysis.opt.name}
                                  {analysis.dataIdx === -1 && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Por defecto</span>}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">Coste total receta: {analysis.totalCost.toFixed(2)}€</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                              <div className="flex gap-2">
                                {analysis.profitMargin === maxMargin && group.options.length > 1 && (
                                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Más rentable</span>
                                )}
                                {analysis.profitMargin === minMargin && group.options.length > 1 && (
                                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">Menos rentable</span>
                                )}
                              </div>
                              <div className="w-20 text-right">
                                <p className="font-bold text-slate-800">{analysis.profitMargin.toFixed(2)}€</p>
                                <p className="text-xs text-slate-500">Margen</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Breakdown Sections */}
          <div className="space-y-8">
            {/* Ingredients */}
            {selectedDish.ingredients.length > 0 && (
              <div>
                <h2 className="text-lg font-serif font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ChefHat size={20} className="text-slate-500" />
                  Ingredientes Base (Coste Directo)
                </h2>
                <div className="space-y-3">
                  {selectedDish.ingredients.map((ing, idx) => {
                    const catItem = catalog.find(c => c.id === ing.catalogId);
                    const displayName = catItem ? catItem.name : 'Desconocido';
                    const waste = ing.wastePercentage || 0;
                    const grossQuantity = ing.quantity / (1 - (waste / 100));

                    let ingCost = grossQuantity * ing.costPerUnit;
                    const liveBaseCost = stockProjection[ing.catalogId]?.cost;
                    let liveCostInUsageUnit = 0;
                    let hasDiscrepancy = false;

                    if (liveBaseCost && liveBaseCost > 0) {
                      const { quantity: baseQty } = normalizeQuantity(grossQuantity, ing.unit);
                      ingCost = baseQty * liveBaseCost;

                      const { quantity: qty1InBase } = normalizeQuantity(1, ing.unit);
                      liveCostInUsageUnit = liveBaseCost * qty1InBase;

                      if (Math.abs(liveCostInUsageUnit - ing.costPerUnit) > 0.0001) {
                        hasDiscrepancy = true;
                      }
                    }

                    const percentage = totalCost > 0 ? (ingCost / totalCost) * 100 : 0;

                    return (
                      <div key={idx} className="bg-white rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center border border-slate-200 gap-4">
                        <div>
                          <p className="font-medium text-slate-800">{displayName}</p>
                          <div className="mt-1">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {ing.priceSource === 'manual'
                                ? 'Manual'
                                : (ing.consumeStock === false ? 'Inventario (no consume)' : 'Inventario (consume)')}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                            <span className="text-xs text-slate-500">
                              {ing.quantity} {ing.unit} netos
                            </span>
                            {waste > 0 && (
                              <>
                                <span className="text-slate-300 hidden sm:inline">•</span>
                                <span className="text-xs text-amber-600 font-medium">
                                  {waste}% merma ({grossQuantity.toFixed(1)} {ing.unit} brutos)
                                </span>
                              </>
                            )}
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className={`text-xs ${hasDiscrepancy ? 'line-through text-slate-400' : 'text-slate-500'}`}>
                              {ing.purchasePrice && ing.purchaseQuantity && ing.purchaseUnit
                                ? `${ing.purchasePrice}€ / ${ing.purchaseQuantity} ${ing.purchaseUnit}`
                                : `${ing.costPerUnit.toFixed(4)}€ / ${ing.unit}`}
                            </span>
                          </div>
                          {hasDiscrepancy && (
                            <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200">
                              <span>⚠️</span>
                              <span>
                                Inventario en vivo: {liveCostInUsageUnit.toFixed(4)}€ / {ing.unit}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className={`font-medium ${hasDiscrepancy ? 'text-amber-600' : 'text-slate-800'}`}>{ingCost.toFixed(2)}€</p>
                          <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SubRecipes */}
            {selectedDish.subRecipes && selectedDish.subRecipes.length > 0 && (
              <div>
                <h2 className="text-lg font-serif font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Layers size={20} className="text-slate-500" />
                  Subrecetas
                </h2>
                <div className="space-y-3">
                  {selectedDish.subRecipes.map((sub, idx) => {
                    const subCost = sub.quantity * sub.costPerUnit;
                    const percentage = totalCost > 0 ? (subCost / totalCost) * 100 : 0;

                    return (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 flex justify-between items-center border border-slate-200">
                        <div>
                          <p className="font-medium text-slate-800">{sub.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {sub.quantity} {sub.unit} × {sub.costPerUnit.toFixed(2)}€
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-800">{subCost.toFixed(2)}€</p>
                          <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Variants Breakdown */}
            {selectedDish.variants && selectedDish.variants.length > 0 && variantsCost > 0 && (
              <div>
                <h2 className="text-lg font-serif font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Layers size={20} className="text-slate-500" />
                  Variantes Seleccionadas (Coste Directo)
                </h2>
                <div className="space-y-3">
                  {selectedDish.variants.map((group, idx) => {
                    const selectedIdx = selectedVariants[group.name] || 0;
                    const option = group.options[selectedIdx];
                    if (!option) return null;

                    const optCost = option.quantity * option.costPerUnit;
                    const percentage = totalCost > 0 ? (optCost / totalCost) * 100 : 0;

                    return (
                      <div key={idx} className="bg-white rounded-lg p-4 flex justify-between items-center border border-slate-200">
                        <div>
                          <p className="font-medium text-slate-800">{group.name}: {option.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {option.quantity} {option.unit} a {option.costPerUnit.toFixed(2)}€/{option.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-800">{optCost.toFixed(2)}€</p>
                          <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Indirect Costs */}
            {selectedDish.indirectCosts && selectedDish.indirectCosts.length > 0 && (
              <div>
                <h2 className="text-lg font-serif font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Calculator size={20} className="text-slate-500" />
                  Costes Indirectos
                </h2>
                <div className="space-y-3">
                  {selectedDish.indirectCosts.map((ic, idx) => {
                    const icCost = ic.type === 'fixed' ? ic.value : directCost * (ic.value / 100);
                    const percentage = totalCost > 0 ? (icCost / totalCost) * 100 : 0;

                    return (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 flex justify-between items-center border border-slate-200">
                        <div>
                          <p className="font-medium text-slate-800">{ic.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {ic.type === 'fixed' ? 'Coste Fijo' : `${ic.value}% sobre coste directo`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-800">{icCost.toFixed(2)}€</p>
                          <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={async () => {
              if (!isOnline) {
                alert('La exportación a PDF requiere conexión para procesar los activos de marca y asegurar la calidad del documento.');
                return;
              }
              setIsGeneratingPdf(true);
              try {
                const model = await mapRecipeToPDFModel(selectedDish, catalog, selectedVariants, stockProjection);
                setPdfData(model);
                setShowPdfPreview(true);
              } catch (error) {
                console.error('PDF Error:', error);
                alert('Error al generar la vista previa del PDF.');
              } finally {
                setIsGeneratingPdf(false);
              }
            }}
            disabled={isGeneratingPdf}
            className={`flex-1 ${isOnline ? 'bg-[#06b6d4] hover:bg-[#0891b2]' : 'bg-slate-400 cursor-not-allowed'} active:scale-95 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50`}
            title={!isOnline ? 'Conexión requerida para PDF' : ''}
          >
            {isGeneratingPdf ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Printer size={18} />
            )}
            {isGeneratingPdf ? 'Generando...' : 'Exportar Ficha (PDF)'}
          </button>
          <button
            onClick={resetView}
            className="flex-1 bg-[#1e293b] hover:bg-slate-800 active:scale-95 text-white py-3 rounded-lg font-medium transition-all"
          >
            Nueva Calculación
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar escandallo?</h3>
              <p className="text-slate-600 mb-6">
                Estás a punto de eliminar "{selectedDish?.name}". Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteDish}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Memoize PDF document to avoid expensive recalculations on each render
  const pdfDocument = useMemo(() => {
    if (!pdfData) return null;
    return <RecipePDF data={pdfData} mode={pdfViewMode} />;
  }, [pdfData, pdfViewMode]);

  return (
    <div
      className={`max-w-5xl mx-auto w-full min-h-screen ${hasFloatingFooter ? 'pb-24' : 'pb-6 md:pb-8'
        }`}
    >
      {view === 'result' ? (
        renderResult()
      ) : (
        <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[calc(100vh-220px)] md:min-h-[calc(100vh-280px)]">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'traditional' ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('traditional')}
            >
              Mis Platos
            </button>
            <button
              className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'custom' ? 'bg-[#1e293b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => {
                if (activeTab !== 'custom') {
                  resetForm();
                  setActiveTab('custom');
                }
              }}
            >
              Nuevo Escandallo
            </button>
          </div>

          <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            {activeTab === 'traditional' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allDishes.map((dish) => {
                  const isDraft = !!draftDishes[dish.id];
                  return (
                    <div
                      key={dish.id}
                      onClick={() => handleCalculateTraditional(dish)}
                      className={`group bg-white border ${isDraft ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'} rounded-xl p-5 cursor-pointer hover:border-[#06b6d4] hover:shadow-md transition-all flex flex-col items-center text-center relative`}
                    >
                      {isDraft && (
                        <div className="absolute top-3 right-3 text-amber-600 flex items-center gap-1" title="Pendiente de sincronizar">
                          <Clock size={14} className="animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-tight">Draft</span>
                        </div>
                      )}
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
                        <ChefHat className="text-slate-400 group-hover:text-[#06b6d4] transition-colors" size={24} />
                      </div>
                      <h3 className="font-bold text-slate-800 mb-1">{dish.name}</h3>
                      <p className="text-sm text-slate-500">{dish.portions} raciones</p>
                    </div>
                  );
                })}
                {allDishes.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    No hay platos guardados. Crea uno nuevo.
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-serif font-bold text-slate-800 mb-2">
                    {editingDishId ? 'Editar Escandallo' : 'Crear Escandallo'}
                  </h2>
                  <p className="text-slate-500">Define los ingredientes, mermas y costes indirectos para calcular el precio ideal.</p>
                </div>

                {/* Basic Info */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Plato</label>
                      <input
                        type="text"
                        value={dishName}
                        onChange={(e) => setDishName(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                        placeholder="Ej. Paella Valenciana"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Raciones que rinde</label>
                      <input
                        type="number" inputMode="decimal"
                        min="1"
                        value={dishPortions || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setDishPortions(0);
                          } else {
                            const parsed = parseInt(val);
                            if (!isNaN(parsed)) setDishPortions(parsed);
                          }
                        }}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ChefHat size={20} className="text-[#06b6d4]" />
                    Ingredientes Base
                    <div className="group relative flex items-center ml-1">
                      <Info size={16} className="text-slate-400 hover:text-[#06b6d4] cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl font-normal leading-relaxed pointer-events-none">
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        Materia prima directa que compone el plato. Introduce el precio al que compras el ingrediente y la cantidad neta que usas en la receta.
                      </div>
                    </div>
                  </h3>

                  {customIngredients.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="p-3 font-medium">Ingrediente</th>
                              <th className="p-3 font-medium">Cantidad</th>
                              <th className="p-3 font-medium">Coste/Ud</th>
                              <th className="p-3 font-medium">Merma</th>
                              <th className="p-3 font-medium w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customIngredients.map((ing, idx) => {
                              const catItem = catalog.find(c => c.id === ing.catalogId);
                              return (
                                <tr key={idx}>
                                  <td className="p-3 font-medium text-slate-800">{catItem?.name || 'Desconocido'}</td>
                                  <td className="p-3 text-slate-600">{ing.quantity} {ing.unit}</td>
                                  <td className="p-3 text-slate-600">
                                    {ing.purchasePrice && ing.purchaseQuantity && ing.purchaseUnit
                                      ? <>{ing.purchasePrice}€ / {ing.purchaseQuantity} {ing.purchaseUnit} <span className="text-[10px] text-slate-400 block">({ing.costPerUnit.toFixed(4)}€/{ing.unit})</span></>
                                      : `${ing.costPerUnit.toFixed(4)}€ / ${ing.unit}`}
                                    <span className="text-[10px] text-slate-500 block mt-1">
                                      {ing.priceSource === 'manual'
                                        ? 'Manual'
                                        : (ing.consumeStock === false ? 'Inventario (no consume)' : 'Inventario (consume)')}
                                    </span>
                                  </td>
                                  <td className="p-3 text-amber-600">{ing.wastePercentage}%</td>
                                  <td className="p-3">
                                    <button
                                      onClick={() => setCustomIngredients(customIngredients.filter((_, i) => i !== idx))}
                                      className="text-slate-400 hover:text-red-500 transition-colors p-2"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAddCustomIngredient} className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-4 shadow-sm">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-700">Nombre del ingrediente</label>
                        <button
                          type="button"
                          onClick={() => setShowInventoryPicker(!showInventoryPicker)}
                          className={`text-xs font-medium px-2 py-1 rounded-md transition-all flex items-center gap-1.5 ${showInventoryPicker
                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            : 'bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20'
                            }`}
                        >
                          {showInventoryPicker ? (
                            <><X size={14} /> Cerrar catálogo</>
                          ) : (
                            <><Plus size={14} /> Usar Inventario</>
                          )}
                        </button>
                      </div>

                      <input
                        type="text" required
                        value={ingredientSearch}
                        onChange={e => setIngredientSearch(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="Busca o escribe un ingrediente..."
                        list="catalog-ingredient-suggestions"
                      />
                      <datalist id="catalog-ingredient-suggestions">
                        {filteredCatalogItems.map(item => (
                          <option key={item.id} value={item.name} />
                        ))}
                      </datalist>

                      {showInventoryPicker && (
                        <div className="mt-3 p-3 bg-white border border-[#06b6d4]/20 rounded-lg shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
                          <label className="block text-xs font-bold text-[#06b6d4] uppercase tracking-wider mb-2">Elegir desde catálogo</label>
                          <select
                            value={selectedCatalogId || ''}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const selected = catalog.find(c => c.id === e.target.value);
                              if (!selected) return;
                              setSelectedCatalogId(selected.id);
                              setIngredientSearch(selected.name);
                              setUseInventoryPrice(true);
                              setConsumeStock(true);
                              setNewUnit(selected.defaultUnit);
                              setNewPurchaseUnit(selected.defaultUnit === 'kg' || selected.defaultUnit === 'l' || selected.defaultUnit === 'ud'
                                ? selected.defaultUnit
                                : (selected.defaultUnit === 'g' ? 'kg' : 'l')
                              );
                              // Auto-cerrar al seleccionar para limpiar la vista
                              setShowInventoryPicker(false);
                            }}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white shadow-sm"
                          >
                            <option value="">Buscar en el inventario...</option>
                            {[...catalog]
                              .filter(c => c.active)
                              .sort((a, b) => {
                                const aHasPrice = !!stockProjection[a.id]?.cost;
                                const bHasPrice = !!stockProjection[b.id]?.cost;
                                if (aHasPrice !== bHasPrice) return bHasPrice ? 1 : -1;
                                return a.name.localeCompare(b.name);
                              })
                              .map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.name}{stockProjection[item.id]?.cost ? ' • con precio inventario' : ' • sin precio inventario'}
                                </option>
                              ))}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-2 italic">
                            💡 Al seleccionar, se vincularán automáticamente los precios y unidades del inventario.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Bloque 1: Uso en receta */}
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">1. Uso en receta</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                            <input
                              type="number" inputMode="decimal" required min="0" step="any"
                              value={newQuantity} onChange={e => setNewQuantity(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                              placeholder="0"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Unidad</label>
                            <select
                              value={newUnit} onChange={e => {
                                setNewUnit(e.target.value);
                                // Smart defaults
                                if (e.target.value === 'g') setNewPurchaseUnit('kg');
                                if (e.target.value === 'ml') setNewPurchaseUnit('l');
                                if (e.target.value === 'ud') setNewPurchaseUnit('ud');
                              }}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white"
                            >
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="ud">ud</option>
                              <option value="kg">kg</option>
                              <option value="l">l</option>
                            </select>
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Merma (%)</label>
                            <input
                              type="number" inputMode="decimal" min="0" max="99"
                              value={newWaste} onChange={e => setNewWaste(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bloque 2: Precio de compra */}
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">2. Compra (Factura)</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Precio (€)</label>
                            <input
                              type="number" inputMode="decimal" required min="0" step="any"
                              value={newPurchasePrice} onChange={e => setNewPurchasePrice(e.target.value)}
                              disabled={priceLocked}
                              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] ${priceLocked
                                ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                                : 'border-slate-300'
                                }`}
                              placeholder="0.00"
                            />
                            <div className="min-h-[16px] mt-1">
                              {priceLocked && (
                                <p className="text-[10px] text-slate-500">🔒 Precio calculado automáticamente desde inventario</p>
                              )}
                            </div>
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                            <input
                              type="number" inputMode="decimal" required min="0.001" step="any"
                              value={newPurchaseQuantity} onChange={e => setNewPurchaseQuantity(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                              placeholder="1"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Unidad</label>
                            <select
                              value={newPurchaseUnit} onChange={e => setNewPurchaseUnit(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white"
                            >
                              <option value="kg">kg</option>
                              <option value="l">l</option>
                              <option value="ud">ud</option>
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 bg-slate-100 p-3 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`relative inline-flex items-center justify-between border rounded-lg px-3 py-2 transition-all ${isFromCatalog
                          ? 'bg-white/80 border-slate-300 hover:border-[#06b6d4] cursor-pointer'
                          : 'bg-slate-100/50 border-slate-200 cursor-not-allowed opacity-50'
                          }`}>
                          <span className="text-sm font-medium text-slate-700">Usar precio del inventario (WAC)</span>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={useInventoryPrice}
                            disabled={!isFromCatalog}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUseInventoryPrice(checked);
                              if (!checked) setConsumeStock(false);
                            }}
                          />
                          <span className={`relative w-11 h-6 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 shadow-sm ${!isFromCatalog ? 'bg-slate-200' : 'bg-slate-300 peer-checked:bg-[#06b6d4]'
                            }`} />
                        </label>

                        <label
                          className={`relative inline-flex items-center justify-between border rounded-lg px-3 py-2 transition-all ${useInventoryPrice
                            ? 'bg-white/80 border-slate-300 hover:border-[#06b6d4] cursor-pointer'
                            : 'bg-slate-100/50 border-slate-200 cursor-not-allowed opacity-50'
                            }`}
                          title="Si está desactivado, este ingrediente no afectará el stock al producir."
                        >
                          <span className="text-sm font-medium text-slate-700">Consumir del inventario</span>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={consumeStock}
                            disabled={!useInventoryPrice}
                            onChange={(e) => setConsumeStock(e.target.checked)}
                          />
                          <span className="relative w-11 h-6 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#06b6d4] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 shadow-sm" />
                        </label>
                      </div>
                      {!isFromCatalog && ingredientSearch.trim() && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                          ⚠️ Ingrediente nuevo: se usará precio manual y no consumirá inventario hasta existir en catálogo.
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        {/* Real-time preview */}
                        <div className="text-sm flex-1">
                          {newQuantity && newPurchasePrice && newPurchaseQuantity ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                              <span className="text-slate-500 font-medium">Coste en receta:</span>
                              <span className="font-bold text-slate-800 text-lg">
                                {(() => {
                                  try {
                                    const pPrice = parseFloat(newPurchasePrice);
                                    const pQty = parseFloat(newPurchaseQuantity);
                                    const uQty = parseFloat(newQuantity);
                                    const purchaseQtyInUsageUnit = convertUnit(pQty, newPurchaseUnit as any, newUnit as any);
                                    const costPerUsageUnit = pPrice / purchaseQtyInUsageUnit;

                                    const costElement = (costPerUsageUnit * uQty).toFixed(2) + '€';
                                    const isSuspiciousPrice = (newPurchaseUnit === 'g' || newPurchaseUnit === 'ml') && (pPrice / pQty) > 0.5;

                                    return (
                                      <div className="flex items-center gap-2">
                                        {costElement}
                                        {isSuspiciousPrice && (
                                          <div className="group relative flex items-center">
                                            <span className="text-amber-500 cursor-help">⚠️</span>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl font-normal leading-relaxed text-center">
                                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                              ¿Seguro que el precio es por {newPurchaseUnit}? Normalmente se compra por {newPurchaseUnit === 'g' ? 'kg' : 'litro'}.
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } catch (e) {
                                    return <span className="text-red-500 text-sm font-normal">Unidades incompatibles</span>;
                                  }
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Rellena cantidad y precio para ver el coste...</span>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="bg-[#06b6d4] hover:bg-cyan-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm"
                        >
                          <Plus size={18} />
                          Añadir
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* SubRecipes List */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers size={20} className="text-[#06b6d4]" />
                    Subrecetas
                    <div className="group relative flex items-center ml-1">
                      <Info size={16} className="text-slate-400 hover:text-[#06b6d4] cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl font-normal leading-relaxed pointer-events-none">
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        Preparaciones previas (ej. salsas, caldos, masas) que ya has escandallado y usas como ingrediente en este plato.
                      </div>
                    </div>
                  </h3>

                  {customSubRecipes.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="p-3 font-medium">Subreceta</th>
                              <th className="p-3 font-medium">Raciones</th>
                              <th className="p-3 font-medium w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customSubRecipes.map((sub, idx) => {
                              const baseDish = dishes.find(d => d.id === sub.dishId);
                              const isExpanded = expandedSubRecipeIdx === idx;

                              // El cálculo se hace aquí de forma memoizada o directa dado que el factor es simple
                              const breakdown = isExpanded && baseDish
                                ? getScaledDishBreakdown(baseDish, sub.quantity, stockProjection, catalog)
                                : null;

                              return (
                                <React.Fragment key={idx}>
                                  <tr className={`transition-colors ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}`}>
                                    <td className="p-3 font-medium text-slate-800">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedSubRecipeIdx(isExpanded ? null : idx)}
                                          className={`p-1.5 rounded-md transition-all ${isExpanded ? 'bg-[#06b6d4] text-white shadow-sm' : 'text-[#06b6d4] hover:bg-[#06b6d4]/10'}`}
                                          title={isExpanded ? "Ocultar desglose" : "Ver desglose"}
                                        >
                                          {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <span className={isExpanded ? 'text-[#06b6d4]' : ''}>{sub.name}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-slate-600 font-medium">
                                      {sub.quantity} <span className="text-[10px] text-slate-400 font-normal">raciones</span>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCustomSubRecipes(customSubRecipes.filter((_, i) => i !== idx));
                                          if (expandedSubRecipeIdx === idx) setExpandedSubRecipeIdx(null);
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-2"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && breakdown && (
                                    <tr className="bg-slate-50/80">
                                      <td colSpan={3} className="p-0 border-b border-slate-200">
                                        <div className="px-10 py-4 text-[11px] animate-in slide-in-from-top-2 duration-200 border-l-2 border-[#06b6d4] ml-3 mb-2">
                                          <div className="flex items-center justify-between mb-3">
                                            <h5 className="font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                              <Calculator size={12} /> Impacto en {sub.quantity} raciones
                                            </h5>
                                            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400">
                                              Coste Base: {sub.costPerUnit.toFixed(2)}€/ud
                                            </span>
                                          </div>

                                          <div className="space-y-1.5">
                                            {breakdown.items.map((item, iIdx) => (
                                              <div key={iIdx} className="flex justify-between items-center group">
                                                <span className="text-slate-500 group-hover:text-slate-700 transition-colors">
                                                  <span className="opacity-40 mr-1.5">•</span>
                                                  {item.name}
                                                </span>
                                                <div className="flex items-center gap-4">
                                                  <span className="text-slate-400 tabular-nums">
                                                    {item.quantity.toFixed(2)} {item.unit}
                                                  </span>
                                                  <span className="font-bold text-slate-700 min-w-[50px] text-right tabular-nums">
                                                    {item.cost.toFixed(2)}€
                                                  </span>
                                                </div>
                                              </div>
                                            ))}

                                            {breakdown.indirectCost > 0 && (
                                              <div className="flex justify-between items-center pt-1 text-[#06b6d4] italic">
                                                <span>+ Costes Indirectos Proporcionales</span>
                                                <span className="font-medium tabular-nums">{breakdown.indirectCost.toFixed(2)}€</span>
                                              </div>
                                            )}

                                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800 text-xs">
                                              <span>Total Aportado al Escandallo</span>
                                              <span className="text-sm tracking-tight">{breakdown.totalCost.toFixed(2)}€</span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAddSubRecipe} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-7">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Receta Base</label>
                      <select
                        value={newSubRecipeId} onChange={e => setNewSubRecipeId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white"
                        required
                      >
                        <option value="">Seleccionar receta...</option>
                        {dishes.filter(d => d.id !== editingDishId).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Raciones a usar</label>
                      <input
                        type="number" inputMode="decimal" required min="0.1" step="any"
                        value={newSubRecipeQty} onChange={e => setNewSubRecipeQty(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="Ej. 2.5"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg flex items-center justify-center transition-colors">
                        <Plus size={20} />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Variants */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers size={20} className="text-[#06b6d4]" />
                    Variantes (Opcional)
                    <div className="group relative flex items-center ml-1">
                      <Info size={16} className="text-slate-400 hover:text-[#06b6d4] cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl font-normal leading-relaxed pointer-events-none">
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        Opciones que el cliente puede elegir y que cambian el coste del plato (ej. tipo de guarnición, extra de queso, tipo de leche).
                      </div>
                    </div>
                  </h3>

                  {customVariants.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                      <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-700">{group.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveVariantGroup(activeVariantGroup === group.name ? '' : group.name)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition-colors font-medium shadow-sm"
                          >
                            + Añadir Opción
                          </button>
                          <button
                            onClick={() => setCustomVariants(customVariants.filter((_, i) => i !== gIdx))}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {group.options.map((opt, oIdx) => (
                              <tr key={oIdx}>
                                <td className="p-3 font-medium text-slate-800">{opt.name}</td>
                                <td className="p-3 text-slate-600">{opt.quantity > 0 ? `${opt.quantity} ${opt.unit}` : '-'}</td>
                                <td className="p-3 text-slate-600">{opt.costPerUnit > 0 ? `${opt.costPerUnit}€/${opt.unit}` : '-'}</td>
                                <td className="p-3 text-right">
                                  {oIdx > 0 && (
                                    <button
                                      onClick={() => {
                                        const newVariants = [...customVariants];
                                        newVariants[gIdx].options = newVariants[gIdx].options.filter((_, i) => i !== oIdx);
                                        setCustomVariants(newVariants);
                                      }}
                                      className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {activeVariantGroup === group.name && (
                        <div className="p-3 bg-blue-50/50 border-t border-slate-100">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                            <div className="sm:col-span-4">
                              <input
                                type="text" placeholder="Nombre opción"
                                value={newVariantOptionName} onChange={e => setNewVariantOptionName(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <input
                                type="number" inputMode="decimal" placeholder="Cant." min="0" step="any"
                                value={newVariantOptionQty} onChange={e => setNewVariantOptionQty(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <select
                                value={newVariantOptionUnit} onChange={e => setNewVariantOptionUnit(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
                              >
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="l">l</option>
                                <option value="ml">ml</option>
                                <option value="ud">ud</option>
                              </select>
                            </div>
                            <div className="sm:col-span-3">
                              <input
                                type="number" inputMode="decimal" placeholder="Coste/Ud" min="0" step="any"
                                value={newVariantOptionCost} onChange={e => setNewVariantOptionCost(e.target.value)}
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <button
                                onClick={() => handleAddVariantOption(group.name)}
                                className="w-full bg-[#06b6d4] text-white p-1.5 rounded-md flex justify-center"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <form onSubmit={handleAddVariantGroup} className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <input
                        ref={variantGroupInputRef}
                        type="text"
                        value={newVariantGroupName}
                        onChange={e => {
                          setNewVariantGroupName(e.target.value);
                          if (variantGroupError) setVariantGroupError(false);
                        }}
                        className={`w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 transition-all ${variantGroupError
                          ? 'border-red-400 bg-red-50 ring-red-100 focus:ring-red-400 placeholder:text-red-400'
                          : 'border-slate-300 focus:ring-[#06b6d4]'
                          }`}
                        placeholder={variantGroupError ? "Introduce un nombre para el grupo..." : "Nueva categoría de variante (ej. Tipo de Arroz)"}
                      />
                      {variantGroupError && (
                        <span className="text-[10px] text-red-500 font-medium ml-1">El nombre del grupo es obligatorio</span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className={`h-fit px-4 py-2 rounded-lg text-sm font-medium transition-all ${variantGroupError
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                      Añadir Grupo
                    </button>
                  </form>
                </div>

                {/* Indirect Costs */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Calculator size={20} className="text-[#06b6d4]" />
                    Costes Indirectos
                    <div className="group relative flex items-center ml-1">
                      <Info size={16} className="text-slate-400 hover:text-[#06b6d4] cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl font-normal leading-relaxed pointer-events-none">
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        Gastos adicionales imputables al plato, como packaging, mano de obra específica o un porcentaje fijo de costes generales.
                      </div>
                    </div>
                  </h3>

                  {customIndirectCosts.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {customIndirectCosts.map((ic, idx) => (
                            <tr key={idx}>
                              <td className="p-3 font-medium text-slate-800">{ic.name}</td>
                              <td className="p-3 text-slate-600">
                                {ic.type === 'percentage' ? `${ic.value}% sobre coste` : `${ic.value}€ fijo`}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setCustomIndirectCosts(customIndirectCosts.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <form onSubmit={handleAddIndirectCost} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Concepto</label>
                      <input
                        type="text" required
                        value={newIcName} onChange={e => setNewIcName(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="Ej. Personal, Luz..."
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                      <select
                        value={newIcType} onChange={e => setNewIcType(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white"
                      >
                        <option value="percentage">% del coste</option>
                        <option value="fixed">€ Fijo</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Valor</label>
                      <input
                        type="number" inputMode="decimal" required min="0" step="any"
                        value={newIcValue} onChange={e => setNewIcValue(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="0"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg flex items-center justify-center transition-colors">
                        <Plus size={20} />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Operational Info & versioning */}
                <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Info size={20} className="text-[#06b6d4]" />
                    Información Operativa
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Versión del Escandallo</label>
                        <input
                          type="text" value={dishVersion} onChange={e => setDishVersion(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#06b6d4] bg-white"
                          placeholder="Ej. 1.0.0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Instrucciones de Preparación</label>
                      <textarea
                        rows={4}
                        value={instructions} onChange={e => setInstructions(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="Describe los pasos para cocinar el plato..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notas Internas (No visibles en cocina)</label>
                      <textarea
                        rows={2}
                        value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#06b6d4]"
                        placeholder="Notas sobre mermas especiales, proveedores, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Allergens Selection */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-5 h-5 bg-amber-100 text-amber-600 rounded flex items-center justify-center text-[10px] font-bold">!</div>
                    Alérgenos (Reglamento UE 1169/2011)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      'Gluten', 'Crustáceos', 'Huevos', 'Pescado', 'Cacahuetes', 'Soja', 'Lácteos',
                      'Frutos secos', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces', 'Moluscos'
                    ].map(alg => (
                      <label key={alg} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${dishAllergens[alg] ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-amber-600"
                          checked={!!dishAllergens[alg]}
                          onChange={(e) => setDishAllergens({ ...dishAllergens, [alg]: e.target.checked })}
                        />
                        <span className="text-sm font-medium">{alg}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Calculate Button */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveAndCalculate}
                    disabled={!dishName || dishPortions <= 0 || (customIngredients.length === 0 && customSubRecipes.length === 0)}
                    className="w-full sm:w-auto bg-[#06b6d4] hover:bg-[#0891b2] active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-medium transition-all shadow-md"
                  >
                    Guardar y Calcular
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {showPdfPreview && pdfData && (
        <div className="fixed inset-0 bg-slate-900/90 flex flex-col z-[100] animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-4 bg-[#1e293b] text-white border-b border-slate-700">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Eye size={20} className="text-[#06b6d4]" />
                Vista Previa de Ficha
              </h2>
              <div className="hidden sm:flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setPdfViewMode('kitchen')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${pdfViewMode === 'kitchen' ? 'bg-[#06b6d4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Modo Cocina
                </button>
                <button
                  onClick={() => setPdfViewMode('manager')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${pdfViewMode === 'manager' ? 'bg-[#06b6d4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Modo Manager
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PDFDownloadLink
                document={<RecipePDF data={pdfData} mode={pdfViewMode} />}
                fileName={`Ficha_${pdfData.identity.name.replace(/\s+/g, '_')}_${pdfViewMode}.pdf`}
                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                {({ loading }) => (
                  loading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />
                )}
              </PDFDownloadLink>
              <button
                onClick={() => setShowPdfPreview(false)}
                className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                title="Cerrar"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="sm:hidden flex bg-[#1e293b] p-2 gap-2 border-b border-slate-700">
            <button
              onClick={() => setPdfViewMode('kitchen')}
              className={`flex-1 py-2 rounded-md text-xs font-bold ${pdfViewMode === 'kitchen' ? 'bg-[#06b6d4] text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              COCINA
            </button>
            <button
              onClick={() => setPdfViewMode('manager')}
              className={`flex-1 py-2 rounded-md text-xs font-bold ${pdfViewMode === 'manager' ? 'bg-[#06b6d4] text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              MANAGER
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-slate-800 relative flex flex-col items-center justify-center">
            {!isCompact ? (
              /* Desktop View: Full integrated viewer with native tools */
              <div className="h-[calc(100vh-200px)] w-full overflow-hidden">
                <PDFViewer className="w-full h-full border-none" showToolbar={true}>
                  {pdfDocument!}
                </PDFViewer>
              </div>
            ) : (
              /* Compact View: Professional Fallback for Mobile/Small tablets */
              <MobilePDFFallback
                document={pdfDocument!}
                fileName={`Ficha_${pdfData.identity.name.replace(/\s+/g, '_')}_${pdfViewMode}.pdf`}
              />
            )}
          </div>

          <div className="p-4 bg-slate-900 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-xs">
              Optimizado para impresión B&N. Los alérgenos y el QR son obligatorios para cumplimiento legal y trazabilidad.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};