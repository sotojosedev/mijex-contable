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
- [ ] T4 (resto) Property: generar los registros desde sus facturas, recibos, cobros y pagos, aportar documentos externos, exportar por organización y consultar las obligaciones antes de cualquier emisión automática.
- [ ] T5 Catálogo de Property:
  - inventario de sus reglas fiscales existentes (alquileres, comunidades, honorarios, liquidaciones) como APPROVED_PENDING_VERIFICATION, con su referencia cuando exista, sin cambiar su comportamiento;
  - las que se contrasten con la fuente oficial pasan a VERIFIED;
  - lo que no tenga regla queda en MANUAL_REVIEW.
