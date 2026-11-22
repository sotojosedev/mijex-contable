import { randomUUID } from "node:crypto";
import { FISCAL_STATUSES, formatMinor, SUBMISSION_STATUSES } from "@sotojosedev/fiscal-core";
import { createHash } from "node:crypto";
import { LedgerError } from "../core/errors.js";
import type { CivilDate, Minor } from "../core/types.js";

// Spec 003: registro de las operaciones que MIJEX administra para cada organización (comunidad,
// empresa administradora, propietario). No son los libros oficiales de la organización
// (REF-DEC-008): es la traza de facturas, recibos, cobros, pagos y documentos externos, exportable
// para su contable. Solo inserción; una corrección es un registro nuevo que enlaza el anterior.

export type OperationKind = "INVOICE" | "RECEIPT" | "COLLECTION" | "PAYMENT" | "SUPPLIER_INVOICE" | "EXTERNAL" | "WITHHOLDING" | "FEE_ACCRUAL";

/**
 * Naturaleza del importe para la organización (spec 003 Q4, REF-DEC-013): ingreso propio, fondos de terceros
 * (p. ej. la renta del propietario que la administradora cobra), retención, pago de impuestos o liquidación.
 */
export const OPERATION_NATURES = ["OWN_INCOME", "THIRD_PARTY_FUNDS", "WITHHOLDING", "TAX_PAYMENT", "SETTLEMENT"] as const;
export type OperationNature = (typeof OPERATION_NATURES)[number];

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
  /** Opcional (compatible): sin ella el registro queda sin clasificar. */
  readonly nature?: OperationNature | null | undefined;
  /** Spec 004c (K12): resultado fiscal del documento, verificado antes de registrarlo. Opcional (compatible). */
  readonly fiscal?: FiscalResultEnvelope | null | undefined;
}

/** Versión del contrato `FiscalResultEnvelope` que admite esta librería. */
export const FISCAL_RESULT_CONTRACT_VERSION = 1;

/**
 * Spec 004c (K12, REF-DEC-015): contrato público y estable del resultado fiscal que se registra. La librería verifica
 * procedencia, versión, estado, ámbito e integridad; no recalcula impuestos ni interpreta la ley.
 */
export interface FiscalResultEnvelope {
  readonly contractVersion: number;
  /** FISCAL_CORE: emitido por `@mijex/fiscal-core`. EXTERNAL: aportado a mano (solo con `origin: "MANUAL"`). */
  readonly provenance: "FISCAL_CORE" | "EXTERNAL";
  /** Identificador del documento en fiscal-core (obligatorio con FISCAL_CORE). */
  readonly documentId: string;
  readonly documentNumber: string;
  readonly issuerId: string;
  readonly organizationId: string;
  readonly country: string;
  /** Estados tal como los da fiscal-core (`FISCAL_STATUSES`, `SUBMISSION_STATUSES`). */
  readonly fiscalStatus: string;
  readonly submissionStatus: string;
  /** Huella del contenido canónico; si se aporta `content`, se comprueba que coincide. `content` no se guarda. */
  readonly integrity: { readonly algorithm: "SHA-256"; readonly digest: string; readonly content?: string | undefined };
}

/** Lo que queda registrado: el sobre sin el contenido y si el resultado es definitivo. */
export interface RecordedFiscalResult extends Omit<FiscalResultEnvelope, "integrity"> {
  readonly integrity: { readonly algorithm: "SHA-256"; readonly digest: string };
  readonly definitive: boolean;
}

// Clasificación cerrada de los estados de fiscal-core (no de la ley): definitivo = aceptado por la autoridad, o sin
// obligación de remitir, y documento vigente (no anulado ni sustituido). Lo demás se registra como no definitivo.
const DEFINITIVE_SUBMISSION: readonly string[] = ["ACCEPTED", "ACCEPTED_WITH_ERRORS", "NOT_SUBMITTED"];
const DEFINITIVE_FISCAL: readonly string[] = ["ACTIVE", "PARTIALLY_CORRECTED", "CORRECTED"];

