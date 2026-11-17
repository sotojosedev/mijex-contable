# Plan — Spec 001 (fase 1: núcleo)

## Decisiones
- Paquete `@sotojosedev/contable-core` (privado hasta que el usuario apruebe publicarlo). ESM y
  TypeScript estricto, con la misma configuración que `mijex-fiscal` (tsconfig, ESLint, tsup,
  knip y vitest).
- **Reutilización:** el dinero viene de `@sotojosedev/fiscal-core` (`parseMinor`, `formatMinor`,
  `roundHalfUp`, `percentOf`). No se duplica.
- **Sin datos legales en el motor:** el motor no conoce países, cuentas ni eventos concretos.
  Los planes de cuentas y las reglas de asiento llegan como datos versionados. Los de ES (PGC)
  y DO (NIIF) se cargan en la fase 1b, con cada cuenta y cada regla aprobadas por el usuario
  (son *stop conditions*).

## Modelo
| Concepto | Campos clave |
|---|---|
| `LedgerEntity` | id, kind (`PLATFORM` / `ORGANIZATION` / `COMMUNITY` / `OWNER`), country, currency, external `{system, ref}` (único), framework |
| `Chart` | id, framework, version, validFrom, validTo?, status (`DRAFT` / `APPROVED`), referenceIds; cuentas `{code, name, type, normalSide}` |
| `PostingRule` | id, framework, eventType, version, validFrom, validTo?, ruleId (R-…), referenceIds; líneas `{side, account, amount: clave del importe del evento}` |
| `BusinessEvent` | entityId, type, source `{system, id}`, name (p. ej. `issued`), occurredOn (AAAA-MM-DD), currency, amounts `Record<string, bigint>`, memo? |
| `JournalEntry` | id, entityId, chartId, ruleId, source, name, entryDate, currency, lines `{account, debit, credit}`, reversalOf?, reason?, actor? |

## Comportamiento
- **`post(event)`:**
  1. Resuelve la entidad.
  2. Elige el plan aprobado y la regla del marco de la entidad vigentes en `occurredOn`.
  3. Construye las líneas.
  4. Valida que las cuentas existen en el plan, que la moneda es la de la entidad, que los
     importes no son negativos y que el asiento cuadra (R-CORE-002).
  5. Lo inserta de forma idempotente por (entidad, origen, nombre) (R-CORE-004).
  6. Las líneas a cero no se guardan.
- **`reverse(entryId, {actor, reason})`:** crea un asiento con el debe y el haber invertidos y
  `reversalOf`. No se puede revertir dos veces ni revertir una reversión. Nada se edita
  (R-CORE-003).
- **`trialBalance(entityId, {to})`:** saldos por cuenta en bigint, cuadrados.
- Un plan en borrador (`DRAFT`) no admite asientos, salvo en entornos de pruebas.

## Persistencia (puerto `LedgerStore`)
- Memoria: `testing/`.
- PostgreSQL (esquema `contable`):
  - tablas de solo inserción con trigger;
  - índice único de idempotencia;
  - `CHECK` de debe/haber no negativos;
  - el cuadre se valida en el dominio y también con un trigger diferido por asiento.
- Contract tests compartidos por los dos almacenes.

## Tests
`describe('[R-CORE-00X] …')` por cada regla; contrato para la memoria y PostgreSQL.
