import { randomUUID } from "node:crypto";
import { LedgerError } from "./errors.js";
import { DuplicateEntryError, type LedgerStore, type LedgerStoreTx } from "./ports.js";
import type { Account, BalanceRow, BalanceSheet, BusinessEvent, Chart, CivilDate, IncomeStatement, JournalEntry, JournalLine, LedgerEntity, PostingRule, StatementLine, TrialBalance } from "./types.js";

// Motor contable multiempresa (spec 001). Reglas:
// - R-CORE-002: cada asiento cuadra (Σ debe = Σ haber, en bigint) o se rechaza.
// - R-CORE-003: solo inserción; un error se corrige con una reversión enlazada y motivada.
// - R-CORE-004: un hecho (entidad, origen, nombre) genera un único asiento.
// - R-CORE-005: plan de cuentas y reglas de asiento son datos versionados por vigencia.

export interface Clock {
  now(): Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Za-z0-9._-]{1,40}$/;

function invalid(message: string, details: Readonly<Record<string, unknown>> = {}): never {
  throw new LedgerError("INVALID_INPUT", message, details);
}

function assertDate(value: string, what: string): void {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!DATE.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(`${what} no es una fecha AAAA-MM-DD válida`, { what });
}

function assertText(value: string, what: string, max = 200): void {
  if (value.trim() === "" || value.length > max) invalid(`${what} es obligatorio (máximo ${String(max)} caracteres)`, { what });
}

/** Vigencia [validFrom, validTo) que contiene la fecha. */
const inForce = (v: { validFrom: CivilDate; validTo?: CivilDate | undefined }, on: CivilDate): boolean => v.validFrom <= on && (v.validTo === undefined || on < v.validTo);

/**
 * Versión nueva frente a las existentes: una vigente abierta que empieza antes se cierra en el
 * inicio de la nueva (se devuelve para cerrarla); cualquier otro solape es un error.
 */
function supersede<T extends { id: string; version: string; validFrom: CivilDate; validTo?: CivilDate | undefined }>(existing: readonly T[], next: { validFrom: CivilDate; validTo?: CivilDate | undefined }): T | undefined {
  const open = existing.find((e) => e.validTo === undefined && e.validFrom < next.validFrom);
  const clash = existing.find((e) => e !== open && overlaps(e, next));
  if (clash) throw new LedgerError("VALIDITY_OVERLAP", "Su vigencia se solapa con otra versión", { other: clash.version });
  return open;
}

/** ¿Se solapan dos vigencias? */
const overlaps = (a: { validFrom: CivilDate; validTo?: CivilDate | undefined }, b: { validFrom: CivilDate; validTo?: CivilDate | undefined }): boolean =>
  a.validFrom < (b.validTo ?? "9999-12-31") && b.validFrom < (a.validTo ?? "9999-12-31");

const sameEntry = (a: JournalEntry, e: BusinessEvent, lines: readonly JournalLine[]): boolean =>
  a.eventType === e.type && a.entryDate === e.occurredOn && a.currency === e.currency &&
  a.lines.length === lines.length && a.lines.every((l, i) => l.account === lines[i]?.account && l.debit === lines[i].debit && l.credit === lines[i].credit);

/** Día anterior a una fecha civil. */
function previousDay(date: CivilDate): CivilDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Cuentas del marco: las del plan vigente en la fecha y, para códigos antiguos, la última versión que los tuvo. */
async function accountsOf(tx: LedgerStoreTx, framework: string, on: CivilDate): Promise<Map<string, Account>> {
  const map = new Map<string, Account>();
  const charts = [...(await tx.charts(framework))].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  for (const chart of charts) for (const a of chart.accounts) if (!map.has(a.code) || inForce(chart, on) || chart.validFrom <= on) map.set(a.code, a);
  return map;
}

/** Línea de estado en el lado normal de la cuenta (sin cuenta conocida: deudora). */
function statementLine(l: { account: string; debit: bigint; credit: bigint }, account: Account | undefined): StatementLine {
  const debitNormal = (account?.normalSide ?? "DEBIT") === "DEBIT";
  return { account: l.account, name: account?.name ?? l.account, amount: debitNormal ? l.debit - l.credit : l.credit - l.debit };
}

