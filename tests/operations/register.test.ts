import { describe, expect, it } from "vitest";
import { assertAutomaticIssuance, createMemoryOperationsStore, resolveObligation, type ObligationProfile } from "../../src/operations/index.js";
import { operationsContract } from "../contract/operations.contract.js";



operationsContract("memoria", () => Promise.resolve(createMemoryOperationsStore()));

describe("[R-CORE-014] obligaciones fiscales por tipo de organización; sin determinar, no hay emisión automática", () => {
  const profiles: ObligationProfile[] = [
    { country: "ES", organizationType: "COMMUNITY", validFrom: "2026-01-01", obligations: [
      { code: "ISSUE_INVOICES", status: "UNDETERMINED" },
      { code: "WITHHOLD_IRPF", status: "REQUIRED", ruleId: "R-ES-120", reference: "RIRPF art. 76.1.a (BOE-A-2007-6820)" },
    ] },
  ];

  it("una obligación REQUIRED sin referencia oficial no es válida: cuenta como no determinada", () => {
    const bad: ObligationProfile[] = [{ country: "ES", organizationType: "COMPANY", validFrom: "2026-01-01", obligations: [{ code: "ISSUE_INVOICES", status: "REQUIRED" }] }];
    expect(resolveObligation(bad, { country: "ES", organizationType: "COMPANY", obligation: "ISSUE_INVOICES", on: "2026-11-18" }).status).toBe("UNDETERMINED");
  });

  it("devuelve el estado con su regla; sin perfil o sin la obligación, UNDETERMINED", () => {
    expect(resolveObligation(profiles, { country: "ES", organizationType: "COMMUNITY", obligation: "WITHHOLD_IRPF", on: "2026-11-18" })).toMatchObject({ status: "REQUIRED", ruleId: "R-ES-120" });
    expect(resolveObligation(profiles, { country: "DO", organizationType: "COMMUNITY", obligation: "ISSUE_INVOICES", on: "2026-11-18" }).status).toBe("UNDETERMINED");
    expect(resolveObligation(profiles, { country: "ES", organizationType: "COMMUNITY", obligation: "ISSUE_INVOICES", on: "2025-12-31" }).status).toBe("UNDETERMINED");
  });

  it("bloquea la emisión automática si la obligación no está determinada", () => {
    expect(() => { assertAutomaticIssuance(profiles, { country: "ES", organizationType: "COMMUNITY", obligation: "ISSUE_INVOICES", on: "2026-11-18" }); }).toThrow(expect.objectContaining({ code: "OBLIGATION_UNDETERMINED" }));
    expect(() => { assertAutomaticIssuance(profiles, { country: "ES", organizationType: "COMMUNITY", obligation: "WITHHOLD_IRPF", on: "2026-11-18" }); }).not.toThrow();
  });
});
