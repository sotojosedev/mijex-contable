import { randomUUID } from "node:crypto";
import { formatMinor } from "@sotojosedev/fiscal-core";
import { LedgerError } from "../core/errors.js";
import type { CivilDate, Minor } from "../core/types.js";

// Spec 003: registro de las operaciones que MIJEX administra para cada organización (comunidad,
// empresa administradora, propietario). No son los libros oficiales de la organización
// (REF-DEC-008): es la traza de facturas, recibos, cobros, pagos y documentos externos, exportable
// para su contable. Solo inserción; una corrección es un registro nuevo que enlaza el anterior.

export type OperationKind = "INVOICE" | "RECEIPT" | "COLLECTION" | "PAYMENT" | "SUPPLIER_INVOICE" | "EXTERNAL";

export interface OperationInput {
  readonly organizationId: string;
  readonly kind: OperationKind;
  readonly occurredOn: CivilDate;
  /** Céntimos con signo: positivo = entra a la organización; negativo = sale. */
  readonly amount: Minor;
  readonly currency: string;
  readonly counterparty: string;
  readonly document: { readonly type: string; readonly number: string } | null;
  readonly source: { readonly system: string; readonly id: string };
  readonly links?: readonly string[] | undefined;
  /** AUTOMATIC = generado por una operación administrada; MANUAL = documento u operación externa aportada. */
  readonly origin: "AUTOMATIC" | "MANUAL";
  readonly recordedBy: string;
}

export interface OperationRecord extends Omit<OperationInput, "links"> {
  readonly id: string;
  readonly links: readonly string[];
}

export interface OperationsStore {
  bySource(system: string, id: string): Promise<OperationRecord | undefined>;
  byId(id: string): Promise<OperationRecord | undefined>;
  /** Guarda el registro; si el origen ya existe (carrera), devuelve el que quedó guardado. */
  insert(record: OperationRecord): Promise<OperationRecord>;
  list(organizationId: string, range: { readonly from?: CivilDate | undefined; readonly to?: CivilDate | undefined }): Promise<OperationRecord[]>;
}

export function createMemoryOperationsStore(): OperationsStore {
  const rows: OperationRecord[] = [];
  return {
    bySource: (system, id) => Promise.resolve(rows.find((r) => r.source.system === system && r.source.id === id)),
    byId: (id) => Promise.resolve(rows.find((r) => r.id === id)),
    insert: (record) => {
      const existing = rows.find((r) => r.source.system === record.source.system && r.source.id === record.source.id);
      if (existing) return Promise.resolve(existing);
      rows.push(record);
      return Promise.resolve(record);
    },
    list: (organizationId, { from, to }) =>
      Promise.resolve(
        rows
          .filter((r) => r.organizationId === organizationId && (from === undefined || r.occurredOn >= from) && (to === undefined || r.occurredOn <= to))
          .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id)),
      ),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sameData = (a: OperationRecord, b: OperationInput): boolean =>
  a.organizationId === b.organizationId && a.kind === b.kind && a.occurredOn === b.occurredOn && a.amount === b.amount && a.currency === b.currency &&
  a.counterparty === b.counterparty && a.document?.type === b.document?.type && a.document?.number === b.document?.number &&
  a.origin === b.origin && JSON.stringify(a.links) === JSON.stringify(b.links ?? []);

export interface OperationsRegister {
  record(input: OperationInput): Promise<OperationRecord>;
  list(organizationId: string, range?: { readonly from?: CivilDate; readonly to?: CivilDate }): Promise<OperationRecord[]>;
  trace(id: string): Promise<OperationRecord[]>;
}

