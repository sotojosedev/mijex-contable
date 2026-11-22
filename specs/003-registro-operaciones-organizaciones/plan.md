# Plan 003 — Registro de operaciones de organizaciones y comunidades

| Campo | Valor |
|-------|-------|
| Estado | **Ajustado a las decisiones del dueño** (clarify resuelto el 2026-11-22, REF-DEC-013). Falta aprobar las migraciones y la regresión: [migraciones-y-regresion.md](migraciones-y-regresion.md). |
| Spec | [spec.md](spec.md) · Clarify: [clarify.md](clarify.md) · Tareas: [tasks.md](tasks.md) |
| Fecha | 2026-11-22 |

> Fase 3 del [proceso SDD](../../sdd/README.md), a posteriori para lo ya hecho (T1–T4b) y previa para lo que falta
> (T4 resto, T5 y la corrección del fallo de Q3).

## 1. Resumen técnico
1. **Corregir primero** el fallo de Q3: un cambio en el origen de un registro bloquea la consulta. Se resuelve con
   registros de corrección inmutables y sin registrar la cuota mientras esté retenida o sin número.
2. **Generar los registros al ocurrir la operación**, con una sincronización de recuperación paginada (Q6).
3. **Completar los orígenes** (Q4):
   - recibos, retenciones, obligaciones pagadas, `Payout` a propietarios y proveedores, honorarios **al devengarse**
     (con su compensación aparte) y reversiones;
   - sin duplicar un mismo movimiento que aparezca en varios módulos;
   - con la **naturaleza** del importe: ingreso propio, fondos de terceros, retención, pago fiscal o liquidación.
     Es un cambio compatible (MINOR).
4. **T5 replanteada** (Q1, Q2):
   - para ARRIENDO, una sola puerta: la decisión de la 055;
   - el resto del catálogo de Property se guarda como datos con vigencia en el esquema `contable`, todo en
     `APPROVED_PENDING_VERIFICATION`;
   - no cambia ningún comportamiento ni se inventa ninguna regla.

## 2. Inventario (2026-11-22)
| Tipo | Elemento existente | Uso en este plan |
|------|-------------------|------------------|
| Núcleo | `src/operations/index.ts`: `createOperationsRegister`, `createMemoryOperationsStore`, `exportOperationsCsv`, `decideFiscalIssuance`, `FiscalRule` | Ampliar: corrección y naturaleza |
| PG | `migrations/0003_operation_records.sql` (solo inserción, trigger `reject_mutation`, único por `source_system` + `source_id`); `src/persistence/pg` | Migración 0004 (naturaleza, versión de origen, catálogo) |
| Reglas | R-CORE-012, R-CORE-013, R-CORE-014; R-CORE-003 (corrección por reversión) | Ampliar R-CORE-012 (corrección y naturaleza); R-CORE-014 (catálogo como datos) |
| Referencias | REF-DEC-008, REF-DEC-009, REF-DEC-012 | Nueva REF-DEC con las respuestas de Q1–Q5 |
| Tests | `tests/operations/register.test.ts`, `tests/pg/pg-store.test.ts` | Ampliar |
| Property | `services/operationsRegister.ts` (sincroniza al consultar, `take: 5000`); `routes/operations.routes.ts`; `services/fiscalRuleCatalog.ts` (constante); `fiscalBridge.ts` (dos puertas: `issuableByDecision` de la 055 y `decideInvoiceIssuance` de la 003) | Cambiar |
| Property, orígenes | `Invoice`, `PaymentTransaction`, `Expense`, `PaymentReceipt`, `WithholdingDecision`, `TaxRemittanceObligation`, `Payout`, `ownerStatement` (honorarios) | Leer |
| Home Services | No usa la 003 | Fuera (Q5) |
| Spec | `spec.md` describe `resolveObligation` y `assertAutomaticIssuance`, sustituidas en T3b por `decideFiscalIssuance` | Actualizar la spec |

