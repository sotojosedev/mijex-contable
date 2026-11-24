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
    expect(buildIr17Summary({ period: "202601", isrWithheld: 0n, itbisWithheld: 0n }).dueDate).toBe("2026-02-10");
    expect(() => buildIr17Summary({ period: "2026-11", isrWithheld: 0n, itbisWithheld: 0n })).toThrow();
  });

  // REF-DO-037: fechas del Calendario del Contribuyente 2026 de la DGII.
  it("si el día 10 cae en sábado o domingo, vence el siguiente día laborable (calendario DGII 2026)", () => {
    const due = (period: string) => buildIr17Summary({ period, isrWithheld: 0n, itbisWithheld: 0n }).dueDate;
    expect(due("202512")).toBe("2026-01-12"); // sábado 10 → lunes 12
    expect(due("202604")).toBe("2026-05-11"); // domingo 10 → lunes 11
    expect(due("202609")).toBe("2026-10-12"); // sábado 10 → lunes 12
    expect(due("202612")).toBe("2027-01-11"); // domingo 10 → lunes 11
  });

  it("salta los feriados que se le dan como dato, sin lista fija en el código", () => {
    const base = { period: "202602", isrWithheld: 0n, itbisWithheld: 0n } as const;
    expect(buildIr17Summary(base).dueDate).toBe("2026-03-10");
    expect(buildIr17Summary({ ...base, holidays: ["2026-03-10"] }).dueDate).toBe("2026-03-11");
    // Feriado el lunes siguiente a un fin de semana: sábado 10 → lunes 12 (feriado) → martes 13.
    expect(buildIr17Summary({ period: "202609", isrWithheld: 0n, itbisWithheld: 0n, holidays: ["2026-10-12"] }).dueDate).toBe("2026-10-13");
    expect(() => buildIr17Summary({ ...base, holidays: ["2026-3-10"] })).toThrow(RangeError);
  });

  it("el ITBIS retenido sigue sin formulario ni plazo propios; la nota cita la norma 02-05 art. 10 (REF-DO-039)", () => {
    const { notes } = buildIr17Summary({ period: "202611", isrWithheld: 0n, itbisWithheld: 1n });
    expect(notes.some((n) => n.includes("feriado") && !n.includes("[verificar]"))).toBe(true);
    expect(notes.some((n) => n.includes("ITBIS retenido") && n.includes("[verificar]") && n.includes("02-05"))).toBe(true);
  });
});
