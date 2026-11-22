import { describe, expect, it } from "vitest";
import { createFiscalRuleCatalog, decideFiscalIssuance, type FiscalRule, type FiscalRuleStore } from "../../src/operations/index.js";

const rule = (over: Partial<FiscalRule> = {}): Omit<FiscalRule, "version"> => ({
  ruleId: "R-CORE-014/PROPERTY/DO/ADMINISTRADOR/COMUNIDAD", country: "DO", jurisdiction: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD",
  treatment: "FISCAL_INVOICE", validation: "APPROVED_PENDING_VERIFICATION", validFrom: "2000-01-01", ...over,
});
const meta = { recordedBy: "platform-admin-1", reason: "prueba" };

/** Spec 003, corte 2 (clarify Q2, REF-DEC-013): catálogo fiscal en datos versionados; mismo comportamiento en memoria y PG. */
export function fiscalRulesContract(name: string, makeStore: () => Promise<FiscalRuleStore>): void {
  describe(`[R-CORE-014] catálogo fiscal en datos versionados (${name})`, () => {
    it("la carga inicial traslada lo aprobado tal cual y es idempotente", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      const seeded = await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial 003" });
      expect(seeded).toBe(1);
      expect(await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial 003" })).toBe(0);
      const rules = await catalog.rules({ country: "DO" });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ version: 1, treatment: "FISCAL_INVOICE", validation: "APPROVED_PENDING_VERIFICATION" });
    });

    it("cambiar una regla crea una versión nueva y conserva el histórico", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      const v2 = await catalog.addVersion(rule({ validation: "VERIFIED", reference: "Ley 11-92 art. 335" }), meta);
      expect(v2).toMatchObject({ version: 2, validation: "VERIFIED", reference: "Ley 11-92 art. 335", recordedBy: "platform-admin-1", reason: "prueba" });
      const history = await catalog.history(rule().ruleId);
      expect(history.map((r) => [r.version, r.validation])).toEqual([[1, "APPROVED_PENDING_VERIFICATION"], [2, "VERIFIED"]]);
      // La decisión usa la versión mayor con la misma vigencia.
      const decision = decideFiscalIssuance(await catalog.rules(), { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", on: "2026-11-22", mode: "LIVE", missingData: [] });
      expect(decision).toMatchObject({ action: "ISSUE", ruleVersion: 2 });
    });

    it("VERIFIED exige referencia oficial", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await expect(catalog.addVersion(rule({ validation: "VERIFIED", reference: "  " }), meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
    });

    it("lo pendiente de verificar no activa comportamientos definitivos nuevos", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      // Cambiar el tratamiento sin verificar, o crear una regla nueva sin verificar: rechazado.
      await expect(catalog.addVersion(rule({ treatment: "NO_FISCAL_DOCUMENT" }), meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
      await expect(catalog.addVersion(rule({ ruleId: "R-NUEVA", operationType: "OTRO" }), meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
      // Marcarla como no determinada (lleva a revisión) o verificarla con referencia: permitido.
      await expect(catalog.addVersion(rule({ validation: "UNDETERMINED" }), meta)).resolves.toMatchObject({ version: 2 });
      await expect(catalog.addVersion(rule({ ruleId: "R-NUEVA", operationType: "OTRO", treatment: "NO_FISCAL_DOCUMENT", validation: "VERIFIED", reference: "Norma X" }), meta)).resolves.toMatchObject({ version: 1 });
    });

    it("una versión exige motivo, autor y vigencia coherente", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await expect(catalog.addVersion(rule({ validation: "UNDETERMINED" }), { recordedBy: "x", reason: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(catalog.addVersion(rule({ validation: "UNDETERMINED", validFrom: "2026-02-30" }), meta)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(catalog.addVersion(rule({ validation: "UNDETERMINED", validFrom: "2026-05-01", validTo: "2026-01-01" }), meta)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("una vigencia nueva no borra la anterior: cada fecha usa la suya", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.addVersion(rule({ validFrom: "2027-01-01", treatment: "NO_FISCAL_DOCUMENT", validation: "VERIFIED", reference: "Norma 2027" }), meta);
      const rules = await catalog.rules();
      const q = { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", mode: "SIMULATION" as const, missingData: [] };
      expect(decideFiscalIssuance(rules, { ...q, on: "2026-12-31" })).toMatchObject({ action: "ISSUE", ruleVersion: 1 });
      expect(decideFiscalIssuance(rules, { ...q, on: "2027-01-01" })).toMatchObject({ action: "NO_FISCAL_DOCUMENT", ruleVersion: 2 });
    });

    it("dos versiones a la vez de la misma regla: una gana y la otra recibe CONCURRENT_UPDATE", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      const results = await Promise.allSettled([
        catalog.addVersion(rule({ validation: "UNDETERMINED" }), meta),
        catalog.addVersion(rule({ validation: "VERIFIED", reference: "Ley" }), meta),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONCURRENT_UPDATE" });
      expect(await catalog.history(rule().ruleId)).toHaveLength(2);
    });
  });
}
