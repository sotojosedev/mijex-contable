# Diseño técnico — `mijex-contable`

> Documento vivo de **lo implementado en código**. Se actualiza en cada cambio o
> actualización del proyecto (ver §8, registro de cambios). Si este documento y el
> código discrepan, manda el código y se corrige el documento.
>
> Última actualización: 2026-11-16 · rama `main` · commit `62c4854`.

---

## 1. Propósito y alcance

Librería de **contabilidad** compartida por **MIJEX Property** y **MIJEX Home Services**.
Complementa a `@mijex/fiscal-core` (`mijex-fiscal`), que se encarga de lo fiscal: emisión,
numeración, VERI\*FACTU y e-CF. El alcance detallado se definirá en la primera spec
(`specs/001-…`).

### 1.1 Migración y reparto de responsabilidades

- Todo lo **contable** que hoy está en `mijex-home-services`, `mijex-property` o
  `mijex-fiscal` se traslada a esta librería. Después se **elimina del proyecto de
  origen**, una vez que la librería lo cubra con tests.
- En Property y HS, el módulo **Finanzas** se divide en dos:

```
Finanzas (Property / HS)
├── Contabilidad  →  mijex-contable
└── Fiscal        →  @mijex/fiscal-core (mijex-fiscal)
```

- La frontera entre contable y fiscal de cada pieza se decide en la spec de inventario,
  con el usuario. Los casos dudosos quedan `[verificar]`.

## 2. Principios y proceso

| # | Principio | Efecto en el diseño |
|---|-----------|---------------------|
| P1 | **No adivinar ni improvisar** | Cada regla contable, fiscal o legal tiene una fuente oficial del país (documento, artículo, versión y fecha) citada en su spec y en este documento. Sin fuente clara, se pregunta y se marca `[verificar]`. |
| P2 | **Legal y permitido** | Solo se implementa lo que la normativa del país permite. |
| P3 | **Multi-país desde el diseño** | Ningún país está fijo en el código. País, moneda, plan de cuentas, impuestos, tipos y reglas de asiento son **datos configurables y versionados por vigencia**. |
| P4 | **Configurable sin código** | Añadir un país, una moneda o un impuesto nuevo se hace desde la app, sin desarrollar código nuevo. |
| P5 | **Inteligente y dinámica** | Las reglas se resuelven en tiempo de ejecución según país, fecha y configuración. |

### 2.1 Fuentes oficiales por país

| País | Fuente | Ámbito | Web |
|------|--------|--------|-----|
| España | ICAC | Normativa contable | icac.gob.es |
| España | BOE | Legislación española | boe.es |
| España | Agencia Tributaria (AEAT) | Normativa tributaria | agenciatributaria.es |
| R. Dominicana | DGII | Impuestos internos | dgii.gov.do |
| R. Dominicana | ICPARD | Normativa contable / profesional | icpard.org |

Las copias de los documentos se guardan en `docs/referencias/<país>/`. Para añadir
un país nuevo, primero se definen sus fuentes oficiales en esta tabla.

### 2.2 Regla, referencia y test en todo desarrollo

Cada desarrollo entrega una **regla** (`docs/reglas/`, ID `R-<ÁMBITO>-NNN`), su
**referencia oficial** (`docs/referencias/`, ID `REF-<PAÍS>-NNN`) y al menos un **test**
con el ID de la regla en el nombre. La cadena regla → referencia → test es obligatoria
(`AGENTS.md` §1).

### 2.3 Países

Cada país queda definido en una ficha (`docs/paises/<ISO>.md`) antes de implementar
nada: marco contable, plan de cuentas, moneda, ejercicio, libros, impuestos,
retenciones, cierre, conservación, informes y frontera con `mijex-fiscal`. Cada campo
lleva su referencia oficial. Primeros países: **España (ES)** y **República Dominicana
(DO)**, ambas fichas en definición.

- Todo lo que se implemente sigue **SDD** (skill `/sdd`): `spec.md` → `clarify.md` →
  `plan.md` → `tasks.md` → implementar → verificar, con artefactos en `specs/NNN-slug/`.
- Toda implementación sigue **TDD** (skill `test-driven-development`): test que falla →
  código mínimo → refactor.
- Commits, PRs, push y cambios de rama los decide el usuario.

## 3. Arquitectura

Paquete `@sotojosedev/contable-core` (privado, sin publicar). Es TypeScript ESM estricto, con
la misma forma que `mijex-fiscal`:
- núcleo de dominio (`src/core`);
- puerto de almacén (`LedgerStore`) con implementaciones en memoria (`src/testing`) y en
  PostgreSQL (`src/persistence/pg`);