export interface RegisterEntityInput {
  readonly kind: LedgerEntity["kind"];
  readonly country: string;
  readonly currency: string;
  readonly framework: string;
  readonly external: { readonly system: string; readonly ref: string };
  readonly name: string;
}

export interface RegisterChartInput {
  readonly framework: string;
  readonly version: string;
  readonly validFrom: CivilDate;
  readonly validTo?: CivilDate | undefined;
  readonly referenceIds: readonly string[];
  readonly accounts: readonly Account[];
}

export type RegisterRuleInput = Omit<PostingRule, "id">;

export interface Ledger {
  registerEntity(input: RegisterEntityInput): Promise<LedgerEntity>;
  registerChart(input: RegisterChartInput): Promise<Chart>;
  approveChart(chartId: string, input: { readonly actor: string }): Promise<Chart>;
  registerRule(input: RegisterRuleInput): Promise<PostingRule>;
  post(event: BusinessEvent): Promise<{ readonly entry: JournalEntry; readonly created: boolean }>;
  reverse(entryId: string, input: { readonly actor: string; readonly reason: string; readonly on?: CivilDate | undefined }): Promise<JournalEntry>;
  entries(entityId: string, filter: { readonly from?: CivilDate | undefined; readonly to?: CivilDate | undefined; readonly limit?: number | undefined; readonly offset?: number | undefined }): Promise<readonly JournalEntry[]>;
  trialBalance(entityId: string, input: { readonly to: CivilDate }): Promise<TrialBalance>;
  /** Cuenta de resultados del periodo [from, to]. */
  incomeStatement(entityId: string, input: { readonly from: CivilDate; readonly to: CivilDate }): Promise<IncomeStatement>;
  /** Balance de situación a una fecha. */
  balanceSheet(entityId: string, input: { readonly at: CivilDate }): Promise<BalanceSheet>;
  /** Planes de cuentas de un marco (todas las versiones). */
  charts(framework: string): Promise<readonly Chart[]>;
  /** Asiento de un hecho (entidad, origen, nombre), si ya está registrado. */
  entryBySource(entityId: string, source: { readonly system: string; readonly id: string }, name: string): Promise<JournalEntry | undefined>;
}

