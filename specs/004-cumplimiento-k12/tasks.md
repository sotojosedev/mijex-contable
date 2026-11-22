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
- [ ] **T010** Contrato memoria y PG en rojo; migración 0006 validada en la base de pruebas.
- [ ] **T011** Catálogo: `propose`, `verify` y `reject`; `SELF_VERIFICATION` y `STALE_PROPOSAL`.
- [ ] **T012** Property: permisos (proponer y verificar, dos PLATFORM_ADMIN distintos del país), auditoría y consola.
- [ ] **T013** Aplicar 0006 en las bases de desarrollo de la rama, con copia previa. **Necesita la aprobación del dueño.**

## 004c · Q3: contrato del resultado fiscal (migración 0007)
- [ ] **T020** `FiscalResultEnvelope` y pruebas de rechazo en rojo (memoria y PG); migración 0007 validada.
- [ ] **T021** Property envía el sobre en las cuotas emitidas con la librería.
- [ ] **T022** Aplicar 0007 en desarrollo, con copia previa. **Necesita la aprobación del dueño.**

## Cierre
- [ ] **T090** Regresión completa.
- [ ] **T095** Documentación: R-CORE-014 y R-CORE-012, constitución (I-K12-1, 3 y 4 cerrados), `diseno-tecnico.md`,
  índice del SDD; Property `DISENO-TECNICO`.
