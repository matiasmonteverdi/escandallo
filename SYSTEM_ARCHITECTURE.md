# SYSTEM ARCHITECTURE & TECHNICAL DOCUMENTATION

Este documento está diseñado para proporcionar contexto técnico completo, detallado y estructurado sobre la aplicación actual a cualquier Agente IA o Desarrollador que se incorpore al proyecto.

## 1. DESCRIPCIÓN GENERAL
La aplicación es un **ERP/Sistema de Gestión para HORECA (Hostelería y Restauración)** enfocado en la gestión de costes de recetas (escandallos), control de inventario en tiempo real y producción. La aplicación está construida con un enfoque de "Action Board" (Orientada a la Acción), priorizando señales claras y alertas sobre gráficos genéricos.

### Stack Tecnológico
*   **Framework Frontend:** React 18+ con Vite.
*   **Lenguaje:** TypeScript (Tipado estricto en dominio).
*   **State Management:** Zustand (Store central sincronizado/en memoria).
*   **Styling:** Tailwind CSS + UI con Lucide React para iconos.
*   **Arquitectura de Datos:** Event Sourcing (para Inventario) + Master Data Management (Catálogo).

---

## 2. ARQUITECTURA DE DATOS Y MODELOS PRINCIPALES

El sistema abandonó el uso de "strings" para referenciar datos y utiliza UUIDs y catálogos maestros para asegurar coherencia transaccional (100% escalable para migración a bases de datos relacionales o NoSQL).

### 2.1. El Catálogo Central (`CatalogItem`)
Archivo fuente principal: `/src/data.ts` y `/src/store/useAppStore.ts`
*   **Filosofía:** Es el "Source of Truth" de la materia prima. 
*   **Estructura:**
    ```typescript
    interface CatalogItem {
      id: string; // UUID (ex: cat_1234)
      name: string; // Nombre de visualización
      defaultUnit: Unit; // Unidad de uso predeterminada (kg, L, g, ml, ud)
      baseCost: number; // Coste de referencia base por unidad de uso
    }
    ```
*   **Comportamiento Dinámico:** Cuando un usuario escribe un ingrediente en una receta, el sistema busca en el catálogo ignorando mayúsculas/minúsculas. Si no existe, lo crea al vuelo ("silent creation") generando su UUID.

### 2.2. Inventario Inmutable (Event Sourcing / Ledger)
No modificamos el stock sumando o restando un valor final estático. Usamos un **Registro Contable (Ledger)** basado en la acumulación de eventos.
*   **Modelo de Evento (`InventoryEvent`):**
    ```typescript
    interface InventoryEvent {
      id: string;
      type: 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT';
      ingredientId: string; // Foreing Key a CatalogItem.id
      quantity: number; // Positivo (Entradas) o Negativo (Salidas)
      unit: BaseUnit; // Siempre normalizado a unidades base (kg, L, ud)
      costPerUnit: number;
      timestamp: string;
      source: 'manual' | 'production'; // Trazabilidad
      referenceId?: string; // ID de Producción o factura
      batchId?: string;
      causality?: string; // Explicación legible del motivo ("Producido x2 Paellas")
    }
    ```
*   **Snapshotting:** Para evitar computar arrays infinitos, el store mantiene `inventorySnapshots` (puntos de captura estáticos del stock en un momento `T`). La función `computeStockProjection` en `/src/services/inventory.service.ts` toma el último snapshot y le suma los eventos de delta para proyectar el stock real a este segundo.

### 2.3. Recetas (Escandallos / `Dish`)
Modelo recursivo complejo capaz de manejar formulaciones directas, variantes e ingredientes compuestos (Sub-recetas).
*   **Estructura Base (`Dish`):** Contiene campos financieros (`targetMargin`, `taxPercentage`) para el cálculo inteligente de Suggested Price.
*   **Ingredientes (`Ingredient`):** Vinculados por `catalogId`. Almacenan `wastePercentage` (mermas).
*   **Sub-Recetas (`SubRecipeRequirement`):** Apuntan a otro `Dish.id`. El escalado de consumo de resolverá recursivamente.
*   **Variantes (`VariantGroup`):** Modificadores (ej: "Con Pollo" vs "Con Ternera").

---

## 3. FLUJOS PRINCIPALES Y LÓGICA DE NEGOCIO (SERVICES)

### 3.1. Producción (`production.service.ts`)
*   **Flujo:** Selección de Receta -> Definición de Raciones -> Ejecución.
*   **Efecto:** Dispara la función `generateConsumptionEventsForProduction(production, dish, allDishes)`.
*   **Algoritmo:** 
    1. Recorre ingredientes base, aplica mermas matemática y normaliza a unidades base usando `/src/domain/units.ts`, emitiendo eventos `CONSUMPTION`.
    2. Recorre `subRecipes` entrando en recursión para generar el impacto de stock escalado proporcional a las raciones de la receta padre.
    3. Resuelve `variants` emitiendo consumo para la opción de variante seleccionada.

