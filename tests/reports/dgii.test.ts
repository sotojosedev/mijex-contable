import { describe, expect, it } from "vitest";
import { buildDgii606, buildDgii607, buildDgii608, includeIn607, type Dgii606Row, type Dgii607Row } from "../../src/reports/do/dgii.js";

// R-DO-201…204 · Formatos de envío de la DGII (Norma General 07-2018, anexos A, B y C; NG 10-2018;
// plantillas oficiales 606 v2025, 607 v2023.1.1, 608 v2018.2.1). Ver docs/referencias/do/dgii-formatos-606-607-608.md.

const purchase: Dgii606Row = {
  taxId: "101010632", purchaseType: "09", ncf: "B0100000123", modifiedNcf: "", issuedOn: "2026-10-05", paidOn: "2026-10-20",
  services: 0n, goods: 1_000_000n, itbisBilled: 180_000n, itbisWithheld: 0n, itbisProportional: 0n, itbisToCost: 0n,
  isrRetentionType: "", isrWithheld: 0n, selectiveTax: 0n, otherTaxes: 0n, legalTip: 0n, paymentMethod: "02",
};

const sale: Dgii607Row = {
  taxId: "131880738", ncf: "E310000000001", modifiedNcf: "", incomeType: "01", issuedOn: "2026-10-05", withheldOn: "",
  billed: 1_000_000n, itbisBilled: 180_000n, itbisWithheldByThirdParty: 0n, isrWithheldByThirdParty: 0n, selectiveTax: 0n, otherTaxes: 0n, legalTip: 0n,
  payments: { cash: 0n, transfer: 1_180_000n, card: 0n, credit: 0n, giftCards: 0n, barter: 0n, other: 0n },
};

describe("[R-DO-201] 606 — compras (Anexo A, plantilla 2025)", () => {
  it("cabecera y 23 campos en el orden oficial, delimitados por «|», con importes exactos y campos calculados", () => {
    const f = buildDgii606({ rnc: "131880738", period: "202610", rows: [purchase] });
    expect(f.errors).toEqual([]);
    expect(f.fileName).toBe("DGII_F_606_131880738_202610.TXT");
    expect(f.lines[0]).toEqual(["101010632", "1", "09", "B0100000123", "", "20261005", "20261020", "0.00", "10000.00", "10000.00", "1800.00", "0.00", "0.00", "0.00", "1800.00", "", "", "0.00", "", "0.00", "0.00", "0.00", "02"]);
    expect(f.txt.split("\r\n")[0]).toBe("606|131880738|202610|1");
    expect(f.lines[0]).toHaveLength(23);
  });

  it("valida códigos oficiales, identificación, fechas y la retención (09 de la plantilla 2025 es válido)", () => {
    const bad = buildDgii606({ rnc: "13188073", period: "202613", rows: [{ ...purchase, purchaseType: "12", paymentMethod: "08", taxId: "12", issuedOn: "2026-02-30", isrWithheld: 100n }] });
    expect(bad.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("RNC del remitente"), expect.stringContaining("periodo"), expect.stringContaining("tipo de bienes y servicios"),
      expect.stringContaining("forma de pago"), expect.stringContaining("RNC o cédula"), expect.stringContaining("fecha"), expect.stringContaining("tipo de retención"),
    ]));
    expect(buildDgii606({ rnc: "131880738", period: "202610", rows: [{ ...purchase, isrRetentionType: "09", isrWithheld: 100n, services: 1_000n }] }).errors).toEqual([]);
  });
});

describe("[R-DO-202] 607 — ventas (Anexo B; instructivo 12/2025)", () => {
  it("23 campos en el orden oficial; las formas de cobro suman el total con impuestos", () => {
    const f = buildDgii607({ rnc: "131880738", period: "202610", rows: [sale] });
    expect(f.errors).toEqual([]);
    expect(f.lines[0]).toEqual(["131880738", "1", "E310000000001", "", "01", "20261005", "", "10000.00", "1800.00", "0.00", "", "0.00", "", "0.00", "0.00", "0.00", "0.00", "11800.00", "0.00", "0.00", "0.00", "0.00", "0.00"]);
    expect(buildDgii607({ rnc: "131880738", period: "202610", rows: [{ ...sale, payments: { ...sale.payments, transfer: 1_000_000n } }] }).errors).toEqual([expect.stringContaining("formas de cobro")]);
  });

  it("una retención exige su fecha", () => {
    const f = buildDgii607({ rnc: "131880738", period: "202610", rows: [{ ...sale, isrWithheldByThirdParty: 2_000n }] });
    expect(f.errors).toEqual([expect.stringContaining("fecha de retención")]);
  });

  it("[R-DO-203] NG 10-2018: el consumo solo va al detalle desde RD$250.000; crédito fiscal y especiales, siempre", () => {
    expect(includeIn607("E32", 24_999_999n)).toBe(false);
    expect(includeIn607("E32", 25_000_000n)).toBe(true);
    expect(includeIn607("B02", 30_000_000n)).toBe(true);
    expect(includeIn607("E31", 100n)).toBe(true);
    expect(includeIn607("E34", 100n)).toBe(true);
  });
});

describe("[R-DO-204] 608 — anulados (Anexo C, plantilla 2018.2.1)", () => {
  it("3 campos: comprobante, fecha de la anulación y tipo (tabla oficial 01–10)", () => {
    const f = buildDgii608({ rnc: "131880738", period: "202610", rows: [{ ncf: "E310000000009", annulledOn: "2026-10-12", type: "04" }] });
    expect(f.errors).toEqual([]);
    expect(f.txt).toBe("608|131880738|202610|1\r\nE310000000009|20261012|04\r\n");
    expect(buildDgii608({ rnc: "131880738", period: "202610", rows: [{ ncf: "E31", annulledOn: "2026-10-12", type: "11" }] }).errors).toEqual(expect.arrayContaining([expect.stringContaining("tipo de anulación")]));
  });

  it("sin operaciones: cabecera con cero registros (art. 8, párr. II)", () => {
    expect(buildDgii608({ rnc: "131880738", period: "202610", rows: [] }).txt).toBe("608|131880738|202610|0\r\n");
  });
});