## 3. Diseño
### 3.1 Librería: corrección y naturaleza (Q3, Q4)
- **Origen versionado.** El registro guarda `source.id` y una `sourceVersion` (huella de los datos que importan).
  - Mismo origen y misma huella: idempotente, como hoy.
  - Mismo origen con otra huella: la operación nueva `recordCorrection(input)` añade dos registros, la **reversión**
    del vigente (importe con signo contrario, enlazado) y el **nuevo**, en una transacción.
  - Nada se actualiza ni se borra (R-CORE-003, K6).
- **Anulación.** `recordReversal(source, motivo)` añade solo la reversión.
- `record` mantiene `IDEMPOTENCY_CONFLICT` para quien no pase por la corrección: es compatible.
- **Naturaleza** opcional: `OWN_INCOME | THIRD_PARTY_FUNDS | WITHHOLDING | TAX_PAYMENT | SETTLEMENT`, con su columna
  en el CSV.
  - La cabecera se amplía añadiendo la columna **al final**, para no romper las importaciones que ya existen.
  - Que cambie la cabecera es un cambio de API pública: se confirma en Q4.
- **Migración 0004 (aditiva):**
  - columnas `nature` y `source_version`, nullables, con CHECK;
  - el único por origen pasa a `(source_system, source_id, source_version)`;
  - las filas existentes conservan versión nula.

### 3.2 Librería: catálogo como datos (Q2)
- Tabla `contable.fiscal_rule`:
  - campos: país, jurisdicción, tipo de organización, tipo de operación, tratamiento, referencia, validación, versión,
    `valid_from` y `valid_to`, quién validó y cuándo;
  - solo inserción: una versión nueva sustituye a la anterior.
- Puerto `FiscalRuleStore`, con la memoria y PG del mismo contrato. `decideFiscalIssuance` no cambia: recibe las reglas.

### 3.3 Property (T4 resto, T5)
- **Registro al ocurrir.** Tras confirmar la transacción de cada origen, una llamada idempotente:
  - emisión con número de la cuota;
  - conciliación del cobro;
  - recibo emitido;
  - retención confirmada o practicada;
  - obligación pagada;
  - `Payout` ejecutado;
  - liquidación (honorarios);
  - anulación o edición (corrección).
  Si falla, no revierte la operación de origen: queda pendiente para la recuperación (sin perder datos).
- **Recuperación** (`syncOrganizationOperations`): paginada, sin `take` silencioso. Usa la corrección en lugar de
  fallar y devuelve lo que no pudo registrar. `GET /operations` solo lee, ya no sincroniza.
- **No registrar** cuotas `PENDING_FISCAL_REVIEW` ni sin numeración definitiva como documento emitido (Q3). Un
  borrador se puede modificar antes de confirmarse, con auditoría. Un documento fiscal emitido solo se corrige por
  la rectificación legal; el registro refleja la rectificativa como corrección enlazada.
- **Sin duplicados** (Q4):
  - el gasto es `SUPPLIER_INVOICE` (devengo, sin caja) y su pago es un solo `PAYMENT` (de su `Payout` o de
    `paidAt`);
  - la obligación pagada y su movimiento de banco son un solo registro.
- **Honorarios:** `FEE_ACCRUAL` mensual por contrato y moneda, con el mismo cálculo que la liquidación (spec 051),
  y la compensación aparte (ver `migraciones-y-regresion.md` §3: pendiente de decidir).
- **Una sola puerta para ARRIENDO** (Q1, A):
  - con el motor activo, la decisión de la 055 manda y `decideInvoiceIssuance` no se aplica a ARRIENDO;
  - sin motor, el catálogo sigue de red de seguridad, como hoy;
  - COMUNIDAD y OTRO, como hoy, pero leídos del catálogo en datos.
- **Carga inicial del catálogo.**
  - Se carga el inventario actual (la misma matriz de `PROPERTY_FISCAL_RULES`), todo en
    `APPROVED_PENDING_VERIFICATION`, con la referencia de la spec de Property que lo aprobó.
  - Pasar algo a VERIFIED exige una referencia oficial (K2) y la aprobación de PLATFORM_ADMIN del país, auditada.
  - Las organizaciones no modifican las reglas generales (403).
  - Las reglas pendientes de verificación no activan comportamientos fiscales definitivos nuevos.
  - Las versiones anteriores se conservan.
  - Ruta y pantalla como las validaciones de la 062.

