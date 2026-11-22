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
  /** Carga inicial: traslada reglas ya aprobadas tal cual, como versión 1. Idempotente; devuelve cuántas añadió. */
  seed(rules: readonly Omit<FiscalRule, "version">[], meta: RuleVersionMeta): Promise<number>;
  /** Añade la siguiente versión de una regla (o la primera, si es nueva y está verificada o no determinada). */
  addVersion(rule: Omit<FiscalRule, "version">, meta: RuleVersionMeta): Promise<StoredFiscalRule>;
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
  const insertVersion = async (rule: Omit<FiscalRule, "version">, version: number, meta: RuleVersionMeta): Promise<StoredFiscalRule> => {
    const row: StoredFiscalRule = { ...rule, ...(rule.reference ? { reference: rule.reference.trim() } : {}), version, id: randomUUID(), recordedBy: meta.recordedBy, reason: meta.reason.trim() };
    const stored = await store.insert(row);
    if (stored.id !== row.id) throw new LedgerError("CONCURRENT_UPDATE", "Otra versión de la misma regla se registró a la vez; vuelve a intentarlo", { ruleId: rule.ruleId });
    return stored;
  };
  return {
    async seed(rules, meta) {
      let added = 0;
      for (const rule of rules) {
        validate(rule, meta);
        if ((await store.list({ ruleId: rule.ruleId })).length > 0) continue;
        const id = randomUUID();
        const stored = await store.insert({ ...rule, version: 1, id, recordedBy: meta.recordedBy, reason: meta.reason.trim() });
        if (stored.id === id) added += 1;
      }
      return added;
    },
    async addVersion(rule, meta) {
      validate(rule, meta);
      const versions = await store.list({ ruleId: rule.ruleId });
      const last = versions.at(-1);
      if (rule.validation === "APPROVED_PENDING_VERIFICATION") {
        // Sin verificar no se activa nada nuevo: ni una regla nueva ni un tratamiento distinto.
        if (!last) throw new LedgerError("RULE_INVALID", "Una regla nueva entra verificada (con referencia) o como no determinada", { ruleId: rule.ruleId });
        if (rule.treatment !== last.treatment) throw new LedgerError("RULE_INVALID", "Cambiar el tratamiento exige verificar la regla con su referencia", { ruleId: rule.ruleId });
      }
      return insertVersion(rule, (last?.version ?? 0) + 1, meta);
    },
    rules: (filter = {}) => store.list({ country: filter.country }),
    history: (ruleId) => store.list({ ruleId }),
  };
}
