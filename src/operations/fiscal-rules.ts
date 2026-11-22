import { randomUUID } from "node:crypto";
import { LedgerError } from "../core/errors.js";
import type { FiscalRule } from "./index.js";

// Spec 003, corte 2 (R-CORE-014, clarify Q2, REF-DEC-013): catálogo de reglas fiscales en datos versionados.
// - Solo inserción: cada cambio es una versión nueva y el histórico se conserva. La decisión de emisión recibe todas
//   las versiones y elige por vigencia y, a igual vigencia, por la versión mayor.
// - VERIFIED exige referencia oficial.
// - Lo pendiente de verificar no activa comportamientos fiscales definitivos nuevos: una versión sin verificar no
//   puede crear una regla ni cambiar el tratamiento. Solo la carga inicial traslada lo ya aprobado tal cual.

/** Una versión guardada, con quién la registró y por qué. */
export interface StoredFiscalRule extends FiscalRule {
  readonly id: string;
  readonly recordedBy: string;
  readonly reason: string;
  /** Spec 004b: quién propuso el contenido de esta versión. */
  readonly proposedBy?: string | undefined;
  /** Spec 004b: quién la revisó (VERIFIED o REJECTED) y cuándo (ISO 8601); siempre distinto de `proposedBy`. */
  readonly reviewedBy?: string | undefined;
  readonly reviewedAt?: string | undefined;
}

export interface ReviewMeta {
  readonly reviewedBy: string;
  readonly reason: string;
}

export interface FiscalRuleStore {
  /** Guarda la versión; si esa versión de la regla ya existe (carrera), devuelve la que quedó guardada. */
  insert(rule: StoredFiscalRule): Promise<StoredFiscalRule>;
  /** Todas las versiones, de la regla y la versión menor a la mayor. */
  list(filter: { readonly country?: string | undefined; readonly ruleId?: string | undefined }): Promise<StoredFiscalRule[]>;
}

export function createMemoryFiscalRuleStore(): FiscalRuleStore {
  const rows: StoredFiscalRule[] = [];
  return {
    insert: (rule) => {
      const existing = rows.find((r) => r.ruleId === rule.ruleId && r.version === rule.version);
      if (existing) return Promise.resolve(existing);
      rows.push(rule);
      return Promise.resolve(rule);
    },
    list: ({ country, ruleId }) =>
      Promise.resolve(
        rows
          .filter((r) => (country === undefined || r.country === country) && (ruleId === undefined || r.ruleId === ruleId))
          .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.version - b.version),
      ),
  };
}

export interface RuleVersionMeta {
  readonly recordedBy: string;
  readonly reason: string;
}

export interface FiscalRuleCatalog {
  /** Carga inicial: traslada reglas ya aprobadas tal cual, como propuestas (versión 1). Nunca verifica. Idempotente. */
  seed(rules: readonly Omit<FiscalRule, "version">[], meta: RuleVersionMeta): Promise<number>;
  /**
   * Propone la siguiente versión (pendiente de verificación) o marca la regla como no determinada, que es conservador.
   * Una propuesta nunca genera documentos reales (K12); para que decida, otra persona la verifica.
   */
  propose(rule: Omit<FiscalRule, "version">, meta: RuleVersionMeta): Promise<StoredFiscalRule>;
  /** Verifica la última propuesta pendiente, con su referencia oficial; nunca quien la propuso (spec 004b). */
  verify(ruleId: string, version: number, meta: ReviewMeta & { readonly reference: string }): Promise<StoredFiscalRule>;
  /** Rechaza la última propuesta pendiente; nunca quien la propuso. */
  reject(ruleId: string, version: number, meta: ReviewMeta): Promise<StoredFiscalRule>;
  /** Todas las versiones (para `decideFiscalIssuance`). */
  rules(filter?: { readonly country?: string }): Promise<StoredFiscalRule[]>;
  history(ruleId: string): Promise<StoredFiscalRule[]>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: string) => DATE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

