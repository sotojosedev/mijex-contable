// Tipos del dominio contable (spec 001). El motor no conoce países, cuentas ni eventos concretos:
// todo llega como datos versionados por vigencia (R-CORE-005).

/** Fecha civil AAAA-MM-DD (fecha contable, sin hora ni zona). */
export type CivilDate = string;

/** Importe en unidades menores (céntimos), siempre bigint (R-CORE-001). */
export type Minor = bigint;

export type EntityKind = "PLATFORM" | "ORGANIZATION" | "COMMUNITY" | "OWNER";
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type Side = "DEBIT" | "CREDIT";

/** Dueño de un juego de libros (multiempresa y por país; Clarify Q1). */
export interface LedgerEntity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly country: string;
  /** Moneda funcional (ISO 4217). */
  readonly currency: string;
  /** Marco contable (p. ej. ES-PGC-PYMES, DO-NIIF-PYMES): elige plan y reglas. */
  readonly framework: string;
  readonly external: { readonly system: string; readonly ref: string };
  readonly name: string;
  readonly createdAt: Date;
}

export interface Account {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly normalSide: Side;
  /** Presentación en la cuenta de resultados: gasto que forma parte del coste de ventas. */
  readonly group?: "COST_OF_SALES" | undefined;
}

/** Plan de cuentas de un marco, versionado por vigencia [validFrom, validTo). */
export interface Chart {
  readonly id: string;
  readonly framework: string;
  readonly version: string;
  readonly validFrom: CivilDate;
  readonly validTo?: CivilDate | undefined;
  /** Solo un plan aprobado admite asientos (salvo en pruebas). */
  readonly status: "DRAFT" | "APPROVED";
  readonly approvedBy?: string | undefined;
  readonly approvedAt?: Date | undefined;
  /** Fuentes oficiales o decisiones (REF-…). */
  readonly referenceIds: readonly string[];
  readonly accounts: readonly Account[];
}

export interface RuleLine {
  readonly side: Side;
  readonly account: string;
  /** Clave del importe del evento que lleva esta línea. */
  readonly amount: string;
  readonly memo?: string | undefined;
}

/** Regla de asiento: evento de negocio → líneas, por marco y vigencia. */
export interface PostingRule {
  readonly id: string;
  readonly framework: string;
  readonly eventType: string;
  readonly version: string;
  readonly validFrom: CivilDate;
  readonly validTo?: CivilDate | undefined;
  /** Regla de negocio que implementa (R-…). */
  readonly ruleId: string;
  readonly referenceIds: readonly string[];
  readonly lines: readonly RuleLine[];
}

/** Hecho de negocio que emite una app (nunca cuentas). */
export interface BusinessEvent {
  readonly entityId: string;
  readonly type: string;
  readonly source: { readonly system: string; readonly id: string };
  /** Momento del hecho dentro del origen (p. ej. `issued`, `paid`): idempotencia (R-CORE-004). */
  readonly name: string;
  readonly occurredOn: CivilDate;
  readonly currency: string;
  readonly amounts: Readonly<Record<string, Minor>>;
  readonly memo?: string | undefined;
}

export interface JournalLine {
  readonly account: string;
  readonly debit: Minor;
  readonly credit: Minor;
  readonly memo?: string | undefined;
}

export interface JournalEntry {
  readonly id: string;
  readonly entityId: string;
  readonly entryDate: CivilDate;
  readonly currency: string;
  readonly chartId: string;
  /** Regla de asiento aplicada; las reversiones conservan la del original. */
  readonly postingRuleId: string;
  readonly eventType: string;
  readonly source: { readonly system: string; readonly id: string };
  readonly name: string;
  readonly memo?: string | undefined;
  readonly lines: readonly JournalLine[];
  /** Asiento que revierte (R-CORE-003). */
  readonly reversalOf?: string | undefined;
  readonly reason?: string | undefined;
  readonly actor?: string | undefined;
  readonly createdAt: Date;
}

export interface BalanceRow {
  readonly account: string;
  readonly name: string;
  readonly type: AccountType;
  readonly debit: Minor;
  readonly credit: Minor;
  /** Saldo en el lado normal de la cuenta (positivo = saldo normal). */
  readonly balance: Minor;
}

export interface TrialBalance {
  readonly entityId: string;
  readonly to: CivilDate;
  readonly currency: string;
  readonly rows: readonly BalanceRow[];
  readonly totalDebit: Minor;
  readonly totalCredit: Minor;
}

export interface StatementLine {
  readonly account: string;
  readonly name: string;
  /** En el lado normal de la cuenta. */
  readonly amount: Minor;
}

/** Cuenta de resultados de un periodo [from, to] (fechas incluidas). Contra-ingresos: ingresos de saldo deudor. */
export interface IncomeStatement {
  readonly entityId: string;
  readonly from: CivilDate;
  readonly to: CivilDate;
  readonly currency: string;
  readonly revenue: readonly StatementLine[];
  readonly contraRevenue: readonly StatementLine[];
  readonly costOfSales: readonly StatementLine[];
  readonly operatingExpenses: readonly StatementLine[];
  readonly grossRevenue: Minor;
  readonly netRevenue: Minor;
  readonly grossProfit: Minor;
  readonly netIncome: Minor;
}

/** Balance de situación a una fecha: activo = pasivo + patrimonio (con el resultado no cerrado). */
export interface BalanceSheet {
  readonly entityId: string;
  readonly at: CivilDate;
  readonly currency: string;
  readonly assets: readonly StatementLine[];
  readonly liabilities: readonly StatementLine[];
  readonly equity: readonly StatementLine[];
  readonly currentEarnings: Minor;
  readonly totalAssets: Minor;
  readonly totalLiabilities: Minor;
  readonly totalEquity: Minor;
  readonly balanced: boolean;
}
