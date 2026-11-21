---
name: sdd
description: Spec-Driven Development del sitio público mijex-web. Úsalo para cualquier cambio no trivial de páginas, rutas, contenido por país, enlaces a las apps, precios, accesibilidad, rendimiento o build — o cuando el usuario diga "/sdd", "spec", "clarify", "plan", "tasks", "analyze" o "nueva feature". Guía las fases specify → clarify → plan → tasks → analyze → implement → verify → close con los artefactos en specs/NNN-slug/.
---

# SDD — mijex-web

Uso: `/sdd <fase> [feature]` — fases: `specify`, `clarify`, `plan`, `tasks`,
`analyze`, `implement`, `verify`, `close`, `status`. Sin fase → `status`.
Mismo proceso que `mijex-home-services` (`.claude/skills/sdd`) y
`mijex-property` (`.claude/commands/sdd-*`), adaptado a un repo **solo frontend**.

## Antes de cualquier fase (fase 0)
1. Leer `MEMORY.md`, `sdd/constitucion.md` y `AGENTS.md`. Las decisiones del
   dueño (memoria §2) y las *stop conditions* (AGENTS.md) son requisitos.
2. Leer `sdd/README.md` (orden, puertas de salida, convenciones).
3. Localizar la feature en `specs/`. Para una nueva: siguiente `NNN`
   correlativo y `slug` en kebab-case y en español.
4. Si el cambio describe funcionalidades de las apps, las fuentes son
   (dueño, 2026-10-15): `../mijex-home-services/docs/diseno-tecnico.md`,
   `../mijex-property/docs/DISENO-TECNICO.md`,
   `../mijex-property/backend/docs/DISENO-TECNICO.md`,
   `../mijex-mobile/docs/DISENO-TECNICO.md` y `../mijex-fiscal/sdd/memory.md`.
   No se publica lo que no existe salvo decisión registrada del dueño.

## Fases
| Fase | Qué hacer | Plantilla | Puerta de salida |
|------|-----------|-----------|------------------|
| `specify` | `specs/NNN-slug/spec.md`: problema, historias por audiencia, criterios Dado/Cuando/Entonces, **casos por país (RD y España)**, no funcionales (responsive, accesibilidad), fuera de alcance. Sin componentes ni CSS. Dudas → `[NEEDS CLARIFICATION: …]`. | `sdd/templates/spec-template.md` | Sin supuestos inventados. |
| `clarify` | `clarify.md`: una pregunta por bloque, alternativas, recomendación. Preguntar al usuario. Al resolverse: quitar las marcas de la spec y copiar las decisiones duraderas a `MEMORY.md` §2. | `sdd/templates/clarify-template.md` | Cero preguntas abiertas. |
| `plan` | Inventario (componentes, `data/*`, `lib/*`, tokens, tests existentes); diseño; tests que se escriben primero; responsive y accesibilidad; *Constitution check* (P1–P9). | `sdd/templates/plan-template.md` | Constitution check sin incumplimientos sin justificar. |
| `tasks` | `tasks.md`: tareas `T001…`, **cada tarea de código empieza por su test** (rojo), dependencias, `[P]` si son paralelizables. | `sdd/templates/tasks-template.md` | Orden ejecutable. |
| `analyze` | Matriz criterio → tarea → test al final de `tasks.md`; huecos y contradicciones. | — | Todo criterio con tarea y verificación. |
| `implement` | Una tarea a la vez con el skill `test-driven-development` (rojo → verde → refactor). Mínima modificación. Marcar `[x]`. | — | Tareas cerradas. |
| `verify` | Desde la raíz: `npm run lint && npm run typecheck && npm test`; build con URLs de ejemplo (`VITE_HOME_SERVICES_APP_URL`, `VITE_PROPERTY_APP_URL`, `VITE_PROPERTY_API_URL`); Chrome headless contra `vite preview` de 280 a 1920 px, tema claro y oscuro, **RD y España**. Revisión adversarial. | — | Todo en verde o fallos preexistentes documentados. |
| `close` | `docs/DISENO-TECNICO.md` si cambian rutas, componentes, build o diseño; `MEMORY.md` (decisiones, deuda, trampas); índice de `sdd/README.md`; informe `AGENTS.md §24`. | — | Documentación sincronizada. |
| `status` | Listar `specs/*`, su estado, preguntas abiertas y tareas pendientes. | — | — |

## Reglas
- No avanzar de fase con la puerta abierta; si una fase posterior invalida una
  anterior, volver y actualizar ese artefacto.
- Vía rápida solo para cambios triviales (`sdd/README.md`): spec mínima + test
  que reproduce el fallo.
- Git lo controla el usuario: no hacer commits, push ni cambiar de rama.
