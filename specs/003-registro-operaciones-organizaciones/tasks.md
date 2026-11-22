# Tareas — Spec 003

- [x] T1 Specify (`spec.md`) con la decisión del usuario (REF-DEC-008): no son los libros oficiales de la organización.
- [x] T2 Núcleo: `createOperationsRegister` (idempotente por origen, enlaces solo dentro de la organización, `trace`), `exportOperationsCsv` (cabecera estable, importes exactos, protegido frente a fórmulas) y obligaciones por tipo de organización (`resolveObligation`, `assertAutomaticIssuance`). R-CORE-012…014.
- [x] T3 PostgreSQL: migración 0003 (`contable.operation_record`, solo inserción, única por origen, índice por organización y fecha) y `createPgOperationsStore`; contrato común en memoria y PostgreSQL, incluida la carrera de dos registros del mismo origen.
- [x] T3b Catálogo de reglas fiscales y `decideFiscalIssuance` por operación (REF-DEC-009), en lugar de las obligaciones por tipo.
- [x] T4a Property, registro (sin tocar la emisión fiscal):
  - `operationsRegister.ts` genera los registros de facturas de alquiler y de comunidad, cobros conciliados (enlazados a su factura) y gastos (salidas), idempotentes, sobre el esquema `contable` (`migrate`).
  - Rutas `/api/v1/operations` (módulo Finanzas, ORG_ADMIN y PROPERTY_MANAGER): lista por periodo, trazabilidad, documento externo (validado con zod, importe exacto) y exportación CSV auditada.
  - e2e `operations-register.e2e.test.ts`. La prueba detectó una filtración entre organizaciones (dos `OR` en la misma consulta), ya corregida con `AND`.
- [x] T4b Property, emisión: catálogo, `decideFiscalIssuance` antes de emitir y bandera `FISCAL_RULE_GATE`.
  - [x] Módulo puro `fiscalRuleCatalog.ts` (catálogo ES/DO × tipo de organización × tipo de factura, `decideInvoiceIssuance`, `fiscalRuleGateEnabled`) con 8 tests `[R-CORE-014]`.
  - [x] Conectado en `fiscalBridge.issuePendingWithFiscalCore` (aprobado por el usuario el 2026-11-19): MANUAL_REVIEW o NO_FISCAL_DOCUMENT → `fiscalHold = HELD` con el motivo y la auditoría `INVOICE_FISCAL_HELD`, solo de esa factura. e2e `fiscal-rule-gate-003.e2e.test.ts`.
## Corte 2 (clarify resuelto, REF-DEC-013; plan y migraciones aprobados el 2026-11-22)
Orden por dependencias. Cada tarea de código empieza por su test en rojo. Ninguna migración se aplica en un entorno
sin la aprobación final de ese paso.

### A · Fallo Q3 (hecho el 2026-11-22)
- [x] **T010** e2e Property `operations-register-003`. En rojo con el código anterior: `internal_error` (500) en cuanto
  la cuota se numera, cambia de contraparte o se anula. Ahora pasa.
  - Precisión, tomada antes de implementar: una cuota sin número se registra como cargo **sin documento** (no figura
    como documento fiscal emitido); solo espera la que está retenida (`HELD`) o en revisión fiscal. Si no, las
    organizaciones sin numeración perderían sus operaciones.
- [x] **T011** Contrato común (memoria y PG), `[R-CORE-012] corrección por reversión`, 7 pruebas en rojo primero:
  - idempotencia;
  - reversión + versión nueva con el original intacto;
  - `current`;
  - primera versión;
  - anulación con motivo y repetida sin efecto;
  - motivo obligatorio;
  - dos correcciones simultáneas: una gana y la otra recibe `CONCURRENT_UPDATE`.
- [x] **T012** Librería:
  - `recordCorrection`, `recordReversal` y `current` (solo lectura);
  - `OperationRecord` con `sourceVersion`, `reverses` y `reason`;
  - almacén con `versionsBySource`;
  - error `CONCURRENT_UPDATE`.
  - La reversión lleva la fecha de la operación que anula, para que el saldo del periodo cuadre.
- [x] **T013** `migrations/0004_operation_record_v2.sql`, validada en la base de pruebas de la librería:
  - contrato PG (37 pruebas);
  - motivo obligatorio y una sola reversión por registro en la base;
  - aplicada sobre datos de la 0003 en una base temporal, que luego se borró: las filas quedan en la versión 1.
- [x] **T014** Property:
  - `syncOrganizationOperations` corrige en lugar de fallar y revierte las anuladas;
  - no registra las retenidas ni las que están en revisión;
  - el cobro conserva el enlace a la cuota que tenía;
  - un registro que no se puede hacer queda pendiente y se devuelve, sin tumbar la consulta.
