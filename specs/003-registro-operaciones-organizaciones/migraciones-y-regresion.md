# 003 · Migraciones, dependencias afectadas y regresión (para aprobar antes de implementar)

| Campo | Valor |
|-------|-------|
| Estado | **Aprobado por el dueño el 2026-11-22**:<br>• migraciones 0004 y 0005 y carga inicial del catálogo;<br>• compensación de honorarios con la opción **A**, liquidación guardada, cuya migración Prisma se presentará aparte;<br>• bloquear la edición de cuotas con número fiscal, en un cambio aparte.<br>Aplicarlas en cada entorno sigue necesitando la aprobación final de ese paso. |
| Fecha | 2026-11-22 |
| Base | [clarify.md](clarify.md) resuelto · [plan.md](plan.md) |

Nada de esto se ha ejecutado. Ninguna migración se aplica en ningún entorno sin aprobación, siguiendo el mismo
criterio que las migraciones B a E de Property: preparar y validar en la base de pruebas, presentar y pedir la
aprobación final.

## 1. Migraciones

### 1.1 Librería, `migrations/0004_operation_record_v2.sql` (aditiva)
Amplía el registro existente sin tocar sus filas. La tabla sigue siendo de solo inserción (trigger `reject_mutation`).

```sql
ALTER TABLE contable.operation_record
  ADD COLUMN nature          text CHECK (nature IN ('OWN_INCOME', 'THIRD_PARTY_FUNDS', 'WITHHOLDING', 'TAX_PAYMENT', 'SETTLEMENT')),
  ADD COLUMN source_version  integer NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  ADD COLUMN reverses        uuid REFERENCES contable.operation_record (id),
  ADD COLUMN reason          text;

-- Nuevos tipos: retención y devengo de honorarios (los anteriores siguen valiendo).
ALTER TABLE contable.operation_record DROP CONSTRAINT operation_record_kind_check;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_kind_check
  CHECK (kind IN ('INVOICE', 'RECEIPT', 'COLLECTION', 'PAYMENT', 'SUPPLIER_INVOICE', 'EXTERNAL', 'WITHHOLDING', 'FEE_ACCRUAL'));

-- Corrección (Q3): un mismo origen puede tener varias versiones; cada registro se revierte como mucho una vez.
ALTER TABLE contable.operation_record DROP CONSTRAINT operation_record_source_key;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_source_key UNIQUE (source_system, source_id, source_version);
CREATE UNIQUE INDEX operation_record_reverses_key ON contable.operation_record (reverses) WHERE reverses IS NOT NULL;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_reversal_reason
  CHECK (reverses IS NULL OR (reason IS NOT NULL AND btrim(reason) <> ''));
```

- **Filas existentes:** quedan en `source_version = 1`, sin naturaleza y sin reversión. Siguen siendo válidas.
- **Bloqueos:** `ADD COLUMN` con `DEFAULT` constante no reescribe la tabla (PostgreSQL ≥ 11). El cambio de CHECK y del
  único toma un bloqueo breve; el volumen actual es pequeño.
- **Vuelta atrás:** borrar el índice y las columnas y restaurar el CHECK y el único anteriores. Solo es posible si
  no hay versiones mayores que 1 ni tipos nuevos; si los hay, se revisa antes de revertir.
- **Comprobación previa (solo lectura):** contar las filas por organización y confirmar que no hay duplicados por
  `(source_system, source_id)`.

### 1.2 Librería, `migrations/0005_fiscal_rule_catalog.sql` (tabla nueva)
Catálogo de reglas fiscales genérico (R-CORE-014 en datos), sin nada específico de Property (Q5). Es de solo
inserción: un cambio de estado o de contenido es una **versión nueva**. Así se conservan las reglas históricas y la
auditoría.

```sql
CREATE TABLE contable.fiscal_rule (
  id                uuid PRIMARY KEY,
  rule_id           text NOT NULL CHECK (rule_id <> ''),
  version           integer NOT NULL CHECK (version >= 1),
  country           text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  jurisdiction      text NOT NULL CHECK (jurisdiction <> ''),
  organization_type text NOT NULL CHECK (organization_type <> ''),
  operation_type    text NOT NULL CHECK (operation_type <> ''),
  treatment         text NOT NULL CHECK (treatment <> ''),
  validation        text NOT NULL CHECK (validation IN ('VERIFIED', 'APPROVED_PENDING_VERIFICATION', 'UNDETERMINED')),
  reference         text,
  valid_from        date NOT NULL,
  valid_to          date,
  recorded_by       text NOT NULL CHECK (recorded_by <> ''),
  reason            text NOT NULL CHECK (btrim(reason) <> ''),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_rule_version_key UNIQUE (rule_id, version),
  CONSTRAINT fiscal_rule_verified_reference CHECK (validation <> 'VERIFIED' OR (reference IS NOT NULL AND btrim(reference) <> '')),
  CONSTRAINT fiscal_rule_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX fiscal_rule_lookup_idx ON contable.fiscal_rule (country, organization_type, operation_type, valid_from);
CREATE TRIGGER fiscal_rule_immutable BEFORE UPDATE OR DELETE ON contable.fiscal_rule FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
```

