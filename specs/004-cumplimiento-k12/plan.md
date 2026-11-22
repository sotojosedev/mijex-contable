# Plan 004 — Cumplimiento de K12

| Campo | Valor |
|-------|-------|
| Estado | **Aprobado** por el dueño el 2026-11-22: cortes 004a–004c con sus cambios incompatibles (solo Property) y validación de las migraciones 0006 y 0007 en la base de pruebas. La spec de Q4 en `mijex-fiscal` se abre **después** de la 004 |
| Spec | [spec.md](spec.md) · [clarify.md](clarify.md) (resuelto, REF-DEC-015) |

## 1. Resumen técnico
Tres cortes en esta librería (Q1, Q2 y Q3), cada uno con su adaptación en Property en el mismo cambio, y una spec
aparte en `mijex-fiscal` para Q4. Mientras llega Q4, el catálogo de la 003 queda **congelado**: no admite tipos de
operación ni tratamientos nuevos.

## 2. Consumidores afectados (inventario del 2026-11-22)
Búsqueda en los repositorios y ramas de MIJEX: `mijex-property` y `mijex-home-services` (`main`), `wt-prop-contingencia`
y `wt-hs-contingencia` (`feat/contingencia-fiscal`) y `wt-fiscal-contingencia`.

| API de la librería | Consumidor | Uso |
|--------------------|------------|-----|
| `decideFiscalIssuance`, `IssuanceQuery` | Property (rama `feat/contingencia-fiscal`): `services/fiscalRuleCatalog.ts` (`decideInvoiceIssuance`), `fiscalBridge.ts` (`fiscalRuleDeployment`, `deploymentForTests`) | Puerta de emisión del catálogo |
| `createFiscalRuleCatalog`, `createPgFiscalRuleStore`, `FiscalRule`, `StoredFiscalRule` | Property: `fiscalRuleCatalog.ts` (siembra `PROPERTY_FISCAL_RULES`), `routes/adminFiscalRuleCatalog.routes.ts` (consola: nueva versión) | Catálogo en datos |
| `createOperationsRegister`, `createPgOperationsStore`, `OperationInput`, `exportOperationsCsv` | Property: `services/operationsRegister.ts`, `routes/operations.routes.ts` | Registro de operaciones y CSV |
| — | Home Services, ramas `main` de Property y HS, fiscal-core | **No usan** ninguna de estas APIs |

Property depende de la librería por ruta local (`file:../../mijex-contable`) y la librería está en `0.0.0`: no hay
versiones publicadas ni otros consumidores. Aun así, cada cambio incompatible se trata como MAJOR en el registro de
cambios y se hace junto con su adaptación en Property, en el mismo corte.

**Reglas fiscales paralelas (Q4), inventario:**
- **Property:**
  - `CountryTaxProfile` (tipos del país);
  - `RentalTaxRule` (021/055) y `RentalWithholdingRule` (055);
  - `CountryFiscalValidation` (062) y `FiscalSystemCalendar`;
  - `FiscalDocumentQualification` (063d);
  - `OrganizationRentalTaxAdjustment` (retirado del cálculo, 063e);
  - el catálogo `PROPERTY_FISCAL_RULES` (003).
- **Home Services:** `Country.taxRate`, `TaxWithholdingConfig` (ISR presunto e ITBIS retenido) y
  `OrganizationServiceRule`.

## 3. Diseño
### 3.1 Corte 004a · Q1: reglas pendientes solo en simulación (sin migración)
- `IssuanceQuery` sustituye `deployment` (`PRODUCTION` | `NON_PRODUCTION`) por `mode`: `LIVE` | `SIMULATION`.
  - **LIVE** (documentos reales, en cualquier entorno): solo emite una regla VERIFIED con referencia. Una pendiente va a
    `MANUAL_REVIEW` con `RULE_NOT_VERIFIED`.
  - **SIMULATION** (pruebas aisladas con datos ficticios): una pendiente devuelve `ISSUE` marcado `simulated: true`. El
    consumidor no puede convertirlo en documento real.
- Incompatible: se quita `deployment` (MAJOR). Lo usa solo Property y se adapta en el mismo corte.
- **Property:**
  - `fiscalRuleDeployment` pasa a `mode`: siempre `LIVE` desde el entorno, nunca `SIMULATION` por variable de entorno.
  - `SIMULATION` solo por el gancho de pruebas (`deploymentForTests`, renombrado), y solo con la librería fiscal de
    pruebas (kit).
  - **Impacto en desarrollo:** con el catálogo sembrado como pendiente, ninguna cuota que decida el catálogo se emite
    con la librería hasta que la plataforma verifique sus reglas. Afecta a comunidades, otras facturas y alquiler sin
    el motor de la 055; los cobros siguen.
