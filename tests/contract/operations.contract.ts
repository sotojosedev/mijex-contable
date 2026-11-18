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
        expect(csv.split("\r\n")[0]).toBe("fecha;tipo;documento_tipo;documento_numero;contraparte;importe;moneda;origen;enlaces;referencia_origen");
        expect(csv.split("\r\n")[1]).toBe("2026-11-10;INVOICE;FACTURA;F-1;Propietario 1A;1180.00;EUR;AUTOMATIC;;property:inv-1");
      });

      it("protege el CSV frente a fórmulas y separadores en los textos", () => {
        const csv = exportOperationsCsv([{ ...op(), id: "x", counterparty: "=HYPERLINK(1);a", links: [] }]);
        expect(csv.split("\r\n")[1]).toContain("\"'=HYPERLINK(1);a\"");
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
