import { DuplicateEntryError, type AccountTotals, type EntryFilter, type LedgerStore, type LedgerStoreTx } from "../core/ports.js";
import type { Chart, JournalEntry, LedgerEntity, PostingRule } from "../core/types.js";

/**
 * Almacén en memoria con la misma semántica que el de PostgreSQL: transacciones en serie, con
 * copia y restauración si fallan, e índice de idempotencia. Solo para pruebas.
 */
export function createMemoryLedgerStore(): LedgerStore {
  interface State {
    entities: Map<string, LedgerEntity>;
    charts: Map<string, Chart>;
    rules: PostingRule[];
    entries: JournalEntry[];
  }
  let state: State = { entities: new Map(), charts: new Map(), rules: [], entries: [] };
  let queue: Promise<unknown> = Promise.resolve();

  const filtered = (s: State, entityId: string, f: EntryFilter): JournalEntry[] =>
    s.entries
      .filter((e) => e.entityId === entityId && (f.from === undefined || e.entryDate >= f.from) && (f.to === undefined || e.entryDate <= f.to) && (f.sourcePrefix === undefined || e.source.id.startsWith(`${f.sourcePrefix}:`)))
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.getTime() - a.createdAt.getTime());
  const clone = (s: State): State => ({ entities: new Map(s.entities), charts: new Map(s.charts), rules: [...s.rules], entries: [...s.entries] });

  const tx = (s: State): LedgerStoreTx => ({
    entity: (id) => Promise.resolve(s.entities.get(id)),
    entityByExternal: (system, ref) => Promise.resolve([...s.entities.values()].find((e) => e.external.system === system && e.external.ref === ref)),
    insertEntity: (e) => {
      s.entities.set(e.id, e);
      return Promise.resolve();
    },
    charts: (framework) => Promise.resolve([...s.charts.values()].filter((c) => c.framework === framework)),
    chart: (id) => Promise.resolve(s.charts.get(id)),
    insertChart: (c) => {
      s.charts.set(c.id, c);
      return Promise.resolve();
    },
    approveChart: (id, by, at) => {
      const c = s.charts.get(id);
      if (c?.status === "DRAFT") s.charts.set(id, { ...c, status: "APPROVED", approvedBy: by, approvedAt: at });
      return Promise.resolve();
    },
    closeChart: (id, validTo) => {
      const c = s.charts.get(id);
      if (c && c.validTo === undefined) s.charts.set(id, { ...c, validTo });
      return Promise.resolve();
    },
    closeRule: (id, validTo) => {
      s.rules = s.rules.map((r) => (r.id === id && r.validTo === undefined ? { ...r, validTo } : r));
      return Promise.resolve();
    },
    rules: (framework, eventType) => Promise.resolve(s.rules.filter((r) => r.framework === framework && r.eventType === eventType)),
    insertRule: (r) => {
      s.rules.push(r);
      return Promise.resolve();
    },
    entry: (id) => Promise.resolve(s.entries.find((e) => e.id === id)),
    entryBySource: (entityId, system, sourceId, name) => Promise.resolve(s.entries.find((e) => e.entityId === entityId && e.source.system === system && e.source.id === sourceId && e.name === name)),
    reversalOf: (id) => Promise.resolve(s.entries.find((e) => e.reversalOf === id)),
    insertEntry: (e) => {
      if (s.entries.some((x) => x.entityId === e.entityId && x.source.system === e.source.system && x.source.id === e.source.id && x.name === e.name)) return Promise.reject(new DuplicateEntryError());
      s.entries.push(e);
      return Promise.resolve();
    },
    entries: (entityId, f) => Promise.resolve(filtered(s, entityId, f).slice(f.offset, f.offset + f.limit)),
    countEntries: (entityId, f) => Promise.resolve(filtered(s, entityId, f).length),
    totals: (entityId, to) => {
      const acc = new Map<string, AccountTotals>();
      for (const e of s.entries) {
        if (e.entityId !== entityId || e.entryDate > to) continue;
        for (const l of e.lines) {
          const prev = acc.get(l.account) ?? { account: l.account, debit: 0n, credit: 0n };
          acc.set(l.account, { account: l.account, debit: prev.debit + l.debit, credit: prev.credit + l.credit });
        }
      }
      return Promise.resolve([...acc.values()]);
    },
  });

  return {
    transaction<T>(work: (t: LedgerStoreTx) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        const draft = clone(state);
        const result = await work(tx(draft));
        state = draft;
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
