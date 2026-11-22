import { describe, expect, it } from "vitest";
import {
  createFiscalRuleCatalog,
  createMemoryFiscalRuleStore,
  createMemoryOperationsStore,
  createOperationsRegister,
  decideFiscalIssuance,
  type FiscalRule,
  type IssuanceQuery,
  type OperationInput,
} from "../../src/operations/index.js";

// Constitución K12 (v1.1.0, ratificada por el dueño el 2026-11-22; AGENTS.md §7): tratamiento fiscal solo con regla
// validada. Aquí se comprueba lo que la librería ya cumple. Los incumplimientos conocidos (sdd/constitucion.md,
// I-K12-1 a I-K12-4) quedan como `it.todo` hasta que una spec aprobada los resuelva.

const rule = (over: Partial<FiscalRule> = {}): FiscalRule => ({
  ruleId: "R-K12/DO/ADMINISTRADOR/COMUNIDAD", version: 1, country: "DO", jurisdiction: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD",
  treatment: "FISCAL_INVOICE", validation: "VERIFIED", reference: "Norma de prueba", validFrom: "2026-01-01", ...over,
});
const query = (over: Partial<IssuanceQuery> = {}): IssuanceQuery => ({ country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", on: "2026-11-22", mode: "LIVE", missingData: [], ...over });

describe("[K12] tratamiento fiscal solo con regla validada (R-CORE-014)", () => {
  it("lo indeterminado no se emite de forma automática: sin regla, regla no determinada o datos ausentes → revisión", () => {
    expect(decideFiscalIssuance([], query())).toMatchObject({ action: "MANUAL_REVIEW", reason: "NO_RULE" });
    expect(decideFiscalIssuance([rule({ validation: "UNDETERMINED" })], query())).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_UNDETERMINED" });
    expect(decideFiscalIssuance([rule()], query({ missingData: ["buyerTaxId"] }))).toMatchObject({ action: "MANUAL_REVIEW", reason: "MISSING_DATA" });
  });

  it("un documento real solo se emite con una regla VERIFIED con referencia oficial", () => {
    expect(decideFiscalIssuance([rule()], query())).toMatchObject({ action: "ISSUE", validation: "VERIFIED", reference: "Norma de prueba" });
    expect(decideFiscalIssuance([rule({ validation: "APPROVED_PENDING_VERIFICATION" })], query())).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED" });
    expect(decideFiscalIssuance([rule({ reference: undefined })], query())).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED" });
  });

  it("el catálogo no admite VERIFIED sin referencia ni tratamientos nuevos sin verificar", async () => {
    const catalog = createFiscalRuleCatalog({ store: createMemoryFiscalRuleStore() });
    const base = { ruleId: "R-K12", country: "DO", jurisdiction: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", treatment: "FISCAL_INVOICE", validation: "APPROVED_PENDING_VERIFICATION", validFrom: "2026-01-01" } as const;
    await catalog.seed([base], { recordedBy: "system", reason: "carga inicial" });
    const meta = { recordedBy: "platform-admin", reason: "prueba K12" };
    await expect(catalog.addVersion({ ...base, validation: "VERIFIED", reference: " " }, meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
    await expect(catalog.addVersion({ ...base, treatment: "NO_FISCAL_DOCUMENT" }, meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
  });

  it("la revisión fiscal no bloquea el registro de los cobros y pagos", async () => {
    const register = createOperationsRegister({ store: createMemoryOperationsStore() });
    expect(decideFiscalIssuance([], query())).toMatchObject({ action: "MANUAL_REVIEW" });
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

  it("I-K12-1 (spec 004a): una regla pendiente nunca genera un documento real; solo se ejecuta en simulación", () => {
    const pending = rule({ validation: "APPROVED_PENDING_VERIFICATION" });
    expect(decideFiscalIssuance([pending], query())).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED" });
    expect(decideFiscalIssuance([pending], query({ mode: "SIMULATION" }))).toMatchObject({ action: "ISSUE", simulated: true });
  });
  it.todo("I-K12-2: las reglas fiscales viven en @mijex/fiscal-core; esta librería no guarda un catálogo propio");
  it.todo("I-K12-3: quien registra una versión de regla no puede verificarla (aprobación separada)");
  it.todo("I-K12-4: el registro comprueba la procedencia y el estado del resultado fiscal antes de registrarlo");
});
