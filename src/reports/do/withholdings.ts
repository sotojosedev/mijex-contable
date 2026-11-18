import type { Ledger } from "../../core/ledger.js";
import type { CivilDate, Minor } from "../../core/types.js";

// R-DO-206: retenciones del mes para el IR-17 (REF-DO-006, página ISR de la DGII: «a más tardar los
// días 10 del mes siguiente al periodo declarado»). El ITBIS retenido se informa, pero la página
// oficial no dice en qué formulario ni con qué plazo se declara: queda [verificar] y sin fecha.

const PERIOD = /^(\d{4})(0[1-9]|1[0-2])$/;

function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD.exec(period);
  if (!match) throw new RangeError(`Periodo no válido (AAAAMM): ${period}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

const civil = (year: number, month: number, day: number): CivilDate =>
  `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Último día del mes anterior al periodo y último día del periodo. */
function bounds(period: string): { before: CivilDate; last: CivilDate } {
  const { year, month } = parsePeriod(period);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prev = new Date(Date.UTC(year, month - 1, 0));
  return { before: civil(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate()), last: civil(year, month, lastDay) };
}

/**
 * Movimiento neto (haber − debe) del mes en las cuentas de retención: lo retenido menos lo revertido.
 * Las cuentas las da el plan del país (roles ISR_WITHHELD e ITBIS_WITHHELD).
 */
export async function withholdingsOfPeriod(ledger: Ledger, entityId: string, accounts: { readonly isr: string; readonly itbis: string }, period: string): Promise<{ isr: Minor; itbis: Minor }> {
  const { before, last } = bounds(period);
  const [start, end] = await Promise.all([ledger.trialBalance(entityId, { to: before }), ledger.trialBalance(entityId, { to: last })]);
  const net = (tb: typeof start, account: string): Minor => {
    const row = tb.rows.find((r) => r.account === account);
    return row ? row.credit - row.debit : 0n;
  };
  return { isr: net(end, accounts.isr) - net(start, accounts.isr), itbis: net(end, accounts.itbis) - net(start, accounts.itbis) };
}

export interface Ir17Summary {
  readonly period: string;
  readonly isrWithheld: Minor;
  /** Día 10 del mes siguiente (REF-DO-006). Si cae en fin de semana o feriado: [verificar]. */
  readonly dueDate: CivilDate;
  readonly itbisWithheld: Minor;
  readonly notes: readonly string[];
}

export function buildIr17Summary(input: { readonly period: string; readonly isrWithheld: Minor; readonly itbisWithheld: Minor }): Ir17Summary {
  const { year, month } = parsePeriod(input.period);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    period: input.period,
    isrWithheld: input.isrWithheld,
    dueDate: civil(next.year, next.month, 10),
    itbisWithheld: input.itbisWithheld,
    notes: [
      "Retenciones de ISR: IR-17, a más tardar el día 10 del mes siguiente (DGII, Impuesto sobre la Renta). Si cae en fin de semana o feriado, [verificar] la prórroga.",
      "ITBIS retenido: [verificar] formulario y plazo; la página oficial del ITBIS no lo indica (el ITBIS mensual vence el día 20).",
    ],
  };
}
