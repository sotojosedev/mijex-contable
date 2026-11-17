# Tareas — Spec 001

## Fase 1a — Motor (sin datos legales)
- [x] T01 Proyecto: package.json, tsconfig, ESLint, vitest, tsup, knip y `.gitignore`; enlace local a `fiscal-core`.
- [x] T02 Tipos del dominio y puerto `LedgerStore`.
- [x] T03 Tests de contrato rojos: R-CORE-002 (cuadre), R-CORE-003 (solo inserción + reversión), R-CORE-004 (idempotencia), R-CORE-005 (plan y regla por vigencia; sin plan aprobado no hay asiento).
- [x] T04 Almacén en memoria + motor `createLedger` (post, reverse, trialBalance).
- [x] T05 Almacén PostgreSQL + migración 0001 (esquema `contable`, inmutabilidad, idempotencia, cuadre diferido).
- [x] T06 Verificación: lint, typecheck, test, test:pg, build, knip.

## Fase 1b — Datos por país (cada cuenta y regla, aprobada por el usuario)
- [ ] T07 ES: cuentas del PGC PYMES (BOE-A-2007-19966) que usan los eventos de MIJEX; mapeo evento → cuentas para revisión.
- [ ] T08 DO: plan NIIF para PYMES propuesto («pendiente de revisión del contador»).
- [ ] T09 Reglas de asiento de los eventos de HS (hoy en `ledger.ts`), en paralelo con el motor actual.

## Fase 2 y siguientes
Comparador HS, conciliación común, 606/607/608 e IR-17, entidades de organizaciones y comunidades (con sus fuentes).
