export { createLedger, type Clock, type Ledger, type RegisterChartInput, type RegisterEntityInput, type RegisterRuleInput } from "./core/ledger.js";
export { isLedgerError, LedgerError, type LedgerErrorCode } from "./core/errors.js";
export { DuplicateEntryError, type AccountTotals, type EntryFilter, type LedgerStore, type LedgerStoreTx } from "./core/ports.js";
export type * from "./core/types.js";
export * from "./reconciliation/index.js";
export * from "./frameworks/index.js";
export { buildDgii606, buildDgii607, buildDgii608, DGII_CODES, includeIn607, type DgiiFile, type Dgii606Row, type Dgii607Row, type Dgii608Row } from "./reports/do/dgii.js";
export { buildIr17Summary, withholdingsOfPeriod, type Ir17Summary } from "./reports/do/withholdings.js";
export {
  createMemoryOperationsStore,
  createOperationsRegister,
  decideFiscalIssuance,
  exportOperationsCsv,
  type CorrectionMeta,
  createFiscalRuleCatalog,
  createMemoryFiscalRuleStore,
  type FiscalRuleCatalog,
  type FiscalRuleStore,
  type RuleVersionMeta,
  type StoredFiscalRule,
  type FiscalRule,
  type FiscalTreatment,
  type IssuanceDecision,
  type IssuanceQuery,
  type IssuanceReason,
  type RuleValidation,
  type OperationInput,
  type OperationKind,
  type OperationNature,
  OPERATION_NATURES,
  type OperationRecord,
  type OperationsRegister,
  type OperationsStore,
  // Spec 004b y 004c (K12).
  type ReviewMeta,
  FISCAL_RESULT_CONTRACT_VERSION,
  type FiscalResultEnvelope,
  type RecordedFiscalResult,
} from "./operations/index.js";
