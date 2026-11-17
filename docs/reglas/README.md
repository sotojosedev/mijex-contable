# Catálogo de reglas

Cada regla que implementa la librería tiene aquí una fila. Ninguna regla se implementa sin
referencia oficial (`docs/referencias/`) y ninguna se da por terminada sin test.

## Formato del ID

`R-<ÁMBITO>-NNN`, donde el ámbito es:
- `CORE`: regla técnica de la librería, válida en todos los países.
- `ES`, `DO`, …: regla de un país (código ISO 3166-1 alfa-2).

Los IDs no se reutilizan. Una regla derogada se marca `derogada` y se conserva.

## Estados

`borrador` → `verificar` (falta confirmar la fuente o al usuario) → `aprobada` →
`implementada` (con test en verde) → `derogada`.

## Reglas

| ID | Regla | Referencias | Vigencia | Tests | Spec | Estado |
|----|-------|-------------|----------|-------|------|--------|
| R-CORE-001 | Dinero exacto: importes en unidades menores (bigint) o decimal exacto, redondeo half-up en valor absoluto a 2 decimales; el total sale de los importes ya redondeados; nunca `number` flotante en conversiones ni sumas | REF-DEC-001 | 2026-11-05 | HS `test/unit/moneyExact.test.ts`; Property `fiscalAmountsMath.test.ts`, `taxBreakdownMath.test.ts` | HS 036, Property 059 | implementada (camino fiscal y liquidaciones; resto: spec 037) |
| R-CORE-002 | Cada asiento cuadra (Σ debe = Σ haber en unidades menores) o se rechaza; sin líneas no hay asiento | REF-DEC-004 | spec 001 | `tests/contract/ledger.contract.ts` (memoria y PostgreSQL); `tests/pg/pg-store.test.ts` (cuadre diferido) | 001 | implementada |
| R-CORE-003 | El mayor es de solo inserción: un error se corrige con un asiento de reversión enlazado, con actor y motivo; no se revierte dos veces ni una reversión | REF-DEC-004 | spec 001 | `ledger.contract.ts`; `pg-store.test.ts` (triggers) | 001 | implementada |
| R-CORE-004 | Un hecho (entidad, origen, nombre) genera un único asiento; repetirlo devuelve el mismo y con otros datos es un conflicto | REF-DEC-004 | spec 001 | `ledger.contract.ts`; `pg-store.test.ts` (carrera) | 001 | implementada |
| R-CORE-005 | Plan de cuentas y reglas de asiento son datos por marco, versionados por vigencia; solo un plan aprobado admite asientos; una versión nueva cierra la anterior en su inicio | REF-DEC-004 | spec 001 | `ledger.contract.ts` | 001 | implementada |
| R-CORE-006 | El extracto bancario se lee con importes exactos (bigint, hasta 2 decimales; nunca se redondea en silencio); una línea ilegible se informa con su número sin perder las demás; cada movimiento tiene una huella estable (la de Property) que evita importarlo dos veces | REF-DEC-005 | spec 002 | `tests/reconciliation/statement.test.ts` | 002 | implementada (librería, HS y Property) |
| R-CORE-007 | El casado automático solo ocurre si es inequívoco según la política de cada app (importe exacto; identificación obligatoria o ventana de días); un empate siempre va a revisión manual. El reparto de un ingreso no mezcla monedas ni supera ningún pendiente | REF-DEC-005 | spec 002 | `tests/reconciliation/match.test.ts` | 002 | implementada (librería, HS y Property) |
| R-DO-001 | Falta de conectividad: el e-CF se genera offline y se remite en ≤ 72 h; la representación impresa lleva la leyenda oficial de contingencia | REF-DO-020, REF-DO-021 §19.1, REF-DO-022 §6 | Instructivo oct. 2026 | `dominican-contingency.contract.ts` (supuesto 1), `tests/do/contingency.test.ts` | fiscal 012 | implementada (fiscal 012) |
| R-DO-002 | Imposibilidad de emitir e-CF: declaración Total/Parcial en la OFV, comprobantes serie B, duración ≤ 15 días calendario; solo son válidos los B emitidos con contingencia notificada | REF-DO-020, REF-DO-021 §19.2 y §19.4 | ídem | `dominican-contingency.contract.ts` (supuesto 2) | fiscal 012 | implementada (fiscal 012, pendiente de la revisión del asesor: verificar Q2) |
| R-DO-003 | Regularización: en ≤ 30 días desde la salida, e-CF de reemplazo con código de modificación 4 que referencia el B, enviado solo a la DGII | REF-DO-020, REF-DO-021 §19.3 | ídem | `dominican-contingency.contract.ts` (regularización código 4) | fiscal 012 | implementada (fiscal 012) |
| R-DO-004 | DGII no disponible: consultar el canal de estatus, almacenar, reanudar en orden cronológico y sin ráfagas; > 15 días hábiles → reportes por la OFV | REF-DO-021 §19.5, REF-DO-022 §5 | ídem | `dominican-contingency.contract.ts` (supuesto 3) | fiscal 012 | implementada (fiscal 012) |
| R-DO-005 | La retención de ITBIS se calcula sobre el ITBIS facturado (100 % servicios de persona física a persona jurídica; 30 % servicios profesionales liberales entre personas jurídicas). HS: PF y autónomo 100 %; empresa sin retención | REF-DO-011, REF-DEC-002 | Decreto 293-11 / Norma 02-05 | HS `test/unit/withholdingVersions.test.ts`, `test/integration/settlement.test.ts`, `test/integration/taxWithholding.test.ts` | HS 036 | implementada (HS 036) |
| R-DO-006 | Retención de ISR (art. 309) por fecha de pago, en versiones con vigencia: alquiler y honorarios 10 % → 15 %; servicios técnicos 2 % → 3 % efectivo (15 % × renta presunta 20 %), desde el 01/07/2026 | REF-DO-003, REF-DO-008, REF-DO-009, REF-DEC-002 | 01/07/2026 | HS `test/unit/withholdingVersions.test.ts`, `test/integration/taxWithholding.test.ts`; alquileres: fiscal `dominicanRentalDefault` | HS 036 | implementada (HS 036; nivel C confirmado por el usuario 2026-11-17) |
| R-DO-007 | QR del timbre del e-CF: se intenta la versión 8 con corrección M; si la URL oficial completa no cabe (ni el ejemplo de la DGII cabe), se usa la mínima versión superior que la contenga, sin quitar parámetros. Se comprueba por lectura que el QR contiene exactamente la URL y se registra la versión usada | REF-DO-023 (Consulta timbre, «versión 8»), REF-DEC-003 | Descripción Técnica Servicios 2026-01/05 | fiscal `tests/core/qr.test.ts`; HS `fiscalControl.test.ts` (PDF); Property `pdfDocuments.test.ts` | fiscal 012 | implementada, **verificar con la DGII** (pendiente de confirmación oficial de la versión superior) |
| R-DO-101…115 | Reglas de asiento de MIJEX RD (marco DO-NIIF-PYMES, plan propio con los códigos de HS): un evento por regla (`src/frameworks/events.ts`). Como agente, solo la comisión es ingreso (4110); lo cobrado por cuenta del técnico es deuda (2150 → 2110); retenciones de ISR (2130, IR-17) e ITBIS (2140) | REF-DO-025, REF-DO-026, REF-DO-011, REF-DO-003, REF-DEC-006 | desde 2026-01-01 (v2026.1) | `tests/frameworks/mijex.test.ts`; `tests/pg/pg-store.test.ts` | 001 | implementada (datos; aún sin eventos de HS) |
| R-DO-201 | Formato 606 (compras): TXT delimitado por «|», cabecera `606|RNC|AAAAMM|n` y 23 campos en el orden oficial; códigos de las tablas oficiales (tipo de bienes y servicios 01–11, retención ISR 01–09, forma de pago 01–07); 10 = 8 + 9 y 15 = 11 − 14; importes exactos con dos decimales | REF-DO-027, REF-DO-031 | NG 07-2018; plantilla v2025 | `tests/reports/dgii.test.ts` | 001 / HS 040 | implementada |
| R-DO-202 | Formato 607 (ventas): 23 campos oficiales; tipo de ingreso 01–06; tipo de identificación 1/2/3; las formas de cobro suman el total con impuestos; una retención exige su fecha; máximo 65.000 registros | REF-DO-027, REF-DO-030, REF-DO-031 | NG 07-2018; instructivo 12/2025 | `tests/reports/dgii.test.ts` | 001 / HS 040 | implementada |
| R-DO-203 | En el detalle del 607, el consumo (B02/E32) solo desde RD$250.000; el crédito fiscal y los comprobantes especiales, siempre (el resto del consumo, como resumen en la OFV) | REF-DO-028 | NG 10-2018 | `tests/reports/dgii.test.ts` | 001 / HS 040 | implementada |
| R-DO-204 | Formato 608 (anulados): comprobante, **fecha de la anulación** y tipo de anulación 01–10 | REF-DO-027, REF-DO-031 | NG 07-2018, Anexo C | `tests/reports/dgii.test.ts` | 001 / HS 040 | implementada; [verificar] e-NCF de 13 posiciones frente a las 11 de la norma |
| R-ES-001 | Los registros remitidos a posteriori por una incidencia llevan `Incidencia` = "S" | REF-ES-002, REF-ES-001 art. 16.4 | Orden HAC/1177/2024 | `tests/official/xsd.test.ts`, `spain-submitter.contract.ts` | fiscal 012 | implementada (fiscal 012) |
| R-ES-002 | Con una incidencia técnica, reintentar la remisión al menos una vez cada hora | REF-ES-001 art. 16.4 | ídem | `spain-submitter.contract.ts` (tope 1 h), `tests/core/backoff.test.ts` | fiscal 012 | implementada (fiscal 012) |
| R-ES-003 | Remitir respetando el orden temporal de generación de los registros | REF-ES-001 art. 16.4 | ídem | `spain-submitter.contract.ts` (orden de cadena) | fiscal 012 | implementada (fiscal 012) |
| R-ES-004 | Una incidencia de remisión nunca interrumpe la facturación | REF-ES-002 | FAQ 21/10/2026 | `spain-submitter.contract.ts` (facturación sin bloqueo) | fiscal 012 | implementada (fiscal 012) |
| R-ES-101…115 | Reglas de asiento de MIJEX España (marco ES-PGC-PYMES): cuentas oficiales del cuadro o subcuentas propias dentro de ellas (art. 3.1). Como agente, solo la comisión es ingreso (7051 ⊂ 705, cifra de negocios); lo cobrado por cuenta del técnico es deuda (4101 ⊂ 410 → 4100); sin cuentas de ISR/ITBIS: una retención en ES descuadra y se rechaza | REF-ES-005, REF-ES-006, REF-ES-004 (NRV 14.ª), REF-ES-007, REF-DEC-006 | desde 2026-01-01 (v2026.1) | `tests/frameworks/mijex.test.ts` (cuentas contra el cuadro oficial del BOE) | 001 | implementada (datos; aún sin eventos de HS) |

## Plantilla para una regla extensa (`docs/reglas/R-XX-NNN.md`)

```markdown
# R-XX-NNN — <título>
- Estado: borrador | verificar | aprobada | implementada | derogada
- Ámbito / país:
- Vigencia: desde AAAA-MM-DD [hasta AAAA-MM-DD]
- Referencias: REF-XX-NNN (artículo …)
- Spec: specs/NNN-slug/
- Tests: tests/…  (describe('[R-XX-NNN] …'))
- Configurable desde la app: sí/no — qué dato

## Enunciado
## Ejemplos (casos que cubren los tests)
## Notas y dudas [verificar]
```
