Plan de Implementación Final (Congelado y Ejecutable)
Este plan está diseñado para que la IA lo ejecute sin perder contexto, con riesgo mínimo y sin romper el sistema actual.
Objetivo: desacoplar pricing y consumo físico, añadir modo de producción global y mantener compatibilidad legacy.

0) Objetivo funcional definitivo
Soportar 3 comportamientos reales:

Producción real (default)

Usa precios (WAC o manual según ingrediente)
Consume stock según consumeStock por ingrediente
Producción teórica (simulación global)

Calcula todo igual
No genera eventos de consumo (no afecta inventario)
Ingrediente no consumible en modo real

Impacta coste
No descuenta stock (consumeStock=false)
1) Reglas de diseño (no negociables)
No romper legacy: defaults implícitos (mode='real', consumeStock=true)
pricing y stock movement son capas separadas
mode se decide solo en wrapper de producción
skippedIngredientIds usa IDs, nunca nombres
consumeStock ?? true se normaliza en un único helper
Recursividad de subrecetas debe heredar siempre el mismo mode
2) Fases de implementación (orden estricto)
Fase A — Baseline y saneamiento mínimo
Antes de nuevas features, estabilizar base:

Resolver inconsistencias críticas de tipos que afecten rutas tocadas (Dish.variants, Production shape, imports rotos).
Asegurar compilación en los módulos que vamos a modificar.
Salida esperada: base confiable para cambios de dominio.

Fase B — Dominio y tipos (Commit 1)
Archivos
src/domain/types.ts y/o src/data.ts, src/domain/production.ts
Cambios
Añadir:
type ProductionMode = 'real' | 'theoretical'
Extender Ingredient:
priceSource?: 'inventory' | 'manual'
consumeStock?: boolean
Extender input/entidad de producción:
mode?: ProductionMode
Compatibilidad
Legacy se interpreta como:
mode ?? 'real'
consumeStock ?? true
Salida esperada: tipos listos sin alterar comportamiento.

Fase C — Pricing engine puro (Commit 2)
Archivo
src/services/pricing.service.ts (crear o consolidar)
Función
resolveIngredientCost(...) devuelve:
costPerUsageUnit
source: 'inventory' | 'manual'
Reglas
Sin side effects
Sin emitir eventos
Sin mezclar con inventario físico
Reusar normalizeQuantity/normalizeCost desde domain/units
Salida esperada: cálculo determinístico, testeable y aislado.

Fase D — Wrapper de producción (Commit 3 - clave)
Archivo
src/services/production.service.ts
Añadir función de entrada única
generateProductionResult(input: ProductionInput)
Comportamiento
Normaliza mode = input.mode ?? 'real'
Si mode === 'theoretical' retorna:
events: []
simulated: true
skippedIngredientIds: []
Si mode === 'real':
llama a interno con mode inyectado
retorna { events, simulated: false, skippedIngredientIds }
Salida esperada: punto único de decisión de modo + simulación auditable.

Fase E — Consumo granular + normalización única (Commit 4)
Archivo
src/services/production.service.ts
Añadir helper único
normalizeIngredient(i) => consumeStock: i.consumeStock ?? true
En generador interno
Filtrar ingredientes consumibles:
si consumeStock=false, no evento y agregar catalogId a skippedIngredientIds
Mantener cálculo de cantidades/costes como hoy para consumibles
Recursión subrecetas
Propagar siempre mode en cada llamada interna recursiva
Aplicar mismo filtro consumeStock en subrecetas
Salida esperada: consumo parcial controlado en real, cero consumo en theoretical.

Fase F — Preflight por modo (Commit 5)
Archivo
production.service.ts o servicio de validación asociado
Reglas
mode='theoretical':
saltar validación de faltante de stock
mode='real':
validar stock solo de ingredientes consumibles
Validaciones estructurales/domain (IDs inválidos, inactivos) se mantienen según política actual
Salida esperada: warnings/errores coherentes con el modo operativo.

Fase G — Recipes UI (Commit 6)
Archivo
src/pages/RecipesPage.tsx
Estado nuevo ingrediente
useInventoryPrice
consumeStock
Reglas UI
Si useInventoryPrice=false => forzar consumeStock=false
Bloquear combinación inválida manual+consume
Tooltip: “si está desactivado, no afectará stock en producción”
Guardado ingrediente (crítico)
Resolver coste con resolveIngredientCost(...)
Persistir:
costPerUnit
priceSource
consumeStock
Antiduplicados catálogo
Normalizar nombre (trim().toLowerCase()) antes de crear
Reusar catalog existente si coincide
Salida esperada: ingrediente coherente y deterministicamente guardado.

Fase H — Production UI global (Commit 7)
Archivo
src/pages/ProductionPage.tsx
Estado nuevo
productionMode: 'real' | 'theoretical' (default real)
UI
Selector claro real/simulación
Badge visible en simulación:
🧪 Simulación (no afecta inventario)
Integración
Usar generateProductionResult({ ..., mode: productionMode })
Persistir producción con mode para trazabilidad futura
Salida esperada: operador entiende y controla impacto global.

Fase I — Badges y claridad operativa (Commit 8)
Archivos
RecipesPage y vistas de detalle/listados de ingredientes relevantes
Mostrar estado de fuente/consumo
Inventario (consume)
Inventario (no consume)
Manual
Opcional: Sin precio cuando aplique
Salida esperada: cero ambigüedad de negocio en UI.

Fase J — QA funcional obligatorio (Commit 9)
Ejecutar y documentar estos casos:

real + consume=true -> genera eventos
real + consume=false -> no evento para ese ingrediente
theoretical -> 0 eventos, simulated=true
subrecetas mixtas en real -> consume solo los habilitados
subrecetas en theoretical -> 0 eventos total
manual + consume=true -> bloqueado en UI
WAC + consume=false -> coste correcto, stock intacto
skippedIngredientIds poblado con IDs correctos
Salida esperada: validación completa del modelo.

3) Checklist por archivo (resumen operativo IA)
src/domain/types.ts / src/data.ts:
ProductionMode, Ingredient.consumeStock, Ingredient.priceSource, Production.mode
src/services/pricing.service.ts:
resolveIngredientCost puro
src/services/production.service.ts:
generateProductionResult
normalizeIngredient
generateConsumptionEventsInternal(..., mode)
recursión con mode
retorno skippedIngredientIds
preflight aware de modo
src/pages/RecipesPage.tsx:
toggles + reglas + guardado determinístico + normalización de catálogo
src/pages/ProductionPage.tsx:
selector global productionMode
badge simulación
integración con wrapper
4) Riesgos y mitigaciones
Riesgo: doble lógica de mode dispersa
Mitigación: wrapper único obligatorio
Riesgo: defaults repetidos y bugs por olvido
Mitigación: normalizeIngredient único
Riesgo: confusión operativa en cocina
Mitigación: badges explícitos + textos claros
Riesgo: romper ledger actual
Mitigación: cambios opt-in y pruebas por escenario
5) Definición de Done (final)
Legacy intacto sin configuración extra
productionMode global funcional
consumeStock granular funcional
Simulación auditable (simulated, skippedIngredientIds)
Subrecetas coherentes con el mismo mode
Costes y stock desacoplados correctamente
QA completo aprobado
Build/lint de TypeScript sin errores introducidos por estos cambios