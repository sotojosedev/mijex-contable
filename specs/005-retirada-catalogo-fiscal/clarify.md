# Clarify 005 — Retirada del catálogo fiscal duplicado

| Campo | Valor |
|-------|-------|
| Estado | Resuelto (2026-11-23) |
| Spec | [spec.md](spec.md) |
| Fecha | 2026-11-23 |

> Fase 2 del [proceso SDD](../../sdd/README.md). Las **stop conditions** (AGENTS.md §4) las responde solo el dueño.

## Resumen
| ID | Pregunta | Stop condition | Estado | Decisión |
|----|----------|----------------|--------|----------|
| Q1 | ¿Se retira el catálogo fiscal de esta librería? | Sí: API pública (MAJOR) y arquitectura | Resuelta | Sí: fiscal-core es la única fuente autorizada de reglas fiscales |
| Q2 | ¿Cómo se eliminan las tablas? | Sí: migración destructiva | Resuelta | Migración nueva; 0005 y 0006 intactas; antes, tablas vacías, dependencias identificadas y copia de seguridad |
| Q3 | ¿Qué valida el sobre del resultado fiscal? | Sí: API pública | Resuelta | Se mantiene `FiscalResultEnvelope` con procedencia, estado, versión **e identificación de las reglas usadas** |
| Q4 | ¿Dónde se aplica y cuándo se publica? | Sí: git, publicación y entornos | Resuelta | Implementación y pruebas en desarrollo; producción y publicación de la versión mayor, con resultados y aprobación específica |

## Decisión del dueño (2026-11-23, REF-DEC-016)
Texto aprobado, resumido por condición:

1. Spec independiente en mijex-contable, con plan, alcance, criterios de aceptación y pruebas.
2. Verificar que Property, Home Services y cualquier otro consumidor no dependen de funciones, tipos, exportaciones ni
   tablas que se eliminan.
3. Confirmar que fiscal-core cubre por completo las responsabilidades del catálogo antiguo, sin pérdida de
   funcionalidad.
4. Eliminar funciones y exportaciones con el versionado semántico correspondiente: changeset de versión mayor y guía de
   migración.
5. Mantener `FiscalResultEnvelope` y la validación de procedencia, estado, versión e identificación de las reglas
   fiscales usadas.
6. Migración nueva para eliminar las tablas; no modificar ni borrar 0005 y 0006.
7. Antes de ejecutarla: tablas vacías, dependencias identificadas y copia de seguridad.
8. Pruebas unitarias, de integración, compilación y regresión de los consumidores afectados.
9. Actualizar `AGENTS.md`, las referencias arquitectónicas y `docs/diseno-tecnico.md`: fiscal-core es la única fuente
   de reglas fiscales.
10. Ni migraciones destructivas en producción ni publicación de la versión mayor sin presentar las verificaciones y
    obtener su aprobación específica.

«La eliminación debe simplificar la arquitectura sin alterar los cálculos fiscales, las operaciones contables ni el
comportamiento actual de Property y Home Services.»

## Consecuencias para el diseño (sin decisiones nuevas)
- **Q3.** La condición 5 pide validar la identificación de las reglas usadas, y hoy el sobre no la lleva. Se añade al
  sobre un campo **opcional** con las referencias de fiscal-core (tipo, regla, versión). Opcional porque hay documentos
  legítimos sin regla del catálogo (alquiler con regla de la 055, Home Services): exigirlo cambiaría su comportamiento.
  La versión del contrato sigue siendo 1 (el campo es aditivo).
- **Q4.** Property y Home Services aplican las migraciones de la librería **al arrancar**. Por eso «publicar la versión
  mayor» o actualizarla en un entorno equivale a ejecutar la migración allí: ese es el punto de aprobación. Además, la
  migración aborta si encuentra filas, para que nunca borre datos en silencio.
