import type { Pool } from "pg";
import type { RuleValidation } from "../../operations/index.js";
import type { FiscalRuleStore, StoredFiscalRule } from "../../operations/fiscal-rules.js";

// Spec 003, corte 2 (R-CORE-014): almacén PostgreSQL del catálogo fiscal (migraciones 0005 y 0006, spec 004b). SQL parametrizado y solo
// inserción; la carrera de dos versiones iguales devuelve la que quedó guardada.

interface Row {
  id: string;
  rule_id: string;
  version: number;
  country: string;
  jurisdiction: string;
  organization_type: string;
  operation_type: string;
  treatment: string;
  validation: RuleValidation;
  reference: string | null;
  valid_from: string;
  valid_to: string | null;
  recorded_by: string;
  reason: string;
  proposed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
}

const COLUMNS =
  "id, rule_id, version, country, jurisdiction, organization_type, operation_type, treatment, validation, reference, to_char(valid_from, 'YYYY-MM-DD') AS valid_from, to_char(valid_to, 'YYYY-MM-DD') AS valid_to, recorded_by, reason, proposed_by, reviewed_by, reviewed_at";

const toRule = (r: Row): StoredFiscalRule => ({
  id: r.id,
  ruleId: r.rule_id,
  version: r.version,
  country: r.country,
  jurisdiction: r.jurisdiction,
  organizationType: r.organization_type,
  operationType: r.operation_type,
  treatment: r.treatment,
  validation: r.validation,
  ...(r.reference === null ? {} : { reference: r.reference }),
  validFrom: r.valid_from,
  ...(r.valid_to === null ? {} : { validTo: r.valid_to }),
  recordedBy: r.recorded_by,
  reason: r.reason,
  ...(r.proposed_by === null ? {} : { proposedBy: r.proposed_by }),
  ...(r.reviewed_by === null ? {} : { reviewedBy: r.reviewed_by }),
  ...(r.reviewed_at === null ? {} : { reviewedAt: r.reviewed_at.toISOString() }),
});

export function createPgFiscalRuleStore(deps: { readonly pool: Pool }): FiscalRuleStore {
  const { pool } = deps;
  return {
    async insert(r) {
      const { rows } = await pool.query<Row>(
        `INSERT INTO contable.fiscal_rule (id, rule_id, version, country, jurisdiction, organization_type, operation_type, treatment, validation, reference, valid_from, valid_to, recorded_by, reason, proposed_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (rule_id, version) DO NOTHING
         RETURNING ${COLUMNS}`,
        [r.id, r.ruleId, r.version, r.country, r.jurisdiction, r.organizationType, r.operationType, r.treatment, r.validation, r.reference ?? null, r.validFrom, r.validTo ?? null, r.recordedBy, r.reason, r.proposedBy ?? null, r.reviewedBy ?? null, r.reviewedAt ?? null],
      );
      if (rows[0]) return toRule(rows[0]);
      const existing = await pool.query<Row>(`SELECT ${COLUMNS} FROM contable.fiscal_rule WHERE rule_id = $1 AND version = $2`, [r.ruleId, r.version]);
      if (!existing.rows[0]) throw new Error("Regla fiscal no encontrada tras un conflicto de versión");
      return toRule(existing.rows[0]);
    },
    async list({ country, ruleId }) {
      const { rows } = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM contable.fiscal_rule
          WHERE ($1::text IS NULL OR country = $1) AND ($2::text IS NULL OR rule_id = $2)
          ORDER BY rule_id, version`,
        [country ?? null, ruleId ?? null],
      );
      return rows.map(toRule);
    },
  };
}