function checkFiscal(input: OperationInput): RecordedFiscalResult | null {
  const f = input.fiscal;
  if (!f) return null;
  const fail = (code: "FISCAL_PROVENANCE" | "FISCAL_VERSION" | "FISCAL_STATUS" | "FISCAL_SCOPE" | "FISCAL_INTEGRITY", message: string): never => {
    throw new LedgerError(code, message, { source: `${input.source.system}:${input.source.id}` });
  };
  if (f.contractVersion !== FISCAL_RESULT_CONTRACT_VERSION) fail("FISCAL_VERSION", "Versión del contrato del resultado fiscal no admitida");
  // El sobre llega de fuera: se comprueba también lo que los tipos ya prometen.
  const provenance: string = f.provenance;
  const algorithm: string = f.integrity.algorithm;
  if (provenance !== "FISCAL_CORE" && provenance !== "EXTERNAL") fail("FISCAL_PROVENANCE", "Procedencia del resultado fiscal desconocida");
  if (f.provenance === "EXTERNAL" && input.origin !== "MANUAL") fail("FISCAL_PROVENANCE", "Un resultado fiscal externo solo se registra como operación aportada a mano");
  if (f.provenance === "FISCAL_CORE" && !f.documentId.trim()) fail("FISCAL_PROVENANCE", "Un resultado de fiscal-core exige el identificador de su documento");
  if (!(FISCAL_STATUSES as readonly string[]).includes(f.fiscalStatus) || !(SUBMISSION_STATUSES as readonly string[]).includes(f.submissionStatus)) {
    fail("FISCAL_STATUS", "Estado fiscal o de envío desconocido");
  }
  if (f.organizationId !== input.organizationId || !/^[A-Z]{2}$/.test(f.country) || !f.issuerId.trim() || (input.document !== null && f.documentNumber !== input.document.number)) {
    fail("FISCAL_SCOPE", "El resultado fiscal no corresponde a esta organización, país o documento");
  }
  if (algorithm !== "SHA-256" || !/^[0-9a-f]{64}$/.test(f.integrity.digest)) fail("FISCAL_INTEGRITY", "Huella del documento ausente o mal formada");
  if (f.integrity.content !== undefined && createHash("sha256").update(f.integrity.content).digest("hex") !== f.integrity.digest) {
    fail("FISCAL_INTEGRITY", "La huella no coincide con el contenido del documento");
  }
  const { integrity, ...rest } = f;
  return { ...rest, integrity: { algorithm: integrity.algorithm, digest: integrity.digest }, definitive: DEFINITIVE_SUBMISSION.includes(f.submissionStatus) && DEFINITIVE_FISCAL.includes(f.fiscalStatus) };
}

export interface OperationRecord extends Omit<OperationInput, "links" | "nature" | "fiscal"> {
  readonly id: string;
  readonly links: readonly string[];
  readonly nature: OperationNature | null;
  /** Versión dentro del mismo origen (1 = primera). Una reversión y cada versión nueva ocupan la siguiente. */
  readonly sourceVersion: number;
  /** Registro que anula (corrección o anulación, spec 003 Q3); null en los registros normales. */
  readonly reverses: string | null;
  /** Motivo de la reversión; null en los registros normales. */
  readonly reason: string | null;
  /** Spec 004c: resultado fiscal verificado; null si la operación no lo trae. */
  readonly fiscal: RecordedFiscalResult | null;
}

export interface OperationsStore {
  /** Todas las versiones de un origen, de la primera a la última. */
  versionsBySource(system: string, id: string): Promise<OperationRecord[]>;
  byId(id: string): Promise<OperationRecord | undefined>;
  /** Guarda el registro; si esa versión del origen ya existe (carrera), devuelve la que quedó guardada. */
  insert(record: OperationRecord): Promise<OperationRecord>;
  list(organizationId: string, range: { readonly from?: CivilDate | undefined; readonly to?: CivilDate | undefined }): Promise<OperationRecord[]>;
}