- tests de contrato comunes a los dos almacenes.

El motor **no conoce países, cuentas ni eventos concretos**: planes de cuentas y reglas de
asiento son datos por marco contable (p. ej. `ES-PGC-PYMES`, `DO-NIIF-PYMES`), versionados por
vigencia (R-CORE-005).

## 4. Módulos

| Módulo | Qué hace |
|---|---|
| `core/types.ts` | Entidad contable (multiempresa y por país), plan, cuenta, regla de asiento, evento de negocio, asiento, balance |
| `core/ledger.ts` | `createLedger`: `registerEntity` (idempotente por sistema y ref), `registerChart` + `approveChart` (solo un plan aprobado admite asientos; la versión nueva cierra la anterior), `registerRule`, `post` (R-CORE-002/004), `reverse` (R-CORE-003), `entries`, `trialBalance` |
| `core/errors.ts` | `LedgerError` con códigos tipados |

## 5. Persistencia

Esquema `contable` (migración `0001_core.sql`), aplicado con el `migrate` de `fiscal-core`
(reutilizado, con la opción `schema`):
- `entity`, `chart`, `account`, `posting_rule`, `journal_entry` y `journal_line`;
- importes BIGINT con `CHECK` (≥ 0 y un solo lado por línea);
- índice único de idempotencia (entidad, origen, nombre);
- una sola reversión por asiento;
- triggers de solo inserción (`reject_mutation`, `chart_guard`, `posting_rule_guard`,
  `account_draft_only`);
- cuadre por asiento con un *constraint trigger* diferido;
- un solo plan aprobado abierto por marco y una sola regla abierta por evento (índices
  parciales).

## 6. Integraciones

- `@sotojosedev/fiscal-core`, enlazado en local (`file:../wt-fiscal-contingencia`) hasta que
  se publique la 0.5.0: se reutilizan `migrate` y, en las próximas fases, el dinero (`money.ts`).
- Pendiente: que HS y Property emitan eventos de negocio a la librería (fase 2).

## 7. Pendiente y decisiones abiertas

_Ninguna registrada._

## 8. Registro de cambios

