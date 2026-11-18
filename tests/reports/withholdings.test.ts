import { describe, expect, it } from "vitest";
import { createLedger } from "../../src/core/ledger.js";
import { DO_NIIF_PYMES, installFramework } from "../../src/frameworks/mijex.js";
import { createMemoryLedgerStore } from "../../src/testing/memory-store.js";
import { buildIr17Summary, withholdingsOfPeriod } from "../../src/reports/do/withholdings.js";

async function doLedger() {
  const ledger = createLedger({ store: createMemoryLedgerStore() });
  await installFramework(ledger, DO_NIIF_PYMES, { approvedBy: "usuario (REF-DEC-006)" });
  const entity = await ledger.registerEntity({ kind: "PLATFORM", country: "DO", currency: "DOP", framework: DO_NIIF_PYMES.framework, external: { system: "hs", ref: "platform-DO" }, name: "MIJEX DO" });
  return { ledger, entity };
}
const approved = (isr: bigint, itbis: bigint) => ({ total: 2_700n + isr + itbis, commissionTax: 2_700n, isr, itbis, clientWithheld: 0n });

describe("[R-DO-206] IR-17: retenciones de ISR del mes, a más tardar el día 10 del mes siguiente (REF-DO-006)", () => {
  it("suma el movimiento neto del mes en las cuentas de retención (las reversiones restan; otros meses no cuentan)", async () => {
    const { ledger, entity } = await doLedger();
    const post = (id: string, on: string, amounts: Record<string, bigint>) => ledger.post({ entityId: entity.id, type: "PayoutApproved", source: { system: "hs", id }, name: "approved", occurredOn: on, currency: "DOP", amounts });
    await post("p0", "2026-10-31", approved(9_999n, 0n));
    const { entry } = await post("p1", "2026-11-05", approved(3_000n, 18_000n));
    await post("p2", "2026-11-20", approved(1_500n, 0n));
    await ledger.reverse(entry.id, { actor: "admin", reason: "liquidación rechazada", on: "2026-11-25" });
    await ledger.post({ entityId: entity.id, type: "PurchaseInvoiced", source: { system: "hs", id: "e41" }, name: "invoiced", occurredOn: "2026-11-26", currency: "DOP", amounts: { subtotal: 100_000n, tax: 18_000n, total: 100_000n, itbisWithheld: 18_000n } });
    await post("p3", "2026-12-01", approved(7_000n, 0n));

    expect(await withholdingsOfPeriod(ledger, entity.id, { isr: "2130", itbis: "2140" }, "202611")).toEqual({ isr: 1_500n, itbis: 18_000n });
  });

  it("vence el día 10 del mes siguiente (también de diciembre a enero); el ITBIS retenido se informa sin inventar su plazo", () => {
    expect(buildIr17Summary({ period: "202611", isrWithheld: 1_500n, itbisWithheld: 18_000n })).toEqual({
      period: "202611", isrWithheld: 1_500n, dueDate: "2026-12-10", itbisWithheld: 18_000n,
      notes: [expect.stringContaining("IR-17"), expect.stringContaining("[verificar]")],
    });
    expect(buildIr17Summary({ period: "202612", isrWithheld: 0n, itbisWithheld: 0n }).dueDate).toBe("2027-01-10");
    expect(() => buildIr17Summary({ period: "2026-11", isrWithheld: 0n, itbisWithheld: 0n })).toThrow();
  });
});
