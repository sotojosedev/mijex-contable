import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLedger } from "../../src/core/ledger.js";
import { MIJEX_EVENTS } from "../../src/frameworks/events.js";
import { DO_NIIF_PYMES, ensureFramework, ES_PGC_PYMES, frameworkForCountry, installFramework, MIJEX_FRAMEWORKS, ruleInputs, type FrameworkData } from "../../src/frameworks/mijex.js";
import { createMemoryLedgerStore } from "../../src/testing/memory-store.js";

// Spec 001 · fase 1b: marcos de MIJEX como datos (R-ES-101…, R-DO-101…).

/** Cuadro de cuentas oficial del PGC PYMES (extraído del BOE: docs/referencias/es/pgc-pymes-cuadro-de-cuentas.txt). */
const PGC_PYMES = new Map(
  readFileSync(new URL("../../docs/referencias/es/pgc-pymes-cuadro-de-cuentas.txt", import.meta.url), "utf8")
    .split("\n").filter((l) => /^\d/.test(l)).map((l) => l.split("|") as [string, string]),
);

// Importes de ejemplo que cuadran por evento (en céntimos).
const SAMPLE: Record<string, Record<string, bigint>> = {
  PaymentVerified: { bank: 100_000n, gateway: 18_000n, cash: 0n, creditApplied: 2_000n, total: 120_000n },
  ServiceSettledAgent: { gross: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianPayable: 100_300n, technicianCash: 0n },
  ServiceSettledEmployee: { gross: 118_000n, labor: 100_000n, tax: 18_000n, bonus: 5_000n },
  PayoutApproved: { total: 4_700n, commissionTax: 2_700n, isr: 0n, itbis: 0n, clientWithheld: 2_000n },
  TechnicianPaid: { amount: 95_600n },
  CashDebtSettled: { byBank: 1_000n, byPayout: 500n, total: 1_500n },
  CashDebtIncreased: { total: 300n, byBank: 0n, byPayout: 300n },
  RefundCompleted: { total: 10_000n, bank: 4_000n, gateway: 6_000n },
  ClientCreditReceived: { amount: 2_000n },
  ClientCreditRefunded: { amount: 500n },
  OrgStatementCreditApplied: { amount: 1_000n },
  OrgStatementPaid: { bank: 50_000n, gateway: 0n, cash: 0n, total: 50_000n },
  MaterialsSold: { gross: 11_800n, base: 10_000n, tax: 1_800n },
  PurchaseInvoiced: { subtotal: 10_000n, tax: 1_800n, total: 11_800n },
  PurchasePaid: { amount: 11_800n },
};

async function ledgerWith(fw: FrameworkData) {
  const ledger = createLedger({ store: createMemoryLedgerStore() });
  await installFramework(ledger, fw, { approvedBy: "usuario (REF-DEC-006)" });
  const entity = await ledger.registerEntity({ kind: "PLATFORM", country: fw.country, currency: fw.country === "ES" ? "EUR" : "DOP", framework: fw.framework, external: { system: "hs", ref: `platform-${fw.country}` }, name: `MIJEX ${fw.country}` });
  return { ledger, entity };
}

describe("[R-ES-1xx] España: cuentas del PGC PYMES (BOE-A-2007-19966)", () => {
  it("cada cuenta es una cuenta oficial o una subcuenta de ella (art. 3.1: numeración no vinculante)", () => {
    for (const acc of ES_PGC_PYMES.accounts) {
      expect(acc.official, acc.code).toBeDefined();
      expect(PGC_PYMES.has(acc.official ?? ""), `${acc.code} → ${acc.official ?? ""}`).toBe(true);
      expect(acc.code.startsWith(acc.official ?? "x"), acc.code).toBe(true);
    }
  });

  it("si el código es oficial, el nombre es el oficial literal", () => {
    for (const acc of ES_PGC_PYMES.accounts) {
      const official = PGC_PYMES.get(acc.code);
      if (official !== undefined) expect(acc.name, acc.code).toBe(official);
    }
    // Y la subcuenta propia lleva el nombre oficial de su cuenta de 3 dígitos cuando no la desarrolla.
    expect(PGC_PYMES.get("572")).toBe(ES_PGC_PYMES.accounts.find((x) => x.code === "5720")?.name);
  });
});

