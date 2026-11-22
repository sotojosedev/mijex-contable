import type { Pool } from "pg";
import type { OperationKind, OperationNature, OperationRecord, OperationsStore } from "../../operations/index.js";

// Spec 003: almacén PostgreSQL del registro de operaciones. SQL parametrizado; importes BIGINT
// leídos como texto y convertidos a bigint (sin pasar por Number).

interface Row {
  id: string;
  organization_id: string;
  kind: OperationKind;
  occurred_on: string;
  amount: string;
  currency: string;
  counterparty: string;
  document_type: string | null;
  document_number: string | null;
  source_system: string;
  source_id: string;
  links: string[];
  origin: "AUTOMATIC" | "MANUAL";
  recorded_by: string;
  source_version: number;
  reverses: string | null;
  reason: string | null;
  nature: OperationNature | null;
}

const COLUMNS = "id, organization_id, kind, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, amount::text AS amount, currency, counterparty, document_type, document_number, source_system, source_id, links::text[] AS links, origin, recorded_by, source_version, reverses::text AS reverses, reason, nature";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toRecord = (r: Row): OperationRecord => ({
  id: r.id,
  organizationId: r.organization_id,
  kind: r.kind,
  occurredOn: r.occurred_on,
  amount: BigInt(r.amount),
  currency: r.currency,
  counterparty: r.counterparty,
  document: r.document_type === null || r.document_number === null ? null : { type: r.document_type, number: r.document_number },
  source: { system: r.source_system, id: r.source_id },
  links: r.links,
  origin: r.origin,
  recordedBy: r.recorded_by,
  sourceVersion: r.source_version,
  reverses: r.reverses,
  reason: r.reason,
  nature: r.nature,
});

export function createPgOperationsStore(deps: { readonly pool: Pool }): OperationsStore {
  const { pool } = deps;
  const one = async (sql: string, params: unknown[]): Promise<OperationRecord | undefined> => {
    const { rows } = await pool.query<Row>(sql, params);
    return rows[0] ? toRecord(rows[0]) : undefined;
  };
  return {
    async versionsBySource(system, id) {
      const { rows } = await pool.query<Row>(`SELECT ${COLUMNS} FROM contable.operation_record WHERE source_system = $1 AND source_id = $2 ORDER BY source_version`, [system, id]);
      return rows.map(toRecord);
    },
    // Un id que no es UUID no existe (y no aborta la consulta con un error de conversión).
    byId: async (id) => (UUID.test(id) ? one(`SELECT ${COLUMNS} FROM contable.operation_record WHERE id = $1`, [id]) : undefined),
    async insert(r) {
      const inserted = await one(
        `INSERT INTO contable.operation_record (id, organization_id, kind, occurred_on, amount, currency, counterparty, document_type, document_number, source_system, source_id, links, origin, recorded_by, source_version, reverses, reason, nature)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::uuid[], $13, $14, $15, $16::uuid, $17, $18)
         ON CONFLICT DO NOTHING
         RETURNING ${COLUMNS}`,
        [r.id, r.organizationId, r.kind, r.occurredOn, r.amount.toString(), r.currency, r.counterparty, r.document?.type ?? null, r.document?.number ?? null, r.source.system, r.source.id, r.links, r.origin, r.recordedBy, r.sourceVersion, r.reverses, r.reason, r.nature],
      );
      if (inserted) return inserted;
      // Otro proceso ocupó la misma versión del origen, o ya revirtió ese registro: se devuelve lo que quedó guardado.
      const existing = await one(
        `SELECT ${COLUMNS} FROM contable.operation_record
          WHERE (source_system = $1 AND source_id = $2 AND source_version = $3) OR ($4::uuid IS NOT NULL AND reverses = $4::uuid)
          ORDER BY source_version LIMIT 1`,
        [r.source.system, r.source.id, r.sourceVersion, r.reverses],
      );
      if (!existing) throw new Error("Registro de operación no encontrado tras un conflicto de origen");
      return existing;
    },
    async list(organizationId, { from, to }) {
      const { rows } = await pool.query<Row>(
        `SELECT ${COLUMNS} FROM contable.operation_record
          WHERE organization_id = $1 AND ($2::date IS NULL OR occurred_on >= $2::date) AND ($3::date IS NULL OR occurred_on <= $3::date)
          ORDER BY occurred_on, id`,
        [organizationId, from ?? null, to ?? null],
      );
      return rows.map(toRecord);
    },
  };
}
