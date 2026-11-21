---
name: sdd
description: Spec-Driven Development de MIJEX Fiscal Core. Úsalo para cualquier funcionalidad, cambio de regla de negocio, API, esquema, permisos, pagos o integración — o cuando el usuario diga "/sdd", "spec", "clarify", "plan", "tasks", "analyze" o "nueva feature". Guía las fases specify → clarify → plan → tasks → analyze → implement → verify → close con los artefactos en specs/NNN-slug/.
---

# SDD — MIJEX Fiscal Core

Uso: `/sdd <fase> [feature]` — fases: `specify`, `clarify`, `plan`, `tasks`,
`analyze`, `implement`, `verify`, `close`, `status`. Sin fase → `status`.

## Antes de cualquier fase (fase 0)
1. Leer `sdd/memory.md` y `AGENTS.md`. Las decisiones del dueño (memoria §2) y
   las *stop conditions* (AGENTS.md) son requisitos.
2. Leer `sdd/README.md` (orden, puertas de salida, convenciones).
3. Localizar la feature en `specs/`. Para una nueva: siguiente número `NNN`
   correlativo y `slug` en kebab-case y en español.

## Fases
| Fase | Qué hacer | Plantilla | Puerta de salida |
|------|-----------|-----------|------------------|
| `specify` | Crear `specs/NNN-slug/spec.md`: problema, historias por rol, criterios Dado/Cuando/Entonces, casos límite (otro emisor/país, serie agotada, respuesta perdida), no funcionales, fuera de alcance. **Sin** tablas, módulos ni funciones. Dudas → `[NEEDS CLARIFICATION: …]`. | `sdd/templates/spec-template.md` | Sin supuestos inventados. |
| `clarify` | Crear/actualizar `clarify.md`: una pregunta por bloque, alternativas, recomendación. Preguntar al usuario. **Nunca** dar por respondida una stop condition. Al resolverse: quitar las marcas de la spec y copiar las decisiones duraderas a `sdd/memory.md`. | `sdd/templates/clarify-template.md` | Cero preguntas abiertas. |
| `plan` | Inventario de lo existente (modelos, servicios, puertos, adaptadores, tests, vectores oficiales); diseño; contratos; migraciones SQL del esquema `fiscal`; seguridad y aislamiento por emisor; fuentes normativas (`research.md`); tests; rollout/rollback; *Constitution check* contra `sdd/constitucion.md`. | `sdd/templates/plan-template.md` | Constitution check sin incumplimientos sin justificar. |
| `tasks` | `tasks.md`: tareas ≤ ½ día `T001…`, test primero, dependencias, `[P]` si son paralelizables. | `sdd/templates/tasks-template.md` | Orden ejecutable. |
| `analyze` | Matriz criterio → tarea → test al final de `tasks.md`; detectar huecos y contradicciones. | — | Todo criterio con tarea y test. |
| `implement` | Una tarea a la vez con el skill `test-driven-development` (rojo → verde → refactor). Tipos: `typescript-pro`; tests: `ts-testing`. Mínima modificación. Marcar `[x]`. | — | Tareas cerradas. |
| `verify` | `npm run lint && npm run typecheck && npm test && npm run test:pg && npm run build` y `npm run test:coverage` (umbral 90 %). Revisión adversarial (AGENTS.md §13). Si toca firma, certificados, secretos o transporte: skill `security-audit` sobre el diff. Fallos preexistentes: demostrar que no son del cambio y reportarlos. | — | Todo en verde o fallos preexistentes documentados. |
| `close` | Actualizar `README.md`, `data-model.md` y `contracts/` si cambió la API pública, datos o flujos; changeset si cambia la API; `sdd/memory.md` (decisiones, deuda, trampas); índice de `sdd/README.md`; informe con el formato de `AGENTS.md §15`. | — | Documentación sincronizada. |
| `status` | Listar `specs/*`, su estado, preguntas abiertas en `clarify.md` y tareas pendientes. | — | — |

## Reglas
- No avanzar de fase con la puerta abierta; si una fase posterior invalida una
  anterior, volver y actualizar ese artefacto.
- Vía rápida solo para cambios triviales sin impacto en reglas, datos, API ni
  permisos (spec mínima + test que reproduce el bug).
- Git lo controla el usuario: no hacer commits, push ni cambiar de rama.