export function createMemoryOperationsStore(): OperationsStore {
  const rows: OperationRecord[] = [];
  const sameVersion = (a: OperationRecord, b: OperationRecord) => a.source.system === b.source.system && a.source.id === b.source.id && a.sourceVersion === b.sourceVersion;
  return {
    versionsBySource: (system, id) => Promise.resolve(rows.filter((r) => r.source.system === system && r.source.id === id).sort((a, b) => a.sourceVersion - b.sourceVersion)),
    byId: (id) => Promise.resolve(rows.find((r) => r.id === id)),
    insert: (record) => {
      const existing = rows.find((r) => sameVersion(r, record) || (record.reverses !== null && r.reverses === record.reverses));
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
/** Mismo resultado fiscal, campo a campo (PostgreSQL guarda el JSON con otro orden de claves). */
function sameFiscal(a: RecordedFiscalResult | null, b: RecordedFiscalResult | null): boolean {
  if (a === null || b === null) return a === b;
  return a.contractVersion === b.contractVersion && a.provenance === b.provenance && a.documentId === b.documentId && a.documentNumber === b.documentNumber &&
    a.issuerId === b.issuerId && a.organizationId === b.organizationId && a.country === b.country && a.fiscalStatus === b.fiscalStatus &&
    a.submissionStatus === b.submissionStatus && a.integrity.digest === b.integrity.digest && a.definitive === b.definitive;
}

const sameData = (a: OperationRecord, b: OperationInput): boolean =>
  a.organizationId === b.organizationId && a.kind === b.kind && a.occurredOn === b.occurredOn && a.amount === b.amount && a.currency === b.currency &&
  a.counterparty === b.counterparty && a.document?.type === b.document?.type && a.document?.number === b.document?.number &&
  a.origin === b.origin && a.nature === (b.nature ?? null) && JSON.stringify(a.links) === JSON.stringify(b.links ?? []) &&
  sameFiscal(a.fiscal, checkFiscal(b));

/** Quién y por qué en una corrección o anulación (spec 003 Q3). */
export interface CorrectionMeta {
  readonly reason: string;
  readonly recordedBy: string;
}

export interface OperationsRegister {
  record(input: OperationInput): Promise<OperationRecord>;
  /**
   * Si el origen no cambió, devuelve su versión vigente; si cambió, añade la reversión de la vigente y la versión
   * nueva, enlazadas. Nada se edita (R-CORE-003, R-CORE-012).
   */
  recordCorrection(input: OperationInput, meta: CorrectionMeta): Promise<{ readonly reversal: OperationRecord | null; readonly record: OperationRecord }>;
  /** Versión vigente del origen (solo lectura); null si no hay ninguna o está anulado. */
  current(source: { readonly system: string; readonly id: string }): Promise<OperationRecord | null>;
  /** Anula la versión vigente del origen con una reversión; null si no había nada vigente. */
  recordReversal(source: { readonly system: string; readonly id: string }, meta: CorrectionMeta): Promise<OperationRecord | null>;
  list(organizationId: string, range?: { readonly from?: CivilDate; readonly to?: CivilDate }): Promise<OperationRecord[]>;
  trace(id: string): Promise<OperationRecord[]>;
}

/** Versión vigente de un origen: la última que no es una reversión ni ha sido revertida. */
function current(versions: readonly OperationRecord[]): OperationRecord | undefined {
  const reversed = new Set(versions.map((v) => v.reverses).filter((v): v is string => v !== null));
  return [...versions].reverse().find((v) => v.reverses === null && !reversed.has(v.id));
}

/** R-CORE-012/013: registro idempotente por origen, enlaces solo dentro de la misma organización. */
export function createOperationsRegister(deps: { readonly store: OperationsStore }): OperationsRegister {
  const { store } = deps;
  const validate = (input: OperationInput) => {
    if (!input.organizationId || !DATE.test(input.occurredOn) || !input.currency || !input.source.system || !input.source.id || !input.recordedBy) {
      throw new LedgerError("INVALID_INPUT", "Operación incompleta: organización, fecha AAAA-MM-DD, moneda, origen y autor son obligatorios");
    }
    if (input.nature != null && !(OPERATION_NATURES as readonly string[]).includes(input.nature)) throw new LedgerError("INVALID_INPUT", "Naturaleza del importe desconocida", { nature: input.nature });
    checkFiscal(input);
  };
  const validateMeta = (meta: CorrectionMeta) => {
    if (!meta.reason.trim() || !meta.recordedBy) throw new LedgerError("INVALID_INPUT", "Una corrección o anulación exige motivo y autor");
  };
  const checkLinks = async (input: OperationInput) => {
    for (const link of input.links ?? []) {
      const target = await store.byId(link);
      if (target?.organizationId !== input.organizationId) throw new LedgerError("INVALID_LINK", "Solo se enlazan registros existentes de la misma organización", { link });
    }
  };
  const nextVersion = (versions: readonly OperationRecord[]) => (versions.at(-1)?.sourceVersion ?? 0) + 1;
  /** Inserta una versión; si otro proceso ocupó esa versión con otros datos, es una corrección concurrente. */
  const insertVersion = async (record: OperationRecord, same: (stored: OperationRecord) => boolean): Promise<OperationRecord> => {
    const stored = await store.insert(record);
    if (stored.id !== record.id && !same(stored)) throw new LedgerError("CONCURRENT_UPDATE", "Otra corrección del mismo origen se registró a la vez; vuelve a intentarlo", { recordId: stored.id });
    return stored;
  };
  const reversalOf = async (target: OperationRecord, version: number, meta: CorrectionMeta): Promise<OperationRecord> => {
    const reversal: OperationRecord = {
      ...target,
      id: randomUUID(),
      // Misma fecha que la operación que anula: el saldo del periodo cuadra (la fecha real queda en el almacén).
      amount: -target.amount,
      links: [target.id],
      sourceVersion: version,
      reverses: target.id,
      reason: meta.reason.trim(),
      recordedBy: meta.recordedBy,
    };
    return insertVersion(reversal, (stored) => stored.reverses === target.id);
  };
  const build = (input: OperationInput, version: number): OperationRecord => {
    const { fiscal: _envelope, ...data } = input;
    return { ...data, id: randomUUID(), links: [...(input.links ?? [])], nature: input.nature ?? null, sourceVersion: version, reverses: null, reason: null, fiscal: checkFiscal(input) };
  };
  const append = async (input: OperationInput, version: number): Promise<OperationRecord> => {
    const record = build(input, version);
    return insertVersion(record, (stored) => stored.reverses === null && sameData(stored, input));
  };
  return {
    async record(input: OperationInput): Promise<OperationRecord> {
      validate(input);
      const versions = await store.versionsBySource(input.source.system, input.source.id);
      const existing = current(versions);
      if (existing) {
        if (!sameData(existing, input)) throw new LedgerError("IDEMPOTENCY_CONFLICT", "El mismo origen ya se registró con otros datos", { recordId: existing.id });
        return existing;
      }
      await checkLinks(input);
      const record = build(input, nextVersion(versions));
      const stored = await store.insert(record);
      if (stored.id !== record.id && !sameData(stored, input)) throw new LedgerError("IDEMPOTENCY_CONFLICT", "El mismo origen ya se registró con otros datos", { recordId: stored.id });
      return stored;
    },
    async recordCorrection(input, meta) {
      validate(input);
      validateMeta(meta);
      const versions = await store.versionsBySource(input.source.system, input.source.id);
      const existing = current(versions);
      if (existing && sameData(existing, input)) return { reversal: null, record: existing };
      await checkLinks(input);
      if (!existing) return { reversal: null, record: await append(input, nextVersion(versions)) };
      const reversal = await reversalOf(existing, nextVersion(versions), meta);
      return { reversal, record: await append(input, reversal.sourceVersion + 1) };
    },
    async current(source) {
      return current(await store.versionsBySource(source.system, source.id)) ?? null;
    },
    async recordReversal(source, meta) {
      validateMeta(meta);
      const versions = await store.versionsBySource(source.system, source.id);
      const existing = current(versions);
      if (!existing) return null;
      return reversalOf(existing, nextVersion(versions), meta);
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

// Las columnas nuevas van siempre al final: las importaciones que ya leen las anteriores no se rompen (REF-DEC-013 Q4).
const HEADER = ["fecha", "tipo", "documento_tipo", "documento_numero", "contraparte", "importe", "moneda", "origen", "enlaces", "referencia_origen", "naturaleza", "version_origen", "revierte", "motivo", "documento_fiscal", "fiscal_definitivo"];

/** Texto seguro para CSV: sin fórmulas (=, +, -, @) y entrecomillado si lleva separador o comillas. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** R-CORE-013: exportación por organización y periodo (CSV con `;`, CRLF e importes exactos). */
export function exportOperationsCsv(records: readonly OperationRecord[]): string {
  const lines = records.map((r) =>
    [r.occurredOn, r.kind, r.document?.type ?? "", r.document?.number ?? "", r.counterparty, formatMinor(r.amount), r.currency, r.origin, r.links.join(" "), `${r.source.system}:${r.source.id}`, r.nature ?? "", String(r.sourceVersion), r.reverses ?? "", r.reason ?? "", r.fiscal?.documentId ?? "", r.fiscal ? (r.fiscal.definitive ? "si" : "no") : ""]
      .map((v, i) => (i === 5 ? v : cell(v)))
      .join(";"),
  );
  return [HEADER.join(";"), ...lines].join("\r\n");
}

// --- Catálogo de reglas fiscales y decisión de emisión (R-CORE-014, REF-DEC-009) ---

/**
 * VERIFIED: contrastada con una fuente normativa aplicable. APPROVED_PENDING_VERIFICATION: aprobada
 * funcionalmente por el usuario, sin verificación normativa: nunca basta para un documento real (REF-DEC-015).
 * UNDETERMINED: no hay regla suficiente para decidir el tratamiento.
 * REJECTED: propuesta revisada y rechazada (spec 004b); no decide nada.
 */
export type RuleValidation = "VERIFIED" | "APPROVED_PENDING_VERIFICATION" | "UNDETERMINED" | "REJECTED";

/** Tratamiento fiscal de la operación: con documento fiscal o sin él (no toda cuota o alquiler se factura). */
export type FiscalTreatment = "FISCAL_INVOICE" | "NO_FISCAL_DOCUMENT" | (string & {});

export interface FiscalRule {
  readonly ruleId: string;
  readonly version: number;
  readonly country: string;
  readonly jurisdiction: string;
  readonly organizationType: string;
  readonly operationType: string;
  readonly treatment: FiscalTreatment;
  readonly reference?: string | undefined;
  readonly validation: RuleValidation;
  readonly validFrom: CivilDate;
  readonly validTo?: CivilDate | undefined;
}

export interface IssuanceQuery {
  readonly country: string;
  readonly organizationType: string;
  readonly operationType: string;
  readonly on: CivilDate;
  /**
   * LIVE: documento fiscal real, en cualquier entorno; solo con una regla VERIFIED con referencia (K12, REF-DEC-015).
   * SIMULATION: prueba aislada con datos ficticios; una regla pendiente se ejecuta y la decisión sale `simulated`.
   */
  readonly mode: "LIVE" | "SIMULATION";
  /** Datos esenciales que faltan para determinar el tratamiento (p. ej. identificación fiscal del comprador). */
  readonly missingData: readonly string[];
}

export type IssuanceReason = "RULE_APPLIES" | "NO_RULE" | "RULE_UNDETERMINED" | "RULE_NOT_VERIFIED" | "MISSING_DATA";

export interface IssuanceDecision {
  /** ISSUE: emitir; NO_FISCAL_DOCUMENT: la operación no lleva documento fiscal; MANUAL_REVIEW: solo esta emisión queda retenida. */
  readonly action: "ISSUE" | "NO_FISCAL_DOCUMENT" | "MANUAL_REVIEW";
  readonly reason: IssuanceReason;
  readonly ruleId?: string | undefined;
  readonly ruleVersion?: number | undefined;
  readonly validation?: RuleValidation | undefined;
  readonly reference?: string | undefined;
  readonly missingData?: readonly string[] | undefined;
  /** Solo en SIMULATION: la decisión no autoriza ningún documento fiscal real. */
  readonly simulated?: true | undefined;
}

/**
 * Decide la emisión fiscal de UNA operación. Nunca bloquea el registro económico, los cobros ni los
 * pagos: solo dice si este documento fiscal se emite, no se emite o espera revisión manual.
 */
export function decideFiscalIssuance(catalog: readonly FiscalRule[], q: IssuanceQuery): IssuanceDecision {
  // Una propuesta con un rechazo justo encima está cerrada: ni ella ni el rechazo deciden nada.
  const rejected = new Set(catalog.filter((r) => r.validation === "REJECTED").map((r) => `${r.ruleId}#${String(r.version - 1)}`));
  const applicable = catalog
    .filter((r) => r.country === q.country && r.organizationType === q.organizationType && r.operationType === q.operationType && r.validFrom <= q.on && (r.validTo === undefined || q.on < r.validTo) && r.validation !== "REJECTED" && !rejected.has(`${r.ruleId}#${String(r.version)}`))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.version - a.version);
  // Spec 004b: un documento real usa la última versión revisada (verificada o no determinada); una propuesta pendiente
  // no cambia nada hasta que la verifique otra persona. En simulación, también las propuestas.
  const rule = (q.mode === "LIVE" ? applicable.find((r) => r.validation === "VERIFIED" || r.validation === "UNDETERMINED") : undefined) ?? applicable[0];
  if (!rule) return { action: "MANUAL_REVIEW", reason: "NO_RULE" };
  const ref = { ruleId: rule.ruleId, ruleVersion: rule.version, validation: rule.validation, reference: rule.reference };
  const simulated = q.mode === "SIMULATION" ? { simulated: true as const } : {};
  if (rule.validation === "UNDETERMINED") return { action: "MANUAL_REVIEW", reason: "RULE_UNDETERMINED", ...ref, ...simulated };
  if (q.mode === "LIVE" && (rule.validation !== "VERIFIED" || !rule.reference?.trim())) return { action: "MANUAL_REVIEW", reason: "RULE_NOT_VERIFIED", ...ref };
  if (q.missingData.length > 0) return { action: "MANUAL_REVIEW", reason: "MISSING_DATA", missingData: [...q.missingData], ...ref, ...simulated };
  return { action: rule.treatment === "NO_FISCAL_DOCUMENT" ? "NO_FISCAL_DOCUMENT" : "ISSUE", reason: "RULE_APPLIES", ...ref, ...simulated };
}

export { createFiscalRuleCatalog, createMemoryFiscalRuleStore, type FiscalRuleCatalog, type FiscalRuleStore, type ReviewMeta, type RuleVersionMeta, type StoredFiscalRule } from "./fiscal-rules.js";
