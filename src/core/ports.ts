import type { Chart, CivilDate, JournalEntry, LedgerEntity, PostingRule } from "./types.js";

/** Movimientos acumulados de una cuenta hasta una fecha. */
export interface AccountTotals {
  readonly account: string;
  readonly debit: bigint;
  readonly credit: bigint;
}

/** Operaciones dentro de una transacción del almacén. Todo es de solo inserción salvo aprobar un plan. */
export interface LedgerStoreTx {
  entity(id: string): Promise<LedgerEntity | undefined>;
  entityByExternal(system: string, ref: string): Promise<LedgerEntity | undefined>;
  insertEntity(entity: LedgerEntity): Promise<void>;

  charts(framework: string): Promise<readonly Chart[]>;
  chart(id: string): Promise<Chart | undefined>;
  insertChart(chart: Chart): Promise<void>;
  /** DRAFT → APPROVED (modificación permitida de un plan, junto con cerrar su vigencia). */
  approveChart(id: string, by: string, at: Date): Promise<void>;
  /** Cierra la vigencia abierta de un plan (validTo de vacío a fecha). */
  closeChart(id: string, validTo: CivilDate): Promise<void>;

  rules(framework: string, eventType: string): Promise<readonly PostingRule[]>;
  insertRule(rule: PostingRule): Promise<void>;
  /** Cierra la vigencia abierta de una regla (validTo de vacío a fecha). */
  closeRule(id: string, validTo: CivilDate): Promise<void>;

  entry(id: string): Promise<JournalEntry | undefined>;
  entryBySource(entityId: string, system: string, sourceId: string, name: string): Promise<JournalEntry | undefined>;
  reversalOf(entryId: string): Promise<JournalEntry | undefined>;
  /** Inserta asiento y líneas. Con (entidad, origen, nombre) repetido lanza `DuplicateEntryError`. */
  insertEntry(entry: JournalEntry): Promise<void>;
  entries(entityId: string, filter: { readonly from?: CivilDate | undefined; readonly to?: CivilDate | undefined; readonly limit: number; readonly offset: number }): Promise<readonly JournalEntry[]>;
  totals(entityId: string, to: CivilDate): Promise<readonly AccountTotals[]>;
}

export interface LedgerStore {
  transaction<T>(work: (tx: LedgerStoreTx) => Promise<T>): Promise<T>;
}

/** Señal de los almacenes ante una clave de idempotencia repetida (carrera entre dos procesos). */
export class DuplicateEntryError extends Error {
  constructor() {
    super("El asiento ya existe para ese origen");
    this.name = "DuplicateEntryError";
  }
}
