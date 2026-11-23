import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPgLedgerStore } from "../../src/persistence/pg/store.js";
import { createLedger } from "../../src/core/ledger.js";
import { ledgerContract } from "../contract/ledger.contract.js";
import { installFramework, MIJEX_EVENTS, MIJEX_FRAMEWORKS } from "../../src/frameworks/index.js";
import { resetDatabase, testPool } from "./pg-env.js";
import { createPgOperationsStore } from "../../src/persistence/pg/operations-store.js";
import { operationsContract } from "../contract/operations.contract.js";
import { readFile } from "node:fs/promises";
import type pg from "pg";

const pool = testPool();
afterAll(() => pool.end());

ledgerContract("PostgreSQL", async () => {
  await resetDatabase(pool);
  return { store: createPgLedgerStore({ pool }) };
});

operationsContract("PostgreSQL", async () => {
  await resetDatabase(pool);
  return createPgOperationsStore({ pool });
});

describe("[K12][R-CORE-014] PostgreSQL: retirada del catálogo fiscal (0008, spec 005)", () => {
  const sql = (name: string) => readFile(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
  // Recrea el catálogo tal como lo dejaron 0005 y 0006 dentro de una transacción que se deshace al final.
  async function withOldCatalog(work: (client: pg.PoolClient) => Promise<void>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await sql("0005_fiscal_rule_catalog.sql"));
      await client.query(await sql("0006_fiscal_rule_review.sql"));
      await work(client);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  const exists = async (client: pg.PoolClient) =>
    (await client.query<{ t: string | null; f: string | null }>("SELECT to_regclass('contable.fiscal_rule')::text AS t, to_regprocedure('contable.fiscal_rule_review_guard()')::text AS f")).rows[0];

  it("las bases migradas ya no tienen el catálogo; 0005 y 0006 siguen en el historial", async () => {
    const { rows } = await pool.query<{ t: string | null }>("SELECT to_regclass('contable.fiscal_rule')::text AS t");
    expect(rows[0]?.t).toBeNull();
    const applied = (await pool.query<{ name: string }>("SELECT name FROM contable.schema_migrations ORDER BY name")).rows.map((r) => r.name);
    expect(applied).toEqual(expect.arrayContaining(["0005_fiscal_rule_catalog.sql", "0006_fiscal_rule_review.sql", "0008_drop_fiscal_rule_catalog.sql"]));
  });

  it("con la tabla vacía, elimina la tabla y su función de guardia y conserva reject_mutation", async () => {
    await withOldCatalog(async (client) => {
      expect(await exists(client)).toEqual({ t: "contable.fiscal_rule", f: "contable.fiscal_rule_review_guard()" });
      await client.query(await sql("0008_drop_fiscal_rule_catalog.sql"));
      expect(await exists(client)).toEqual({ t: null, f: null });
      const { rows } = await client.query<{ f: string | null }>("SELECT to_regprocedure('contable.reject_mutation()')::text AS f");
      expect(rows[0]?.f).toBe("contable.reject_mutation()");
    });
  });

  it("con filas, falla y no borra nada", async () => {
    await withOldCatalog(async (client) => {
      await client.query(
        `INSERT INTO contable.fiscal_rule (id, rule_id, version, country, jurisdiction, organization_type, operation_type, treatment, validation, valid_from, recorded_by, reason, proposed_by)
         VALUES ('7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e20', 'R-T', 1, 'DO', 'DO', 'ADMINISTRADOR', 'OTRO', 'FISCAL_INVOICE', 'APPROVED_PENDING_VERIFICATION', '2000-01-01', 'system', 'prueba', 'system')`,
      );
      await client.query("SAVEPOINT antes");
      await expect(client.query(await sql("0008_drop_fiscal_rule_catalog.sql"))).rejects.toThrow(/tiene filas/);
      await client.query("ROLLBACK TO SAVEPOINT antes");
      expect(await exists(client)).toEqual({ t: "contable.fiscal_rule", f: "contable.fiscal_rule_review_guard()" });
      expect((await client.query("SELECT 1 FROM contable.fiscal_rule")).rowCount).toBe(1);
    });
  });
});

describe("[R-CORE-012] PostgreSQL: el registro de operaciones es de solo inserción", () => {
  beforeEach(() => resetDatabase(pool));
  it("no se edita ni se borra", async () => {
    const store = createPgOperationsStore({ pool });
    const r = await store.insert({ id: "7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e01", organizationId: "org-a", kind: "INVOICE", occurredOn: "2026-11-10", amount: 100n, currency: "EUR", counterparty: "x", document: null, source: { system: "t", id: "1" }, links: [], origin: "AUTOMATIC", recordedBy: "system", nature: null, sourceVersion: 1, reverses: null, reason: null, fiscal: null });
    await expect(pool.query("UPDATE contable.operation_record SET amount = 1 WHERE id = $1", [r.id])).rejects.toThrow(/solo inserción/);
    await expect(pool.query("DELETE FROM contable.operation_record WHERE id = $1", [r.id])).rejects.toThrow(/solo inserción/);
  });

  it("[R-CORE-012] 0004: una reversión exige motivo y cada registro se revierte una sola vez (spec 003 Q3)", async () => {
    const store = createPgOperationsStore({ pool });
    const base = { organizationId: "org-a", kind: "INVOICE" as const, occurredOn: "2026-11-10", currency: "EUR", counterparty: "x", document: null, source: { system: "t", id: "2" }, links: [], origin: "AUTOMATIC" as const, recordedBy: "system", nature: null, fiscal: null };
    const r = await store.insert({ ...base, id: "7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e02", amount: 100n, sourceVersion: 1, reverses: null, reason: null });
    await expect(store.insert({ ...base, id: "7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e03", amount: -100n, sourceVersion: 2, reverses: r.id, reason: " " })).rejects.toThrow(/operation_record_reversal_reason/);
    const first = await store.insert({ ...base, id: "7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e04", amount: -100n, sourceVersion: 2, reverses: r.id, reason: "anulada" });
    const again = await store.insert({ ...base, id: "7d0c7a52-0f8a-4c51-9a43-3f2f7a1d8e05", amount: -100n, sourceVersion: 3, reverses: r.id, reason: "anulada" });
    expect(again.id).toBe(first.id);
  });
});

// Garantías que da la base aunque alguien escriba sin la librería.
describe("PostgreSQL: garantías del esquema", () => {
  beforeEach(() => resetDatabase(pool));

  const seed = async () => {
    const ledger = createLedger({ store: createPgLedgerStore({ pool }) });
    const entity = await ledger.registerEntity({ kind: "PLATFORM", country: "DO", currency: "DOP", framework: "TEST", external: { system: "hs", ref: "p" }, name: "MIJEX" });
    const chart = await ledger.registerChart({ framework: "TEST", version: "1", validFrom: "2026-01-01", referenceIds: [], accounts: [{ code: "1110", name: "Banco", type: "ASSET", normalSide: "DEBIT" }, { code: "4110", name: "Comisiones", type: "REVENUE", normalSide: "CREDIT" }] });
    await ledger.approveChart(chart.id, { actor: "contador" });
    await ledger.registerRule({ framework: "TEST", eventType: "E", version: "1", validFrom: "2026-01-01", ruleId: "R-TEST-1", referenceIds: [], lines: [{ side: "DEBIT", account: "1110", amount: "x" }, { side: "CREDIT", account: "4110", amount: "x" }] });
    const { entry } = await ledger.post({ entityId: entity.id, type: "E", source: { system: "hs", id: "1" }, name: "n", occurredOn: "2026-11-10", currency: "DOP", amounts: { x: 500n } });
    return { entity, chart, entry };
  };

  it("[R-CORE-003] asientos, líneas y cuentas no se editan ni se borran", async () => {
    const { entry, chart } = await seed();
    await expect(pool.query("UPDATE contable.journal_line SET debit = 1 WHERE entry_id = $1", [entry.id])).rejects.toThrow(/solo inserción/);
    await expect(pool.query("DELETE FROM contable.journal_entry WHERE id = $1", [entry.id])).rejects.toThrow(/solo inserción/);
    await expect(pool.query("UPDATE contable.account SET name = 'x' WHERE chart_id = $1", [chart.id])).rejects.toThrow(/solo inserción/);
    await expect(pool.query("UPDATE contable.chart SET version = '9' WHERE id = $1", [chart.id])).rejects.toThrow(/solo se aprueba/);
    await expect(pool.query("INSERT INTO contable.account (chart_id, code, name, type, normal_side, position) VALUES ($1, '9999', 'Nueva', 'ASSET', 'DEBIT', 9)", [chart.id])).rejects.toThrow(/aprobado/);
  });

  it("[R-CORE-002] un asiento descuadrado escrito a mano no se confirma", async () => {
    const { entry, entity } = await seed();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO contable.journal_entry (id, entity_id, entry_date, currency, chart_id, posting_rule_id, event_type, source_system, source_id, name, created_at) SELECT gen_random_uuid(), $1, '2026-11-11', 'DOP', chart_id, posting_rule_id, 'E', 'manual', 'x', 'n', now() FROM contable.journal_entry WHERE id = $2",
        [entity.id, entry.id],
      );
      await client.query("INSERT INTO contable.journal_line (entry_id, line_no, account, debit, credit) SELECT id, 1, '1110', 100, 0 FROM contable.journal_entry WHERE source_system = 'manual'");
      await expect(client.query("COMMIT")).rejects.toThrow(/descuadrado/);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("[R-CORE-004] dos procesos con el mismo hecho a la vez dejan un solo asiento", async () => {
    const { entity } = await seed();
    const a = createLedger({ store: createPgLedgerStore({ pool }) });
    const b = createLedger({ store: createPgLedgerStore({ pool }) });
    const event = { entityId: entity.id, type: "E", source: { system: "hs", id: "dup" }, name: "n", occurredOn: "2026-11-12", currency: "DOP", amounts: { x: 7n } } as const;
    const [r1, r2] = await Promise.all([a.post(event), b.post(event)]);
    expect(r1.entry.id).toBe(r2.entry.id);
    expect([r1.created, r2.created].filter(Boolean)).toHaveLength(1);
    expect((await pool.query("SELECT 1 FROM contable.journal_entry WHERE source_id = 'dup'")).rowCount).toBe(1);
  });
});

describe("PostgreSQL: marcos de MIJEX (fase 1b)", () => {
  beforeEach(() => resetDatabase(pool));

  it("instala ES-PGC-PYMES y DO-NIIF-PYMES aprobados y registra un asiento por evento", async () => {
    const ledger = createLedger({ store: createPgLedgerStore({ pool }) });
    for (const fw of MIJEX_FRAMEWORKS) {
      const { chart, rules } = await installFramework(ledger, fw, { approvedBy: "usuario (REF-DEC-006)" });
      expect(chart.status).toBe("APPROVED");
      expect(rules).toHaveLength(MIJEX_EVENTS.length);
    }
    const entity = await ledger.registerEntity({ kind: "PLATFORM", country: "DO", currency: "DOP", framework: "DO-NIIF-PYMES", external: { system: "hs", ref: "platform-DO" }, name: "MIJEX DO" });
    const { entry } = await ledger.post({ entityId: entity.id, type: "ServiceSettledAgent", source: { system: "hs", id: "e1" }, name: "accrued_agent", occurredOn: "2026-11-10", currency: "DOP", amounts: { gross: 118_000n, commission: 15_000n, commissionTax: 2_700n, technicianPayable: 100_300n, technicianCash: 0n } });
    expect(entry.lines.map((l) => l.account)).toEqual(["2150", "4110", "2120", "2110"]);
  });
});
