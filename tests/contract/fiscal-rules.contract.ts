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
    it("la carga inicial traslada lo aprobado tal cual, como propuesta del sistema, y es idempotente", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      expect(await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial 003" })).toBe(1);
      expect(await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial 003" })).toBe(0);
      const rules = await catalog.rules({ country: "DO" });
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({ version: 1, treatment: "FISCAL_INVOICE", validation: "APPROVED_PENDING_VERIFICATION", proposedBy: "system" });
    });

    it("la carga inicial no puede verificar: una regla VERIFIED en la siembra se rechaza", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await expect(catalog.seed([rule({ validation: "VERIFIED", reference: "Ley" })], { recordedBy: "system", reason: "carga" })).rejects.toMatchObject({ code: "RULE_INVALID" });
    });

    it("[K12] proponer y verificar con identidades distintas: versión VERIFIED con quién propuso y quién verificó", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      const proposal = await catalog.propose(rule({ reference: "Ley 11-92 art. 335" }), { recordedBy: "pa-1", reason: "Propuesta con referencia" });
      expect(proposal).toMatchObject({ version: 2, validation: "APPROVED_PENDING_VERIFICATION", proposedBy: "pa-1" });
      const verified = await catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "Ley 11-92 art. 335", reason: "Contrastada con la fuente" });
      expect(verified).toMatchObject({ version: 3, validation: "VERIFIED", reference: "Ley 11-92 art. 335", proposedBy: "pa-1", reviewedBy: "pa-2", recordedBy: "pa-2" });
      expect(typeof verified.reviewedAt).toBe("string");
      const history = await catalog.history(rule().ruleId);
      expect(history.map((r) => `${String(r.version)}:${r.validation}`)).toEqual(["1:APPROVED_PENDING_VERIFICATION", "2:APPROVED_PENDING_VERIFICATION", "3:VERIFIED"]);
      const decision = decideFiscalIssuance(await catalog.rules(), { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", on: "2026-11-22", mode: "LIVE", missingData: [] });
      expect(decision).toMatchObject({ action: "ISSUE", ruleVersion: 3 });
    });

    it("[K12] nadie verifica ni rechaza su propia propuesta (SELF_VERIFICATION)", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule(), { recordedBy: "pa-1", reason: "Propuesta" });
      await expect(catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-1", reference: "Ley", reason: "Me la verifico" })).rejects.toMatchObject({ code: "SELF_VERIFICATION" });
      await expect(catalog.reject(rule().ruleId, 2, { reviewedBy: "pa-1", reason: "Me la rechazo" })).rejects.toMatchObject({ code: "SELF_VERIFICATION" });
      expect(await catalog.history(rule().ruleId)).toHaveLength(2);
    });

    it("[K12] solo se revisa la última versión y solo si es una propuesta (STALE_PROPOSAL)", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule(), { recordedBy: "pa-1", reason: "Propuesta" });
      await expect(catalog.verify(rule().ruleId, 1, { reviewedBy: "pa-2", reference: "Ley", reason: "Versión antigua" })).rejects.toMatchObject({ code: "STALE_PROPOSAL" });
      await catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "Ley", reason: "Verificada" });
      await expect(catalog.verify(rule().ruleId, 3, { reviewedBy: "pa-1", reference: "Ley", reason: "Ya verificada" })).rejects.toMatchObject({ code: "STALE_PROPOSAL" });
      await expect(catalog.verify(rule().ruleId, 9, { reviewedBy: "pa-2", reference: "Ley", reason: "No existe" })).rejects.toMatchObject({ code: "STALE_PROPOSAL" });
    });

    it("VERIFIED exige referencia oficial; proponer VERIFIED directamente no se admite", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule(), { recordedBy: "pa-1", reason: "Propuesta" });
      await expect(catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "  ", reason: "Sin referencia" })).rejects.toMatchObject({ code: "RULE_INVALID" });
      await expect(catalog.propose(rule({ validation: "VERIFIED", reference: "Ley" }), meta)).rejects.toMatchObject({ code: "RULE_INVALID" });
    });

    it("rechazar una propuesta: versión REJECTED; en LIVE sigue la última verificada", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule(), { recordedBy: "pa-1", reason: "Propuesta" });
      await catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "Ley", reason: "Verificada" });
      await catalog.propose(rule({ treatment: "NO_FISCAL_DOCUMENT" }), { recordedBy: "pa-1", reason: "Cambio de tratamiento" });
      const live = { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", on: "2026-11-22", mode: "LIVE" as const, missingData: [] };
      expect(decideFiscalIssuance(await catalog.rules(), live)).toMatchObject({ action: "ISSUE", ruleVersion: 3 });
      const rejected = await catalog.reject(rule().ruleId, 4, { reviewedBy: "pa-2", reason: "Sin fuente oficial" });
      expect(rejected).toMatchObject({ version: 5, validation: "REJECTED", treatment: "NO_FISCAL_DOCUMENT", proposedBy: "pa-1", reviewedBy: "pa-2" });
      expect(decideFiscalIssuance(await catalog.rules(), live)).toMatchObject({ action: "ISSUE", ruleVersion: 3 });
      expect(decideFiscalIssuance(await catalog.rules(), { ...live, mode: "SIMULATION" })).toMatchObject({ ruleVersion: 3 });
    });

    it("marcar no determinada es conservador: cualquiera puede, y en LIVE lleva a revisión", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule(), { recordedBy: "pa-1", reason: "Propuesta" });
      await catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "Ley", reason: "Verificada" });
      await expect(catalog.propose(rule({ validation: "UNDETERMINED" }), meta)).resolves.toMatchObject({ version: 4, validation: "UNDETERMINED" });
      const live = { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", on: "2026-11-22", mode: "LIVE" as const, missingData: [] };
      expect(decideFiscalIssuance(await catalog.rules(), live)).toMatchObject({ action: "MANUAL_REVIEW", reason: "RULE_UNDETERMINED" });
    });

    it("una versión exige motivo, autor y vigencia coherente", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await expect(catalog.propose(rule({ validation: "UNDETERMINED" }), { recordedBy: "x", reason: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(catalog.propose(rule({ validation: "UNDETERMINED", validFrom: "2026-02-30" }), meta)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(catalog.propose(rule({ validation: "UNDETERMINED", validFrom: "2026-05-01", validTo: "2026-01-01" }), meta)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(catalog.verify(rule().ruleId, 1, { reviewedBy: "pa-2", reference: "Ley", reason: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });

    it("una vigencia nueva no borra la anterior: cada fecha usa la suya", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      await catalog.propose(rule({ validFrom: "2027-01-01", treatment: "NO_FISCAL_DOCUMENT" }), meta);
      await catalog.verify(rule().ruleId, 2, { reviewedBy: "pa-2", reference: "Norma 2027", reason: "Verificada" });
      const rules = await catalog.rules();
      const q = { country: "DO", organizationType: "ADMINISTRADOR", operationType: "COMUNIDAD", mode: "SIMULATION" as const, missingData: [] };
      expect(decideFiscalIssuance(rules, { ...q, on: "2026-12-31" })).toMatchObject({ action: "ISSUE", ruleVersion: 1 });
      expect(decideFiscalIssuance(rules, { ...q, on: "2027-01-01" })).toMatchObject({ action: "NO_FISCAL_DOCUMENT", ruleVersion: 3 });
    });

    it("dos versiones a la vez de la misma regla: una gana y la otra recibe CONCURRENT_UPDATE", async () => {
      const catalog = createFiscalRuleCatalog({ store: await makeStore() });
      await catalog.seed([rule()], { recordedBy: "system", reason: "carga inicial" });
      const results = await Promise.allSettled([
        catalog.propose(rule({ validation: "UNDETERMINED" }), meta),
        catalog.verify(rule().ruleId, 1, { reviewedBy: "pa-2", reference: "Ley", reason: "Verificada" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONCURRENT_UPDATE" });
      expect(await catalog.history(rule().ruleId)).toHaveLength(2);
    });
  });
}
