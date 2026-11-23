---
"@sotojosedev/contable-core": major
---

Spec 005 (K12, REF-DEC-016): se retira el catálogo fiscal duplicado. `@mijex/fiscal-core` es la única fuente
autorizada de reglas fiscales.

**Incompatible (eliminado):**
- De `@sotojosedev/contable-core`: `createFiscalRuleCatalog`, `createMemoryFiscalRuleStore`, `decideFiscalIssuance` y
  los tipos `FiscalRuleCatalog`, `FiscalRuleStore`, `StoredFiscalRule`, `RuleVersionMeta`, `ReviewMeta`, `FiscalRule`,
  `FiscalTreatment`, `RuleValidation`, `IssuanceQuery`, `IssuanceReason` e `IssuanceDecision`.
- De `@sotojosedev/contable-core/pg`: `createPgFiscalRuleStore`.
- Códigos de `LedgerErrorCode`: `SELF_VERIFICATION` y `STALE_PROPOSAL`.
- Migración `0008_drop_fiscal_rule_catalog.sql`: elimina `contable.fiscal_rule` y `contable.fiscal_rule_review_guard()`.
  **Aborta si la tabla tiene filas.** Se aplica sola al arrancar el consumidor que llame a `migrate`.

**Compatible (nuevo):**
- `FiscalResultEnvelope.ruleRefs` (opcional) y el tipo `FiscalRuleRef`: reglas de fiscal-core que decidieron el
  documento; se validan (código nuevo `FISCAL_RULE_REF`) y se guardan con el registro. El contrato sigue en la versión 1.

Guía de migración: `specs/005-retirada-catalogo-fiscal/guia-migracion.md`.
