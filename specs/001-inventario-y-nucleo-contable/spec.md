# Spec 001 — Inventario contable y núcleo de la librería

| Campo | Valor |
|-------|-------|
| Estado | Aprobada (Clarify 2026-11-17) · fase 1a implementada |
| Fecha | 2026-11-17 |
| Alcance | Inventario de lo contable en HS, Property y `mijex-fiscal`; frontera contable/fiscal; núcleo de `mijex-contable` (plan de cuentas y reglas de asiento como datos, libro mayor inmutable) |
| Reglas que crea | R-CORE-002…005 (abajo); las de país (plan de cuentas ES/DO) tras Clarify |

## 1. Problema
- **HS** tiene un libro mayor de partida doble completo, pero el plan de cuentas está fijo en
  el código (`ACCOUNTS`, 21 cuentas de 4 dígitos), es el mismo para todos los países y las
  reglas de asiento están escritas a mano (unos 15 `postX`).
  - Incumple P3/P4 (multi-país configurable sin código) y R-CORE-001 (unos 180 `round2` en
    coma flotante).
  - España usa un plan genérico en lugar del PGC.
- **Property** no lleva contabilidad de partida doble: tiene finanzas operativas (resumen,
  liquidación al propietario, cuotas de comunidad, conciliación) y un informe de ingresos
  por suscripción que no guarda asientos.
- **`mijex-fiscal`** tiene `money.ts` (dinero exacto) y `settlement.ts` (reparto de comisión y
  retenciones), que usan las dos apps.

## 2. Inventario (verificado en el código, 2026-11-17)

### HS (`wt-hs-contingencia/backend`)
| Pieza | Ficheros | Líneas | Qué es | Destino propuesto |
|---|---|---|---|---|
| Libro mayor | `services/ledger.ts`; modelos `LedgerAccount`, `JournalEntry`, `JournalLine` | 825 | Motor de asientos idempotente por (origen, id, evento); reversión; backfill `syncLedger` | **Núcleo de la librería** (fase 1) |
| Informes contables | `services/accountingReports.ts` (`trialBalance`, `incomeStatement`, `balanceSheet`, `salesTaxReport`, `listJournal`) | ≈150 | Balance de comprobación, PyG y balance de situación desde el mayor | **Librería** (fase 1) |
| Formatos DGII | `accountingReports.ts` (`dgii606/607/608`, `ir17Summary`) | ≈180 | Declaraciones informativas desde documentos y mayor | **Frontera (Q3)** |
| Movimientos de dinero | `MoneyTransaction` (derivado de asientos de tesorería) | — | Base de la conciliación | Librería (fase 2) |
| Conciliación bancaria | `services/bankReconciliation.ts`, `BankStatementImport/Line` | 465 | Importar CSV, casar y estado | Librería (fase 2), reutilizando el lector de Property |
| Liquidaciones, deuda de efectivo, saldo a favor, estado de cuenta de organización, compras | `payouts.ts`, `cashDebt.ts`, `clientCreditApplications.ts`, `orgStatement.service.ts`, `purchasing.ts` | ≈1.500 | Lógica de negocio que **genera hechos contables** | Se quedan en HS; emiten eventos al mayor de la librería |
| Notas de crédito y desglose | `creditNotes.ts`, `invoiceBreakdown.ts` | ≈440 | Documentos comerciales | Se quedan en HS (`round2` → R-CORE-001) |

### Property (`wt-prop-contingencia/backend`)
| Pieza | Ficheros | Qué es | Destino propuesto |
|---|---|---|---|
| Resumen financiero | `financeEngine.ts` | Agregados operativos | Se queda (Q1) |
| Liquidación al propietario | `ownerStatement.ts` | Cuenta de un mandante (cobros − gastos − honorarios) | Q1 |
| Comunidades | `communityMath.ts`, `communityManagement.ts`, `CommunityEntry` | Presupuesto, cuotas, derramas | Q1 |
| Conciliación | `reconciliation.ts`, `paymentReconciliation.ts`, `platformReconciliationMath.ts`, `bankStatement.ts`, `platformBank.ts` | Casar movimientos con facturas y cuotas | Librería (fase 2): un solo lector de extractos y un solo motor de casado |
| Ingresos por suscripción | `subscriptionRevenue.ts` | Devengo y cobro de las suscripciones de MIJEX (informe) | Pasa a asientos en el mayor de MIJEX (Q1) |
| Gastos y activos | `Expense`, `Asset` | Datos operativos; sin amortización contable | Q1 |

### `mijex-fiscal`
| Pieza | Qué es | Destino |
|---|---|---|
| `core/money.ts` | Unidades menores, `allocate`, `percentOf`, `roundHalfUp` | Se queda; la librería contable lo **reutiliza** (no se duplica) |
| `core/settlement.ts` | Reparto comisión/retenciones de un servicio | Se queda: calcula importes de documentos fiscales |

## 3. Propuesta de núcleo (sujeta a Clarify)
- **Plan de cuentas como datos** por país y versión con vigencia, con regla y referencia por
  cuenta (P3/P4). Cada país parte de su marco oficial: ES con el PGC o el PGC PYMES (BOE); DO
  según Q2.
- **Reglas de asiento como datos:** evento de negocio → líneas (cuenta por rol, importe por
  fórmula sobre los importes del evento), versionadas por vigencia. Las apps emiten eventos
  (`InvoiceIssued`, `PaymentVerified`…) y no cuentas.
- **Libro mayor inmutable:**
  - asientos de solo inserción;
  - corrección por asiento de reversión, con quién, cuándo y por qué;
  - cuadre debe = haber en cada asiento;
  - idempotencia por (origen, id, evento);
  - dinero en bigint (R-CORE-001).
- **Informes** desde el mayor: comprobación, PyG y balance de situación con los formatos de
  cada marco.
- **Arquitectura (Q4):** librería TypeScript con puertos y almacén en memoria y PostgreSQL, y
  tests de contrato, igual que `mijex-fiscal`.

## 4. Reglas técnicas nuevas (CORE; referencia = decisión del usuario en Clarify)
- **R-CORE-002:** cada asiento cuadra (Σ debe = Σ haber, en unidades menores) o se rechaza.
- **R-CORE-003:** el mayor es de solo inserción; un error se corrige con un asiento de
  reversión enlazado y motivado.
- **R-CORE-004:** un mismo hecho (origen, id, evento) genera un único asiento (idempotencia).
- **R-CORE-005:** las cuentas y las reglas de asiento son datos versionados por vigencia; ningún
  país ni código de cuenta está fijo en el código.

## 5. Fases propuestas
1. **Núcleo:** plan de cuentas y reglas como datos, mayor inmutable e informes básicos (memoria
   y PostgreSQL).
2. **HS:** sus asientos pasan a la librería con un comparador (antiguo y nuevo en paralelo con
   datos copiados hasta que no haya diferencias). Después se borra en HS, con confirmación.
3. **Conciliación común** (HS y Property).
4. **Property:** asientos de MIJEX por las suscripciones y lo que decida Q1.