- Verificación:
  - librería: eslint sin errores, typecheck, 76 unitarias, 37 PG y build;
  - Property: oxlint sin avisos nuevos, typecheck, 522 unitarias, `operations-register-003` y `operations-register`.
- **Aviso de entorno:**
  - Property y HS enlazan la librería compilada y aplican sus migraciones al usarla: Property al primer uso de
    `/operations` y HS al arrancar en modo sombra.
  - Con `dist/` recompilado, arrancar un servidor de **desarrollo** de `wt-prop-contingencia` o `wt-hs-contingencia`
    aplicaría la 0004 en su base de desarrollo.
  - Necesita la aprobación final de ese paso. Hoy no hay ninguno de esos servidores en marcha.

### B · Catálogo en datos (hecho el 2026-11-22)
- [x] **T020** Contrato común (memoria y PG) `[R-CORE-014] catálogo fiscal en datos versionados`, 7 pruebas en rojo
  primero:
  - carga inicial idempotente que traslada lo aprobado tal cual;
  - cada cambio es una versión nueva y el histórico se conserva;
  - VERIFIED sin referencia, rechazada;
  - lo pendiente no crea reglas ni cambia tratamientos;
  - motivo, autor y vigencia obligatorios;
  - una vigencia nueva no borra la anterior;
  - dos versiones a la vez: `CONCURRENT_UPDATE`.
  En PG, además: solo inserción y referencia obligatoria en la base.
- [x] **T021**
  - `migrations/0005_fiscal_rule_catalog.sql`, validada en la base de pruebas de la librería;
  - `createFiscalRuleCatalog`, `FiscalRuleStore` (memoria y PG) y `createPgFiscalRuleStore`;
  - `decideFiscalIssuance` no cambia: recibe todas las versiones y elige por vigencia y versión.
- [x] **T022** Property:
  - `contableDb.ts`, una sola conexión con el esquema `contable` para el registro y el catálogo;
  - `propertyFiscalCatalog()` con la carga inicial de las 30 reglas (motivo con REF-DEC-013);
  - `fiscalBridge` lee las reglas de los datos.
  - e2e `fiscal-rule-catalog-003` (en rojo primero): carga sin cambios y una versión 2 verificada que decide sin
    desplegar.
  - `fiscal-rule-gate-003` sigue en verde.
  - El arnés e2e vacía también el esquema `contable` (antes quedaba estado entre archivos).
- [x] **T023** `catalogDecides`: con el motor de la 055 activo, en alquiler el catálogo no vuelve a decidir; sin motor,
  sí, y para comunidades y otras facturas, siempre. Probado con unitarias (en rojo primero); en la e2e se cubre el
  caso sin motor. Activar el motor en una e2e era desproporcionado, así que el caso con motor queda en las unitarias.
- [x] **T024** `GET /admin/fiscal/rule-catalog` (PA y PF, por los países de la consola) y
  `POST /admin/fiscal/rule-catalog/versions` (solo PA del país; auditado `FISCAL_RULE_VERSION_RECORDED`).
  e2e `fiscal-rule-catalog-routes-003` (en rojo primero):
  - ORG_ADMIN y PF → 403; otro país → 404;
  - sin referencia o con cambio de tratamiento sin verificar → 422; sin motivo → 400;
  - la versión 2 queda auditada y el histórico se conserva.

### C · Orígenes nuevos y naturaleza (Q4)
- [x] **T030** Unit: naturaleza, tipos nuevos y CSV con las columnas al final, compatible. Hecho el 2026-11-22:
  - `nature` opcional (`OPERATION_NATURES`), validada y parte de los datos: cambiarla es una corrección;
  - tipos `WITHHOLDING` y `FEE_ACCRUAL`;
  - CSV: `naturaleza;version_origen;revierte;motivo` al final, las columnas anteriores en el mismo orden.
- [x] **T031** Property: cada origen, registrado al ocurrir y sin duplicar, con su e2e:
  - recibo;
  - retención;
  - obligación pagada (un solo registro con su movimiento de banco);
  - `Payout` a propietario y a proveedor;
  - gasto como `SUPPLIER_INVOICE` y su pago una sola vez.
  Hecho el 2026-11-22 (e2e `operations-origins-003`, comprobada con mutaciones):
  - naturaleza por la titularidad que Property ya usa en el recibo (spec 052) y en la comunidad (spec 054); lo que no
    se puede clasificar queda sin naturaleza, nunca como ingreso propio;
  - retención: solo la practicada en un cobro conciliado y fuera de revisión;
  - transferencia al propietario: `SETTLEMENT`; a un proveedor: pago del gasto enlazado a su factura;
  - registro al ocurrir: cobro, anulación de cobro, pago fiscal, transferencia pagada y gasto nuevo avisan a una cola
    que registra fuera de la transacción de origen (si falla, queda para la recuperación). Activa en el servidor y en
    las e2e, nunca en las unitarias.
