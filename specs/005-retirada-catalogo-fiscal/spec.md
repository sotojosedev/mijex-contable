# Spec 005 — Retirada del catálogo fiscal duplicado

| Campo | Valor |
|-------|-------|
| Estado | Implementado y verificado en desarrollo (2026-11-23). Clarify: [clarify.md](clarify.md) (REF-DEC-016); plan: [plan.md](plan.md); tareas: [tasks.md](tasks.md) |
| Solicitado por | Dueño, 2026-11-23 (T016 de la spec 014 de `mijex-fiscal`) |
| Fecha | 2026-11-23 |
| Países | ES · DO (no cambia ninguna regla de país) |
| Consumidores | Property · Home Services · `@mijex/fiscal-core` (frontera) |

> Fase 1 del [proceso SDD](../../sdd/README.md). Describe **qué** y **por qué**.

## 1. Problema y contexto
La spec 003 (corte 2) y la 004b metieron en esta librería un catálogo de reglas fiscales de emisión: propuesta,
verificación por otra persona, decisión de emisión y su almacén en el esquema `contable`. Es el incumplimiento
**I-K12-2** de la constitución: K12 dice que `@mijex/fiscal-core` es el **único** responsable de las reglas fiscales y
que esta librería solo valida la procedencia y el estado del resultado fiscal.

La spec 014 de `mijex-fiscal` (etapa 2, commit `c08ab5a`) llevó ese catálogo a fiscal-core, con publicación por una
tercera persona y la referencia de la regla guardada en cada documento. Property (commit `3015216`) ya usa el de
fiscal-core. La copia de esta librería queda sin uso y es un riesgo: dos catálogos que pueden decir cosas distintas
contradicen la condición C1 de la spec 014 («ninguna aplicación puede modificar directamente las reglas fiscales
compartidas»).

## 2. Objetivo
`@mijex/fiscal-core` queda como **única fuente autorizada de reglas fiscales**. Esta librería deja de exponer el
catálogo y su decisión de emisión, sus tablas desaparecen con una migración nueva, y el contrato del resultado fiscal
(`FiscalResultEnvelope`) sigue validando procedencia, estado, versión **e identificación de las reglas usadas**, sin
cambiar cálculos fiscales, asientos ni el comportamiento de Property y Home Services.

## 3. Historias
- **H1** — Como plataforma, quiero que las reglas fiscales existan en un solo sitio, para que nadie las cambie fuera
  del proceso de propuesta, verificación y publicación de fiscal-core.
- **H2** — Como Property o Home Services, quiero actualizar la librería sin cambiar mi comportamiento, y saber
  exactamente qué hacer si algún día usé el catálogo retirado.
- **H3** — Como contabilidad, quiero que cada resultado fiscal registrado diga qué reglas (y qué versiones) lo
  decidieron, para reproducir la decisión aunque las reglas cambien después (condición C2 de la 014).
- **H4** — Como dueño, quiero que ninguna operación destructiva llegue a producción ni se publique una versión mayor
  sin ver antes los resultados y dar mi aprobación.

