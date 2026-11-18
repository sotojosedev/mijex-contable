# Tareas — Spec 001

## Fase 1a — Motor (sin datos legales)
- [x] T01 Proyecto: package.json, tsconfig, ESLint, vitest, tsup, knip y `.gitignore`; enlace local a `fiscal-core`.
- [x] T02 Tipos del dominio y puerto `LedgerStore`.
- [x] T03 Tests de contrato rojos: R-CORE-002 (cuadre), R-CORE-003 (solo inserción + reversión), R-CORE-004 (idempotencia), R-CORE-005 (plan y regla por vigencia; sin plan aprobado no hay asiento).
- [x] T04 Almacén en memoria + motor `createLedger` (post, reverse, trialBalance).
- [x] T05 Almacén PostgreSQL + migración 0001 (esquema `contable`, inmutabilidad, idempotencia, cuadre diferido).
- [x] T06 Verificación: lint, typecheck, test, test:pg, build, knip.

## Fase 1b — Datos por país (cada cuenta y regla, aprobada por el usuario)
- [x] T07 ES: marco ES-PGC-PYMES con cuentas oficiales o subcuentas (art. 3.1), verificadas contra el cuadro del BOE. Decisiones con fuente: el agente solo reconoce su comisión (ICAC 2021 art. 26.4 y art. 34.8; NRV 14.ª) → 4101 ⊂ 410 para los fondos de técnicos; comisión 7051 ⊂ 705 (cifra de negocios); pasarelas 4402 ⊂ 440 (deudor de tráfico, no entidad de crédito); técnico empleado 640.
- [x] T08 DO: marco DO-NIIF-PYMES (ICPARD Res. 002/2010; NIIF PYMES secc. 23) con plan propio y los códigos de HS.
- [x] T09 Catálogo de 15 eventos con roles (`src/frameworks/events.ts`) y reglas generadas por marco (R-ES-101…115, R-DO-101…115); `installFramework`. Usuario: «no esperes a mi contador» (REF-DEC-006).
- Fuera de los eventos: la reclasificación del modelo anterior (cuenta 1120/4300) y los reajustes `settled:*` de HS se harán con reversión + nuevo asiento en la fase 2.

## Fase 2 — HS en modo sombra
- [x] T10 Librería: `ledger.charts`, `ledger.entryBySource`, `ensureFramework`, `frameworkForCountry`.
- [x] T11 HS spec 039: traductor de asientos, réplica idempotente (job y script) y comparador por rol. Verificado en memoria y en PostgreSQL real (base de pruebas).
- [ ] T12 Activar en desarrollo o producción y revisar el comparador con datos reales (con confirmación).
- [ ] T13 Cubrir los asientos sin equivalente (modelo anterior, reajustes `settled:*`).
- [x] T14a Informes en la librería: `incomeStatement` (contra-ingresos = ingresos de saldo deudor; coste de ventas = grupo `COST_OF_SALES`, dato del plan) y `balanceSheet` (resultado no cerrado en el patrimonio), en bigint; migración 0002 (grupo de la cuenta).
- [x] T14b (fase 1, HS spec 040, aprobada por el usuario) HS deja de llevar plan, saldos e informes: Contabilidad lee de la librería (diario paginado con `countEntries` y `sourcePrefix`). `journal_entries` queda como registro transaccional de hechos (outbox) que la librería replica.
- [x] T14c 606/607/608 en la librería (`src/reports/do/dgii.ts`, R-DO-201…204), con los formatos verificados en las normas (07-2018, 10-2018, 05-2019), los instructivos y las plantillas oficiales. HS solo aporta los datos. Correcciones por norma: 608 con la fecha de anulación; 607 sin el consumo inferior a RD$250.000. El IR-17 sigue en HS (resumen de liquidaciones, sin formato de envío).
  - [verificar con el asesor o la DGII] e-NCF (13 posiciones) frente al NCF de 11 de la norma, y si los e-CF se siguen remitiendo en 606/607; el 606 de las liquidaciones a técnicos no lleva NCF.
- [x] T14d (HS spec 040 fase 3, aprobada) `ledger_accounts` archivada en `archive.ledger_accounts_hs_20261117` (reversible), sin FK; `postEntry` valida contra el plan de la librería. El registro de hechos se mantiene (outbox).
- [ ] T15 Comprobante de Compras (e-CF 41) para liquidaciones a técnicos no registrados (NG 05-2019 art. 7): regla fiscal nueva, pendiente de confirmación.

## Siguientes
Conciliación común (hecha: spec 002), entidades de organizaciones y comunidades (con sus fuentes).
