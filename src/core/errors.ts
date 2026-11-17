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
  | "CANNOT_REVERSE_REVERSAL";

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