- Pruebas: el test actual «desarrollo y pruebas: una regla pendiente emite» se sustituye por los de LIVE y SIMULATION.
  El `todo` I-K12-1 pasa a prueba. Las e2e de Property del catálogo (`fiscal-rule-gate-003`,
  `fiscal-rule-catalog-*-003`) se adaptan.

### 3.2 Corte 004b · Q2: proponer y verificar, separados (migración 0006, aditiva)
- **Estados de una versión:** `PROPOSED` | `VERIFIED` | `REJECTED`, además de `UNDETERMINED`. La siembra crea
  `APPROVED_PENDING_VERIFICATION`, que equivale a propuesta.
- **Columnas nuevas en `contable.fiscal_rule`:**
  - `proposed_by`, `verified_by`, `verified_at`;
  - CHECK `verified_by <> proposed_by`;
  - CHECK de completitud (VERIFIED exige `verified_by`, `verified_at` y referencia).
- La tabla sigue siendo solo de inserción: verificar es una versión nueva que copia el contenido de la propuesta y
  enlaza `proposed_by`.
- **API:**
  - `catalog.propose(rule, meta)`;
  - `catalog.verify(ruleId, version, { verifiedBy, reference, reason })`: rechaza con `SELF_VERIFICATION` si
    `verifiedBy` es quien propuso, y con `STALE_PROPOSAL` si ya hay una versión posterior;
  - `catalog.reject(...)`.
- `addVersion` con `validation: "VERIFIED"` deja de aceptarse (MAJOR): se verifica con `verify`.
- **Permisos (Property):**
  - proponer: PLATFORM_ADMIN del país;
  - verificar o rechazar: otro PLATFORM_ADMIN del país;
  - FINANCE: lectura;
  - todo auditado (`FISCAL_RULE_PROPOSED`, `VERIFIED` y `REJECTED`).
- **Datos existentes:** en desarrollo, `contable.fiscal_rule` tiene 0 filas. La siembra posterior a la migración deja
  `proposed_by = "system"`, así que la siembra no puede verificar.
- Vuelta atrás: quitar las columnas y las CHECK nuevas (ninguna fila existente depende de ellas).

### 3.3 Corte 004c · Q3: contrato del resultado fiscal (migración 0007, aditiva)
**Contrato público estable** `FiscalResultEnvelope`, opcional en `OperationInput.fiscal`, con estos datos:

| Campo | Qué es |
|-------|--------|
| `provenance` | `FISCAL_CORE` o `EXTERNAL` |
| `documentId` | Identificador del documento en fiscal-core |
| `documentVersion` | Versión del contrato del documento |
| `status` | Estado fiscal y de envío, tal como los da fiscal-core |
| `scope` | Organización, emisor y país |
| `integrity` | `{ algorithm, digest }` |

**Qué verifica la librería, sin recalcular impuestos ni interpretar la ley:**
- **Procedencia:** `EXTERNAL` solo con `origin: "MANUAL"`.
- **Versión:** del contrato admitido.
- **Estado:** de una lista cerrada; uno no definitivo se registra como **no definitivo**.
- **Ámbito:** la organización del registro debe ser la del documento, y el país debe coincidir.
- **Integridad:** el algoritmo debe estar admitido y la huella bien formada. Si se aporta el contenido canónico, se
  comprueba que la huella coincide.

Lo que no cumple se rechaza con errores tipados: `FISCAL_PROVENANCE`, `FISCAL_VERSION`, `FISCAL_STATUS`,
`FISCAL_SCOPE` y `FISCAL_INTEGRITY`. El cobro o pago asociado se registra aparte y no se bloquea.

**Migración 0007:** columnas `fiscal_*` en `contable.operation_record`, nulas para lo anterior, que no se reescribe.
Cambio MINOR: el campo es opcional.

**Dependencia de fiscal-core:** hoy su documento no expone una huella del contenido (`FiscalDocument` tiene
identificador, emisor, país y estados, pero no `hash`). La integridad completa necesita que fiscal-core la publique; va
en la spec de Q4. Hasta entonces, la integridad solo comprueba que la huella esté presente y bien formada.

