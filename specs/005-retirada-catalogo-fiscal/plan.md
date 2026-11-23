# Plan 005 — Retirada del catálogo fiscal duplicado

| Campo | Valor |
|-------|-------|
| Estado | Aprobado (dueño, 2026-11-23: «Procede con la spec, la implementación y las pruebas en desarrollo») |
| Spec | [spec.md](spec.md) · Clarify: [clarify.md](clarify.md) |
| Fecha | 2026-11-23 |

## 1. Resumen técnico
Se quitan de la librería el catálogo de reglas fiscales (`src/operations/fiscal-rules.ts`), su almacén PostgreSQL
(`src/persistence/pg/fiscal-rule-store.ts`), la decisión de emisión (`decideFiscalIssuance`) y sus tipos y códigos de
error exclusivos. La migración nueva `0008` elimina la tabla `contable.fiscal_rule` y su función de guardia, y aborta si
la tabla tiene filas. `FiscalResultEnvelope` gana un campo opcional `ruleRefs` (tipo, regla, versión), validado y
guardado con el registro. Property pasa las referencias que ya le da fiscal-core. Versión mayor con guía de migración.

## 2. Inventario (condición 2: consumidores)
### 2.1 Lo que se retira
| Elemento | Dónde | Exportado por |
|----------|-------|---------------|
| `createFiscalRuleCatalog`, `createMemoryFiscalRuleStore`, `FiscalRuleCatalog`, `FiscalRuleStore`, `StoredFiscalRule`, `RuleVersionMeta`, `ReviewMeta` | `src/operations/fiscal-rules.ts` | `@sotojosedev/contable-core` |
| `decideFiscalIssuance`, `FiscalRule`, `FiscalTreatment`, `RuleValidation`, `IssuanceQuery`, `IssuanceReason`, `IssuanceDecision` | `src/operations/index.ts` | `@sotojosedev/contable-core` |
| `createPgFiscalRuleStore` | `src/persistence/pg/fiscal-rule-store.ts` | `@sotojosedev/contable-core/pg` |
| Códigos `SELF_VERIFICATION`, `STALE_PROPOSAL` de `LedgerErrorCode` | `src/core/errors.ts` | `@sotojosedev/contable-core` |
| Tabla `contable.fiscal_rule` (índice, disparadores `fiscal_rule_immutable` y `fiscal_rule_review_guard`) y función `contable.fiscal_rule_review_guard()` | migraciones 0005 y 0006 | esquema `contable` |

Se conservan `RULE_INVALID` y `CONCURRENT_UPDATE` (los usan las reglas de asiento y el registro de operaciones) y la
función compartida `contable.reject_mutation()` (la usan las demás tablas).

### 2.2 Consumidores (búsqueda del 2026-11-23)
Búsqueda con `git grep` en todos los repositorios y worktrees de `~/Desktop/Jose/Empresa` (`mijex-*`, `wt-*`) de cada
símbolo anterior y de `contable.fiscal_rule`:

| Repositorio | Depende de la librería | Usa algo de lo retirado |
|-------------|------------------------|-------------------------|
| `wt-prop-contingencia` (Property, `feat/contingencia-fiscal`) | Sí (`file:`) | **No.** Usa `exportOperationsCsv`, `isLedgerError`, conciliación, `createOperationsRegister`, `createPgOperationsStore`, `migrate`, `FiscalResultEnvelope` y `FISCAL_RESULT_CONTRACT_VERSION`. Desde la spec 014 (commit `3015216`) su catálogo es el de fiscal-core. Las coincidencias de texto (`RentalTaxRuleValidation`, `FiscalTreatment` del frontend) son tipos propios. |
| `wt-hs-contingencia` (HS, `feat/contingencia-fiscal`) | Sí (`file:`) | **No.** Usa el libro mayor, marcos, conciliación, informes DGII e IR-17 y `migrate`. |
| `mijex-property`, `mijex-home-services`, `mijex-web`, `mijex-mobile`, `mijex-fiscal` y los demás `wt-*` | No | No |
| `wt-fiscal-contingencia` (fiscal-core) | No (es la frontera) | No: las coincidencias son su propio catálogo (`IssuanceReason`, `rule-catalog.ts`). |

La prueba definitiva es la compilación de Property y HS contra la librería sin esas exportaciones (T030).

### 2.3 Datos (condición 7)
| Base | Contenedor | Migración actual | Filas en `contable.fiscal_rule` |
|------|------------|------------------|---------------------------------|
| `mijex_property` (Property, desarrollo) | `mijex-property-postgres` | 0007 | 0 |
| `mijex_contingencia_dev` (HS, desarrollo) | `mijex-postgres` | 0007 | 0 |
| `mijex_contable_test` (pruebas de la librería; se recrea en cada ejecución) | `mijex-fiscal-test-pg` | 0007 | 0 |
| `mijex` (HS `main`, compartida) | `mijex-postgres` | 0002, sin la tabla | **No se toca** |
| `mijex_contingencia_test`, bases e2e de Property | — | sin la tabla o sin el esquema | se migran solas en sus pruebas |

