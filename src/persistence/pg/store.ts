import type { Pool, PoolClient } from "pg";
import { DuplicateEntryError, type AccountTotals, type LedgerStore, type LedgerStoreTx } from "../../core/ports.js";
import type { Account, Chart, JournalEntry, JournalLine, LedgerEntity, PostingRule, RuleLine } from "../../core/types.js";

// Almacén PostgreSQL del núcleo contable (esquema `contable`, migración 0001). SQL siempre
// parametrizado; importes BIGINT leídos como texto y convertidos a bigint (sin pasar por Number).

type Row = Record<string, unknown>;

// Un identificador mal formado no llega a la base: un error de tipo abortaría la transacción.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valor de columna como texto (TEXT, UUID, DATE con to_char, BIGINT como ::text, TIMESTAMPTZ). */
function str(r: Row, k: string): string {
  const v = r[k];
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number" || typeof v === "bigint") return v.toString();
  throw new Error(`Columna ${k} sin valor de texto`);
}
const optStr = (r: Row, k: string): string | undefined => (r[k] === null || r[k] === undefined ? undefined : str(r, k));

const toEntity = (r: Row): LedgerEntity => ({
  id: str(r, "id"), kind: str(r, "kind") as LedgerEntity["kind"], country: str(r, "country"), currency: str(r, "currency"), framework: str(r, "framework"),
  external: { system: str(r, "external_system"), ref: str(r, "external_ref") }, name: str(r, "name"), createdAt: new Date(str(r, "created_at")),
});

const ENTITY_COLUMNS = "id, kind, country, currency, framework, external_system, external_ref, name, created_at";
const CHART_COLUMNS = "id, framework, version, to_char(valid_from, 'YYYY-MM-DD') AS valid_from, to_char(valid_to, 'YYYY-MM-DD') AS valid_to, status, approved_by, approved_at, reference_ids";
const RULE_COLUMNS = "id, framework, event_type, version, to_char(valid_from, 'YYYY-MM-DD') AS valid_from, to_char(valid_to, 'YYYY-MM-DD') AS valid_to, rule_id, reference_ids, lines";
const ENTRY_COLUMNS = "id, entity_id, to_char(entry_date, 'YYYY-MM-DD') AS entry_date, currency, chart_id, posting_rule_id, event_type, source_system, source_id, name, memo, reversal_of, reason, actor, created_at";

