# SDD — Spec-Driven Development en MIJEX Contable

Proceso obligatorio para cualquier cambio no trivial: regla contable o fiscal, API pública, esquema, permisos o
integración con Home Services y Property. Complementa [`AGENTS.md`](../AGENTS.md); si algo de aquí lo contradice,
manda `AGENTS.md` y se corrige este documento.

> Primero se acuerda el *qué* y el *por qué* (spec), después el *cómo* (plan), después el *orden* (tasks). Solo
> entonces se escribe código, con el test primero. Cada fase deja un artefacto versionado y tiene una puerta de
> salida explícita.

## Orden de las fases

| # | Fase | Artefacto | Puerta de salida |
|---|------|-----------|------------------|
| 0 | **Memoria** | [`constitucion.md`](constitucion.md) (v1.1.0, ratificada el 2026-11-22), [`memory.md`](memory.md), `AGENTS.md` | Leídos antes de empezar. |
| 1 | **Specify** | `specs/NNN-slug/spec.md` | Historias y criterios verificables, fuera de alcance, reglas (`R-…`) y referencias (`REF-…`) que crea o modifica. Dudas marcadas `[NEEDS CLARIFICATION]`, sin decisiones técnicas. |
| 2 | **Clarify** | `specs/NNN-slug/clarify.md` | Ningún `[NEEDS CLARIFICATION]` abierto. Cada *stop condition* (AGENTS.md §4) la resuelve una persona y queda registrada con fecha. |
| 3 | **Plan** | `specs/NNN-slug/plan.md` | Inventario de lo existente, diseño, contratos, migraciones SQL, seguridad y aislamiento por organización y país, tests, despliegue y vuelta atrás. *Constitution check* superado. |
| 4 | **Tasks** | `specs/NNN-slug/tasks.md` | Tareas pequeñas ordenadas por dependencia, cada una con su test primero. |
| 5 | **Analyze** | Sección final de `tasks.md` | Cada criterio y cada regla tienen tarea y test; ninguna tarea queda sin requisito. |
| 6 | **Implement** | Código y tests | TDD rojo → verde → refactor; tareas marcadas `[x]`. |
| 7 | **Verify** | Resultados en `tasks.md` | Comandos de abajo en verde, revisión adversarial y `security-audit` si toca secretos, permisos, entradas o datos personales. |
| 8 | **Close** | `docs/reglas/`, `docs/referencias/`, `docs/diseno-tecnico.md`, [`memory.md`](memory.md) | Regla, referencia y test enlazados (AGENTS.md §1); diseño técnico y registro de cambios al día. |

No se avanza de fase con la puerta abierta. Si una fase posterior invalida una anterior, **se vuelve** a esa fase y se
actualiza su artefacto; no se arregla solo en el código.

## Detalle por fase

### 1 · Specify (plantilla: [`templates/spec-template.md`](templates/spec-template.md))
- Qué necesita quien usa la librería (Property, Home Services, la organización, la plataforma) y por qué.
- Enumera las reglas `R-<ÁMBITO>-NNN` y las referencias `REF-<PAÍS>-NNN` o `REF-DEC-NNN` que crea o modifica.
- Prohibido en la spec: tablas, módulos o funciones.
- Toda duda se marca `[NEEDS CLARIFICATION: …]`. Nunca se rellena con supuestos, y menos en normativa (AGENTS.md §3).

### 2 · Clarify (plantilla: [`templates/clarify-template.md`](templates/clarify-template.md))
- Una pregunta por bloque, con alternativas y recomendación.
- Las *stop conditions* (reglas contables, fiscales o legales; dinero, redondeo e impuestos; borrar código contable
  de otros repositorios; API pública; git) **las responde el dueño**. El agente nunca las da por resueltas.
- Al resolverlas: se quitan las marcas de la spec y las decisiones duraderas se registran (ver [`memory.md`](memory.md)).

### 3 · Plan (plantilla: [`templates/plan-template.md`](templates/plan-template.md))
- Antes de diseñar, localizar lo que ya existe: `src/`, `@mijex/fiscal-core`, las reglas y referencias, los tests y las
  integraciones con Property y Home Services. Reutilizar antes de crear (AGENTS.md §6).
- Cambios de esquema: migración SQL nueva en `migrations/` (nunca se reescribe una publicada), con compatibilidad y
  vuelta atrás. Todo PostgreSQL sigue el skill `supabase-postgres-best-practices`.
- Dinero en unidades menores (`bigint`); los tipos y umbrales son datos con vigencia, nunca constantes por país.
- *Constitution check* contra [`constitucion.md`](constitucion.md).

### 4 · Tasks (plantilla: [`templates/tasks-template.md`](templates/tasks-template.md))
- Tareas de ½ día como máximo (`T001…`), con dependencias y `[P]` si se pueden hacer en paralelo.
- Cada tarea de código empieza por su test, con el ID de la regla: `describe('[R-ES-001] …')`.

### 6 · Implement
- Una tarea a la vez, con los skills `test-driven-development`, `typescript-pro` y `ts-testing`.
- Lo que quede fuera de alcance va a la deuda (ver [`memory.md`](memory.md)).

### 7 · Verify
```bash
npm run lint && npm run typecheck && npm test && npm run test:pg && npm run build && npm run knip
```
- Revisión adversarial: otra organización o país, importes en el límite, redondeo, operación repetida o concurrente,
  datos con vigencia vencida.
- Revisión con `code-review-typescript`; en cambios relevantes, `/code-review` y `/simplify` (AGENTS.md §6).
- Fallos preexistentes: identificarlos, demostrar que no los causa el cambio y reportarlos.

## Vía rápida
Para un cambio trivial (texto, mensaje, error tipográfico) sin impacto en reglas, datos, API ni permisos basta con un
`spec.md` mínimo (síntoma, causa, criterio) y un `tasks.md` con el test que lo reproduce. **Si toca una stop
condition, no es trivial.**

## Convenciones
- Una carpeta por feature: `specs/NNN-slug/` (`NNN` correlativo, `slug` en kebab-case y en español).
- Estado en la cabecera: `Borrador` → `En revisión` → `Aprobado` → `Implementado` → `Verificado`.
- Fechas absolutas (AAAA-MM-DD). Documentación en español; identificadores de código en inglés.
- Git solo con permiso explícito del dueño, cada vez.

## Índice de features

| Feature | Estado | Artefactos | Notas |
|---------|--------|------------|-------|
| [001-inventario-y-nucleo-contable](../specs/001-inventario-y-nucleo-contable/spec.md) | Aprobada (Clarify 2026-11-17) · fase 1a implementada | spec, clarify, plan, tasks | Núcleo de la librería |
| [002-conciliacion-bancaria-comun](../specs/002-conciliacion-bancaria-comun/spec.md) | Implementada y conectada en HS y Property (2026-11-17) | spec, tasks | **Sin clarify ni plan** |
| [003-registro-operaciones-organizaciones](../specs/003-registro-operaciones-organizaciones/spec.md) | Corte 2 implementado (2026-11-22): clarify resuelto (REF-DEC-013), plan, migraciones 0004/0005 y liquidación guardada aprobadas; T001–T050 hechas | spec, clarify, plan, tasks, migraciones-y-regresion, liquidacion-guardada | Corte 2 cerrado (T090, T095). Reglas del catálogo de Property en «pendiente de verificación»: verificarlas es trabajo del dueño. Ver incumplimientos de K12 en `constitucion.md` |
