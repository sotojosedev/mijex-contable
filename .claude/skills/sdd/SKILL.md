---
name: sdd
description: Spec-Driven Development para los proyectos MIJEX. Usar al solicitar /sdd, specify, clarify, plan, tasks, analyze, implement, verify, close o status, o al desarrollar cambios no triviales sujetos al proceso SDD del repositorio actual.
---

# SDD — MIJEX

Uso: `/sdd <fase> [feature]`. Sin fase, mostrar `status`.

## Seleccionar el contexto local

Leer primero `AGENTS.md`, `MEMORY.md` y la memoria a la que remita ese archivo.
Seguir la constitución, el proceso, las plantillas y los comandos que existan en
el repositorio actual. No trasladar reglas de negocio, tablas, esquemas de base
de datos, umbrales de cobertura ni comandos de otro proyecto.

Las variantes originales se conservan como referencias del proyecto de origen:

- Web: [mijex-web](references/mijex-web.md), junto con `sdd/README.md` y `sdd/constitucion.md` locales.
- Home Services: [mijex-home-services](references/mijex-home-services.md), junto con `sdd/README.md`, `sdd/constitucion.md` y `sdd/memory.md` locales.
- Fiscal: [mijex-fiscal](references/mijex-fiscal.md), junto con `sdd/README.md`, `sdd/constitucion.md` y `sdd/memory.md` locales.
- Property: usar `specs/README.md`, `.specify/memory/constitution.md` y las plantillas de `.specify/templates/` locales.
- Mobile: usar `specs/README.md`, `AGENTS.md` y `MEMORY.md` locales.
- Contable: usar `AGENTS.md`, las specs y las reglas y referencias de `docs/` locales. Su copia anterior era idéntica a la de Fiscal; no aplicar por ello el esquema `fiscal`, sus comandos ni sus umbrales.

Si falta un artefacto necesario, indicar cuál falta y resolverlo con el usuario
antes de decidir arquitectura o negocio. La sincronización de skills no crea
specs, constituciones ni procesos de producto nuevos.

## Fases

1. `status`: localizar specs, estado, preguntas abiertas y tareas pendientes.
2. `specify`: definir problema, alcance, criterios observables y casos límite;
   marcar dudas sin inventar requisitos ni diseño.
3. `clarify`: resolver las dudas con el usuario y registrar decisiones en los
   artefactos locales. Respetar las condiciones de parada de `AGENTS.md`.
4. `plan`: inventariar código reutilizable, contratos, seguridad, aislamiento,
   tests y fuentes oficiales cuando correspondan; comprobar la constitución local.
5. `tasks`: ordenar tareas con dependencias y verificaciones de comportamiento.
6. `analyze`: comprobar la trazabilidad criterio → tarea → test y señalar huecos
   o contradicciones antes de implementar.
7. `implement`: seguir las tareas aprobadas y el TDD exigido por el proyecto;
   hacer el cambio mínimo y actualizar su estado.
8. `verify`: ejecutar los checks definidos por el repositorio y revisar casos
   negativos, fallos, concurrencia e idempotencia cuando apliquen. Registrar los
   resultados reales y separar fallos preexistentes de regresiones.
9. `close`: actualizar la memoria y la documentación afectada e informar de
   cambios, verificaciones, limitaciones y deuda según `AGENTS.md` local.

Mantener el orden y las puertas de salida del proceso local. No avanzar con
preguntas de negocio pendientes. Git permanece bajo control del usuario: no
hacer commits, pushes ni cambios de rama por aplicar este skill.