## 4. Criterios de aceptación
| ID | Historia | Criterio (Dado / Cuando / Entonces) |
|----|----------|-------------------------------------|
| CA1 | H2 | **Dado** Property, Home Services y cualquier otro repositorio local, **cuando** se buscan las funciones, tipos, exportaciones, códigos de error y tablas a retirar, **entonces** ninguno los usa (inventario en el plan, con la búsqueda que lo demuestra). |
| CA2 | H1 | **Dado** el catálogo antiguo, **cuando** se compara con el de fiscal-core, **entonces** cada responsabilidad tiene su equivalente igual o más estricto, y cada diferencia queda documentada sin pérdida de funcionalidad usada. |
| CA3 | H1, H2 | **Dado** la librería, **cuando** se importa, **entonces** ya no expone el catálogo, su almacén (memoria y PostgreSQL), la decisión de emisión ni sus tipos y códigos de error exclusivos; hay changeset de versión **mayor** y guía de migración hacia `@mijex/fiscal-core`. |
| CA4 | H3 | **Dado** un resultado fiscal de fiscal-core con las reglas que lo decidieron, **cuando** se registra, **entonces** se validan (tipo, identificador y versión bien formados, sin repetidas) y quedan guardadas con el registro; un sobre sin reglas se sigue aceptando igual que hoy. |
| CA5 | H3 | **Dado** un sobre con reglas mal formadas o repetidas, **cuando** se registra, **entonces** se rechaza con un error tipado y no se guarda nada. |
| CA6 | H1 | **Dado** una base con el esquema `contable`, **cuando** se aplica la migración nueva, **entonces** las tablas del catálogo, sus disparadores y su función de guardia desaparecen; las migraciones 0005 y 0006 no se modifican ni se borran. |
| CA7 | H4 | **Dado** una base donde el catálogo **tiene filas**, **cuando** se aplica la migración nueva, **entonces** falla sin borrar nada (nunca se pierden datos en silencio). |
| CA8 | H4 | **Dado** una base de desarrollo, **antes** de aplicar la migración, **entonces** se comprueba que las tablas están vacías, que no hay objetos que dependan de ellas y que existe una copia de seguridad validada. |
| CA9 | H2 | **Dado** el cambio, **cuando** se ejecutan las pruebas unitarias, de PostgreSQL, compilación, lint y `knip` de la librería, y la compilación y regresión de Property y Home Services, **entonces** todo está en verde y el comportamiento de los consumidores no cambia. |
| CA10 | H1 | `AGENTS.md`, la constitución, las referencias arquitectónicas y `docs/diseno-tecnico.md` dicen explícitamente que fiscal-core es la única fuente de reglas fiscales; I-K12-2 queda cerrado en lo que toca a esta librería. |
| CA11 | H4 | No se aplica la migración fuera de desarrollo ni se publica la versión mayor sin presentar los resultados y obtener la aprobación específica del dueño. |

## 5. Reglas y referencias
| Regla | Qué dice | Referencia | Nivel / estado |
|-------|----------|------------|----------------|
| R-CORE-014 | **Retirada** (2026-11-23): el catálogo de reglas fiscales y la decisión de emisión pasan a `@mijex/fiscal-core` (spec 014 de `mijex-fiscal`). Esta librería no guarda ni decide reglas fiscales. | REF-DEC-016 (y REF-DEC-014, K12) | Decisión del dueño |
| R-CORE-018 | El resultado fiscal registrado puede llevar las reglas que lo decidieron (tipo, identificador, versión); si las lleva, se validan y se guardan con el registro, sin interpretarlas. | REF-DEC-016, REF-DEC-015 | Decisión del dueño |

No crea ni modifica ninguna regla fiscal de país.

## 6. Casos límite
- Una base de un entorno con filas en el catálogo antiguo: la migración falla y no borra nada (CA7).
- Una base que nunca tuvo el catálogo (p. ej. con el esquema en una versión anterior a la 0005): la migración llega a
  ella después de 0005 y 0006, así que siempre encuentra las tablas; aun así, se escribe de forma que no falle si ya no
  existen.
- Un registro ya guardado sin reglas: se lee igual; no se reescribe nada (inmutabilidad).
- La misma operación registrada dos veces con y sin reglas: es un cambio de datos (idempotencia de la 003): mismo
  tratamiento que cualquier otro campo del sobre.
- Property y Home Services aplican las migraciones de la librería **al arrancar**: actualizar la librería en un entorno
  equivale a ejecutar la migración allí (por eso CA11 controla la publicación).

## 7. Requisitos no funcionales
- Seguridad: el sobre llega de fuera; se valida en el límite y no se guardan datos personales nuevos.
- Multi-país por datos: sin constantes por país.
- Inmutabilidad y auditoría: los registros existentes no cambian; la retirada del catálogo es una migración nueva con
  vuelta atrás documentada.
- Compatibilidad: único cambio incompatible, la retirada de exportaciones sin uso (versión mayor). El contrato del sobre
  sigue en la versión 1 (el campo nuevo es opcional).

## 8. Fuera de alcance
- Las reglas de alquiler de Property (021/055): siguen en Property hasta la etapa 3 de la spec 014.
- Aplicar la migración en staging o producción y publicar la versión mayor (CA11).
- La base compartida `mijex` (rama `main` de HS), que sigue en la migración 0002 y no tiene el catálogo.

## 9. Preguntas abiertas
Ninguna (ver [clarify.md](clarify.md)).