| Fecha | Cambio | Spec | Secciones afectadas |
|-------|--------|------|---------------------|
| 2026-11-16 | Creación del proyecto; skills copiadas de `mijex-fiscal` a `.claude/skills/`; creado este documento. | — | Todas |
| 2026-11-16 | Definidos el propósito (librería contable para Property y HS) y los principios P1–P5 (fuentes oficiales, legalidad, multi-país configurable sin código). | — | §1, §2 |
| 2026-11-16 | Añadida la tabla de fuentes oficiales por país (ES: ICAC, BOE, AEAT; RD: DGII, ICPARD). | — | §2.1 |
| 2026-11-16 | Decisión: todo lo contable de HS, Property y mijex-fiscal migra a esta librería y se limpia en origen; Finanzas se divide en Contabilidad y Fiscal. | — | §1.1 |
| 2026-11-16 | Creados `AGENTS.md`, `CLAUDE.md`, los catálogos `docs/reglas/` y `docs/referencias/` y las fichas de país `docs/paises/` (ES y DO en definición). Regla obligatoria: regla + referencia + test en todo desarrollo. | — | §2.1, §2.2, §2.3 |
| 2026-11-16 | Estándar profesional en `AGENTS.md` §6: seguridad ante todo, reutilización, eficiencia y calidad. | — | §2 |
| 2026-11-16 | Instalado el skill `supabase-postgres-best-practices` (supabase/agent-skills v1.1.1) aquí, en HS, en Property y en mijex-fiscal; obligatorio en todo trabajo de esquema, migraciones, índices y SQL. | — | §2 |
| 2026-11-16 | Instalados los skills de España `es-autonomous-worker`, `es-corporate-tax`, `es-vat-return` y `spain-bookkeeping` (openaccountants). Verificadas las fuentes dominicanas (REF-DO-001…019), creado el skill propio `do-contabilidad` con niveles de confianza A–D y rellenada parcialmente la ficha `docs/paises/DO.md`. Hallazgo: la Ley 30-26 (18/06/2026) cambia las retenciones (alquiler y honorarios del 10 % al 15 % desde el 01/07/2026), los recargos y los anticipos. | — | §2.1, §2.3 |
| 2026-11-16 | Plan de contingencia ES/DO aprobado. Spec 012 de `mijex-fiscal` implementada en el worktree `wt-fiscal-contingencia` (rama `feat/contingencia-fiscal`, versión 0.5.0 sin publicar), con 632 tests en memoria y 232 en PostgreSQL. Reglas R-DO-001…004 y R-ES-001…004 implementadas; referencias REF-DO-020…024 y REF-ES-001…003 con copia oficial. Pendiente: fase de dinero y retenciones (HS/Property) e integración en las apps. | fiscal 012 | §2.1 |
| 2026-11-17 | Commit local `099ef3d` de la spec 012 en `wt-fiscal-contingencia`. Fase 1 (dinero y retenciones): HS spec 036 (retenciones RD versionadas por vigencia, ITBIS sobre el ITBIS facturado, PUT con motivo y `auditInTx`, versiones inmutables por trigger, sumas de la liquidación en bigint) y Property spec 059 (`fromMinorUnits` exacto, impuesto y retención redondeados half-up, semilla v1 muerta borrada). Nuevas R-CORE-001, REF-DEC-001 y REF-DEC-002; R-DO-005 y R-DO-006 implementadas. Pendiente: `round2` de la contabilidad de HS (spec 037 o migración a esta librería). | HS 036, Property 059 | §2.2 |
| 2026-11-17 | Fase 3, Property spec 060: avisos fiscales reales (campana + email a ORG_ADMIN o a la plataforma según el emisor, deduplicados), estados traducidos (CONTINGENCIA, POR_CONFIRMAR), leyenda oficial de contingencia en el PDF, Centro de Control Fiscal `/admin/fiscal-control/*` (motivo obligatorio, auditoría, alcance por país, rate limit) y la pestaña «Control fiscal». La librería expone `PlatformFiscalCore.contingency`. Verificación: 420 unitarios, 31 e2e y 318 tests del frontend en verde. | Property 060, fiscal 012 | §6 |
| 2026-11-17 | Fase 4, HS spec 038: avisos fiscales al técnico y a los admins de su país (tipo FISCAL obligatorio, sin duplicar en BD), Centro de Control (consulta sin reenvío, reintento con motivo, cronología, OFV/serie B, incidencias ES; `auditInTx`; rate limit), listado sin N+1 (`listDocuments({ ids })`) y leyenda en el PDF. Librería: `noticeContent` común (Property lo reutiliza) y QR R-DO-007 (versión 8 o la mínima superior con la URL completa, comprobada por lectura; pendiente de confirmar con la DGII, REF-DEC-003). | HS 038, fiscal 012 | §6 |
| 2026-11-17 | Spec 001 (Clarify: multiempresa y por país; PGC/PGC PYMES en ES y NIIF PYMES en RD; 606/607/608 e IR-17 aquí; persistencia como mijex-fiscal). Fase 1a implementada: motor `createLedger`, almacenes en memoria y PostgreSQL (esquema `contable`, migración 0001), R-CORE-002…005 con 16 pruebas de contrato en memoria y 19 en PostgreSQL. Copias oficiales del PGC y del PGC PYMES (REF-ES-004/005). `fiscal-core` gana `migrate({ schema })` para reutilizarlo. | 001 | §3, §4, §5, §6 |
| 2026-11-17 | Propuesta de la fase 1b (`specs/001-…/propuesta-fase-1b.md`): correspondencia de las 21 cuentas de HS con el PGC PYMES (códigos y nombres literales del BOE) y con un plan propio NIIF PYMES para RD, y reglas por evento. Sin cargar: pendiente del contador y del usuario. | 001 | — |
| 2026-11-17 | Spec 002: conciliación bancaria común en `src/reconciliation` (lector de extractos con importes exactos, errores por línea y huella compatible con Property; casado con política por app; reparto en bigint). R-CORE-006/007, REF-DEC-005. Las apps aún no lo usan (T05, con confirmación). | 002 | §4 |
| 2026-11-17 | Spec 002 conectada: HS y Property usan el lector y el casado comunes (adaptadores finos; HS conserva su huella; Property, la suya, que es la de la librería). Librería: `requireDescription`, `tieBreak`, sin recortes. | 002 | §4, §6 |
| 2026-11-17 | Fase 1b: marcos ES-PGC-PYMES y DO-NIIF-PYMES como datos (`src/frameworks/`), 15 eventos de MIJEX con roles, R-ES-101…115 y R-DO-101…115. Verificado con normas oficiales: ICAC 10/02/2021 (BOE-A-2021-2155; agente = comisión), PGC NRV 14.ª, RD 1515/2007 art. 3.1 y cuadro oficial (tests contra él), ICPARD Res. 002/2010 (NIIF PYMES). Decisión del usuario: no esperar al contador (REF-DEC-006). 41 pruebas unitarias y 20 en PostgreSQL. | 001 | §4 |
| 2026-11-17 | Fase 2 (HS spec 039): modo sombra. HS replica su mayor en los libros de MIJEX por país (traductor puro, réplica idempotente con job y script, comparador por rol); verificado en memoria y con PostgreSQL real. Librería: `charts`, `entryBySource`, `ensureFramework`, `frameworkForCountry`. | 001 | §4, §6 |
| 2026-11-17 | Informes en la librería: cuenta de resultados y balance de situación por entidad, en bigint, sin heurísticas de códigos (contra-ingreso por lado normal; coste de ventas como grupo de la cuenta en el plan; migración 0002). 45 pruebas unitarias y 21 en PostgreSQL. | 001 | §4, §5 |
| 2026-11-17 | Retirada del mayor de HS, fase 1 (HS spec 040): Contabilidad de HS (plan, diario, comprobación, resultados, balance e IVA/ITBIS) sale de la librería; HS conserva `journal_entries` como registro transaccional de hechos. Librería: `countEntries` y filtro `sourcePrefix`; diario del más reciente al más antiguo. Pruebas de contabilidad de HS sin cambios y en verde. | 001 | §4, §6 |
| 2026-11-17 | Formatos DGII 606/607/608 en la librería (`src/reports/do/dgii.ts`, R-DO-201…204), verificados con las normas 07-2018, 10-2018 y 05-2019, los instructivos (2025-2026) y las plantillas oficiales (copias y extracto en `docs/referencias/do/`). HS los usa (spec 040 fase 2), con importes exactos; el 608 pasa a la fecha de anulación y el 607 excluye el consumo inferior a RD$250.000. Pendientes [verificar]: e-NCF de 13 posiciones y remisión de e-CF. | 001 | §4 |
| 2026-11-17 | Documentos oficiales e-CF (Informe Técnico v1.0 y Formato ANECF, REF-DO-032/033): e-NCF de 13 posiciones (R-DO-205); sin exención de 606/607 para e-CF; un e-CF enviado se corrige con E34. HS spec 040 fase 3: `ledger_accounts` archivada (reversible), validación de cuentas contra la librería. Pendiente: e-CF 41 para técnicos no registrados (NG 05-2019 art. 7). | 001 | §4, §6 |
| 2026-11-17 | HS spec 037 corte 1 (R-CORE-001/002): el registro de hechos de HS (`postEntry`) pasa a céntimos exactos (decimal half-up) con cuadre en bigint; la reversión y el ajuste de lo liquidado, sin `number`. Quedan los cortes 2–4 (aritmética de cada `postX` y otros servicios). | HS 037 | §6 |
| 2026-11-18 | HS spec 041 (Specify): análisis de la intermediación fiscal de servicios y materiales frente a las fuentes oficiales (RD 1619/2012 art. 5, RIRPF arts. 75/76/95, LIVA art. 78, NG 05-2019 art. 7, instructivo de delegación e-CF). Incompatibilidades: retención automática por MIJEX en DO, MIJEX como comprador y revendedor de materiales, riesgo de duplicar ventas de materiales. Pendiente del Clarify. | HS 041 | §4 |
| 2026-11-18 | HS spec 041 T4: con `INTERMEDIATION_V2` (apagada en producción), la liquidación decide el agente de retención por servicio con `determineWithholdingAgent` (fiscal-core): MIJEX no retiene en DO salvo regla vigente; régimen desconocido → revisión manual; cada servicio guarda agente y regla. | HS 041 | §4 |
| 2026-11-18 | Evento `SupplierPassThroughPaid` (R-CORE-009): suplido pagado al proveedor por cuenta del cliente, contra fondos de terceros, sin ingreso, gasto ni impuesto. `MaterialsSold` queda para la reventa con margen. | 001 / HS 041 | §3 |
| 2026-11-18 | HS spec 041 T5/T6: partidas con tipo, vendedor, modo e impuesto; `MaterialsSold` solo para la reventa de MIJEX; órdenes en suplido (`supplyMode`) contra fondos de terceros y fuera del 606; con `INTERMEDIATION_V2`, el 606 de MIJEX sin liquidaciones a técnicos. | HS 041 | §4 |
| 2026-11-18 | fiscal-core: XML E41 (Comprobante de Compras, R-DO-302), sin `TipoIngresos`, con el vendedor identificado y el 100 % del ITBIS retenido; valida contra el XSD oficial e-CF 41. Los XSD oficiales E31, RFCE y ACECF no compilan en libxml (tipo sin definir, expresiones regulares de .NET): bloqueo externo ya conocido. | HS 041 | §4 |
| 2026-11-18 | HS spec 041 T7: E41 de MIJEX desde la orden de compra en reventa, con verificación manual (NG 05-2019 art. 7 párr. I), 100 % del ITBIS a 2140 y en el 606. `PurchaseInvoiced` gana `itbisWithheld` (cambio incompatible de evento; solo lo usa HS). | HS 041 | §3, §4 |
| 2026-11-18 | HS spec 041 T5 (editor «Lo vende»; propuesta de compra solo con lo que compra MIJEX) y T8 (detalle y referencias por servicio en la liquidación). | HS 041 | §4 |
| 2026-11-18 | HS spec 037 corte 2: todo `ledger.ts` en céntimos exactos (sin `round2` ni `Number`); refactorización cubierta por las suites del mayor. HS spec 041: el PDF de la liquidación muestra el detalle por servicio. | HS 037 / 041 | §6 |
| 2026-11-18 | HS spec 037 corte 3: deudas de efectivo, notas de crédito (impuesto proporcional half-up exacto: 0,045 → 0,05), reembolsos, estados de cuenta, desglose de factura y ganancias en céntimos exactos. Pendiente de decisión: reparto del céntimo entre varios técnicos. | HS 037 | §6 |
| 2026-11-18 | IR-17 en la librería (R-DO-206, `src/reports/do/withholdings.ts`): retenciones de ISR del mes desde el mayor (movimiento neto de la cuenta, las reversiones restan), vencimiento el día 10 del mes siguiente; el ITBIS retenido se informa con [verificar] (la página oficial no da su formulario ni plazo). Spec 001: T12 (desarrollo), T13, T15 y T16 cerradas; producción pendiente de aprobación. | 001 | §4 |
| 2026-11-18 | HS spec 037 cortes 3b y 4: `roundMoney` como único redondeo (decimal exacto) en lugar de 14 `round2` en coma flotante. HS: el IR-17 sale de la librería (R-DO-206), incluido el ITBIS retenido de los E41, con las notas [verificar]. | HS 037 / 040 | §4, §6 |
| 2026-11-18 | Spec 003: registro de operaciones de organizaciones (no son sus libros oficiales, REF-DEC-008). Incluye registro idempotente, separación por organización, trazabilidad, CSV y obligaciones por tipo con bloqueo de la emisión automática si no están determinadas; PostgreSQL con la migración 0003. HS: reparto entre técnicos con `allocate` (R-CORE-011) y banderas apagadas en las pruebas. Desarrollo: base `mijex_contingencia_dev` con las migraciones de la rama y `CONTABLE_ENABLED`/`INTERMEDIATION_V2` activos. | 003 / HS 037 | §3, §6 |
| 2026-11-18 | Spec 003: catálogo de reglas fiscales y `decideFiscalIssuance` por operación (REF-DEC-009: tres estados de validación; en producción solo VERIFIED; MANUAL_REVIEW solo de esa emisión; sin documento fiscal cuando el tratamiento lo indica). Propuesta de integración en Property pendiente de aprobación. | 003 | §3 |
| 2026-11-19 | mijex-fiscal spec 013 (facturación convencional ES; R-ES-203; F21): régimen de facturación del emisor con exclusión del RRSIF verificada, factura sin remisión (`NOT_SUBMITTED`), series por tercero, huella SHA-256, corrección solo con rectificativa y `previewDocument`. Migración 0019 aditiva. Verificación: 688 unitarias y 265 PG en verde, cobertura del 94,9 % (unit) y 97 % de líneas (PG). Property y HS sin cambios de comportamiento; la integración va en la fase 4 de la 055. | mijex-fiscal 013 / Property 055 | — |
| 2026-11-18 | Property: registro de operaciones de la organización (spec 003 T4a) en `/api/v1/operations`, con lista, trazabilidad, documentos externos y CSV, separado por organización (prueba e2e). La emisión con el catálogo (T4b) espera la aprobación del usuario. | 003 | §3 |
| 2026-11-19 | Property, spec 003 T4b (aprobada por el usuario): `fiscalRuleCatalog.ts` inventaría el tratamiento actual (ES/DO × tipo de organización × ARRIENDO/COMUNIDAD/OTRO, factura fiscal, APPROVED_PENDING_VERIFICATION) y `issuePendingWithFiscalCore` llama a `decideFiscalIssuance` antes de cada emisión. Un alquiler con `RentalTaxRule` validada, activa y con referencia normativa cuenta como VERIFIED. Si no se emite, esa factura pasa a `fiscalHold = HELD` con el motivo (`fiscalHoldReason`) y la auditoría `INVOICE_FISCAL_HELD`. Bandera `FISCAL_RULE_GATE`: activa fuera de producción, donde nada cambia; en producción solo con `1`. | 003 | §3 |
