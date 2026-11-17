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
- [ ] T14b Retirar el mayor de HS y pasar sus pantallas a los informes de la librería; 606/607/608 e IR-17 (*stop condition*).

## Siguientes
Conciliación común (hecha: spec 002), entidades de organizaciones y comunidades (con sus fuentes).
