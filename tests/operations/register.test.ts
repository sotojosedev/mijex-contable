import { describe, expect, it } from "vitest";
import { createMemoryFiscalRuleStore, createMemoryOperationsStore, decideFiscalIssuance, type FiscalRule, type IssuanceQuery } from "../../src/operations/index.js";
import { fiscalRulesContract } from "../contract/fiscal-rules.contract.js";
import { operationsContract } from "../contract/operations.contract.js";



operationsContract("memoria", () => Promise.resolve(createMemoryOperationsStore()));
fiscalRulesContract("memoria", () => Promise.resolve(createMemoryFiscalRuleStore()));

describe("[R-CORE-014] catálogo de reglas fiscales y decisión de emisión por operación (REF-DEC-009)", () => {
  const rule = (over: Partial<FiscalRule> = {}): FiscalRule => ({
    ruleId: "R-PROP-001", version: 1, country: "DO", jurisdiction: "DO", organizationType: "PROPERTY_MANAGER", operationType: "COMMERCIAL_RENT",
    treatment: "FISCAL_INVOICE", validation: "APPROVED_PENDING_VERIFICATION", validFrom: "2026-01-01", ...over,
  });
  const q = (over: Partial<IssuanceQuery> = {}): IssuanceQuery => ({ country: "DO", organizationType: "PROPERTY_MANAGER", operationType: "COMMERCIAL_RENT", on: "2026-11-18", deployment: "NON_PRODUCTION", missingData: [], ...over });

  it("desarrollo y pruebas: una regla aprobada pendiente de verificación conserva su comportamiento (emite)", () => {
    expect(decideFiscalIssuance([rule()], q())).toMatchObject({ action: "ISSUE", ruleId: "R-PROP-001", validation: "APPROVED_PENDING_VERIFICATION" });
  });

  it("producción: la aprobación funcional no basta; solo emite una regla VERIFIED con su referencia", () => {
    expect(decideFiscalIssuance([rule()], q({ deployment: "PRODUCTION" }))).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED" });
    expect(decideFiscalIssuance([rule({ validation: "VERIFIED", reference: "Ley 11-92 art. 335" })], q({ deployment: "PRODUCTION" }))).toMatchObject({ action: "ISSUE" });
    expect(decideFiscalIssuance([rule({ validation: "VERIFIED" })], q({ deployment: "PRODUCTION" }))).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED" });
  });

  it("sin regla, con regla UNDETERMINED o con datos esenciales ausentes: revisión manual solo para esa operación", () => {
    expect(decideFiscalIssuance([], q())).toMatchObject({ action: "MANUAL_REVIEW", reason: "NO_RULE" });
    expect(decideFiscalIssuance([rule({ validation: "UNDETERMINED" })], q())).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_UNDETERMINED" });
    expect(decideFiscalIssuance([rule()], q({ missingData: ["buyerTaxId"] }))).toMatchObject({ action: "MANUAL_REVIEW", reason: "MISSING_DATA", missingData: ["buyerTaxId"] });
  });

  it("no toda operación genera factura: un tratamiento sin documento fiscal no emite ni bloquea", () => {
    expect(decideFiscalIssuance([rule({ operationType: "COMMUNITY_FEE", treatment: "NO_FISCAL_DOCUMENT", validation: "VERIFIED", reference: "x" })], q({ operationType: "COMMUNITY_FEE", deployment: "PRODUCTION" }))).toMatchObject({ action: "NO_FISCAL_DOCUMENT" });
  });

  it("usa la versión vigente en la fecha", () => {
    const rules = [rule(), rule({ version: 2, validFrom: "2027-01-01", treatment: "NO_FISCAL_DOCUMENT" })];
    expect(decideFiscalIssuance(rules, q({ on: "2026-12-31" })).ruleVersion).toBe(1);
    expect(decideFiscalIssuance(rules, q({ on: "2027-01-01" }))).toMatchObject({ ruleVersion: 2, action: "NO_FISCAL_DOCUMENT" });
  });
});
