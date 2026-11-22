# Spec 004 — Cumplimiento de K12: tratamiento fiscal solo con regla validada

| Campo | Valor |
|-------|-------|
| Estado | En revisión (2026-11-22). Clarify resuelto ([clarify.md](clarify.md), REF-DEC-015); plan: [plan.md](plan.md) |
| Solicitado por | Dueño, 2026-11-22, al ratificar la constitución v1.1.0 (REF-DEC-014) |
| Fecha | 2026-11-22 |
| Países | ES · DO |
| Consumidores | Property (catálogo de la 003, registro de operaciones) · `@mijex/fiscal-core` (frontera) |

> Fase 1 del [proceso SDD](../../sdd/README.md). Describe **qué** y **por qué**. Las dudas están en `clarify.md`.

## 1. Problema y contexto
Al ratificar la constitución con K12 (AGENTS.md §7) se encontraron cuatro incumplimientos en lo ya implementado
(`sdd/constitucion.md`, I-K12-1 a I-K12-4; `tests/operations/k12.test.ts`, `todo`):
1. **I-K12-1.** Fuera de producción, una regla del catálogo «aprobada, pendiente de verificación» emite. Lo decidió el
   dueño en REF-DEC-009 para no cambiar el comportamiento de Property. K12 dice que ningún tratamiento fiscal se aplica
   sin una regla validada.
2. **I-K12-2.** Las reglas fiscales no están todas en `@mijex/fiscal-core`. El catálogo de la 003 vive en esta librería
   (esquema `contable`) y las reglas de alquiler (021 y 055) viven en Property.
3. **I-K12-3.** Una versión verificada del catálogo solo guarda quién la registró. No hay una aprobación separada de
   la propuesta, así que una misma persona puede proponer y verificar.
4. **I-K12-4.** El registro de operaciones no comprueba la procedencia ni el estado del resultado fiscal antes de
   registrarlo: acepta cualquier documento como si fuera definitivo.

## 2. Objetivo
Cerrar los cuatro incumplimientos y convertir los `todo` de `k12.test.ts` en pruebas en verde, sin bloquear cobros ni
pagos, sin cambiar documentos emitidos y sin duplicar reglas ni cálculos con `@mijex/fiscal-core`.

## 3. Historias
- **H1** — Como dueño, quiero que ningún documento fiscal se emita con una regla sin verificar, en ningún entorno, para
  que lo que se prueba sea lo que se aplicará.
- **H2** — Como plataforma, quiero que verificar una regla exija a alguien distinto de quien la propuso, para que
  ninguna regla fiscal se apruebe a sí misma.
- **H3** — Como organización, quiero que el registro distinga un resultado fiscal emitido por la librería fiscal de uno
  pendiente o de origen desconocido, para que mi gestoría no contabilice como definitivo lo que no lo es.
- **H4** — Como arquitectura, quiero que las reglas y los cálculos fiscales tengan un único dueño
  (`@mijex/fiscal-core`), para no mantener dos catálogos que puedan contradecirse.

## 4. Criterios de aceptación
| ID | Historia | Criterio (Dado / Cuando / Entonces) |
|----|----------|-------------------------------------|
| CA1 | H1 | **Dado** una regla «pendiente de verificación» **cuando** se decide la emisión de un documento real, en cualquier entorno, **entonces** la operación va a revisión manual y el cobro o pago no se bloquea; solo una simulación o prueba aislada con datos ficticios puede ejecutarla, y nunca produce un documento real. |
| CA2 | H2 | **Dado** una regla propuesta por una persona **cuando** esa misma persona intenta verificarla **entonces** se rechaza por permisos, por estado y en la base de datos, y el intento queda auditado. |
| CA3 | H3 | **Dado** un documento fiscal **cuando** se registra **entonces** se verifican su procedencia, versión, estado, ámbito e integridad según un contrato público estable; uno que no los cumple se rechaza con un error tipado o se registra como no definitivo, y el registro del cobro o pago sigue. Sin recalcular impuestos. |
| CA4 | H4 | **Dado** el catálogo de la 003 y las reglas de alquiler de Property **cuando** se resuelve la frontera **entonces** la autoridad es `@mijex/fiscal-core` con un catálogo compartido y versionado; esta librería, Property y Home Services solo consumen resultados validados. |
| CA5 | todas | Los documentos emitidos no cambian; las correcciones son documentos o registros nuevos. |

## 5. Reglas y referencias
| Regla | Qué dice | Referencia | Estado |
|-------|----------|------------|--------|
| R-CORE-014 | Catálogo fiscal en datos versionados; lo indeterminado va a revisión | REF-DEC-009, REF-DEC-013, **REF-DEC-014** | se modifica (CA1, CA2) |
| R-CORE-012 | Registro de operaciones inmutable, con corrección por reversión | REF-DEC-008, REF-DEC-013 | se amplía (CA3) |
| K12 | Constitución v1.1.0 | REF-DEC-014 | principio que se cumple |

No se crea ninguna regla fiscal nueva: esta spec cambia quién y cómo se valida, no qué tratamiento corresponde.

## 6. Casos límite
- Una regla verificada que luego pasa a no determinada: vuelve a revisión desde ese momento; lo emitido no cambia.
- Carga inicial (siembra) de reglas ya aprobadas: no es una verificación; quedan pendientes.
- Documentos anteriores a esta spec sin procedencia registrada: no se reescriben.
- Otra organización o país: la verificación y el registro siguen separados por país y organización.
- Concurrencia: dos verificaciones de la misma regla a la vez (ya cubierto por `CONCURRENT_UPDATE`).

## 7. Requisitos no funcionales
- Seguridad: la separación de funciones se garantiza también en la base de datos, no solo en el código.
- Multi-país por datos: ninguna condición por país en el código.
- Inmutabilidad y auditoría: quién propuso, quién verificó, cuándo y con qué referencia.
- Compatibilidad: los cambios de la API pública son MINOR si añaden campos opcionales; un cambio de comportamiento de
  `decideFiscalIssuance` es una decisión del dueño (Q1).

## 8. Fuera de alcance
- Verificar las reglas concretas del catálogo de Property (trabajo de validación del dueño).
- Cambios en `@mijex/fiscal-core` sin su propia spec en `mijex-fiscal` (Q4).
- Las reglas de alquiler de la 055 de Property (validación en curso, spec 062).

## 9. Preguntas abiertas
Ninguna: resueltas en `clarify.md` (2026-11-22).
