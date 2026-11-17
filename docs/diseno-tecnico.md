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

_Pendiente._

## 4. Módulos

_Pendiente._

## 5. Persistencia

_Pendiente._

## 6. Integraciones

_Pendiente (p. ej. `@mijex/fiscal-core`)._

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
