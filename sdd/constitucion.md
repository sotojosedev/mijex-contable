# Constitución — MIJEX Contable

> Principios **no negociables** de la librería contable. Toda spec, plan y tarea se valida contra este documento (el
> *Constitution check* del `plan.md`). Si una spec lo contradice, gana la constitución y se informa de la
> contradicción. Cada principio sale de [`AGENTS.md`](../AGENTS.md), que sigue siendo la fuente de las reglas
> operativas. Aquí no se añade nada que no esté ya decidido allí.

Versión: 1.0.0 · Propuesta: 2026-11-21 · **Pendiente de ratificación del dueño**

Prioridad (AGENTS.md): **cumplimiento legal > corrección > seguridad > compatibilidad de la API > rendimiento >
comodidad**.

## Principios

| # | Principio | Origen | Cómo se comprueba |
|---|-----------|--------|-------------------|
| K1 | **Regla + referencia + test.** Todo desarrollo entrega la regla (`docs/reglas/`, `R-…`), su referencia oficial (`docs/referencias/`, `REF-…`) y al menos un test con el ID de la regla en su nombre. | §1 | Trazabilidad regla → referencia → test en cada spec y en cada PR. |
| K2 | **Solo fuentes oficiales.** España: ICAC, BOE y AEAT. RD: DGII e ICPARD. Un skill de terceros nunca sustituye a la fuente. Sin referencia, la regla queda `[verificar]` y no se implementa. | §1, §3 | Revisión de `docs/referencias/` y de los niveles de confianza. |
| K3 | **Stop conditions.** Las reglas contables, fiscales o legales, el dinero, el redondeo, los tipos de cambio, los impuestos, borrar código contable de otros repositorios, la API pública y git requieren la confirmación explícita del dueño. | §4 | `clarify.md` con la decisión, la fecha y quién la tomó. |
| K4 | **Multi-país por datos.** Ningún país, moneda, impuesto, plan de cuentas o tipo fijo en el código; todo es dato configurable y versionado por vigencia, con su ID de regla y su referencia. | §5 | Sin `if (country === …)`; tests con datos de vigencia. |
| K5 | **Dinero exacto.** Importes en unidades menores (`bigint`), nunca `number` flotante; redondeo documentado. | §6 | Tests de redondeo y repartos que siempre cuadran. |
| K6 | **Inmutabilidad contable.** Lo registrado no se edita: se corrige con asientos nuevos, con traza de quién, cuándo y por qué. | §6 | Sin actualizaciones de contenido en la API; test del intento de edición. |
| K7 | **Seguridad primero.** Entrada validada en el límite de la API, tipos estrictos sin `any`, secretos inyectados (nunca en código, logs ni errores), SQL parametrizado y privilegio mínimo. | §6 | `security-audit` en lo que toque secretos, permisos, entradas o datos personales. |
| K8 | **Reutilización.** Antes de escribir, buscar aquí y en `@mijex/fiscal-core`. Lo que se extrae de HS, Property o `mijex-fiscal` se extrae una sola vez. | §6 | Inventario del plan; `knip` en verde. |
| K9 | **Frontera con lo fiscal.** La emisión, la numeración, VERI*FACTU y el e-CF viven en `@mijex/fiscal-core`; esta librería los consume para asentarlos e informar. | CLAUDE.md | Ningún código de emisión en `src/`. |
| K10 | **SDD + TDD siempre.** Spec → clarify → plan → tasks; test en rojo antes del código. | §2 | Artefactos de `specs/NNN-slug/` y orden de los commits. |
| K11 | **Calidad verificable.** Lint, typecheck, tests (unit y PG), build y knip en verde antes de cerrar; documentación al día. | §6 | Resultados registrados en `tasks.md`. |

## Gobierno
- Las enmiendas requieren la aprobación explícita del dueño. Cada una sube la versión (MAJOR si se cambia o elimina
  un principio, MINOR si se añade, PATCH si es de redacción) y se anota abajo.
- Un incumplimiento en el *Constitution check* bloquea el paso a tareas hasta que se resuelva o se justifique por
  escrito en el plan.

## Registro de enmiendas

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-11-21 | Propuesta inicial: K1–K11, sacados de `AGENTS.md` y `CLAUDE.md`, sin reglas nuevas. Pendiente de ratificación. |