Dependencias en la base: se comprueban justo antes de aplicar (`pg_depend`: vistas, claves foráneas y funciones que
nombren la tabla). La migración no usa `CASCADE`: si apareciera una dependencia, falla en vez de borrarla.

## 3. Cobertura en fiscal-core (condición 3)
| Responsabilidad del catálogo antiguo | En `@mijex/fiscal-core` (spec 014, etapa 2) | Resultado |
|--------------------------------------|---------------------------------------------|-----------|
| Siembra idempotente, solo propuestas, nunca verifica | `rules.seed` | Igual |
| Proponer (pendiente) o marcar no determinada | `rules.propose` (`undetermined`) | Igual |
| Verificar con referencia oficial, nunca quien propuso | `rules.verify` (`RULE_SELF_REVIEW`) | Igual |
| Rechazar, nunca quien propuso | `rules.reject` | Igual |
| — | `rules.publish` por una **tercera** persona (decisión del dueño, 2026-11-23) | Más estricto |
| Listado por país e histórico | `rules.list`, `rules.history` | Igual |
| Solo inserción en la base | disparador de solo inserción (migración 0021) | Igual |
| Guardia de revisión en la base | `fiscal.rule_version_guard` (0021): roles, orden y contenido | Más estricto |
| Carrera de dos versiones (`CONCURRENT_UPDATE`) | `RULE_CONCURRENT_VERSION` | Igual |
| Decisión por operación LIVE / SIMULATION; `NO_RULE`, `RULE_UNDETERMINED`, `RULE_NOT_VERIFIED`, `MISSING_DATA`, `RULE_APPLIES`, `simulated` | `decideIssuance` / `rules.decideIssuance`, con el mismo orden (vigencia y versión) y la misma regla de cierre por rechazo | Igual, más `RULE_NOT_PUBLISHED` |
| Identificador y versión de la regla en la decisión | `ruleRef` en la decisión **y guardado con el documento** (0022) | Más completo |
| Validación de vigencia y fechas | esquema de la propuesta | Igual |
| Tratamiento abierto (cualquier texto distinto de `NO_FISCAL_DOCUMENT` emite) | Tratamiento cerrado: `FISCAL_INVOICE` o `NO_FISCAL_DOCUMENT` | Más estricto; nunca hubo otros valores (0 filas) |
| Campo `jurisdiction` | No existe | **Diferencia documentada:** era descriptivo, ninguna decisión lo usaba y no hay filas. Si hace falta una jurisdicción por debajo del país (territorios forales, Canarias), se añade como dato del catálogo en una spec de fiscal-core. |

Conclusión: no se pierde ninguna funcionalidad usada.

## 4. Diseño
### 4.1 API pública (versión mayor)
- Se borran los ficheros `src/operations/fiscal-rules.ts` y `src/persistence/pg/fiscal-rule-store.ts`, el bloque
  «Catálogo de reglas fiscales y decisión de emisión» de `src/operations/index.ts` y sus exportaciones.
- `LedgerErrorCode` pierde `SELF_VERIFICATION` y `STALE_PROPOSAL`; gana `FISCAL_RULE_REF`.
- `FiscalResultEnvelope` (contrato versión 1, sin cambio de versión) gana:
  ```ts
  /** Reglas de fiscal-core que decidieron el documento (spec 014). Opcional: hay documentos sin regla del catálogo. */
  readonly ruleRefs?: readonly FiscalRuleRef[] | undefined;
  export interface FiscalRuleRef { readonly type: string; readonly ruleId: string; readonly version: number }
  ```
  Validación (`FISCAL_RULE_REF`): lista; cada `type` en mayúsculas (`^[A-Z][A-Z_]*$`), `ruleId` no vacío,
  `version` entero ≥ 1; una sola referencia por regla. Se guarda tal cual en `RecordedFiscalResult.ruleRefs`, ordenada
  por regla; una lista vacía equivale a no llevarla (no se guarda el campo). La librería **no** consulta el catálogo ni
  interpreta la regla: eso es de fiscal-core, que ya rechaza referencias inexistentes o rechazadas al emitir.
- Idempotencia: el mismo documento lleva siempre las mismas referencias (fiscal-core las guarda al emitir y no
  cambian), así que entran en la comparación del registro sin romper reintentos.
- Sin cambio de esquema para `ruleRefs`: el sobre se guarda en la columna `fiscal jsonb` (0007).

