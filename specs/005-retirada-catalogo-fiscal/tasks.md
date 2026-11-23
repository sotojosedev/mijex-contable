# Tasks 005 — Retirada del catálogo fiscal duplicado

| Campo | Valor |
|-------|-------|
| Spec | [spec.md](spec.md) · Plan: [plan.md](plan.md) |
| Fecha | 2026-11-23 |

## Tareas
- [x] **T001** Test rojo `[R-CORE-018]`: sobre con `ruleRefs` válidos se guarda (ordenados) y se relee; vacío = sin campo; mal formados o repetidos → `FISCAL_RULE_REF` sin guardar nada; idempotencia con las mismas referencias.
- [x] **T002** Implementar `FiscalRuleRef`, `ruleRefs` en el sobre y en `RecordedFiscalResult`, validación y comparación.
- [x] **T003** Test rojo PG: la 0008 borra la tabla y la función con la tabla vacía; aborta con filas; `reject_mutation` sigue.
- [x] **T004** Migración `0008_drop_fiscal_rule_catalog.sql`.
- [x] **T005** Retirar catálogo, almacenes, decisión, tipos, exportaciones y códigos `SELF_VERIFICATION` / `STALE_PROPOSAL`; borrar sus pruebas (cubiertas en fiscal-core, plan §3).
- [x] **T006** Changeset de versión mayor y guía de migración ([guia-migracion.md](guia-migracion.md)).
- [x] **T010** Verificación de la librería: lint, typecheck, test, test:pg, build, knip.
- [x] **T020** Property: `fiscalEnvelopeFor` pasa `ruleRefs` (test primero).
- [x] **T030** Regresión de consumidores: Property (typecheck, unitarias, frontend, e2e) y HS (typecheck y pruebas de la librería contable).
- [x] **T040** Desarrollo: copia, filas y dependencias de `contable.fiscal_rule` en `mijex_property` y `mijex_contingencia_dev`; aplicar la 0008.
- [x] **T050** Documentación: `AGENTS.md`, constitución (I-K12-2), `docs/reglas`, `docs/referencias` (REF-DEC-016), `docs/diseno-tecnico.md`, `sdd/README.md` y `sdd/memory.md`; Property `DISENO-TECNICO.md`.
- [ ] **T060** Pendiente del dueño: staging/producción y publicación de la versión mayor (condición 10).

## Análisis (criterio → tarea → test)
| Criterio | Tareas | Test / evidencia |
|----------|--------|------------------|
| CA1 | inventario, T030 | plan §2.2; compilación de Property y HS |
| CA2 | — | plan §3 (tests de fiscal-core `rule-decision`, `rule-catalog.contract`) |
| CA3 | T005, T006 | `knip`, typecheck; changeset y guía |
| CA4, CA5 | T001, T002, T020 | `[R-CORE-018]` (memoria y PG); `fiscalEnvelope.test.ts` |
| CA6, CA7 | T003, T004 | prueba PG de la 0008 |
| CA8 | T040 | registro de comprobaciones abajo |
| CA9 | T010, T030 | resultados abajo |
| CA10 | T050 | documentos |
| CA11 | T060 | — |

## Resultados (2026-11-23)
**Librería** (`mijex-contable`): unitarias 88/88 · PostgreSQL 53/53 · typecheck · `eslint src tests` · build. `npm run
lint` y `npm run knip` solo señalan ficheros de `.agents/` (skills de terceros, deuda conocida en `sdd/memory.md`). El
`dist` ya no contiene ninguna de las exportaciones retiradas.

**fiscal-core** (`wt-fiscal-contingencia`): `tests/core/rule-decision.test.ts` 11/11, con los dos casos trasladados (sin
documento fiscal en LIVE; versión vigente en la fecha). Pasan sin cambiar código: fiscal-core ya los cumplía.

**Property** (`wt-prop-contingencia`): typecheck contra la librería nueva · unitarias 552/552 (incluida la nueva de
`fiscalEnvelope.test.ts`) · e2e completa 165/165 (incluye registro de operaciones 004c y emisión con el catálogo de fiscal-core).

**Home Services** (`wt-hs-contingencia`): typecheck contra la librería nueva · 13 ficheros / 80 pruebas que usan la
librería contable (`accounting`, `contableShadow`, `irpfSpain`, `ledgerAtomicity`, `paymentOutbox`,
`payoutLedgerAtomicity`, `payoutReviewOutbox`, `purchasing`, `referenceReconciliation`, `accountingRange`,
`contableShadowMath`, `refundProviderOutcome`, `bankReconciliation`/`dgii`).

**T040 · desarrollo** (CA8):
| Base | Filas | Dependencias | Copia previa (validada con `pg_restore -l`) | Resultado |
|------|-------|--------------|---------------------------------------------|-----------|
| `mijex_property` | 0 | solo sus restricciones, sus 2 disparadores y su función de guardia; sin vistas ni claves foráneas entrantes | `~/mijex-backups/mijex_property-pre005-20261123-193156.dump` | 0008 aplicada; tabla y función eliminadas; `reject_mutation()` intacta |
| `mijex_contingencia_dev` | 0 | ídem | `~/mijex-backups/mijex_contingencia_dev-pre005-20261123-193156.dump` | ídem |

No se tocó la base compartida `mijex` (HS `main`, en 0002, sin la tabla).