### 3.2. Proyección y Cálculo de Costes (Costing Engine)
Para evitar bloqueos renderizando la vista de recetas (RecipesPage), calculamos:
*   `liveCost` dinámicamente obteniendo la referencia del stock via catálogo (qué precio real tiene mis compras).
*   Se compara el `liveCost` contra el `baseCost`. Las alertas críticas del Action Board (Dashboard) se nutren directamente de esta desviación porcentual.

---

## 4. VISTAS DEL FRONT-END Y SUS COMPONENTES

1.  **Dashboard (Action Board):** 
    - Diseñado bajo preceptos de UX para cocinas/chef. No hay KPIs vacíos (sin gráficos de donut).
    - **Top Section:** Alertas críticas cliqueables (ej. *costes disparados, invoca a revisar receta*).
    - **Summary:** Totales diarios (compras emitidas vs coste procesado hoy).
    - **Capital Inmovilizado & Actividad Contable:** Tablas top mostrando ingredientes con mayor inmovilización (Qty * Cost) usando alias del `catálogo` para mostrar nombres reales. Accesos rápidos en móviles.
2.  **Recipes Planner (Escandallos):** Vista en TABS ('Mis Platos' y 'Nuevo'). CRUD complejo con nested mapping de variantes. Usa `parseFloat` y parseos sanitizados. Mapea `catalogId` en UI.
3.  **Production (Cocina):** UI orientada a ejecución rápida de lotes. Genera `ProductionRecord` y muta el store de eventos simultáneamente.
4.  **Inventory (Gestión de Cámaras):** Listado proyectado del stock. 
    - Soporta registro de "COMPRAS" en diferentes formatos normalizados a posteriori (ej: comprar un pimiento por unidades, normalizado a unidades globales). 
    - Soporta "AJUSTAR STOCK REAL" como conciliación de mermas o inventario físico.
5.  **Debug Ledger (Registro Contable):** Registro inmutable ("Append-only"). Tabla forense de la aplicación donde se depura entrada por entrada el log financiero/operativo.

---

## 5. REGLAS DE UI / CSS Y DISEÑO

*   **Tailwind Utils:** Todo el estilo reside en clases utilitarias en línea siguiendo patrones `sm:`, `md:`. 
*   **Auditoría Reciente de CSS:**
    - Scrollbars modernas customizadas en `index.css`.
    - Eliminado el outline azul estándar de formularios web (`focus:ring-2 focus:ring-[#06b6d4]`).
    - Tipografía antialiased nativa optimizada (`WebkitFontSmoothing`).
*   **Principios de Estética Hostelería:** Interfaz "clean", muy espaciada (padding abundante), paleta basada en Slate (800 y 900) con contrastes muy selectivos en Cyan (`#06b6d4`) y acentos condicionales en Alertas (Red-600, Amber-500, Green-600).
*   **Responsive Categórico:** Se usan layouts dobles. En grids de tablas para Desktop (`hidden md:block/table`) contrapuestas a Tarjetas nativas apilables `md:hidden flex-col`.

---

## 6. DEUDA TÉCNICA RECONOCIDA Y NEXT STEPS (WARNINGS AL IA SYSTEM)

### 6.1. Gestión de Backups de DB / Mutabilidad de Estado
*   **Problema:** Actualmente Zustand funciona 100% en persistencia local por defecto (si hubiera middleware persist) o en memoria volátil de sesión.
*   **Fix requerido:** Plantear adaptadores de servicio a una DB asíncrona real (EJ: Supabase/Firestore) extrayendo el `useAppStore` para realizar Mutations y Query fetching con invalidación (react-query).

### 6.2. Master Data Management: Faltan ABM (CRUD) del Catálogo Explícito
*   **Problema:** Se implementó creación automática en las Recetas si no encuentra el ítem (`silent creation`). Pero no hay una UI en ningún "Tab" para borrar, unificar o editar el nombre de un Item base en el catálogo.
*   **Riesgo:** Si el cocinero asienta "Lechega" en lugar de "Lechuga", creará una entidad suelta. Habrá que implementar un Gestor de Catálogo para fusionar IDs de Catálogo y actualizar Referencias.

### 6.3. Resoluciones Circulares
*   **Problema:** En `generateConsumptionEventsForProduction()`, las resoluciones de subRecetas son recursivas.
*   **Riesgo:** No hay un chequeo estricto de recursividad indirecta infinita (ej: Receta A pide Receta B, Receta B pide Receta A). Alguien que lo asigne crasheará call stacks si no montamos un límite de profundidad (depth trap) en la iteración.

### 6.4. Control de Concurrencia de Eventos de Stock
*   **Riesgo:** Si un usuario abre multiples tabs y emite ajustes, la concatenación asume que la longitud de eventos transcurre sin latencia. En un entorno real se debe asegurar encriptación por optimismo (Lock version) hacia el DB server.

--- 
**FIN DEL DOCUMENTO TÉCNICO**
*Generado y mantenido automáticamente.*