**Property:** envía el sobre en las cuotas emitidas con la librería, con los datos que da fiscal-core.

### 3.4 Q4 · Autoridad única de las reglas fiscales (spec aparte en `mijex-fiscal`)
- Catálogo fiscal compartido y versionado en `@mijex/fiscal-core`. Absorbe por etapas:
  1. el catálogo de la 003;
  2. los tipos del país y las calificaciones del documento;
  3. las reglas de alquiler de Property (021/055) y sus validaciones por país;
  4. la configuración de retenciones de Home Services.
- Property y Home Services consumen resultados; dejan de mantener reglas propias.
- Cada etapa necesita su propia migración de datos, comprobada regla a regla, sin migraciones automáticas sin
  equivalencia (como en la 062).
- En esta spec: congelar el catálogo de la 003, sin tipos ni tratamientos nuevos, y dejar escrito el inventario
  (§2).

## 4. Seguridad y aislamiento
- Separación de funciones garantizada en la base (CHECK) y en el código.
- Sobre fiscal validado en el límite de la API (tipos estrictos, sin `any`).
- Organización y país: un resultado fiscal de otra organización se rechaza (`FISCAL_SCOPE`).
- Revisión con `security-audit` en 004b y 004c (permisos y entrada externa).

## 5. Tests (TDD, en rojo primero)
- **004a:** LIVE con pendiente → revisión en todos los entornos; SIMULATION → `simulated: true`; los `todo`
  I-K12-1 → prueba. e2e de Property: catálogo pendiente → retenida; en prueba aislada con el kit, emite.
- **004b:** contrato memoria y PG:
  - proponer y verificar con identidades distintas → VERIFIED;
  - verificar la propia propuesta → `SELF_VERIFICATION`, y la CHECK de la base lo impide aunque falle el código;
  - verificar una propuesta antigua → `STALE_PROPOSAL`;
  - historial completo.
- **004c:** pruebas de rechazo por cada error (`FISCAL_PROVENANCE`, `VERSION`, `STATUS`, `SCOPE` e `INTEGRITY`) en
  memoria y PG; uno no definitivo queda marcado; el cobro asociado se registra; idempotencia por origen.

## 6. Despliegue y vuelta atrás
- Orden: 004a → 004b → 004c, cada uno con la regresión de la librería (unit, PG, build) y la e2e completa de Property.
- Migraciones 0006 y 0007, aditivas: se validan en la base de pruebas, se presentan y, con aprobación, se aplican en las
  bases de desarrollo de la rama con copia previa (`mijex_property`, `mijex_contingencia_dev`). Nada en staging ni
  producción.

## 7. Constitution check
| Principio | Cumple | Nota |
|-----------|--------|------|
| K1 Regla + referencia + test | Sí | R-CORE-014 y R-CORE-012 se modifican con REF-DEC-015; pruebas `[R-CORE-014]`, `[R-CORE-012]` y `[K12]` |
| K2 Fuentes oficiales | Sí | No se crea ninguna regla fiscal |
| K3 Stop conditions | Sí | Plan, migraciones y cambios de API presentados antes de implementar |
| K4 Multi-país por datos | Sí | Sin condiciones por país |
| K5 Dinero exacto | Sí | Sin cálculos de importes nuevos |
| K6 Inmutabilidad | Sí | Catálogo y registro solo de inserción |
| K7 Seguridad | Sí | CHECK de separación y validación del sobre; `security-audit` |
| K8 Reutilización | Sí | Sin duplicar cálculos fiscales |
| K9 Frontera fiscal | Sí | Q4 lleva las reglas a fiscal-core; aquí solo se valida el resultado |
| K10 SDD + TDD | Sí | — |
| K11 Calidad | Sí | lint, typecheck, test, test:pg, build (con el fallo preexistente de `.agents/` documentado) |
| K12 | Es el objetivo | I-K12-1, 3 y 4 se cierran aquí; I-K12-2, con la spec de Q4 |

## 8. Preguntas para aprobar el plan
1. ¿Apruebas el diseño de los cortes 004a, 004b y 004c y los cambios incompatibles en `decideFiscalIssuance` y el
   catálogo (solo afectan a Property, que se adapta en el mismo corte)?
2. ¿Apruebas las migraciones 0006 y 0007 (aditivas) para validarlas en la base de pruebas?
3. ¿Abro la spec de Q4 en `mijex-fiscal` (catálogo fiscal compartido) en paralelo, o después de la 004?