- `VERIFIED` exige una referencia oficial (K2). La vigente de cada `rule_id` es la versión mayor.
- **Vuelta atrás:** `DROP TABLE` mientras no la use nadie.

### 1.3 Property: sin migración Prisma
- El catálogo y el registro viven en el esquema `contable` de la misma base. Property los aplica con
  `migrate(pool)` de la librería, como ya hace con la 0003.
- **Carga inicial** (dato, no migración): un script idempotente de Property inserta las 30 reglas actuales de
  `PROPERTY_FISCAL_RULES` (ES y DO × 5 tipos de organización × ARRIENDO, COMUNIDAD, OTRO) como versión 1, con el
  **mismo** tratamiento y la misma validación. Así **no cambia ningún comportamiento**.
  - Las filas de ARRIENDO quedan solo como histórico: en alquiler decide la 055 (Q1).
- **Registros ya existentes del T4a:** los gastos se registraron como `PAYMENT` en la fecha del gasto. Con la regla
  sin duplicados, el gasto pasa a `SUPPLIER_INVOICE` y el pago sale de su `Payout` o de `paidAt`. Los registros
  antiguos no se tocan: la sincronización de recuperación añade su reversión y los nuevos, con motivo
  «reclasificación 003».

## 2. Dependencias afectadas

| Dónde | Qué cambia | Compatibilidad |
|-------|-----------|----------------|
| **Librería, API pública** | `OperationInput` con `nature?`, `kind` ampliado, `recordCorrection`, `recordReversal`, `FiscalRuleStore` (memoria y PG). El CSV añade `nature`, `source_version` y `reverses` **al final** de la cabecera. | MINOR: nada se quita ni cambia de orden. Se versiona el paquete. |
| **Home Services** | `contableShadow.ts` aplica `migrate(pool)` en modo sombra: la 0004 y la 0005 crearán las columnas y la tabla también en su base, **sin uso**. Ningún flujo de HS cambia (Q5). | Aditivo. Su regresión se pasa entera. |
| **Property, registro** | `operationsRegister.ts`: registro al ocurrir y recuperación paginada (sin `take: 5000`). `operations.routes.ts`: `GET` solo lee y hay `POST /operations/sync`. | El `GET` deja de sincronizar: la primera vez hay que lanzar la recuperación. |
| **Property, puntos de registro** | Al confirmar la transacción de origen en: emisión y numeración (`rentInvoices`, `fiscalBridge`); cobro (`invoicePayments`, `reconciliation`); recibo (`paymentReceipts`); retención (`withholdingDecisions`); obligación pagada (ruta `tax-obligations/:id/pay`); `Payout` PAGADA (`financeBank.routes`); anulación y edición de la cuota (`invoices.routes`); devengo de honorarios (§3). | El registro nunca revierte la operación de origen: si falla, queda para la recuperación. |
| **Property, emisión** | `fiscalBridge`: para ARRIENDO, una sola puerta (la 055); para COMUNIDAD y OTRO, el catálogo leído de datos. `fiscalRuleCatalog.ts` pasa a leer de `FiscalRuleStore`. | Mismo resultado con la carga inicial; `FISCAL_RULE_GATE` sin cambios en producción. |
| **Property, plataforma** | `GET/POST /admin/fiscal/rule-catalog`: lee PA y PF; crea versión solo PA del país. Auditado. Pantalla como la de validaciones de la 062. | Nuevo. ORG_ADMIN no puede modificar reglas generales (403). |
| **Property, frontend** | Ninguna página consume hoy `/operations` (T4a se quedó sin interfaz). Se añade una pantalla de consulta y exportación con la naturaleza, y la tarjeta del catálogo. | Nuevo. |

## 3. Honorarios: devengo y compensación (Q4)
- **Devengo.** El honorario se calcula **por mes** y por versión del contrato de administración (`monthlyFee` de la
  spec 051): fijo más porcentaje sobre lo facturado (`ACCRUED`) o lo cobrado (`COLLECTED`), con mínimo y comisión de
  cola.
  - Se registra un `FEE_ACCRUAL` con naturaleza `OWN_INCOME` por contrato, mes y moneda, con origen
    `management-fee:<contrato>:<AAAA-MM>:<moneda>`.
  - Se registra al cerrar el mes, por la recuperación o una tarea mensual. Si después cambia la base de ese mes, se
    corrige con reversión y versión nueva.
  - El importe sale del mismo cálculo que la liquidación: **no cambia ningún importe aprobado**.
