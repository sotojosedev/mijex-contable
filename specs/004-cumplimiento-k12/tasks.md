# Tareas · Spec 004 · Cumplimiento de K12

Plan aprobado el 2026-11-22 (`plan.md`, REF-DEC-015). La spec de Q4 en `mijex-fiscal` se abre después de la 004.

## 004a · Q1: reglas pendientes solo en simulación (sin migración)
- [x] **T001** Librería, en rojo primero (`[R-CORE-014]` y `[K12]`): `IssuanceQuery.mode` (`LIVE` | `SIMULATION`)
  sustituye a `deployment`. En LIVE, una regla pendiente → `MANUAL_REVIEW` (`RULE_NOT_VERIFIED`) en cualquier
  entorno. En SIMULATION, la decisión sale marcada `simulated: true`. UNDETERMINED y los datos ausentes siguen en
  revisión en los dos modos. El `todo` I-K12-1 pasa a prueba. Cambio incompatible (MAJOR) anotado en el registro.
- [x] **T002** Property, en rojo primero:
  - el modo sale del núcleo fiscal en uso: el kit de pruebas inyectado → SIMULATION; la librería real → LIVE;
  - nunca de una variable de entorno;
  - la puerta del catálogo queda siempre activa (se retira la excepción de `FISCAL_RULE_GATE` en producción);
  - las e2e del catálogo (`fiscal-rule-gate-003`, `fiscal-rule-catalog-003`) se adaptan;
  - un documento simulado nunca se emite con la librería real.
- [x] **T003** Regresión (2026-11-22): librería 93 unit + 49 PG, lint de `src` y `tests`, build; Property 551 unit,
  e2e 164/164, lint y build del frontend.

## 004b · Q2: proponer y verificar, separados (migración 0006)
- [x] **T010** Contrato memoria y PG en rojo (11 fallos antes de implementar); migración 0006 validada en la base de
  pruebas de la librería (55 pruebas PG, incluidas las de separación en la base: revisor igual al proponente, otro
  proponente, revisión sin propuesta debajo). Nota: las de la base se ejecutaron por primera vez ya con la 0006.
- [x] **T011** Catálogo: `propose`, `verify` y `reject`; `SELF_VERIFICATION` y `STALE_PROPOSAL`; estado `REJECTED`
  (una propuesta rechazada no decide); en LIVE decide la última versión verificada o no determinada. `todo` I-K12-3
  → prueba.
- [x] **T012** Property: rutas `/versions` (proponer), `/verify` y `/reject` (otro PLATFORM_ADMIN del país; 409
  `SELF_VERIFICATION` / `STALE_PROPOSAL`, 422 sin referencia), auditoría `FISCAL_RULE_PROPOSED | VERIFIED | REJECTED`,
  consola con «Proponer versión», «Verificar» y «Rechazar» (prueba de frontend `fiscalRuleCatalog004b`). e2e
  `fiscal-rule-catalog-routes-003` en rojo (11 fallos) y en verde; `fiscal-rule-catalog-003` adaptada. Property aplica
  las migraciones de la librería al primer uso (`contableDb.ts`): un servidor de esta rama contra `mijex_property`
  aplicaría la 0006; ninguno está en marcha (el de `main` no usa la librería).
  Regresión del 004b (2026-11-22): librería 98 unit + 49→55 PG, build; Property 551 unit, e2e 164/164, frontend
  349 pruebas.
- [x] **T013** 0006 aplicada el 2026-11-22 con aprobación del dueño en `mijex_property` y `mijex_contingencia_dev`
  (`migrate()` de la librería, solo lo pendiente), tras copias `~/mijex-backups/*-pre-0006-20261122-193801.dump`
  (validadas: 162 y 119 tablas con datos). Catálogo vacío en las dos; columnas y trigger comprobados.

## 004c · Q3: contrato del resultado fiscal (migración 0007)
- [x] **T020** `FiscalResultEnvelope` (`contractVersion` 1) en `OperationInput.fiscal`, con pruebas de rechazo en rojo
  primero (6 fallos) en memoria y PG: `FISCAL_PROVENANCE` (externo sin origen manual; fiscal-core sin documento),
  `FISCAL_VERSION`, `FISCAL_STATUS` (estados que no son de fiscal-core), `FISCAL_SCOPE` (otra organización, país mal
  formado, otro número de documento) y `FISCAL_INTEGRITY` (algoritmo, huella mal formada o que no coincide con el
  contenido). Definitivo = envío ACCEPTED, ACCEPTED_WITH_ERRORS o NOT_SUBMITTED y documento ACTIVE, PARTIALLY_CORRECTED
  o CORRECTED (clasificación cerrada de los estados de fiscal-core, no de la ley). Un cambio del sobre es una
  corrección (reversión y versión nueva). CSV con `documento_fiscal` y `fiscal_definitivo` al final (compatible).
  Migración 0007 validada en la base de pruebas (60 pruebas PG). `todo` I-K12-4 → prueba.
- [x] **T021** Property envía el sobre en las cuotas emitidas con la librería (decisión del dueño del 2026-11-22: huella
  SHA-256 de la serialización canónica del documento que guarda fiscal-core, con el contenido para comprobarla;
  provisional hasta la huella oficial de la spec de Q4; cada cambio de estado se versiona). `fiscalEnvelope.ts` con
  unitaria (3); e2e `operations-fiscal-004c` en rojo (5 fallos) y en verde: registrada no definitiva, sin versiones al
  repetir, aceptada → reversión y versión definitiva, CSV con «si». Un documento que no se puede leer deja la cuota
  pendiente, sin registro a medias. La aceptación por la autoridad se recoge en la siguiente sincronización.
  Regresión del 004c (2026-11-22): librería 104 unit + 60 PG, build; Property 554 unit, lint, e2e 164/165 con
  `operations-origins-003` fallando por la cabecera del CSV (columnas nuevas al final, esperado); comprobación
  actualizada y en verde por separado.
- [x] **T022** 0007 aplicada el 2026-11-22 con aprobación del dueño en `mijex_property` y `mijex_contingencia_dev`,
  tras copias `~/mijex-backups/*-pre-0007-20261122-201202.dump` (validadas: 162 y 119 tablas con datos); 0 registros
  previos en las dos.

## Cierre
- [x] **T090** Regresión completa (2026-11-22, tras el 004c): librería 104 unit + 60 PG, lint de `src` y `tests`,
  typecheck y build; Property 554 unit, lint, e2e 165/165 (164 en la suite y `operations-origins-003` corregida y en
  verde por separado), frontend 349 pruebas y build.
- [x] **T095** Documentación: R-CORE-014 y R-CORE-012, constitución (I-K12-1, 3 y 4 cerrados; I-K12-2 queda para la
  spec de Q4), `diseno-tecnico.md`, índice y memoria del SDD; Property `DISENO-TECNICO`.
