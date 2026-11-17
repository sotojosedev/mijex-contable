import { beforeEach, describe, expect, it } from "vitest";
import { createLedger, type Ledger } from "../../src/core/ledger.js";
import type { LedgerStore } from "../../src/core/ports.js";
import type { BusinessEvent, LedgerEntity } from "../../src/core/types.js";

// Contrato del motor contable (spec 001), común a todos los almacenes. Plan y reglas FICTICIOS de
// prueba (marco "TEST"): el motor no conoce datos legales; los planes oficiales son datos aparte.

interface ContractEnv {
  readonly store: LedgerStore;
}

const ACCOUNTS = [
  { code: "1110", name: "Banco", type: "ASSET", normalSide: "DEBIT" },
  { code: "2150", name: "Fondos de clientes", type: "LIABILITY", normalSide: "CREDIT" },
  { code: "2120", name: "Impuesto repercutido", type: "LIABILITY", normalSide: "CREDIT" },
  { code: "4110", name: "Comisiones", type: "REVENUE", normalSide: "CREDIT" },
] as const;

export function ledgerContract(name: string, makeEnv: () => Promise<ContractEnv>): void {
  describe(`motor contable (${name})`, () => {
    let ledger: Ledger;
    let entity: LedgerEntity;
    let now = new Date("2026-11-17T10:00:00Z");

    const event = (overrides: Partial<BusinessEvent> = {}): BusinessEvent => ({
      entityId: entity.id,
      type: "ServiceSettled",
      source: { system: "hs", id: "earning-1" },
      name: "settled",
      occurredOn: "2026-11-10",
      currency: "DOP",
      amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n },
      ...overrides,
    });

    beforeEach(async () => {
      const env = await makeEnv();
      now = new Date("2026-11-17T10:00:00Z");
      ledger = createLedger({ store: env.store, clock: { now: () => now } });
      entity = await ledger.registerEntity({ kind: "PLATFORM", country: "DO", currency: "DOP", framework: "TEST", external: { system: "hs", ref: "platform-DO" }, name: "MIJEX DO" });
      const chart = await ledger.registerChart({ framework: "TEST", version: "1", validFrom: "2026-01-01", referenceIds: ["REF-TEST"], accounts: ACCOUNTS });
      await ledger.approveChart(chart.id, { actor: "contador" });
      await ledger.registerRule({
        framework: "TEST", eventType: "ServiceSettled", version: "1", validFrom: "2026-01-01", ruleId: "R-TEST-001", referenceIds: [],
        lines: [
          { side: "DEBIT", account: "2150", amount: "collected" },
          { side: "CREDIT", account: "4110", amount: "commission" },
          { side: "CREDIT", account: "2120", amount: "commissionTax" },
          { side: "CREDIT", account: "2150", amount: "technicianShare" },
        ],
      });
    });

    describe("[R-CORE-002] cada asiento cuadra", () => {
      it("un asiento cuadrado se registra con sus líneas en bigint", async () => {
        const { entry, created } = await ledger.post(event({ amounts: { collected: 17_700n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 0n } }));
        expect(created).toBe(true);
        // La línea a cero no se guarda.
        expect(entry.lines).toEqual([
          { account: "2150", debit: 17_700n, credit: 0n },
          { account: "4110", debit: 0n, credit: 15_000n },
          { account: "2120", debit: 0n, credit: 2_700n },
        ]);
        expect(entry).toMatchObject({ entityId: entity.id, entryDate: "2026-11-10", currency: "DOP", eventType: "ServiceSettled", name: "settled" });
      });

      it("un evento que no cuadra se rechaza y no deja nada", async () => {
        await expect(ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 1n } }))).rejects.toMatchObject({ code: "UNBALANCED" });
        expect(await ledger.entries(entity.id, {})).toEqual([]);
      });

      it("importes negativos, ausentes o moneda distinta se rechazan", async () => {
        await expect(ledger.post(event({ amounts: { collected: -1n, commission: 0n, commissionTax: 0n, technicianShare: -1n } }))).rejects.toMatchObject({ code: "AMOUNT_INVALID" });
        await expect(ledger.post(event({ amounts: { collected: 100n, commission: 100n, commissionTax: 0n } }))).rejects.toMatchObject({ code: "AMOUNT_INVALID" });
        await expect(ledger.post(event({ currency: "USD", amounts: { collected: 100n, commission: 100n, commissionTax: 0n, technicianShare: 0n } }))).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
        await expect(ledger.post(event({ amounts: { collected: 0n, commission: 0n, commissionTax: 0n, technicianShare: 0n } }))).rejects.toMatchObject({ code: "EMPTY_ENTRY" });
      });
    });

    describe("[R-CORE-004] un hecho, un asiento", () => {
      it("repetir el mismo evento devuelve el mismo asiento sin duplicar", async () => {
        const amounts = { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n };
        const first = await ledger.post(event({ amounts }));
        const again = await ledger.post(event({ amounts }));
        expect(again).toEqual({ entry: first.entry, created: false });
        expect(await ledger.entries(entity.id, {})).toHaveLength(1);
      });

      it("el mismo evento con otros importes es un conflicto, no un asiento nuevo", async () => {
        await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        await expect(ledger.post(event({ amounts: { collected: 100n, commission: 100n, commissionTax: 0n, technicianShare: 0n } }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
      });
    });

    describe("[R-CORE-003] el mayor solo crece: se corrige con reversión motivada", () => {
      it("revertir crea el asiento inverso enlazado, con actor y motivo, y el saldo vuelve a cero", async () => {
        const { entry } = await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        now = new Date("2026-11-18T09:00:00Z");
        const reversal = await ledger.reverse(entry.id, { actor: "admin-1", reason: "Servicio anulado", on: "2026-11-18" });
        expect(reversal).toMatchObject({ reversalOf: entry.id, actor: "admin-1", reason: "Servicio anulado", entryDate: "2026-11-18" });
        expect(reversal.lines).toEqual(entry.lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit })));
        const tb = await ledger.trialBalance(entity.id, { to: "2026-12-31" });
        expect(tb.rows.every((r) => r.balance === 0n)).toBe(true);
        // El original sigue intacto.
        expect((await ledger.entries(entity.id, {})).map((e) => e.id)).toEqual([reversal.id, entry.id]);
      });

      it("no se revierte dos veces, ni una reversión, ni sin motivo", async () => {
        const { entry } = await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        await expect(ledger.reverse(entry.id, { actor: "admin-1", reason: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
        const reversal = await ledger.reverse(entry.id, { actor: "admin-1", reason: "Error de importe" });
        await expect(ledger.reverse(entry.id, { actor: "admin-1", reason: "Otra vez" })).rejects.toMatchObject({ code: "ALREADY_REVERSED" });
        await expect(ledger.reverse(reversal.id, { actor: "admin-1", reason: "Deshacer" })).rejects.toMatchObject({ code: "CANNOT_REVERSE_REVERSAL" });
        await expect(ledger.reverse("no-existe", { actor: "a", reason: "Motivo" })).rejects.toMatchObject({ code: "ENTRY_NOT_FOUND" });
      });
    });

    describe("[R-CORE-005] plan y reglas son datos con vigencia", () => {
      it("usa la regla vigente en la fecha del hecho", async () => {
        await ledger.registerRule({
          framework: "TEST", eventType: "ServiceSettled", version: "2", validFrom: "2026-12-01", ruleId: "R-TEST-002", referenceIds: [],
          lines: [
            { side: "DEBIT", account: "1110", amount: "collected" },
            { side: "CREDIT", account: "4110", amount: "collected" },
          ],
        });
        const amounts = { collected: 100n, commission: 100n, commissionTax: 0n, technicianShare: 0n };
        const before = await ledger.post(event({ occurredOn: "2026-11-30", source: { system: "hs", id: "a" }, amounts }));
        const after = await ledger.post(event({ occurredOn: "2026-12-01", source: { system: "hs", id: "b" }, amounts }));
        expect(before.entry.lines.map((l) => l.account)).toEqual(["2150", "4110"]);
        expect(after.entry.lines.map((l) => l.account)).toEqual(["1110", "4110"]);
      });

      it("una versión nueva cierra la vigencia de la abierta en su inicio; no se puede empezar antes ni igual", async () => {
        await expect(ledger.registerRule({ framework: "TEST", eventType: "ServiceSettled", version: "0", validFrom: "2026-01-01", ruleId: "R-TEST-005", referenceIds: [], lines: [{ side: "DEBIT", account: "1110", amount: "x" }, { side: "CREDIT", account: "4110", amount: "x" }] })).rejects.toMatchObject({ code: "VALIDITY_OVERLAP" });
      });

      it("las vigencias de un mismo marco y evento no se solapan", async () => {
        await ledger.registerRule({ framework: "TEST", eventType: "ServiceSettled", version: "3", validFrom: "2027-01-01", validTo: "2027-06-01", ruleId: "R-TEST-006", referenceIds: [], lines: [{ side: "DEBIT", account: "1110", amount: "x" }, { side: "CREDIT", account: "4110", amount: "x" }] });
        await expect(ledger.registerRule({ framework: "TEST", eventType: "ServiceSettled", version: "1b", validFrom: "2027-03-01", ruleId: "R-TEST-003", referenceIds: [], lines: [{ side: "DEBIT", account: "1110", amount: "x" }, { side: "CREDIT", account: "4110", amount: "x" }] })).rejects.toMatchObject({ code: "VALIDITY_OVERLAP" });
      });

      it("sin plan aprobado vigente, sin regla o con una cuenta que no está en el plan, no hay asiento", async () => {
        await expect(ledger.post(event({ occurredOn: "2025-12-31" }))).rejects.toMatchObject({ code: "CHART_NOT_FOUND" });
        await expect(ledger.post(event({ type: "Desconocido" }))).rejects.toMatchObject({ code: "RULE_NOT_FOUND" });
        await ledger.registerRule({ framework: "TEST", eventType: "Raro", version: "1", validFrom: "2026-01-01", ruleId: "R-TEST-004", referenceIds: [], lines: [{ side: "DEBIT", account: "9999", amount: "x" }, { side: "CREDIT", account: "4110", amount: "x" }] });
        await expect(ledger.post(event({ type: "Raro", amounts: { x: 1n } }))).rejects.toMatchObject({ code: "ACCOUNT_UNKNOWN" });
        const other = await ledger.registerEntity({ kind: "ORGANIZATION", country: "ES", currency: "EUR", framework: "OTRO", external: { system: "property", ref: "org-1" }, name: "Gestora" });
        await expect(ledger.post(event({ entityId: other.id, currency: "EUR" }))).rejects.toMatchObject({ code: "CHART_NOT_FOUND" });
      });

      it("un plan en borrador no rige; al aprobarlo, cierra la vigencia del anterior en su inicio", async () => {
        const amounts = { collected: 100n, commission: 100n, commissionTax: 0n, technicianShare: 0n };
        const v1 = (await ledger.post(event({ occurredOn: "2027-01-05", source: { system: "hs", id: "x1" }, amounts }))).entry.chartId;
        const draft = await ledger.registerChart({ framework: "TEST", version: "2", validFrom: "2027-01-01", referenceIds: [], accounts: ACCOUNTS });
        expect(draft.status).toBe("DRAFT");
        expect((await ledger.post(event({ occurredOn: "2027-01-06", source: { system: "hs", id: "x2" }, amounts }))).entry.chartId).toBe(v1);
        await ledger.approveChart(draft.id, { actor: "contador" });
        expect((await ledger.post(event({ occurredOn: "2027-01-07", source: { system: "hs", id: "x3" }, amounts }))).entry.chartId).toBe(draft.id);
        expect((await ledger.post(event({ occurredOn: "2026-12-31", source: { system: "hs", id: "x4" }, amounts }))).entry.chartId).toBe(v1);
      });

      it("un plan con códigos repetidos se rechaza", async () => {
        await expect(ledger.registerChart({ framework: "TEST", version: "x", validFrom: "2030-01-01", referenceIds: [], accounts: [ACCOUNTS[0], ACCOUNTS[0]] })).rejects.toMatchObject({ code: "CHART_INVALID" });
      });
    });

    describe("diario paginado", () => {
      it("del más reciente al más antiguo, con total y filtro por tipo de origen", async () => {
        const amounts = { collected: 100n, commission: 100n, commissionTax: 0n, technicianShare: 0n };
        await ledger.post(event({ occurredOn: "2026-11-01", source: { system: "hs", id: "Payment:1" }, amounts }));
        await ledger.post(event({ occurredOn: "2026-11-03", source: { system: "hs", id: "Payout:2" }, amounts }));
        await ledger.post(event({ occurredOn: "2026-11-02", source: { system: "hs", id: "Payment:3" }, amounts }));
        expect((await ledger.entries(entity.id, {})).map((e) => e.entryDate)).toEqual(["2026-11-03", "2026-11-02", "2026-11-01"]);
        expect((await ledger.entries(entity.id, { sourcePrefix: "Payment", limit: 1, offset: 1 })).map((e) => e.source.id)).toEqual(["Payment:1"]);
        expect(await ledger.countEntries(entity.id, { sourcePrefix: "Payment" })).toBe(2);
        expect(await ledger.countEntries(entity.id, { from: "2026-11-02", to: "2026-11-02" })).toBe(1);
      });
    });

    describe("cuenta de resultados y balance de situación (bigint)", () => {
      it("el ingreso del periodo, el balance cuadrado y el resultado no cerrado en el patrimonio", async () => {
        await ledger.post(event({ occurredOn: "2026-10-31", source: { system: "hs", id: "oct" }, amounts: { collected: 59_000n, commission: 7_500n, commissionTax: 1_350n, technicianShare: 50_150n } }));
        await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        const pl = await ledger.incomeStatement(entity.id, { from: "2026-11-01", to: "2026-11-30" });
        expect(pl).toMatchObject({ grossRevenue: 15_000n, netRevenue: 15_000n, grossProfit: 15_000n, netIncome: 15_000n });
        expect(pl.revenue).toEqual([{ account: "4110", name: "Comisiones", amount: 15_000n }]);
        const bs = await ledger.balanceSheet(entity.id, { at: "2026-11-30" });
        expect(bs).toMatchObject({ currentEarnings: 22_500n, balanced: true });
        expect(bs.totalAssets).toBe(bs.totalLiabilities + bs.totalEquity);
        await expect(ledger.incomeStatement(entity.id, { from: "2026-12-01", to: "2026-11-01" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      });
    });

    describe("entidades multiempresa (Clarify Q1)", () => {
      it("una entidad por (sistema, ref): registrarla otra vez devuelve la misma", async () => {
        const again = await ledger.registerEntity({ kind: "PLATFORM", country: "DO", currency: "DOP", framework: "TEST", external: { system: "hs", ref: "platform-DO" }, name: "MIJEX DO" });
        expect(again.id).toBe(entity.id);
      });

      it("los libros de cada entidad están aislados", async () => {
        const other = await ledger.registerEntity({ kind: "ORGANIZATION", country: "DO", currency: "DOP", framework: "TEST", external: { system: "property", ref: "org-9" }, name: "Gestora RD" });
        await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        expect(await ledger.entries(other.id, {})).toEqual([]);
        expect((await ledger.trialBalance(other.id, { to: "2026-12-31" })).rows).toEqual([]);
      });
    });

    describe("balance de comprobación", () => {
      it("cuadra y da el saldo en el lado normal de cada cuenta", async () => {
        await ledger.post(event({ amounts: { collected: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianShare: 100_300n } }));
        const tb = await ledger.trialBalance(entity.id, { to: "2026-12-31" });
        expect(tb.totalDebit).toBe(tb.totalCredit);
        expect(tb.rows.find((r) => r.account === "4110")).toMatchObject({ name: "Comisiones", type: "REVENUE", credit: 15_000n, balance: 15_000n });
        // 2150 (lado normal haber): debe 118.000 − haber 100.300 → saldo deudor de 17.700, en negativo.
        expect(tb.rows.find((r) => r.account === "2150")?.balance).toBe(-17_700n);
        expect((await ledger.trialBalance(entity.id, { to: "2026-11-09" })).rows).toEqual([]);
      });
    });
  });
}
