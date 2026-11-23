import { describe, expect, it } from "vitest";
import * as library from "../../src/index.js";
import * as pgLibrary from "../../src/persistence/pg/index.js";
import { createMemoryOperationsStore, createOperationsRegister, type OperationInput } from "../../src/operations/index.js";

// Constitución K12 (v1.1.0, ratificada por el dueño el 2026-11-22; AGENTS.md §7): tratamiento fiscal solo con regla
// validada. Aquí se comprueba lo que toca a esta librería. Desde la spec 005, la decisión de emisión y la separación
// entre proponer, verificar y publicar (I-K12-1, I-K12-3) se prueban en `@mijex/fiscal-core`.

describe("[K12] tratamiento fiscal solo con regla validada", () => {
  it("la revisión fiscal no bloquea el registro de los cobros y pagos", async () => {
    const register = createOperationsRegister({ store: createMemoryOperationsStore() });
    const collection: OperationInput = {
      organizationId: "org-k12", kind: "COLLECTION", occurredOn: "2026-11-22", amount: 15_000n, currency: "DOP", counterparty: "Inquilina",
      document: null, source: { system: "test", id: "cobro-1" }, origin: "AUTOMATIC", recordedBy: "system", nature: "OWN_INCOME",
    };
    const recorded = await register.record(collection);
    expect(recorded).toMatchObject({ kind: "COLLECTION", amount: 15_000n, sourceVersion: 1 });
  });

  it("lo registrado es inmutable: corregir crea una reversión y una versión nueva, nunca edita", async () => {
    const register = createOperationsRegister({ store: createMemoryOperationsStore() });
    const input: OperationInput = {
      organizationId: "org-k12", kind: "INVOICE", occurredOn: "2026-11-22", amount: 10_000n, currency: "EUR", counterparty: "Cliente",
      document: { type: "FACTURA", number: "F-1" }, source: { system: "test", id: "factura-1" }, origin: "AUTOMATIC", recordedBy: "system",
    };
    const first = await register.record(input);
    const { reversal, record } = await register.recordCorrection({ ...input, amount: 12_000n }, { reason: "Importe corregido", recordedBy: "admin" });
    expect(reversal).toMatchObject({ reverses: first.id, amount: -10_000n });
    expect(record).toMatchObject({ amount: 12_000n, sourceVersion: 3 });
    expect((await register.trace(first.id)).map((r) => r.id)).toContain(first.id);
    expect((await register.list("org-k12")).find((r) => r.id === first.id)).toMatchObject({ amount: 10_000n });
  });

  it("I-K12-2 (spec 005): las reglas fiscales viven en @mijex/fiscal-core; esta librería no expone un catálogo propio", () => {
    const retired = ["createFiscalRuleCatalog", "createMemoryFiscalRuleStore", "decideFiscalIssuance", "createPgFiscalRuleStore"];
    for (const name of retired) {
      expect(Object.keys(library)).not.toContain(name);
      expect(Object.keys(pgLibrary)).not.toContain(name);
    }
  });
  it("I-K12-4 (spec 004c): el registro comprueba la procedencia y el estado del resultado fiscal antes de registrarlo", async () => {
    const register = createOperationsRegister({ store: createMemoryOperationsStore() });
    const base: OperationInput = {
      organizationId: "org-k12", kind: "INVOICE", occurredOn: "2026-11-22", amount: 10_000n, currency: "EUR", counterparty: "Cliente",
      document: { type: "FACTURA", number: "F-K12" }, source: { system: "test", id: "factura-k12" }, origin: "AUTOMATIC", recordedBy: "system",
    };
    const fiscal = { contractVersion: 1, provenance: "FISCAL_CORE", documentId: "doc-k12", documentNumber: "F-K12", issuerId: "issuer", organizationId: "org-k12", country: "ES", fiscalStatus: "ACTIVE", submissionStatus: "IN_PROCESS", integrity: { algorithm: "SHA-256", digest: "a".repeat(64) } } as const;
    await expect(register.record({ ...base, fiscal: { ...fiscal, organizationId: "otra-org" } })).rejects.toMatchObject({ code: "FISCAL_SCOPE" });
    expect((await register.record({ ...base, fiscal })).fiscal).toMatchObject({ definitive: false });
  });
});
