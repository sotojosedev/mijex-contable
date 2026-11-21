---
name: sdd
description: Spec-Driven Development de MIJEX Home Services. Úsalo para cualquier funcionalidad, cambio de regla de negocio, API, esquema, permisos, pagos o integración — o cuando el usuario diga "/sdd", "spec", "clarify", "plan", "tasks", "analyze" o "nueva feature". Guía las fases specify → clarify → plan → tasks → analyze → implement → verify → close con los artefactos en specs/NNN-slug/.
---

# SDD — MIJEX Home Services

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
| `specify` | Crear `specs/NNN-slug/spec.md`: problema, historias por rol, criterios Dado/Cuando/Entonces, casos límite (otra organización/país, sin permisos), no funcionales, fuera de alcance. **Sin** tablas, endpoints ni componentes. Dudas → `[NEEDS CLARIFICATION: …]`. | `sdd/templates/spec-template.md` | Sin supuestos inventados. |
| `clarify` | Crear/actualizar `clarify.md`: una pregunta por bloque, alternativas, recomendación. Preguntar al usuario. **Nunca** dar por respondida una stop condition. Al resolverse: quitar las marcas de la spec y copiar las decisiones duraderas a `sdd/memory.md`. | `sdd/templates/clarify-template.md` | Cero preguntas abiertas. |
| `plan` | Inventario de lo existente (modelos, servicios, endpoints, authz, tests, utilidades); diseño; contratos; migraciones (nunca `db push`); seguridad y multi-tenant; tests; rollout/rollback; *Constitution check* contra `sdd/memory.md` §1. | `sdd/templates/plan-template.md` | Constitution check sin incumplimientos sin justificar. |
| `tasks` | `tasks.md`: tareas ≤ ½ día `T001…`, test primero, dependencias, `[P]` si son paralelizables. | `sdd/templates/tasks-template.md` | Orden ejecutable. |
| `analyze` | Matriz criterio → tarea → test al final de `tasks.md`; detectar huecos y contradicciones. | — | Todo criterio con tarea y test. |
| `implement` | Una tarea a la vez con el skill `test-driven-development` (rojo → verde → refactor). Prisma: `prisma-client-api`, `prisma-cli`. Mínima modificación. Marcar `[x]`. | — | Tareas cerradas. |
| `verify` | En `backend/`: `npm run lint && npm run typecheck && npm run build && npm test`; desde la raíz: `npm --prefix frontend run lint && npm --prefix frontend run build`. Revisión adversarial. Si toca auth, pagos, archivos, webhooks o datos sensibles: skill `security-audit` o `code-security-audit` sobre el diff. Fallos preexistentes: demostrar que no son del cambio y reportarlos. | — | Todo en verde o fallos preexistentes documentados. |
| `close` | Actualizar `docs/diseno-tecnico.md` si cambió arquitectura/API/datos/roles/flujos; `sdd/memory.md` (decisiones, deuda, trampas); índice de `sdd/README.md`; informe con el formato de `AGENTS.md §24`. | — | Documentación sincronizada. |
| `status` | Listar `specs/*`, su estado, preguntas abiertas en `clarify.md` y tareas pendientes. | — | — |

## Reglas
- No avanzar de fase con la puerta abierta; si una fase posterior invalida una
  anterior, volver y actualizar ese artefacto.
- Vía rápida solo para cambios triviales sin impacto en reglas, datos, API ni
  permisos (spec mínima + test que reproduce el bug).
- Git lo controla el usuario: no hacer commits, push ni cambiar de rama.
