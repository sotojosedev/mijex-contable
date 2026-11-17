import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseBankStatementCsv } from "../../src/reconciliation/statement.js";

// Spec 002 · R-CORE-006: lectura exacta del extracto (unión de los lectores de HS y Property).
describe("[R-CORE-006] lectura del extracto bancario", () => {
  it("formato español con «;», debe/haber y miles con punto: importes exactos en bigint", () => {
    const csv = "﻿Fecha;Concepto;Debe;Haber;Referencia\n01/10/2026;Transferencia recibida;;1.234,56;F-001\n02/10/2026;Comisión;\"0,10\";;\n03/10/2026;Ajuste;0,20;;";
    const r = parseBankStatementCsv(csv, { accountId: "acc-1" });
    expect(r.errors).toEqual([]);
    expect(r.movements.map((m) => [m.bookedOn, m.amount, m.description, m.reference])).toEqual([
      ["2026-10-01", 123_456n, "Transferencia recibida", "F-001"],
      ["2026-10-02", -10n, "Comisión", null],
      ["2026-10-03", -20n, "Ajuste", null],
    ]);
    // 0,1 + 0,2 sin error binario.
    expect((r.movements[1]?.amount ?? 0n) + (r.movements[2]?.amount ?? 0n)).toBe(-30n);
  });

  it("formato de RD de HS: «,», importe con signo o entre paréntesis, cabeceras retiro/depósito/documento", () => {
    const a = parseBankStatementCsv("Fecha,Descripción,Monto,Documento\n2026-10-05,Pago cliente,\"1,180.00\",REF-9\n2026-10-06,Cargo,(50.00),", { accountId: "b" });
    expect(a.movements.map((m) => [m.amount, m.reference])).toEqual([[118_000n, "REF-9"], [-5_000n, null]]);
    const b = parseBankStatementCsv("Fecha Transaccion,Detalle,Retiro,Deposito\n07/10/2026,Depósito,,500.5\n08/10/2026,Retiro,25,", { accountId: "b" });
    expect(b.movements.map((m) => m.amount)).toEqual([50_050n, -2_500n]);
  });

  it("tabulador, años de dos dígitos, contraparte y cabeceras sin acentos", () => {
    const r = parseBankStatementCsv("fecha\tdescripcion\timporte\tordenante\n09/10/26\tAlquiler\t-1.000,00\tJuan Pérez", { accountId: "c" });
    expect(r.movements[0]).toMatchObject({ bookedOn: "2026-10-09", amount: -100_000n, counterparty: "Juan Pérez" });
  });

  it("CA2: una línea ilegible se informa con su número y las demás se conservan", () => {
    const r = parseBankStatementCsv("Fecha;Concepto;Importe\n31/02/2026;Imposible;10\n01/03/2026;Bien;10,00\n02/03/2026;;5\n03/03/2026;Sin importe;abc", { accountId: "d" });
    expect(r.movements.map((m) => m.description)).toEqual(["Bien"]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 4, 5]);
  });

  it("sin cabecera reconocible o sin líneas: error claro, ningún movimiento", () => {
    expect(parseBankStatementCsv("a;b;c\n1;2;3", { accountId: "x" })).toMatchObject({ movements: [], errors: [{ line: 1 }] });
    expect(parseBankStatementCsv("Fecha;Concepto;Importe", { accountId: "x" }).movements).toEqual([]);
  });

  it("el concepto es obligatorio salvo que la app lo desactive (HS admite líneas sin concepto)", () => {
    const csv = "Fecha;Concepto;Importe\n01/03/2026;;10,00";
    expect(parseBankStatementCsv(csv, { accountId: "d" }).movements).toEqual([]);
    expect(parseBankStatementCsv(csv, { accountId: "d", requireDescription: false }).movements.map((m) => m.amount)).toEqual([1_000n]);
    // Sin columna de concepto, con la opción desactivada, también se lee.
    expect(parseBankStatementCsv("Fecha;Importe\n01/03/2026;5", { accountId: "d", requireDescription: false }).movements).toHaveLength(1);
  });

  it("importes con más de dos decimales se rechazan en vez de redondearse en silencio", () => {
    const r = parseBankStatementCsv("Fecha;Concepto;Importe\n01/03/2026;Raro;10,005", { accountId: "d" });
    expect(r.movements).toEqual([]);
    expect(r.errors[0]?.line).toBe(2);
  });

  it("no recorta concepto ni referencia (la huella debe coincidir con la de Property)", () => {
    const long = "x".repeat(400);
    expect(parseBankStatementCsv(`Fecha;Concepto;Importe\n01/03/2026;${long};1`, { accountId: "d" }).movements[0]?.description).toBe(long);
  });

  it("CA3: la huella es la misma que la de Property, y dos líneas idénticas no colisionan", () => {
    const r = parseBankStatementCsv("Fecha;Concepto;Importe;Referencia\n01/10/2026;Cuota;-50,00;R1\n01/10/2026;Cuota;-50,00;R1", { accountId: "acc-7" });
    // Property (bankStatement.ts movementFingerprint): sha256([cuenta, fecha, importe.toFixed(2), concepto, referencia, ocurrencia].join("|")), 32 hex.
    const property = (occurrence: number) => "csv:" + createHash("sha256").update(["acc-7", "2026-10-01", "-50.00", "Cuota", "R1", occurrence].join("|")).digest("hex").slice(0, 32);
    expect(r.movements.map((m) => m.externalId)).toEqual([property(1), property(2)]);
  });
});
