# Spec 003 — Registro de operaciones de organizaciones y comunidades

| Campo | Valor |
|-------|-------|
| Estado | Núcleo y Property T4a/T4b implementados. Clarify abierto y plan en borrador (2026-11-22): [clarify.md](clarify.md), [plan.md](plan.md). |
| Nota | `resolveObligation` y `assertAutomaticIssuance` (§Diseño) se sustituyeron en T3b por `decideFiscalIssuance` con el catálogo de R-CORE-014. |
| Origen | Decisión del usuario del 2026-11-18 (REF-DEC-008): «MIJEX debe generar sus registros automáticamente a partir de las operaciones que administra, permitiendo también incorporar documentos y operaciones externas, sin convertir necesariamente Property en un programa completo de contabilidad». También: «MIJEX no tiene por qué llevar la contabilidad oficial de cada comunidad o empresa administradora». |
| Reglas | R-CORE-012 (registro de operaciones), R-CORE-013 (separación por organización), R-CORE-014 (obligaciones fiscales por tipo de organización; si no están determinadas, no hay emisión automática) |
| Referencias | REF-DEC-008. Cada obligación fiscal configurada lleva su propia referencia oficial (ICAC, BOE o AEAT en ES; DGII o ICPARD en DO). Sin referencia queda `UNDETERMINED`. |

## Qué es y qué no es
- **Sí:** un registro de las operaciones que MIJEX administra para cada organización (comunidad,
  empresa administradora, propietario). Comprende:
  - facturas, recibos, cobros y pagos generados automáticamente;
  - documentos y operaciones externas aportados a mano;
  - trazabilidad entre ellos;
  - exportación para el contable o la gestoría de la organización.
- **No:** los libros oficiales de la organización. MIJEX no aplica a terceros el PGC ni las NIIF
  PYMES, no hace cierres y no presenta declaraciones. Los libros oficiales siguen siendo solo los
  de MIJEX (spec 001).

## Requisitos (del usuario)
1. **Registros automáticos:** cada operación administrada genera un registro, idempotente por su
   origen (`system`, `id`).
2. **Separación por organización:**
   - cada registro pertenece a una sola organización;
   - las consultas y exportaciones nunca mezclan organizaciones.
3. **Trazabilidad de facturas, recibos, cobros y pagos:** cada registro enlaza los registros
   relacionados (un cobro → su recibo y su factura; un pago → su factura de proveedor).
4. **Exportación contable y fiscal:**
   - CSV por organización y periodo, con importes exactos y su documento;
   - la cabecera es estable para que la importe la gestoría.
5. **Obligaciones fiscales según el tipo de organización:**
   - es un dato versionado por vigencia y por país;
   - cada obligación está en uno de tres estados: `REQUIRED`, `NOT_REQUIRED` o `UNDETERMINED`, con
     su regla y su referencia;
   - una obligación sin referencia oficial es `UNDETERMINED`.
6. **Sin emisión automática con obligaciones no determinadas:**
   - si la obligación que exige el documento está `UNDETERMINED` o no está configurada, la emisión
     automática se bloquea y va a revisión manual;
   - nunca se supone que una obligación existe.

## Diseño (núcleo en la librería, puro y con almacén en memoria; PostgreSQL en un corte posterior)
- **Tipos:** `OperationRecord`:
  - `organizationId`, `kind` (`INVOICE`, `RECEIPT`, `COLLECTION`, `PAYMENT`, `SUPPLIER_INVOICE` o
    `EXTERNAL`), `occurredOn`, `amount` (bigint, con signo según la dirección del dinero),
    `currency`, `counterparty`, `document` (número y tipo), `source`, `links`, `origin`
    (`AUTOMATIC` o `MANUAL`) y `recordedBy`.
- **Operaciones:**
  - `createOperationsRegister({ store })` ofrece `record` (idempotente; mismo origen con otros datos
    → conflicto), `list(organizationId, { from, to })` y `trace(recordId)`;
  - `exportOperationsCsv(records)`.
- **Inmutabilidad:** solo inserción. Una corrección es un registro nuevo que enlaza el anterior
  (como R-CORE-003).
- **Obligaciones:**
  - `resolveObligation(profiles, { country, organizationType, obligation, on })` devuelve el
    estado, la regla y la referencia;
  - `assertAutomaticIssuance(...)` lanza `OBLIGATION_UNDETERMINED`.

## Fuera de alcance de este corte
- La persistencia en PostgreSQL.
- La conexión en Property y HS.
- Los perfiles con obligaciones `REQUIRED` o `NOT_REQUIRED` reales, que necesitan su referencia
  oficial por tipo de organización y país. Hasta tenerla, todos quedan `UNDETERMINED`, que bloquea
  la emisión automática (requisito 6).

## Integración en Property (propuesta, pendiente de aprobación; REF-DEC-009 condición 8)
Lo que ya existe en Property y se respeta:
- **Emisión automática** (`fiscalBridge.issuePendingWithFiscalCore`): facturas `ARRIENDO`,
  `COMUNIDAD` y `OTRO` por organización o por propietario representado.
- **Reglas fiscales de alquiler** (`RentalTaxRule`): son versiones; la validación profesional y la
  activación son estados separados.
- **Retención de facturas:** las facturas sin regla lista quedan retenidas
  (`Invoice.fiscalHold = HELD`) y se liberan al validar (`rentalTaxIssuance.ts`).
- **Tipos de organización:** `ADMINISTRADOR`, `INMOBILIARIA`, `PROPIETARIO`, `HOTEL` y `OTRO`.

Cambios propuestos (no alteran el comportamiento actual en desarrollo):
1. **Catálogo de Property** (datos, R-PROP-0xx): una entrada por país, tipo de organización y tipo
   de factura (`ARRIENDO`, `COMUNIDAD`, `OTRO`), con el tratamiento actual.
   - Estado `APPROVED_PENDING_VERIFICATION` y la referencia de la spec de Property que lo aprobó.
   - La validación profesional de `RentalTaxRule` cuenta como `VERIFIED` solo si la regla lleva
     una referencia normativa.
2. **Antes de `fiscal.issue`, `decideFiscalIssuance`** para esa factura:
   - `ISSUE`: igual que hoy.
   - `NO_FISCAL_DOCUMENT`: no se emite y queda registrado.
   - `MANUAL_REVIEW`: se reutiliza `fiscalHold = HELD` con `fiscalHoldReason` = el motivo de la
     decisión. Solo afecta a esa factura: el cobro, el registro y el resto siguen.
3. **Bandera `FISCAL_RULE_GATE`:**
   - En desarrollo y pruebas está activa, y las reglas aprobadas emiten, así que nada cambia.
   - En producción solo se activa con tu aprobación. Al activarla, lo que no esté `VERIFIED` pasa
     a revisión manual (condición 4).
4. **Registro de operaciones:**
   - las facturas, los recibos de comunidad, los cobros (`PaymentTransaction`) y los gastos
     (`Expense`) generan registros automáticos con sus enlaces;
   - los documentos externos se aportan a mano;
   - se exporta el CSV por organización.
   - Se aplica la migración `contable` en la base de Property.