function validate(rule: Omit<FiscalRule, "version">, meta: RuleVersionMeta): void {
  const texts = [rule.ruleId, rule.country, rule.jurisdiction, rule.organizationType, rule.operationType, rule.treatment, meta.recordedBy, meta.reason];
  if (texts.some((t) => !t.trim()) || !/^[A-Z]{2}$/.test(rule.country)) throw new LedgerError("INVALID_INPUT", "Regla incompleta: identificador, país, jurisdicción, organización, operación, tratamiento, autor y motivo son obligatorios");
  if (!validDate(rule.validFrom) || (rule.validTo !== undefined && (!validDate(rule.validTo) || rule.validTo < rule.validFrom))) {
    throw new LedgerError("INVALID_INPUT", "Vigencia no válida: fechas AAAA-MM-DD y el fin no puede ser anterior al inicio");
  }
  if (rule.validation === "VERIFIED" && !rule.reference?.trim()) throw new LedgerError("RULE_INVALID", "Una regla VERIFIED exige su referencia oficial", { ruleId: rule.ruleId });
}

export function createFiscalRuleCatalog(deps: { readonly store: FiscalRuleStore }): FiscalRuleCatalog {
  const { store } = deps;
  const insert = async (row: StoredFiscalRule): Promise<StoredFiscalRule> => {
    const stored = await store.insert(row);
    if (stored.id !== row.id) throw new LedgerError("CONCURRENT_UPDATE", "Otra versión de la misma regla se registró a la vez; vuelve a intentarlo", { ruleId: row.ruleId });
    return stored;
  };
  const proposalOnly = (rule: Omit<FiscalRule, "version">) => {
    if (rule.validation !== "APPROVED_PENDING_VERIFICATION" && rule.validation !== "UNDETERMINED") {
      throw new LedgerError("RULE_INVALID", "Una regla solo se propone (pendiente) o se marca no determinada; la verifica otra persona", { ruleId: rule.ruleId });
    }
  };
  const review = async (ruleId: string, version: number, meta: ReviewMeta, validation: "VERIFIED" | "REJECTED", reference?: string): Promise<StoredFiscalRule> => {
    const verifiedReference = reference?.trim() ?? "";
    if (!meta.reviewedBy.trim() || !meta.reason.trim()) throw new LedgerError("INVALID_INPUT", "La revisión exige revisor y motivo");
    if (validation === "VERIFIED" && !verifiedReference) throw new LedgerError("RULE_INVALID", "Una regla VERIFIED exige su referencia oficial", { ruleId });
    const last = (await store.list({ ruleId })).at(-1);
    if (!last || last.version !== version || last.validation !== "APPROVED_PENDING_VERIFICATION") {
      throw new LedgerError("STALE_PROPOSAL", "Solo se revisa la última versión de la regla y solo si es una propuesta pendiente", { ruleId, version });
    }
    const proposedBy = last.proposedBy ?? last.recordedBy;
    if (proposedBy === meta.reviewedBy) throw new LedgerError("SELF_VERIFICATION", "Quien propone una regla no puede revisarla", { ruleId, version });
    const { id: _id, recordedBy: _by, reason: _reason, reviewedBy: _rb, reviewedAt: _ra, version: _v, ...content } = last;
    const ref = validation === "VERIFIED" ? verifiedReference : last.reference;
    return insert({
      ...content,
      ...(ref ? { reference: ref } : {}),
      validation,
      version: last.version + 1,
      id: randomUUID(),
      recordedBy: meta.reviewedBy,
      reason: meta.reason.trim(),
      proposedBy,
      reviewedBy: meta.reviewedBy,
      reviewedAt: new Date().toISOString(),
    });
  };
  return {
    async seed(rules, meta) {
      let added = 0;
      for (const rule of rules) {
        validate(rule, meta);
        proposalOnly(rule);
        if ((await store.list({ ruleId: rule.ruleId })).length > 0) continue;
        const id = randomUUID();
        const stored = await store.insert({ ...rule, version: 1, id, recordedBy: meta.recordedBy, reason: meta.reason.trim(), proposedBy: meta.recordedBy });
        if (stored.id === id) added += 1;
      }
      return added;
    },
    async propose(rule, meta) {
      validate(rule, meta);
      proposalOnly(rule);
      const last = (await store.list({ ruleId: rule.ruleId })).at(-1);
      return insert({ ...rule, ...(rule.reference?.trim() ? { reference: rule.reference.trim() } : {}), version: (last?.version ?? 0) + 1, id: randomUUID(), recordedBy: meta.recordedBy, reason: meta.reason.trim(), proposedBy: meta.recordedBy });
    },
    verify: (ruleId, version, meta) => review(ruleId, version, meta, "VERIFIED", meta.reference),
    reject: (ruleId, version, meta) => review(ruleId, version, meta, "REJECTED"),
    rules: (filter = {}) => store.list({ country: filter.country }),
    history: (ruleId) => store.list({ ruleId }),
  };
}