- [x] **T032** Property: recuperación paginada sin `take: 5000` (`POST /operations/sync`), con informe de lo
  pendiente; reclasificación de los gastos del T4a por reversión. Hecho el 2026-11-22: `eachPage` por cursor (unit),
  `GET /operations` y `/export` solo leen, `POST /operations/sync` auditado (`OPERATIONS_SYNCED`).
- [x] **T033** Honorarios: `FEE_ACCRUAL` mensual por contrato y moneda, con el mismo cálculo que la spec 051.
  Implementado el 2026-11-22: un devengo por propietario, mes cerrado y moneda con el importe de
  `computeOwnerStatement` de ese mes. Origen `management-fee:<propietario>:<AAAA-MM>:<moneda>` (por propietario y no
  por contrato: rige una sola versión por mes y la clave no cambia con cada versión). e2e `fee-accrual-003`.
- [x] **T034** Liquidación guardada (`OwnerSettlement`, opción A). Propuesta `liquidacion-guardada.md` aprobada el
  2026-11-22 tal cual (las 4 preguntas con la opción propuesta). Implementado el 2026-11-22: migración Prisma
  `20261122100000_spec003_liquidacion_guardada` (CHECK de importes, meses enteros y anulación; triggers de foto
  inmutable y de coherencia propietario/organización/moneda); `GET|POST /rentals/owners/:id/settlements` y
  `POST …/:settlementId/void` (auditados); `settlementId` opcional en `POST /finance/payouts`; registro
  `fee-compensation:<id>` (`COLLECTION`, ingreso propio) enlazado a los devengos de sus meses, y la transferencia
  pagada enlazada a la compensación. e2e `owner-settlement-003` (comprobado con un mutante sin trigger).

### D · Interfaz
- [x] **T040** Pantalla de operaciones (consulta, naturaleza y exportación) y tarjeta del catálogo para la
  plataforma. Hecho el 2026-11-22: pestaña «Registro de operaciones» en Finanzas (solo AD y PM; periodo, filtro por
  naturaleza, estado vigente/revertido/reversión, «Actualizar registro» y CSV) y `PlatformFiscalRuleCatalogCard` en la
  consola (lectura; versión nueva solo PLATFORM_ADMIN). Unit `operationsView.test.ts`. Sin prueba manual en navegador.

### E · Cambio aparte (aprobado el 2026-11-22)
- [x] **T050** Property: `PATCH /invoices/:id` no cambia el importe ni la fecha de una cuota con número fiscal (409);
  se corrige con la rectificación legal. e2e en rojo primero. Hecho el 2026-11-22: `fiscal_number_issued` tras las
  comprobaciones anteriores (que conservan su código, p. ej. `fiscal_record_issued`); el estado sí cambia. e2e
  `numbered-invoice-edit-003`. Consecuencia: ya no se prorroga el vencimiento de una cuota numerada.

### F · Verificación y cierre
- [x] **T090** Regresión completa (`migraciones-y-regresion.md` §5.2): librería, Property (backend y frontend) y Home
  Services. 2026-11-22: librería 87 unit + 49 PG; Property 529 unit, 158/158 ficheros e2e, frontend 94 ficheros
  (347 pruebas) y build; HS 1329 pruebas, con 2 intermitentes (`leadsAutomation`, `partnerWebhookDocuments`) que pasan
  por separado. El build del frontend fallaba por un error de tipos anterior (062e, `TenantInvoicesPage`), corregido.
- [x] **T095** R-CORE-012 y R-CORE-014 ampliadas, REF-DEC-013, `docs/diseno-tecnico.md` e índice de `sdd/`.

## Analyze · trazabilidad
| Decisión | Tareas | Tests |
|----------|--------|-------|
| Q1 (una decisión en alquiler) | T023 | e2e de la puerta única |
| Q2 (catálogo en datos) | T020–T022, T024 | unit, PG y e2e del catálogo |
| Q3 (corrección inmutable) | T010–T014 | e2e del fallo, unit y PG de corrección |
| Q4 (orígenes, naturalezas, sin duplicados, honorarios) | T030–T034 | unit de naturaleza, e2e por origen |
| Q5 (sin HS) | T090 | regresión de HS sin cambios |
| §4 (cuotas numeradas) | T050 | e2e 409 |