export function createLedger(deps: { readonly store: LedgerStore; readonly clock?: Clock | undefined }): Ledger {
  const clock = deps.clock ?? { now: () => new Date() };

  const requireEntity = async (tx: LedgerStoreTx, id: string): Promise<LedgerEntity> => {
    const entity = await tx.entity(id);
    if (!entity) throw new LedgerError("ENTITY_NOT_FOUND", "Entidad contable no encontrada", { entityId: id });
    return entity;
  };

  const chartFor = async (tx: LedgerStoreTx, framework: string, on: CivilDate): Promise<Chart> => {
    const chart = (await tx.charts(framework)).find((c) => c.status === "APPROVED" && inForce(c, on));
    if (!chart) throw new LedgerError("CHART_NOT_FOUND", "No hay plan de cuentas aprobado vigente para el marco y la fecha", { framework, on });
    return chart;
  };

  const buildLines = (rule: PostingRule, chart: Chart, event: BusinessEvent): JournalLine[] => {
    const codes = new Set(chart.accounts.map((a) => a.code));
    const lines: JournalLine[] = [];
    let debit = 0n;
    let credit = 0n;
    for (const line of rule.lines) {
      if (!codes.has(line.account)) throw new LedgerError("ACCOUNT_UNKNOWN", "La regla usa una cuenta que no está en el plan vigente", { account: line.account, ruleId: rule.ruleId, chart: chart.version });
      const amount = event.amounts[line.amount];
      if (amount === undefined || amount < 0n) throw new LedgerError("AMOUNT_INVALID", "Falta un importe del evento o es negativo", { amount: line.amount });
      if (amount === 0n) continue;
      if (line.side === "DEBIT") debit += amount;
      else credit += amount;
      lines.push({ account: line.account, debit: line.side === "DEBIT" ? amount : 0n, credit: line.side === "CREDIT" ? amount : 0n, ...(line.memo ? { memo: line.memo } : {}) });
    }
    if (lines.length === 0) throw new LedgerError("EMPTY_ENTRY", "El asiento no tiene importes");
    if (debit !== credit) throw new LedgerError("UNBALANCED", "El asiento no cuadra", { debit: debit.toString(), credit: credit.toString() });
    return lines;
  };

  return {
    async registerEntity(input) {
      for (const [v, w] of [[input.country, "País"], [input.currency, "Moneda"], [input.framework, "Marco"], [input.external.system, "Sistema"], [input.external.ref, "Referencia"], [input.name, "Nombre"]] as const) assertText(v, w);
      if (!/^[A-Z]{2}$/.test(input.country) || !/^[A-Z]{3}$/.test(input.currency)) invalid("País (ISO 3166-1) o moneda (ISO 4217) no válidos");
      return deps.store.transaction(async (tx) => {
        const existing = await tx.entityByExternal(input.external.system, input.external.ref);
        if (existing) return existing;
        const entity: LedgerEntity = { id: randomUUID(), ...input, createdAt: clock.now() };
        await tx.insertEntity(entity);
        return entity;
      });
    },

    async registerChart(input) {
      assertText(input.framework, "Marco");
      assertText(input.version, "Versión");
      assertDate(input.validFrom, "Inicio de vigencia");
      if (input.validTo !== undefined) assertDate(input.validTo, "Fin de vigencia");
      const codes = input.accounts.map((a) => a.code);
      if (codes.length === 0 || new Set(codes).size !== codes.length || codes.some((c) => !CODE.test(c)) || input.accounts.some((a) => a.name.trim() === "")) {
        throw new LedgerError("CHART_INVALID", "El plan necesita cuentas con código único y nombre");
      }
      return deps.store.transaction(async (tx) => {
        const chart: Chart = { id: randomUUID(), framework: input.framework, version: input.version, validFrom: input.validFrom, validTo: input.validTo, status: "DRAFT", referenceIds: [...input.referenceIds], accounts: input.accounts.map((a) => ({ ...a })) };
        if ((await tx.charts(input.framework)).some((c) => c.version === input.version)) throw new LedgerError("CHART_INVALID", "Ya existe esa versión del plan", { version: input.version });
        await tx.insertChart(chart);
        return chart;
      });
    },

    async approveChart(chartId, { actor }) {
      assertText(actor, "Actor");
      return deps.store.transaction(async (tx) => {
        const chart = await tx.chart(chartId);
        if (!chart) throw new LedgerError("CHART_NOT_FOUND", "Plan de cuentas no encontrado", { chartId });
        if (chart.status === "APPROVED") return chart;
        const previous = supersede((await tx.charts(chart.framework)).filter((c) => c.status === "APPROVED"), chart);
        if (previous) await tx.closeChart(previous.id, chart.validFrom);
        const at = clock.now();
        await tx.approveChart(chartId, actor, at);
        return { ...chart, status: "APPROVED", approvedBy: actor, approvedAt: at };
      });
    },

    async registerRule(input) {
      for (const [v, w] of [[input.framework, "Marco"], [input.eventType, "Evento"], [input.version, "Versión"], [input.ruleId, "Regla"]] as const) assertText(v, w);
      assertDate(input.validFrom, "Inicio de vigencia");
      if (input.validTo !== undefined) assertDate(input.validTo, "Fin de vigencia");
      const sides = new Set(input.lines.map((l) => l.side));
      if (!sides.has("DEBIT") || !sides.has("CREDIT") || input.lines.some((l) => !CODE.test(l.account) || l.amount.trim() === "")) {
        throw new LedgerError("RULE_INVALID", "La regla necesita líneas al debe y al haber, con cuenta e importe");
      }
      return deps.store.transaction(async (tx) => {
        const previous = supersede(await tx.rules(input.framework, input.eventType), input);
        if (previous) await tx.closeRule(previous.id, input.validFrom);
        const rule: PostingRule = { id: randomUUID(), ...input, referenceIds: [...input.referenceIds], lines: input.lines.map((l) => ({ ...l })) };
        await tx.insertRule(rule);
        return rule;
      });
    },

    async post(event) {
      assertDate(event.occurredOn, "Fecha del hecho");
      for (const [v, w] of [[event.type, "Evento"], [event.source.system, "Sistema"], [event.source.id, "Origen"], [event.name, "Nombre del hecho"]] as const) assertText(v, w);
      const attempt = () =>
        deps.store.transaction(async (tx) => {
          const entity = await requireEntity(tx, event.entityId);
          if (event.currency !== entity.currency) throw new LedgerError("CURRENCY_MISMATCH", "El evento no está en la moneda funcional de la entidad", { currency: event.currency });
          const chart = await chartFor(tx, entity.framework, event.occurredOn);
          const rule = (await tx.rules(entity.framework, event.type)).find((r) => inForce(r, event.occurredOn));
          if (!rule) throw new LedgerError("RULE_NOT_FOUND", "No hay regla de asiento vigente para el evento", { eventType: event.type, on: event.occurredOn });
          const lines = buildLines(rule, chart, event);
          const existing = await tx.entryBySource(entity.id, event.source.system, event.source.id, event.name);
          if (existing) {
            if (!sameEntry(existing, event, lines)) invalid("El hecho ya está registrado con otros datos: corrígelo con una reversión", { entryId: existing.id });
            return { entry: existing, created: false };
          }
          const entry: JournalEntry = {
            id: randomUUID(), entityId: entity.id, entryDate: event.occurredOn, currency: event.currency, chartId: chart.id, postingRuleId: rule.id,
            eventType: event.type, source: { ...event.source }, name: event.name, ...(event.memo ? { memo: event.memo } : {}), lines, createdAt: clock.now(),
          };
          await tx.insertEntry(entry);
          return { entry, created: true };
        });
      try {
        return await attempt();
      } catch (err) {
        // Dos procesos con el mismo hecho a la vez: el índice único deja uno; el otro relee.
        if (err instanceof DuplicateEntryError) return attempt();
        throw err;
      }
    },

    async reverse(entryId, { actor, reason, on }) {
      assertText(actor, "Actor");
      assertText(reason, "Motivo", 500);
      if (on !== undefined) assertDate(on, "Fecha de la reversión");
      return deps.store.transaction(async (tx) => {
        const original = await tx.entry(entryId);
        if (!original) throw new LedgerError("ENTRY_NOT_FOUND", "Asiento no encontrado", { entryId });
        if (original.reversalOf !== undefined) throw new LedgerError("CANNOT_REVERSE_REVERSAL", "Una reversión no se revierte: registra el hecho de nuevo");
        if (await tx.reversalOf(entryId)) throw new LedgerError("ALREADY_REVERSED", "El asiento ya está revertido", { entryId });
        const at = clock.now();
        const reversal: JournalEntry = {
          id: randomUUID(), entityId: original.entityId, entryDate: on ?? at.toISOString().slice(0, 10), currency: original.currency, chartId: original.chartId,
          postingRuleId: original.postingRuleId, eventType: original.eventType, source: original.source, name: `${original.name}:reversal`,
          lines: original.lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit, ...(l.memo ? { memo: l.memo } : {}) })),
          reversalOf: original.id, reason: reason.trim(), actor, createdAt: at,
        };
        await tx.insertEntry(reversal);
        return reversal;
      });
    },

    async entries(entityId, filter) {
      return deps.store.transaction(async (tx) => {
        await requireEntity(tx, entityId);
        return tx.entries(entityId, { from: filter.from, to: filter.to, limit: Math.min(Math.max(filter.limit ?? 100, 1), 500), offset: Math.max(filter.offset ?? 0, 0) });
      });
    },

    async incomeStatement(entityId, { from, to }) {
      assertDate(from, "Inicio del periodo");
      assertDate(to, "Fin del periodo");
      if (from > to) invalid("El periodo empieza después de terminar");
      return deps.store.transaction(async (tx) => {
        const entity = await requireEntity(tx, entityId);
        const accounts = await accountsOf(tx, entity.framework, to);
        const before = new Map((await tx.totals(entityId, previousDay(from))).map((t) => [t.account, t]));
        const lines = (await tx.totals(entityId, to)).map((t) => {
          const b = before.get(t.account);
          return { account: t.account, debit: t.debit - (b?.debit ?? 0n), credit: t.credit - (b?.credit ?? 0n) };
        });
        const of = (pick: (a: Account | undefined) => boolean): StatementLine[] =>
          lines.filter((l) => pick(accounts.get(l.account)) && (l.debit !== 0n || l.credit !== 0n)).map((l) => statementLine(l, accounts.get(l.account))).sort((a, b) => a.account.localeCompare(b.account));
        const revenue = of((a) => a?.type === "REVENUE" && a.normalSide === "CREDIT");
        const contraRevenue = of((a) => a?.type === "REVENUE" && a.normalSide === "DEBIT");
        const costOfSales = of((a) => a?.type === "EXPENSE" && a.group === "COST_OF_SALES");
        const operatingExpenses = of((a) => a?.type === "EXPENSE" && a.group !== "COST_OF_SALES");
        const sum = (xs: readonly StatementLine[]) => xs.reduce((s, x) => s + x.amount, 0n);
        const grossRevenue = sum(revenue);
        const netRevenue = grossRevenue - sum(contraRevenue);
        const grossProfit = netRevenue - sum(costOfSales);
        return { entityId, from, to, currency: entity.currency, revenue, contraRevenue, costOfSales, operatingExpenses, grossRevenue, netRevenue, grossProfit, netIncome: grossProfit - sum(operatingExpenses) };
      });
    },

    async balanceSheet(entityId, { at }) {
      assertDate(at, "Fecha del balance");
      return deps.store.transaction(async (tx) => {
        const entity = await requireEntity(tx, entityId);
        const accounts = await accountsOf(tx, entity.framework, at);
        const lines = (await tx.totals(entityId, at)).filter((t) => t.debit !== 0n || t.credit !== 0n);
        const of = (type: Account["type"]): StatementLine[] => lines.filter((l) => (accounts.get(l.account)?.type ?? "ASSET") === type).map((l) => statementLine(l, accounts.get(l.account))).sort((a, b) => a.account.localeCompare(b.account));
        const pl = lines.filter((l) => ["REVENUE", "EXPENSE"].includes(accounts.get(l.account)?.type ?? ""));
        const currentEarnings = pl.reduce((s, l) => s + l.credit - l.debit, 0n);
        const sum = (xs: readonly StatementLine[]) => xs.reduce((s, x) => s + x.amount, 0n);
        const assets = of("ASSET");
        const liabilities = of("LIABILITY");
        const equity = of("EQUITY");
        const totalAssets = sum(assets);
        const totalLiabilities = sum(liabilities);
        const totalEquity = sum(equity) + currentEarnings;
        return { entityId, at, currency: entity.currency, assets, liabilities, equity, currentEarnings, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
      });
    },

    async charts(framework) {
      assertText(framework, "Marco");
      return deps.store.transaction((tx) => tx.charts(framework));
    },

    async entryBySource(entityId, source, name) {
      return deps.store.transaction(async (tx) => {
        await requireEntity(tx, entityId);
        return tx.entryBySource(entityId, source.system, source.id, name);
      });
    },

    async trialBalance(entityId, { to }) {
      assertDate(to, "Fecha de corte");
      return deps.store.transaction(async (tx) => {
        const entity = await requireEntity(tx, entityId);
        const totals = await tx.totals(entityId, to);
        const names = new Map<string, Account>();
        for (const chart of await tx.charts(entity.framework)) for (const a of chart.accounts) if (!names.has(a.code) || inForce(chart, to)) names.set(a.code, a);
        const rows: BalanceRow[] = totals
          .filter((t) => t.debit !== 0n || t.credit !== 0n)
          .map((t) => {
            const account = names.get(t.account);
            const normalDebit = (account?.normalSide ?? "DEBIT") === "DEBIT";
            return { account: t.account, name: account?.name ?? t.account, type: account?.type ?? "ASSET", debit: t.debit, credit: t.credit, balance: normalDebit ? t.debit - t.credit : t.credit - t.debit };
          })
          .sort((a, b) => a.account.localeCompare(b.account));
        return { entityId, to, currency: entity.currency, rows, totalDebit: rows.reduce((s, r) => s + r.debit, 0n), totalCredit: rows.reduce((s, r) => s + r.credit, 0n) };
      });
    },
  };
}