### 4.2 Migración `0008_drop_fiscal_rule_catalog.sql`
```sql
DO $$
BEGIN
  IF to_regclass('contable.fiscal_rule') IS NOT NULL THEN
    LOCK TABLE contable.fiscal_rule IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM contable.fiscal_rule) THEN
      RAISE EXCEPTION '...tiene filas: no se elimina...' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
END $$;
DROP TABLE IF EXISTS contable.fiscal_rule;              -- sin CASCADE: una dependencia hace fallar la migración
DROP FUNCTION IF EXISTS contable.fiscal_rule_review_guard();
```
- Una transacción por migración (mecanismo de `migrate`): si algo falla, no queda nada a medias.
- El bloqueo exclusivo evita que alguien inserte entre la comprobación y el borrado; la tabla está vacía, así que dura
  milisegundos.
- 0005 y 0006 no se tocan (sus checksums siguen iguales).
- **Vuelta atrás:** restaurar la copia previa, o volver a ejecutar a mano el SQL de 0005 y 0006 (sin datos que
  recuperar: la tabla estaba vacía).

### 4.3 Property (consumidor)
`fiscalEnvelopeFor` añade `ruleRefs` cuando el documento de fiscal-core las tiene (`PublishedDocument.ruleRefs`). Sin
referencias, el sobre es idéntico al actual. Home Services no cambia.

## 5. Seguridad
| Riesgo | Mitigación | Test |
|--------|------------|------|
| Sobre manipulado (referencias falsas o mal formadas) | validación en el límite, error tipado, nada guardado | `[R-CORE-018]` rechazos |
| Borrado de datos en una base con catálogo | la migración aborta si hay filas; sin `CASCADE` | prueba PG con fila |
| Migración destructiva aplicada sin control | copia previa y comprobaciones en desarrollo; producción y publicación solo con aprobación (condición 10) | — |

## 6. Tests (TDD)
- Unit: `tests/operations/k12.test.ts` y `register.test.ts` pierden los casos del catálogo (pasan a fiscal-core:
  `tests/core/rule-decision.test.ts` y `tests/contract/rule-catalog.contract.ts`) y ganan `[R-CORE-018]`.
- PG: se borra `tests/contract/fiscal-rules.contract.ts` y sus pruebas de la tabla; nueva prueba de la 0008 (borra con
  la tabla vacía, aborta con filas, no toca `reject_mutation`) y del sobre con referencias guardado y releído.
- Consumidores: compilación de Property y HS; unitarias y e2e de Property (registro de operaciones y emisión);
  pruebas de HS de la librería contable.

## 7. Despliegue y vuelta atrás
1. Desarrollo (aprobado): copia de `mijex_property` y `mijex_contingencia_dev`, comprobación de filas y dependencias,
   `migrate` de la librería.
2. Staging o producción y publicación de la versión mayor: **pendientes** de la aprobación específica del dueño, con
   los resultados de este plan. Al arrancar, Property y HS aplicarán la 0008 solas.
3. Vuelta atrás: §4.2.

## 8. Constitution check
| Principio | Cumple | Cómo |
|-----------|--------|------|
| K1 Regla + referencia + test | ✅ | R-CORE-014 (retirada) y R-CORE-018, REF-DEC-016, tests con su ID |
| K2 Fuentes oficiales | N/A | No crea reglas fiscales de país |
| K3 Stop conditions | ✅ | API pública, migración destructiva y git decididas por el dueño (clarify) |
| K4 Multi-país por datos | ✅ | Sin constantes por país |
| K5 Dinero exacto | N/A | No toca importes |
| K6 Inmutabilidad | ✅ | Registros existentes intactos; migración nueva sin reescribir 0005/0006 |
| K7 Seguridad | ✅ | Validación del sobre en el límite; migración que no borra datos |
| K8 Reutilización | ✅ | Una sola fuente de reglas (fiscal-core); se elimina el duplicado |
| K9 Frontera fiscal | ✅ | Sin reglas fiscales en `src/` |
| K10 SDD + TDD | ✅ | Esta spec; test primero |
| K11 Calidad verificable | ✅ | lint, typecheck, test, test:pg, build, knip |
| K12 | ✅ | Cierra I-K12-2 en esta librería |

## 9. Alternativas descartadas
| Alternativa | Motivo |
|-------------|--------|
| Dejar el catálogo marcado como obsoleto | Mantiene dos fuentes de reglas (C1) y código sin uso |
| Borrar la tabla dentro de 0005/0006 | Prohibido (condición 6) y rompería los checksums de las bases ya migradas |
| `DROP ... CASCADE` | Podría borrar en silencio un objeto dependiente desconocido |
| `ruleRefs` obligatorio con `FISCAL_CORE` | Cambiaría el comportamiento de alquileres con regla de la 055 y de HS |