/** R-CORE-012/013: registro idempotente por origen, enlaces solo dentro de la misma organización. */
export function createOperationsRegister(deps: { readonly store: OperationsStore }): OperationsRegister {
  const { store } = deps;
  return {
    async record(input: OperationInput): Promise<OperationRecord> {
      if (!input.organizationId || !DATE.test(input.occurredOn) || !input.currency || !input.source.system || !input.source.id || !input.recordedBy) {
        throw new LedgerError("INVALID_INPUT", "Operación incompleta: organización, fecha AAAA-MM-DD, moneda, origen y autor son obligatorios");
      }
      const existing = await store.bySource(input.source.system, input.source.id);
      if (existing) {
        if (!sameData(existing, input)) throw new LedgerError("IDEMPOTENCY_CONFLICT", "El mismo origen ya se registró con otros datos", { recordId: existing.id });
        return existing;
      }
      for (const link of input.links ?? []) {
        const target = await store.byId(link);
        if (target?.organizationId !== input.organizationId) throw new LedgerError("INVALID_LINK", "Solo se enlazan registros existentes de la misma organización", { link });
      }
      const record: OperationRecord = { ...input, id: randomUUID(), links: [...(input.links ?? [])] };
      const stored = await store.insert(record);
      if (stored.id !== record.id && !sameData(stored, input)) throw new LedgerError("IDEMPOTENCY_CONFLICT", "El mismo origen ya se registró con otros datos", { recordId: stored.id });
      return stored;
    },
    list: (organizationId: string, range: { readonly from?: CivilDate; readonly to?: CivilDate } = {}) => store.list(organizationId, range),
    /** El registro y todos los que enlaza, en profundidad (factura ← recibo ← cobro). */
    async trace(id: string): Promise<OperationRecord[]> {
      const out: OperationRecord[] = [];
      const seen = new Set<string>();
      const visit = async (current: string): Promise<void> => {
        if (seen.has(current)) return;
        seen.add(current);
        const r = await store.byId(current);
        if (!r) return;
        out.push(r);
        for (const l of r.links) {
          await visit(l);
        }
      };
      await visit(id);
      return out;
    },
  };
}

const HEADER = ["fecha", "tipo", "documento_tipo", "documento_numero", "contraparte", "importe", "moneda", "origen", "enlaces", "referencia_origen"];

/** Texto seguro para CSV: sin fórmulas (=, +, -, @) y entrecomillado si lleva separador o comillas. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** R-CORE-013: exportación por organización y periodo (CSV con `;`, CRLF e importes exactos). */
export function exportOperationsCsv(records: readonly OperationRecord[]): string {
  const lines = records.map((r) =>
    [r.occurredOn, r.kind, r.document?.type ?? "", r.document?.number ?? "", r.counterparty, formatMinor(r.amount), r.currency, r.origin, r.links.join(" "), `${r.source.system}:${r.source.id}`]
      .map((v, i) => (i === 5 ? v : cell(v)))
      .join(";"),
  );
  return [HEADER.join(";"), ...lines].join("\r\n");
}

// --- Obligaciones fiscales por tipo de organización (R-CORE-014) ---

export type ObligationStatus = "REQUIRED" | "NOT_REQUIRED" | "UNDETERMINED";

export interface ObligationProfile {
  readonly country: string;
  readonly organizationType: string;
  readonly validFrom: CivilDate;
  readonly validTo?: CivilDate | undefined;
  readonly obligations: readonly { readonly code: string; readonly status: ObligationStatus; readonly ruleId?: string | undefined; readonly reference?: string | undefined }[];
}

export interface ObligationQuery {
  readonly country: string;
  readonly organizationType: string;
  readonly obligation: string;
  readonly on: CivilDate;
}

/**
 * Estado de una obligación en una fecha. Sin perfil vigente, sin la obligación, o con un estado
 * determinado pero sin regla y referencia oficial: UNDETERMINED (nunca se supone).
 */
export function resolveObligation(profiles: readonly ObligationProfile[], q: ObligationQuery): { status: ObligationStatus; ruleId?: string; reference?: string } {
  const profile = profiles
    .filter((p) => p.country === q.country && p.organizationType === q.organizationType && p.validFrom <= q.on && (p.validTo === undefined || q.on < p.validTo))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  const o = profile?.obligations.find((x) => x.code === q.obligation);
  if (!o || o.status === "UNDETERMINED" || !o.ruleId || !o.reference) return { status: "UNDETERMINED" };
  return { status: o.status, ruleId: o.ruleId, reference: o.reference };
}

/** R-CORE-014: la emisión automática exige la obligación determinada; si no, revisión manual. */
export function assertAutomaticIssuance(profiles: readonly ObligationProfile[], q: ObligationQuery): void {
  if (resolveObligation(profiles, q).status === "UNDETERMINED") {
    throw new LedgerError("OBLIGATION_UNDETERMINED", "Obligación fiscal no determinada para este tipo de organización: la emisión automática queda en revisión manual", { ...q });
  }
}
