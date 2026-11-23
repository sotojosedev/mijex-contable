import { createMemoryOperationsStore } from "../../src/operations/index.js";
import { operationsContract } from "../contract/operations.contract.js";

// El catálogo de reglas fiscales y la decisión de emisión (R-CORE-014) se retiraron en la spec 005: viven en
// `@mijex/fiscal-core` (spec 014 de mijex-fiscal; sus casos están en `tests/core/rule-decision.test.ts` y
// `tests/contract/rule-catalog.contract.ts`).
operationsContract("memoria", () => Promise.resolve(createMemoryOperationsStore()));