- **Compensación: hace falta una decisión.**
  - Hoy la liquidación al propietario **no se guarda**: `ownerStatement` la calcula al consultarla.
  - El `Payout` al propietario no lleva el periodo liquidado.
  - Sin eso no se puede enlazar con seguridad qué honorario se compensó en qué transferencia. Opciones:
    - **A (recomendada):** añadir a Property una **liquidación guardada** (`OwnerSettlement`: propietario,
      periodo, moneda, cobrado, gastos, honorario, neto y `Payout`). Es una migración Prisma nueva que también
      requiere tu aprobación. La compensación se registra al confirmar la liquidación, enlazada al devengo y al
      `Payout`.
    - **B:** registrar solo el devengo en este corte y dejar la compensación para cuando exista la liquidación
      guardada.

## 4. Hallazgo previo que no toco sin aprobación
`PATCH /invoices/:id` permite cambiar el importe o la fecha de una cuota PENDIENTE o VENCIDA **aunque ya tenga número
fiscal**. Eso choca con la condición «los documentos fiscales emitidos siguen la rectificación legal»: un documento
numerado debería corregirse con una rectificativa o una nota, no editándose. Es un comportamiento de Property anterior
a la 003. Propongo bloquear la edición de importe y fecha con número fiscal (409) en un cambio aparte, con su prueba y
tu aprobación.

## 5. Pruebas

### 5.1 Nuevas (TDD, en rojo primero)
| Prueba | Qué demuestra |
|--------|---------------|
| e2e Property `operations-register-003` · **fallo Q3** | Cuota registrada sin número y numerada después: hoy da 500; después, corrección enlazada. |
| Unit `[R-CORE-012] corrección` | Misma huella, idempotente; huella distinta, reversión + versión nueva; anulación con motivo; reversión única. |
| Unit `[R-CORE-012] naturaleza` y CSV | Columnas nuevas al final; los registros sin naturaleza siguen exportándose igual. |
| PG `pg-store` | 0004 sobre datos de la 0003; UPDATE y DELETE rechazados; dos correcciones concurrentes del mismo origen: solo una gana. |
| PG y unit `[R-CORE-014] catálogo en datos` | Versión nueva en lugar de editar; VERIFIED sin referencia rechazada; la vigente es la versión mayor; histórico conservado. |
| e2e Property, cada origen | Recibo, retención, obligación pagada, `Payout` a propietario y a proveedor, devengo de honorarios y anulación: un registro cada uno, enlazado y sin duplicados (gasto + `Payout`, obligación + movimiento de banco). |
| e2e Property, catálogo | ORG_ADMIN → 403; PA de otro país → 404; PA del país crea una versión auditada; con la carga inicial, la emisión de COMUNIDAD y OTRO da el mismo resultado que hoy. |
| e2e Property, puerta única | ARRIENDO con motor: decide solo la 055. Sin motor: el catálogo sigue de red de seguridad, como hoy. |
| e2e Property, recuperación | Más de 5.000 operaciones en un periodo: no se pierde ninguna; informa de lo pendiente. |
| e2e Property, en revisión | Las cuotas `PENDING_FISCAL_REVIEW` o sin número no aparecen como documento emitido. |

### 5.2 Regresión que se pasa entera
- **Librería:** `npm run lint`, `typecheck`, `test`, `test:pg`, `build` y `knip`.
- **Property backend:** lint, typecheck, unitarias y **todas** las e2e (hoy 189 más las nuevas). Las que tocan esto
  directamente:
  - `operations-register`, `fiscal-rule-gate-003`, `fiscal-decisions-055`, `fiscal-decision-routes-055` y
    `fiscal-conventional-055`;
  - `fiscal-core-bridge`, `fiscal-core-bridge-do`, `fiscal-core-owners`, `fiscal-core-cancel-025` y
    `fiscal-core-audit-006`;
  - `payment-receipts-052`, `community-receipts-054`, `operational-payouts` y `owner-management-contract-051`;
  - `withholding-decisions-055`, `withholding-routes-055`, `withholding-unified-062`, `withholding-list-062f` y
    `net-rent-062`;
  - `rental-tax-withholdings`, `rental-withholding-payment-054` y `partial-payments-048`.
- **Property frontend:** tsc, lint y vitest (hoy 344).
- **Home Services:** regresión completa (unit y e2e) para confirmar que las migraciones 0004 y 0005 en modo sombra no
  cambian nada.

## 6. Qué necesito que apruebes
1. Las migraciones **0004** y **0005** de la librería (§1.1, §1.2) y la carga inicial del catálogo sin cambio de
   comportamiento (§1.3).
2. La **compensación de honorarios**: A (liquidación guardada, con su migración Prisma, que presentaré aparte) o B
   (solo devengo por ahora) (§3).
3. Si corrijo en un cambio aparte la edición de cuotas con número fiscal (§4).
4. Después: las tareas en `tasks.md`, empezando por la e2e del fallo Q3 en rojo.
