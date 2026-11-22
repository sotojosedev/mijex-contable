# Clarify 004 — Cumplimiento de K12

| Campo | Valor |
|-------|-------|
| Estado | Abierto |
| Spec | [spec.md](spec.md) |
| Fecha | 2026-11-22 |

> Fase 2 del [proceso SDD](../../sdd/README.md). Las **stop conditions** (AGENTS.md §4) las responde solo el dueño.
> Puerta de salida: ninguna pregunta en estado *Abierta*.

## Resumen
| ID | Pregunta | Stop condition | Estado | Decisión |
|----|----------|----------------|--------|----------|
| Q1 | ¿Una regla pendiente de verificación emite fuera de producción? | Sí: regla fiscal (cambia REF-DEC-009) | Abierta | — |
| Q2 | ¿Cómo se separa proponer y verificar una regla del catálogo? | Sí: datos y permisos (migración) | Abierta | — |
| Q3 | ¿Qué comprueba el registro sobre el resultado fiscal? | Sí: API pública | Abierta | — |
| Q4 | ¿Dónde viven las reglas fiscales? | Sí: arquitectura | Abierta | — |

---

## Q1 · Reglas pendientes de verificación fuera de producción (I-K12-1)

**Contexto.** `decideFiscalIssuance` (`src/operations/index.ts`) solo exige VERIFIED con `deployment: "PRODUCTION"`.
Fuera de producción, una regla «aprobada, pendiente de verificación» emite, y lo exige un test de R-CORE-014
(`tests/operations/register.test.ts`), por decisión del dueño en REF-DEC-009. En Property la puerta del catálogo está
activa siempre fuera de producción, y el catálogo se siembra con todas sus reglas como pendientes. MIJEX solo funciona
en desarrollo (2026-11-22): «fuera de producción» es hoy todo MIJEX.

**Alternativas.**
| Opción | Descripción | Pros | Contras / riesgo |
|--------|-------------|------|------------------|
| A | Pendiente = revisión en **todos** los entornos. Se quita la diferencia por entorno de `decideFiscalIssuance`. | Cumple K12 sin excepción; lo probado es lo que se aplicará. | En desarrollo nada del catálogo (comunidades, otras facturas y alquiler sin motor) se emite con la librería hasta verificar sus reglas. Cambio de comportamiento: MAJOR o decisión documentada. |
| B | Mantener la excepción fuera de producción, documentada en la constitución como excepción justificada de K12. | Sin cambios; se puede probar la emisión en desarrollo. | K12 queda con una excepción; lo de desarrollo no refleja lo que pasaría con reglas reales. |
| C | Pendiente = revisión en todos los entornos, salvo una bandera explícita de pruebas (solo e2e y entornos de prueba aislados, nunca por defecto). | Cumple K12 por defecto y deja probar. | Una bandera más que mantener. |

**Recomendación.** **A.** Es lo que pide K12 y MIJEX no tiene producción. Las pruebas ya inyectan su propio entorno y
sus reglas. En desarrollo basta con verificar las pocas reglas del catálogo que se quieran probar.

**Decisión.** _Pendiente._

---

## Q2 · Separación entre proponer y verificar (I-K12-3)

**Contexto.** Una versión del catálogo (`contable.fiscal_rule`) guarda `recorded_by` y `reason`. VERIFIED exige
referencia, pero nada impide que quien propuso la regla registre también su verificación.

**Alternativas.**
| Opción | Descripción | Pros | Contras / riesgo |
|--------|-------------|------|------------------|
| A | Cada versión VERIFIED lleva `proposed_by` (quien propuso el contenido) y `verified_by` (quien lo verifica), distintos. CHECK en la base (migración 0006, aditiva) y comprobación en el código. | Separación garantizada en la base, como en la spec 063 de Property. | Migración y cambio de la API del catálogo (campo nuevo, MINOR). |
| B | La verificación es una versión nueva; su `recorded_by` debe ser distinto del de la versión anterior con el mismo contenido. | Sin columnas nuevas. | Más frágil: depende del orden de versiones; difícil de garantizar en la base. |

**Recomendación.** **A.**

**Decisión.** _Pendiente._

---

## Q3 · Procedencia y estado del resultado fiscal en el registro (I-K12-4)

**Contexto.** `OperationInput.document` es `{ type, number }` sin procedencia ni estado. K12: esta librería valida la
procedencia y el estado del resultado fiscal antes de contabilizarlo, sin duplicar reglas ni cálculos.

**Alternativas.**
| Opción | Descripción | Pros | Contras / riesgo |
|--------|-------------|------|------------------|
| A | Campo opcional `fiscal` en el registro: procedencia (`FISCAL_CORE` u `EXTERNAL`), identificador del documento y estado (emitido, aceptado, rechazado, anulado). Un documento fiscal sin procedencia de la librería o en un estado no definitivo se registra marcado como **no definitivo**; el cobro o pago se registra igual. | Cumple K12 sin bloquear cobros; MINOR. | Property tiene que enviar el dato; lo anterior queda sin él (no se reescribe). |
| B | Rechazar el registro de un documento fiscal sin procedencia de la librería. | Más estricto. | Bloquea operaciones externas aportadas a mano (spec 003 las admite). |
| C | Solo avisar en la exportación. | Mínimo. | No valida antes de contabilizar. |

**Recomendación.** **A.**

**Decisión.** _Pendiente._

---

## Q4 · Dónde viven las reglas fiscales (I-K12-2)

**Contexto.** K12: `@mijex/fiscal-core` es responsable de las reglas y los cálculos fiscales. Hoy hay reglas en tres
sitios: el catálogo de la 003 (aquí), las reglas de alquiler 021/055 (Property) y el resto en fiscal-core.

**Alternativas.**
| Opción | Descripción | Pros | Contras / riesgo |
|--------|-------------|------|------------------|
| A | Spec propia en `mijex-fiscal` para que fiscal-core absorba el catálogo de la 003 y, después, las reglas de alquiler de Property. Mientras tanto, el catálogo de aquí queda **congelado**: sin tipos de regla ni tratamientos nuevos. | Cumple K12 por etapas, sin romper nada. | Transición larga; dos sitios durante un tiempo. |
| B | Enmendar K12: el catálogo de decisión de emisión puede vivir aquí; fiscal-core solo calcula. | Sin trabajo. | Cambia lo que acabas de ratificar. |
| C | Mover todo ahora, dentro de esta spec. | Una sola vez. | Muy grande; toca tres repositorios a la vez. |

**Recomendación.** **A.** Esta spec 004 resuelve Q1–Q3 y congela el catálogo; el traslado va en su propia spec.

**Decisión.** _Pendiente._
