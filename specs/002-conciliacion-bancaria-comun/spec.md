# Spec 002 — Conciliación bancaria común (lectura de extractos y casado)

| Campo | Valor |
|-------|-------|
| Estado | Aprobada («sigue con la siguiente fase», 2026-11-17) · en curso |
| Origen | Spec 001 §2: HS (`bankReconciliation.ts`) y Property (`bankStatement.ts`, `platformReconciliationMath.ts`) tienen dos lectores de CSV y dos motores de casado |
| Reglas | R-CORE-006 (lectura exacta del extracto), R-CORE-007 (casado automático solo si es inequívoco) |
| Referencias | REF-DEC-005: comportamiento vigente aprobado por el dueño (Property spec 034, decisión 2026-10-30; HS conciliación con ventana de ±3 días) |

## Problema
- **Lectores divergentes:** dos lectores de CSV con capacidades distintas. HS no admite tabulador
  ni años de 2 dígitos y aborta todo el extracto ante una sola línea mala. Property no admite
  negativos entre paréntesis ni varias cabeceras habituales en RD (`retiro`, `deposito`,
  `documento`).
- **Coma flotante:** los dos parsean los importes con `Number` y redondean.
- **Motores de casado divergentes:** dos motores con políticas distintas que no se pueden
  configurar.

## Alcance (módulo puro `src/reconciliation`, sin BD)
- `parseBankStatementCsv(csv, { accountId })` → `{ movements, errors }`:
  - Separador `;`, `,` o tabulador; comillas; BOM.
  - Cabeceras en español o inglés, con y sin acentos (la unión de las dos apps).
  - Fechas AAAA-MM-DD o DD/MM/AA(AA).
  - Importe único con signo, o debe/haber; decimales con punto o coma, separador de miles y
    negativos con `-` o entre paréntesis.
  - **Importes en bigint, sin pasar por `Number`** (R-CORE-001/006).
  - Una línea ilegible se informa con su número y las demás se conservan.
  - Huella estable por movimiento, **idéntica a la de Property** (no duplica lo ya importado).
- `rankCandidates(movement, targets, policy)` y `automaticMatch(candidates, policy)`:
  - Criterios: importe exacto, referencia (id o número fiscal), nombre (todas sus palabras
    significativas) y ventana de días.
  - La política es un dato: `{ windowDays, requireIdentification }`. Property: identificación
    obligatoria. HS: ventana de 3 días.
  - Si hay empate o ambigüedad, el casado no es automático (R-CORE-007).
- `validateAllocation(movement, parts)`: el reparto de un ingreso entre varios destinos, en
  bigint (misma moneda, sin superar el pendiente de cada destino ni el del movimiento).

## Fuera de alcance
- Que HS y Property usen el módulo y retiren su copia: es *stop condition* (borrar código
  contable), con confirmación.
- La persistencia de extractos.

## Criterios de aceptación
- CA1: los CSV de ejemplo de las dos apps dan los mismos movimientos que hoy, con importes exactos
  (`1.234,56` → 123456n; `(50,00)` → −5000n; `0,1` + `0,2` sin error).
- CA2: una línea con una fecha imposible se informa y las demás se leen.
- CA3: la huella coincide con la de Property para el mismo movimiento.
- CA4: Property (identificación obligatoria): solo hay casado automático con importe exacto más
  referencia o nombre, y sin empate. HS (ventana de 3 días): importe exacto dentro de la ventana y
  un único candidato, o la referencia lo desempata.
- CA5: el reparto rechaza otra moneda, un exceso sobre el destino o sobre el movimiento, y destinos
  repetidos.
