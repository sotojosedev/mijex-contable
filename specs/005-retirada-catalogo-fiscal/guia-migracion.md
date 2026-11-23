# Guía de migración — retirada del catálogo fiscal (spec 005, versión mayor)

Para quien use `@sotojosedev/contable-core`. Hoy **ningún consumidor** usa lo retirado (Property y Home Services lo
comprobaron al compilar): para ellos basta con actualizar.

## 1. Antes de actualizar
1. Comprueba que tu base no tiene reglas en el catálogo antiguo:
   ```sql
   SELECT count(*) FROM contable.fiscal_rule;   -- debe ser 0
   ```
   Si hay filas, la migración 0008 **falla y no cambia nada**. Esas reglas se revisan con su supuesto fiscal y sus
   fuentes oficiales y se proponen en fiscal-core (condición C3 de la spec 014: sin traslados automáticos).
2. Haz una copia de la base (`pg_dump -Fc`) y comprueba que se restaura (`pg_restore -l`).
3. Recuerda que `migrate` se ejecuta al arrancar: desplegar la versión nueva aplica la 0008 en ese entorno.

## 2. Equivalencias en `@mijex/fiscal-core`
| Antes (`@sotojosedev/contable-core`) | Ahora (`@mijex/fiscal-core`) |
|--------------------------------------|------------------------------|
| `createFiscalRuleCatalog({ store })` | `fiscal.rules` (el núcleo fiscal en uso) o `createRuleCatalog({ store, clock })` |
| `createMemoryFiscalRuleStore()` / `createPgFiscalRuleStore({ pool })` | El almacén de fiscal-core (memoria en `testing`, PostgreSQL en `pg`); tablas `fiscal.rule_version` y `fiscal.document_rule_ref` (0021, 0022) |
| `catalog.seed(rules, { recordedBy, reason })` | `rules.seed(proposals, { actorId, reason })` |
| `catalog.propose(rule, { recordedBy, reason })` con `validation: "UNDETERMINED"` | `rules.propose(proposal, actor)` con `undetermined: true` |
| `catalog.verify(ruleId, version, { reviewedBy, reference, reason })` | `rules.verify(ruleId, version, { actorId, reason, reference })` |
| `catalog.reject(...)` | `rules.reject(ruleId, version, actor)` |
| — | `rules.publish(ruleId, version, { actorId, reason, effectiveFrom? })` — una **tercera** persona |
| `catalog.rules({ country })`, `catalog.history(ruleId)` | `rules.list({ type: "ISSUANCE", country })`, `rules.history(ruleId)` |
| `decideFiscalIssuance(rules, query)` | `decideIssuance(versions, query)` o `rules.decideIssuance(query)` |
| `FiscalRule` (`jurisdiction`, `organizationType`, `operationType`, `treatment`, `validation`) | `RuleVersion` (`type: "ISSUANCE"`, `content: { organizationType, operationType, treatment }`, `status`) |
| `validation`: `APPROVED_PENDING_VERIFICATION` / `VERIFIED` / `UNDETERMINED` / `REJECTED` | `status`: `PROPOSED` / `VERIFIED` → `PUBLISHED` / `UNDETERMINED` / `REJECTED` |
| Decisión: `ruleId`, `ruleVersion`, `validation` | Decisión: `ruleRef: { type, ruleId, version }`, `status` |
| Errores `SELF_VERIFICATION`, `STALE_PROPOSAL`, `CONCURRENT_UPDATE`, `RULE_INVALID` | `RULE_SELF_REVIEW`, `RULE_STALE_VERSION`, `RULE_CONCURRENT_VERSION`, `RULE_INVALID` (`FiscalError`) |

Diferencias de comportamiento (más estrictas):
- En LIVE solo decide una versión **publicada**; una verificada sin publicar da `RULE_NOT_PUBLISHED`.
- `treatment` solo admite `FISCAL_INVOICE` o `NO_FISCAL_DOCUMENT`.
- No hay `jurisdiction`: ninguna decisión la usaba. Si hace falta una jurisdicción por debajo del país, se pide en una
  spec de fiscal-core.

## 3. Registrar qué reglas decidieron el documento
Pasa a `issueDocument` las referencias de la decisión (`ruleRefs: [decision.ruleRef]`) y, al registrar la operación,
añádelas al sobre:
```ts
const fiscal: FiscalResultEnvelope = { ...sobre, ...(doc.ruleRefs.length ? { ruleRefs: doc.ruleRefs } : {}) };
```
Si el sobre llega con referencias mal formadas o repetidas, el registro falla con `FISCAL_RULE_REF`.

## 4. Vuelta atrás
Restaurar la copia previa o ejecutar a mano el SQL de `0005_fiscal_rule_catalog.sql` y `0006_fiscal_rule_review.sql`, y
volver a la versión anterior de la librería.