### 3.4 Contratos (Property)
| Método y ruta | Rol | Cambio |
|---------------|-----|--------|
| `GET /operations` | AD, PM | Solo lee; sin sincronizar al consultar. |
| `POST /operations/sync` | AD | Recuperación del periodo; devuelve lo pendiente. Auditada. |
| `GET /operations/export` | AD, PM | CSV con la columna de naturaleza al final. |
| `GET/PUT /admin/fiscal/rule-catalog` | PA del país (escribe), PF (lee) | Catálogo de la 003 en datos (T5). |

## 4. Seguridad y aislamiento
| Riesgo | Mitigación | Test |
|--------|------------|------|
| Registro de otra organización | `organizationId` del origen y enlaces solo dentro de la organización (R-CORE-013) | Enlace ajeno → `INVALID_LINK` |
| Catálogo de otro país | Escribe solo PA con el país en su alcance → 404 | e2e como TC-E15 de la 062 |
| Corrección que esconde un cambio | Reversión y nuevo enlazados, con actor y motivo; nada se borra | Contrato PG: UPDATE/DELETE rechazados |
| CSV con fórmulas | Protección actual (R-CORE-013) | La existente |

## 5. Tests (TDD)
- **Unit (librería):**
  - `[R-CORE-012] corrección`: misma huella idempotente; huella distinta → reversión + nuevo; anulación;
  - naturaleza en el CSV al final de la cabecera.
- **PG:**
  - migración 0004 sobre datos de la 0003;
  - concurrencia de dos correcciones del mismo origen: solo una gana.
- **Property e2e:**
  - primero, **reproducir Q3** (cuota sin número, luego numerada: hoy da 500) en rojo;
  - después, cada origen nuevo, la recuperación sin límite silencioso, la puerta única de ARRIENDO con y sin motor y
    el catálogo por país.

## 6. Despliegue y vuelta atrás
- La migración 0004 es aditiva; la vuelta atrás borra las columnas y restaura el único anterior, solo si no hay
  versiones.
- En Property, primero el arreglo de Q3 (corrige una caída), después los orígenes y por último la puerta única, con
  `FISCAL_RULE_GATE` sin cambios en producción.

## 7. Constitution check ([`constitucion.md`](../../sdd/constitucion.md))
| Principio | Cumple | Cómo |
|-----------|--------|------|
| K1 Regla + referencia + test | ✅ | R-CORE-012 y R-CORE-014 ampliadas, con REF-DEC nueva y sus tests |
| K2 Fuentes oficiales | ✅ | Nada pasa a VERIFIED sin referencia oficial; la carga inicial es `APPROVED_PENDING_VERIFICATION` |
| K3 Stop conditions | ✅ / ⏳ | Q1–Q5 resueltas (REF-DEC-013); faltan las migraciones, la compensación de honorarios y la edición de cuotas numeradas (`migraciones-y-regresion.md` §6) |
| K4 Multi-país por datos | ✅ | El catálogo pasa de constante a datos con vigencia (Q2) |
| K5 Dinero exacto | ✅ | `bigint`, reversión con signo exacto |
| K6 Inmutabilidad | ✅ | Corrección por reversión; arregla el fallo actual sin editar nada |
| K7 Seguridad | ✅ | §4 |
| K8 Reutilización | ✅ | `decideFiscalIssuance` y el adaptador PG existentes; la puerta de la 055 para ARRIENDO |
| K9 Frontera fiscal | ✅ | Sin emisión en la librería |
| K10 SDD + TDD | ✅ | Este clarify y este plan; e2e de Q3 primero en rojo |
| K11 Calidad | ✅ | Verificación completa en las tareas |

## 8. Alternativas descartadas
| Alternativa | Motivo |
|-------------|--------|
| Registro editable | Incumple K6 y R-CORE-012 |
| Mantener las dos puertas para ARRIENDO | Dos fuentes que pueden contradecirse; incumple REF-DEC-012 e I-4 |
| Catálogo como constante | Incumple K4; cada verificación exigiría un despliegue |
| Ampliar la 055 a comunidades y honorarios ahora | Spec nueva y grande; se deja como evolución (Q1, B) |
