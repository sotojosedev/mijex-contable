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
- [x] T12 (desarrollo) Modo sombra activo en la base de desarrollo de HS. Comparador el 2026-11-18: ES coincide en todos los roles; RD sin datos.
- [x] T12b (desarrollo, 2026-11-24) Verificado: `CONTABLE_ENABLED=1` en `wt-hs-contingencia/backend/.env` (base
  `mijex_contingencia_dev`); Property aplica el esquema `contable` al arrancar (`contableDb.ts`, sin bandera) sobre
  `mijex_property`. Migraciones 0001–0008 en ambas bases, con la huella SHA-256 idéntica a `migrations/`; sin
  `contable.fiscal_rule`. Librería: unitarias 88/88, PostgreSQL 53/53, typecheck. La base compartida `mijex` no se tocó.
- [ ] T12c Staging y producción: activar `CONTABLE_ENABLED` y aplicar las migraciones. **Parado: MIJEX solo en
  desarrollo; necesita aprobación expresa del usuario.**
- [x] T13 Asientos sin equivalente:
  - Los reajustes `settled:*` se replican como reversión más estado acumulado (spec 039).
  - Los cobros antiguos se fusionan con `netEntry`.
  - Lo único sin equivalente en desarrollo son 6 asientos del modelo antiguo (`Invoice:issued` y `TechnicianEarning:accrued`) y sus 6 reversiones: suman cero y se excluyen en ambos lados, así que no afectan al cuadre.
- [x] T14a Informes en la librería: `incomeStatement` (contra-ingresos = ingresos de saldo deudor; coste de ventas = grupo `COST_OF_SALES`, dato del plan) y `balanceSheet` (resultado no cerrado en el patrimonio), en bigint; migración 0002 (grupo de la cuenta).
- [x] T14b (fase 1, HS spec 040, aprobada por el usuario) HS deja de llevar plan, saldos e informes: Contabilidad lee de la librería (diario paginado con `countEntries` y `sourcePrefix`). `journal_entries` queda como registro transaccional de hechos (outbox) que la librería replica.
- [x] T14c 606/607/608 en la librería (`src/reports/do/dgii.ts`, R-DO-201…204), con los formatos verificados en las normas (07-2018, 10-2018, 05-2019), los instructivos y las plantillas oficiales. HS solo aporta los datos. Correcciones por norma: 608 con la fecha de anulación; 607 sin el consumo inferior a RD$250.000. El IR-17 sigue en HS (resumen de liquidaciones, sin formato de envío).
  - Resuelto con los documentos oficiales e-CF:
    - e-NCF de 13 posiciones y serie B de 11 (R-DO-205).
    - Los e-CF se siguen reportando en el 606 y el 607.
    - Con `INTERMEDIATION_V2`, las liquidaciones a técnicos no van en el 606 de MIJEX (HS spec 041).
- [x] T14d (HS spec 040 fase 3, aprobada) `ledger_accounts` archivada en `archive.ledger_accounts_hs_20261117` (reversible), sin FK; `postEntry` valida contra el plan de la librería. El registro de hechos se mantiene (outbox).
- [x] T15 E41 (R-DO-302, REF-DEC-007):
  - No aplica a las liquidaciones a técnicos: MIJEX no compra su servicio.
  - Se emite solo en compras propias de MIJEX a vendedores no registrados (HS spec 041 T7, fiscal-core `PURCHASE_VOUCHER`).
- [x] T16 IR-17 en la librería (R-DO-206, REF-DO-006):
  - `withholdingsOfPeriod` calcula el movimiento neto del mes en las cuentas de retención del plan.
  - `buildIr17Summary` fija el vencimiento el día 10 del mes siguiente.
  - El ITBIS retenido se informa sin plazo: [verificar] su formulario y plazo, que la página oficial no indica. También [verificar] la prórroga por fin de semana o feriado.
  - HS lo consume en lugar de su `ir17Summary`.

## Siguientes
Conciliación común (hecha: spec 002), entidades de organizaciones y comunidades (con sus fuentes).
