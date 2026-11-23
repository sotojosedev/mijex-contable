export type LedgerErrorCode =
  | "INVALID_INPUT"
  | "ENTITY_NOT_FOUND"
  | "CHART_INVALID"
  | "CHART_NOT_FOUND"
  | "VALIDITY_OVERLAP"
  | "RULE_INVALID"
  | "RULE_NOT_FOUND"
  | "ACCOUNT_UNKNOWN"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_INVALID"
  | "UNBALANCED"
  | "EMPTY_ENTRY"
  | "ENTRY_NOT_FOUND"
  | "ALREADY_REVERSED"
  | "CANNOT_REVERSE_REVERSAL"
  // Spec 003: registro de operaciones y obligaciones fiscales.
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_LINK"
  // Spec 003, corte 2: dos correcciones del mismo origen a la vez (se reintenta).
  | "CONCURRENT_UPDATE"
  // Spec 004c (K12): el resultado fiscal no cumple el contrato (procedencia, versión, estado, ámbito, integridad).
  | "FISCAL_PROVENANCE"
  | "FISCAL_VERSION"
  | "FISCAL_STATUS"
  | "FISCAL_SCOPE"
  | "FISCAL_INTEGRITY"
  // Spec 005 (R-CORE-018): referencias de reglas de fiscal-core mal formadas o repetidas.
  | "FISCAL_RULE_REF";

/** Error tipado de la librería contable; `details` nunca lleva secretos ni datos personales. */
export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export const isLedgerError = (err: unknown): err is LedgerError => err instanceof LedgerError;
