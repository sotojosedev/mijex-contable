import { describe, expect, it } from "vitest";
import { createOperationsRegister, exportOperationsCsv, type OperationInput, type OperationsStore } from "../../src/operations/index.js";

const op = (over: Partial<OperationInput> = {}): OperationInput => ({
  organizationId: "org-a", kind: "INVOICE", occurredOn: "2026-11-10", amount: 118_000n, currency: "EUR",
  counterparty: "Propietario 1A", document: { type: "FACTURA", number: "F-1" }, source: { system: "property", id: "inv-1" },
  origin: "AUTOMATIC", recordedBy: "system", ...over,
});

/** Spec 003: el mismo comportamiento con cualquier almacén (memoria y PostgreSQL). */
export function operationsContract(name: string, makeStore: () => Promise<OperationsStore>): void {
  describe(`registro de operaciones (${name})`, () => {
    describe("[R-CORE-012] registro de operaciones generado automáticamente (spec 003)", () => {
      it("es idempotente por origen; el mismo origen con otros datos es un conflicto", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const a = await reg.record(op());
        expect((await reg.record(op())).id).toBe(a.id);
        await expect(reg.record(op({ amount: 1n }))).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      });

      it("traza factura → recibo → cobro, y admite documentos externos aportados a mano", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const invoice = await reg.record(op());
        const receipt = await reg.record(op({ kind: "RECEIPT", document: { type: "RECIBO", number: "R-1" }, source: { system: "property", id: "rec-1" }, links: [invoice.id] }));
        const collection = await reg.record(op({ kind: "COLLECTION", document: null, source: { system: "property", id: "pay-1" }, links: [receipt.id] }));
        const external = await reg.record(op({ kind: "EXTERNAL", amount: -5_000n, origin: "MANUAL", recordedBy: "admin-1", document: { type: "FACTURA_PROVEEDOR", number: "EXT-9" }, source: { system: "manual", id: "ext-9" } }));
        expect((await reg.trace(collection.id)).map((r) => r.id)).toEqual([collection.id, receipt.id, invoice.id]);
        expect(external.origin).toBe("MANUAL");
      });

      it("rechaza enlaces a registros de otra organización o inexistentes", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const other = await reg.record(op({ organizationId: "org-b", source: { system: "property", id: "inv-b" } }));
        await expect(reg.record(op({ source: { system: "property", id: "rec-x" }, links: [other.id] }))).rejects.toMatchObject({ code: "INVALID_LINK" });
        await expect(reg.record(op({ source: { system: "property", id: "rec-y" }, links: ["no-existe"] }))).rejects.toMatchObject({ code: "INVALID_LINK" });
      });
    });

    describe("[R-CORE-013] separación por organización y exportación", () => {
      it("lista por organización y periodo, sin mezclar; el CSV lleva importes exactos y cabecera estable", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await reg.record(op());
        await reg.record(op({ occurredOn: "2026-12-01", source: { system: "property", id: "inv-2" } }));
        await reg.record(op({ organizationId: "org-b", source: { system: "property", id: "inv-b" } }));
        const nov = await reg.list("org-a", { from: "2026-11-01", to: "2026-11-30" });
        expect(nov.map((r) => r.source.id)).toEqual(["inv-1"]);
        const csv = exportOperationsCsv(nov);
        // Las columnas anteriores se conservan en el mismo orden; las nuevas van al final (compatible, REF-DEC-013 Q4).
        expect(csv.split("\r\n")[0]).toBe("fecha;tipo;documento_tipo;documento_numero;contraparte;importe;moneda;origen;enlaces;referencia_origen;naturaleza;version_origen;revierte;motivo");
        expect(csv.split("\r\n")[1]).toBe("2026-11-10;INVOICE;FACTURA;F-1;Propietario 1A;1180.00;EUR;AUTOMATIC;;property:inv-1;;1;;");
      });

      it("protege el CSV frente a fórmulas y separadores en los textos", () => {
        const csv = exportOperationsCsv([{ ...op(), id: "x", counterparty: "=HYPERLINK(1);a", links: [], nature: null, sourceVersion: 1, reverses: null, reason: null }]);
        expect(csv.split("\r\n")[1]).toContain("\"'=HYPERLINK(1);a\"");
      });
    });

    describe("[R-CORE-012] naturaleza del importe y tipos nuevos (spec 003, clarify Q4, REF-DEC-013)", () => {
      it("guarda la naturaleza y los tipos WITHHOLDING y FEE_ACCRUAL; sin naturaleza queda null (compatible)", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const plain = await reg.record(op());
        expect(plain.nature).toBeNull();
        const w = await reg.record(op({ kind: "WITHHOLDING", nature: "WITHHOLDING", amount: -19_000n, document: null, source: { system: "property", id: "wd-1" } }));
        const fee = await reg.record(op({ kind: "FEE_ACCRUAL", nature: "OWN_INCOME", amount: 5_000n, document: null, source: { system: "property", id: "fee-1" } }));
        expect(w).toMatchObject({ kind: "WITHHOLDING", nature: "WITHHOLDING" });
        expect((await reg.list("org-a")).find((r) => r.id === fee.id)).toMatchObject({ kind: "FEE_ACCRUAL", nature: "OWN_INCOME" });
      });

      it("la naturaleza forma parte de los datos: cambiarla es una corrección y la reversión la conserva", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await reg.record(op({ kind: "COLLECTION", nature: "OWN_INCOME", document: null }));
        await expect(reg.record(op({ kind: "COLLECTION", nature: "THIRD_PARTY_FUNDS", document: null }))).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        const { reversal, record } = await reg.recordCorrection(op({ kind: "COLLECTION", nature: "THIRD_PARTY_FUNDS", document: null }), { reason: "fondos del propietario", recordedBy: "system" });
        expect(reversal?.nature).toBe("OWN_INCOME");
        expect(record.nature).toBe("THIRD_PARTY_FUNDS");
      });

      it("rechaza una naturaleza desconocida", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await expect(reg.record(op({ nature: "OTRA" as never }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
      });

      it("el CSV muestra naturaleza, versión, registro revertido y motivo", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const original = await reg.record(op({ nature: "OWN_INCOME" }));
        await reg.recordReversal({ system: "property", id: "inv-1" }, { reason: "anulada", recordedBy: "system" });
        const lines = exportOperationsCsv(await reg.list("org-a")).split("\r\n").slice(1);
        expect(lines).toContain("2026-11-10;INVOICE;FACTURA;F-1;Propietario 1A;1180.00;EUR;AUTOMATIC;;property:inv-1;OWN_INCOME;1;;");
        expect(lines).toContain(`2026-11-10;INVOICE;FACTURA;F-1;Propietario 1A;-1180.00;EUR;AUTOMATIC;${original.id};property:inv-1;OWN_INCOME;2;${original.id};anulada`);
      });
    });

    describe("[R-CORE-012] corrección por reversión, sin editar nada (spec 003, clarify Q3, REF-DEC-013)", () => {
      it("el mismo origen y los mismos datos es idempotente: no crea versión nueva", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const a = await reg.record(op());
        const r = await reg.recordCorrection(op(), { reason: "sin cambios", recordedBy: "system" });
        expect(r.record.id).toBe(a.id);
        expect(r.reversal).toBeNull();
        expect(await reg.list("org-a")).toHaveLength(1);
      });

      it("si el origen cambia: reversión enlazada al original y versión nueva; el original queda intacto", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const original = await reg.record(op());
        const { reversal, record } = await reg.recordCorrection(op({ counterparty: "Propietario 1A (nuevo nombre)" }), { reason: "cambia la contraparte", recordedBy: "system" });
        expect(reversal).toMatchObject({ reverses: original.id, amount: -118_000n, occurredOn: original.occurredOn, reason: "cambia la contraparte", links: [original.id] });
        expect(record).toMatchObject({ counterparty: "Propietario 1A (nuevo nombre)", amount: 118_000n, reverses: null });
        expect(record.sourceVersion).toBeGreaterThan(reversal?.sourceVersion ?? Number.POSITIVE_INFINITY);
        const all = await reg.list("org-a");
        expect(all.find((r) => r.id === original.id)).toMatchObject({ counterparty: "Propietario 1A", amount: 118_000n, sourceVersion: 1, reverses: null });
        expect(all.reduce((s, r) => s + r.amount, 0n)).toBe(118_000n);
        // A partir de ahí, el registro idempotente compara con la versión vigente.
        expect((await reg.record(op({ counterparty: "Propietario 1A (nuevo nombre)" }))).id).toBe(record.id);
      });

      it("current devuelve la versión vigente del origen (o null si no hay o está anulado)", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const src = { system: "property", id: "inv-1" };
        expect(await reg.current(src)).toBeNull();
        await reg.record(op());
        const { record } = await reg.recordCorrection(op({ amount: 1n }), { reason: "cambia el importe", recordedBy: "system" });
        expect((await reg.current(src))?.id).toBe(record.id);
        await reg.recordReversal(src, { reason: "anulada", recordedBy: "system" });
        expect(await reg.current(src)).toBeNull();
      });

      it("sin registro previo, la corrección registra la primera versión", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        const r = await reg.recordCorrection(op(), { reason: "alta", recordedBy: "system" });
        expect(r.reversal).toBeNull();
        expect(r.record.sourceVersion).toBe(1);
      });

      it("la anulación revierte la versión vigente con motivo; repetirla no hace nada", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await reg.record(op());
        const { record } = await reg.recordCorrection(op({ amount: 120_000n }), { reason: "cambia el importe", recordedBy: "system" });
        const reversal = await reg.recordReversal({ system: "property", id: "inv-1" }, { reason: "cuota anulada", recordedBy: "admin-1" });
        expect(reversal).toMatchObject({ reverses: record.id, amount: -120_000n, reason: "cuota anulada", recordedBy: "admin-1" });
        expect(await reg.recordReversal({ system: "property", id: "inv-1" }, { reason: "cuota anulada", recordedBy: "admin-1" })).toBeNull();
        expect((await reg.list("org-a")).reduce((s, r) => s + r.amount, 0n)).toBe(0n);
      });

      it("la corrección y la anulación exigen motivo", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await reg.record(op());
        await expect(reg.recordCorrection(op({ amount: 1n }), { reason: "  ", recordedBy: "system" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
        await expect(reg.recordReversal({ system: "property", id: "inv-1" }, { reason: "", recordedBy: "system" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      });

      it("dos correcciones simultáneas del mismo origen: una gana y la otra no deja registros a medias", async () => {
        const reg = createOperationsRegister({ store: await makeStore() });
        await reg.record(op());
        const results = await Promise.allSettled([
          reg.recordCorrection(op({ amount: 130_000n }), { reason: "a", recordedBy: "system" }),
          reg.recordCorrection(op({ amount: 140_000n }), { reason: "b", recordedBy: "system" }),
        ]);
        const all = await reg.list("org-a");
        // Cada registro se revierte como mucho una vez y el saldo es el de una única versión vigente.
        const reversed = all.filter((r) => r.reverses).map((r) => r.reverses);
        expect(new Set(reversed).size).toBe(reversed.length);
        const total = all.reduce((s, r) => s + r.amount, 0n);
        expect([130_000n, 140_000n]).toContain(total);
        expect(results.some((r) => r.status === "fulfilled")).toBe(true);
        for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONCURRENT_UPDATE" });
      });
    });

    it("dos registros simultáneos del mismo origen dejan uno solo", async () => {
      const store = await makeStore();
      const reg = createOperationsRegister({ store });
      const [a, b] = await Promise.all([reg.record(op()), reg.record(op())]);
      expect(a.id).toBe(b.id);
      expect(await reg.list("org-a")).toHaveLength(1);
    });
  });
}
