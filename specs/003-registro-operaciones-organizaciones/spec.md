# Spec 003 — Registro de operaciones de organizaciones y comunidades

| Campo | Valor |
|-------|-------|
| Estado | Specify (2026-11-18). Implementación del núcleo en curso. |
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