describe("marcos de MIJEX como datos", () => {
  it("cada evento tiene regla en cada marco; solo faltan en ES las retenciones que MIJEX no practica allí", () => {
    for (const fw of MIJEX_FRAMEWORKS) {
      const roles = new Set(fw.accounts.map((x) => x.role));
      const missing = new Set(MIJEX_EVENTS.flatMap((e) => e.lines.map((l) => l.role)).filter((r) => !roles.has(r)));
      expect([...missing].sort(), fw.framework).toEqual(fw.country === "ES" ? ["ISR_WITHHELD", "ITBIS_WITHHELD"] : []);
      expect(ruleInputs(fw).map((r) => r.ruleId)).toEqual(MIJEX_EVENTS.map((_, i) => `${fw.rulePrefix}${String(i + 1).padStart(2, "0")}`));
      expect(new Set(fw.accounts.map((x) => x.code)).size).toBe(fw.accounts.length);
    }
  });

  for (const fw of MIJEX_FRAMEWORKS) {
    it(`${fw.framework}: todos los eventos cuadran y el balance de comprobación también`, async () => {
      const { ledger, entity } = await ledgerWith(fw);
      for (const [i, event] of MIJEX_EVENTS.entries()) {
        const { entry } = await ledger.post({ entityId: entity.id, type: event.type, source: { system: "hs", id: `s${String(i)}` }, name: "n", occurredOn: "2026-11-10", currency: entity.currency, amounts: SAMPLE[event.type] ?? {} });
        expect(entry.lines.length, event.type).toBeGreaterThan(1);
      }
      const tb = await ledger.trialBalance(entity.id, { to: "2026-12-31" });
      expect(tb.totalDebit).toBe(tb.totalCredit);
    });
  }

  it("[R-ES-102][R-DO-102] como agente, el ingreso de MIJEX es solo la comisión; lo del técnico es deuda (ICAC 2021 art. 26.4; NIIF PYMES sección 23)", async () => {
    for (const fw of MIJEX_FRAMEWORKS) {
      const { ledger, entity } = await ledgerWith(fw);
      await ledger.post({ entityId: entity.id, type: "ServiceSettledAgent", source: { system: "hs", id: "e1" }, name: "accrued_agent", occurredOn: "2026-11-10", currency: entity.currency, amounts: SAMPLE.ServiceSettledAgent ?? {} });
      const tb = await ledger.trialBalance(entity.id, { to: "2026-12-31" });
      const revenue = tb.rows.filter((r) => r.type === "REVENUE").reduce((s, r) => s + r.balance, 0n);
      expect(revenue, fw.framework).toBe(15_000n);
      const apTechs = fw.accounts.find((x) => x.role === "AP_TECHS")?.code;
      expect(tb.rows.find((r) => r.account === apTechs)?.balance).toBe(100_300n);
    }
  });

  it("[R-ES-104] en España una retención de ISR o ITBIS no tiene cuenta: el asiento no cuadra y se rechaza", async () => {
    const { ledger, entity } = await ledgerWith(ES_PGC_PYMES);
    await expect(ledger.post({ entityId: entity.id, type: "PayoutApproved", source: { system: "hs", id: "p1" }, name: "approved", occurredOn: "2026-11-10", currency: "EUR", amounts: { total: 5_000n, commissionTax: 2_700n, isr: 300n, itbis: 0n, clientWithheld: 2_000n } })).rejects.toMatchObject({ code: "UNBALANCED" });
  });

  it("[R-DO-104] en RD la liquidación aprobada lleva ISR (IR-17) e ITBIS retenido a sus cuentas", async () => {
    const { ledger, entity } = await ledgerWith(DO_NIIF_PYMES);
    const { entry } = await ledger.post({ entityId: entity.id, type: "PayoutApproved", source: { system: "hs", id: "p1" }, name: "approved", occurredOn: "2026-11-10", currency: "DOP", amounts: { total: 33_700n, commissionTax: 2_700n, isr: 3_000n, itbis: 18_000n, clientWithheld: 10_000n } });
    expect(entry.lines.map((l) => [l.account, l.debit, l.credit])).toEqual([["2110", 33_700n, 0n], ["2120", 0n, 2_700n], ["2130", 0n, 3_000n], ["2140", 0n, 18_000n], ["2150", 0n, 10_000n]]);
  });
});

describe("arranque de las apps", () => {
  it("ensureFramework instala una vez y luego informa de que ya está; el marco sale del país", async () => {
    const ledger = createLedger({ store: createMemoryLedgerStore() });
    expect(await ensureFramework(ledger, DO_NIIF_PYMES, { approvedBy: "u" })).toBe("INSTALLED");
    expect(await ensureFramework(ledger, DO_NIIF_PYMES, { approvedBy: "u" })).toBe("PRESENT");
    expect(frameworkForCountry("ES")?.framework).toBe("ES-PGC-PYMES");
    expect(frameworkForCountry("XX")).toBeUndefined();
  });

  it("entryBySource encuentra el asiento de un hecho", async () => {
    const { ledger, entity } = await ledgerWith(DO_NIIF_PYMES);
    const { entry } = await ledger.post({ entityId: entity.id, type: "TechnicianPaid", source: { system: "hs", id: "x" }, name: "paid", occurredOn: "2026-11-10", currency: "DOP", amounts: { amount: 1n } });
    expect((await ledger.entryBySource(entity.id, { system: "hs", id: "x" }, "paid"))?.id).toBe(entry.id);
    expect(await ledger.entryBySource(entity.id, { system: "hs", id: "y" }, "paid")).toBeUndefined();
  });
});

describe("cuenta de resultados con los marcos de MIJEX", () => {
  it("contra-ingreso, coste de ventas (dato del plan) y gastos de explotación", async () => {
    for (const fw of MIJEX_FRAMEWORKS) {
      const { ledger, entity } = await ledgerWith(fw);
      const post = (type: string, id: string, amounts: Record<string, bigint>) => ledger.post({ entityId: entity.id, type, source: { system: "hs", id }, name: "n", occurredOn: "2026-11-10", currency: entity.currency, amounts });
      await post("ServiceSettledEmployee", "s1", { gross: 118_000n, labor: 100_000n, tax: 18_000n, bonus: 5_000n });
      await post("MaterialsSold", "m1", { gross: 11_800n, base: 10_000n, tax: 1_800n });
      await post("PurchaseInvoiced", "c1", { subtotal: 6_000n, tax: 1_080n, total: 7_080n });
      const pl = await ledger.incomeStatement(entity.id, { from: "2026-11-01", to: "2026-11-30" });
      expect({ gross: pl.grossRevenue, net: pl.netRevenue, cos: pl.costOfSales.map((l) => l.amount).sort(), profit: pl.grossProfit, net2: pl.netIncome }, fw.framework)
        .toEqual({ gross: 110_000n, net: 110_000n, cos: [5_000n, 6_000n].sort(), profit: 99_000n, net2: 99_000n });
      expect((await ledger.balanceSheet(entity.id, { at: "2026-11-30" })).balanced).toBe(true);
    }
  });
});