function api(client: PoolClient): LedgerStoreTx {
  const rows = async (sql: string, params: readonly unknown[]): Promise<Row[]> => (await client.query<Row>(sql, [...params])).rows;
  const one = async (sql: string, params: readonly unknown[]): Promise<Row | undefined> => (await rows(sql, params))[0];

  const chartsWithAccounts = async (charts: Row[]): Promise<Chart[]> => {
    if (charts.length === 0) return [];
    const accounts = await rows("SELECT chart_id, code, name, type, normal_side, statement_group FROM contable.account WHERE chart_id = ANY($1::uuid[]) ORDER BY chart_id, position", [charts.map((c) => c.id)]);
    return charts.map((c) => ({
      id: str(c, "id"), framework: str(c, "framework"), version: str(c, "version"), validFrom: str(c, "valid_from"), validTo: optStr(c, "valid_to"),
      status: str(c, "status") as Chart["status"], approvedBy: optStr(c, "approved_by"), approvedAt: c.approved_at ? new Date(str(c, "approved_at")) : undefined,
      referenceIds: c.reference_ids as string[],
      accounts: accounts.filter((a) => a.chart_id === c.id).map((a): Account => ({ code: str(a, "code"), name: str(a, "name"), type: str(a, "type") as Account["type"], normalSide: str(a, "normal_side") as Account["normalSide"], ...(a.statement_group === "COST_OF_SALES" ? { group: "COST_OF_SALES" as const } : {}) })),
    }));
  };

  const toRule = (r: Row): PostingRule => ({
    id: str(r, "id"), framework: str(r, "framework"), eventType: str(r, "event_type"), version: str(r, "version"), validFrom: str(r, "valid_from"), validTo: optStr(r, "valid_to"),
    ruleId: str(r, "rule_id"), referenceIds: r.reference_ids as string[], lines: r.lines as RuleLine[],
  });

  const entriesWithLines = async (entries: Row[]): Promise<JournalEntry[]> => {
    if (entries.length === 0) return [];
    const lines = await rows("SELECT entry_id, account, debit::text AS debit, credit::text AS credit, memo FROM contable.journal_line WHERE entry_id = ANY($1::uuid[]) ORDER BY entry_id, line_no", [entries.map((e) => e.id)]);
    return entries.map((e) => ({
      id: str(e, "id"), entityId: str(e, "entity_id"), entryDate: str(e, "entry_date"), currency: str(e, "currency"), chartId: str(e, "chart_id"), postingRuleId: str(e, "posting_rule_id"),
      eventType: str(e, "event_type"), source: { system: str(e, "source_system"), id: str(e, "source_id") }, name: str(e, "name"),
      ...(e.memo !== null ? { memo: str(e, "memo") } : {}),
      lines: lines.filter((l) => l.entry_id === e.id).map((l): JournalLine => ({ account: str(l, "account"), debit: BigInt(str(l, "debit")), credit: BigInt(str(l, "credit")), ...(l.memo !== null ? { memo: str(l, "memo") } : {}) })),
      ...(e.reversal_of !== null ? { reversalOf: str(e, "reversal_of"), reason: optStr(e, "reason"), actor: optStr(e, "actor") } : {}),
      createdAt: new Date(str(e, "created_at")),
    }));
  };

  return {
    async entity(id) {
      if (!UUID.test(id)) return undefined;
      const r = await one(`SELECT ${ENTITY_COLUMNS} FROM contable.entity WHERE id = $1`, [id]);
      return r && toEntity(r);
    },
    async entityByExternal(system, ref) {
      const r = await one(`SELECT ${ENTITY_COLUMNS} FROM contable.entity WHERE external_system = $1 AND external_ref = $2`, [system, ref]);
      return r && toEntity(r);
    },
    async insertEntity(e) {
      await client.query("INSERT INTO contable.entity (id, kind, country, currency, framework, external_system, external_ref, name, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [e.id, e.kind, e.country, e.currency, e.framework, e.external.system, e.external.ref, e.name, e.createdAt]);
    },
    async charts(framework) {
      return chartsWithAccounts(await rows(`SELECT ${CHART_COLUMNS} FROM contable.chart WHERE framework = $1 ORDER BY valid_from`, [framework]));
    },
    async chart(id) {
      if (!UUID.test(id)) return undefined;
      return (await chartsWithAccounts(await rows(`SELECT ${CHART_COLUMNS} FROM contable.chart WHERE id = $1`, [id])))[0];
    },
    async insertChart(c) {
      await client.query("INSERT INTO contable.chart (id, framework, version, valid_from, valid_to, status, reference_ids) VALUES ($1,$2,$3,$4,$5,$6,$7)", [c.id, c.framework, c.version, c.validFrom, c.validTo ?? null, c.status, [...c.referenceIds]]);
      await client.query(
        "INSERT INTO contable.account (chart_id, code, name, type, normal_side, position, statement_group) SELECT $1, a.code, a.name, a.type, a.normal_side, a.position, a.statement_group FROM jsonb_to_recordset($2::jsonb) AS a(code TEXT, name TEXT, type TEXT, normal_side TEXT, position INT, statement_group TEXT)",
        [c.id, JSON.stringify(c.accounts.map((a, i) => ({ code: a.code, name: a.name, type: a.type, normal_side: a.normalSide, position: i, statement_group: a.group ?? null })))],
      );
    },
    async approveChart(id, by, at) {
      await client.query("UPDATE contable.chart SET status = 'APPROVED', approved_by = $2, approved_at = $3 WHERE id = $1 AND status = 'DRAFT'", [id, by, at]);
    },
    async closeChart(id, validTo) {
      await client.query("UPDATE contable.chart SET valid_to = $2 WHERE id = $1 AND valid_to IS NULL", [id, validTo]);
    },
    async rules(framework, eventType) {
      return (await rows(`SELECT ${RULE_COLUMNS} FROM contable.posting_rule WHERE framework = $1 AND event_type = $2 ORDER BY valid_from`, [framework, eventType])).map(toRule);
    },
    async insertRule(r) {
      await client.query("INSERT INTO contable.posting_rule (id, framework, event_type, version, valid_from, valid_to, rule_id, reference_ids, lines) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [r.id, r.framework, r.eventType, r.version, r.validFrom, r.validTo ?? null, r.ruleId, [...r.referenceIds], JSON.stringify(r.lines)]);
    },
    async closeRule(id, validTo) {
      await client.query("UPDATE contable.posting_rule SET valid_to = $2 WHERE id = $1 AND valid_to IS NULL", [id, validTo]);
    },
    async entry(id) {
      if (!UUID.test(id)) return undefined;
      return (await entriesWithLines(await rows(`SELECT ${ENTRY_COLUMNS} FROM contable.journal_entry WHERE id = $1`, [id])))[0];
    },
    async entryBySource(entityId, system, sourceId, name) {
      return (await entriesWithLines(await rows(`SELECT ${ENTRY_COLUMNS} FROM contable.journal_entry WHERE entity_id = $1 AND source_system = $2 AND source_id = $3 AND name = $4`, [entityId, system, sourceId, name])))[0];
    },
    async reversalOf(id) {
      if (!UUID.test(id)) return undefined;
      return (await entriesWithLines(await rows(`SELECT ${ENTRY_COLUMNS} FROM contable.journal_entry WHERE reversal_of = $1`, [id])))[0];
    },
    async insertEntry(e) {
      // Punto de guardado: un duplicado no invalida la transacción del llamador.
      await client.query("SAVEPOINT insert_entry");
      try {
        await client.query(
          "INSERT INTO contable.journal_entry (id, entity_id, entry_date, currency, chart_id, posting_rule_id, event_type, source_system, source_id, name, memo, reversal_of, reason, actor, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
          [e.id, e.entityId, e.entryDate, e.currency, e.chartId, e.postingRuleId, e.eventType, e.source.system, e.source.id, e.name, e.memo ?? null, e.reversalOf ?? null, e.reason ?? null, e.actor ?? null, e.createdAt],
        );
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT insert_entry");
        if ((error as { code?: string }).code === "23505") throw new DuplicateEntryError();
        throw error;
      }
      await client.query(
        "INSERT INTO contable.journal_line (entry_id, line_no, account, debit, credit, memo) SELECT $1, l.line_no, l.account, l.debit::bigint, l.credit::bigint, l.memo FROM jsonb_to_recordset($2::jsonb) AS l(line_no INT, account TEXT, debit TEXT, credit TEXT, memo TEXT)",
        [e.id, JSON.stringify(e.lines.map((l, i) => ({ line_no: i + 1, account: l.account, debit: l.debit.toString(), credit: l.credit.toString(), memo: l.memo ?? null })))],
      );
    },
    async entries(entityId, f) {
      return entriesWithLines(await rows(
        `SELECT ${ENTRY_COLUMNS} FROM contable.journal_entry WHERE entity_id = $1 AND ($2::date IS NULL OR entry_date >= $2) AND ($3::date IS NULL OR entry_date <= $3) AND ($6::text IS NULL OR starts_with(source_id, $6 || ':')) ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT $4 OFFSET $5`,
        [entityId, f.from ?? null, f.to ?? null, f.limit, f.offset, f.sourcePrefix ?? null],
      ));
    },
    async countEntries(entityId, f) {
      const r = await one("SELECT count(*)::text AS n FROM contable.journal_entry WHERE entity_id = $1 AND ($2::date IS NULL OR entry_date >= $2) AND ($3::date IS NULL OR entry_date <= $3) AND ($4::text IS NULL OR starts_with(source_id, $4 || ':'))", [entityId, f.from ?? null, f.to ?? null, f.sourcePrefix ?? null]);
      return Number(r ? str(r, "n") : "0");
    },
    async totals(entityId, to) {
      return (await rows(
        "SELECT l.account, SUM(l.debit)::text AS debit, SUM(l.credit)::text AS credit FROM contable.journal_line l JOIN contable.journal_entry e ON e.id = l.entry_id WHERE e.entity_id = $1 AND e.entry_date <= $2 GROUP BY l.account",
        [entityId, to],
      )).map((r): AccountTotals => ({ account: str(r, "account"), debit: BigInt(str(r, "debit")), credit: BigInt(str(r, "credit")) }));
    },
  };
}

/** Almacén PostgreSQL: cada `transaction` es una transacción READ COMMITTED con su conexión. */
export function createPgLedgerStore(options: { readonly pool: Pool }): LedgerStore {
  return {
    async transaction(work) {
      const client = await options.pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(api(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
