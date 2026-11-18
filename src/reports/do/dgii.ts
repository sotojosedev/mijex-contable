import { formatMinor } from "@sotojosedev/fiscal-core";
import type { CivilDate, Minor } from "../../core/types.js";

// Formatos de envío de la DGII (R-DO-201…204): Norma General 07-2018 (anexos A, B y C), NG 10-2018
// (umbral del consumo en el 607) y plantillas oficiales vigentes (606 v2025, 607 v2023.1.1,
// 608 v2018.2.1). Ver docs/referencias/do/dgii-formatos-606-607-608.md. Puro: las apps aportan los
// datos de sus documentos; aquí se valida y se genera el TXT oficial.

/** Tablas oficiales de códigos (datos con su fuente). */
export const DGII_CODES = {
  /** Anexo A, tabla de costos y gastos. */
  purchaseType: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"],
  /** Anexo A, tabla de tipo de retención; 09 añadido en la plantilla 606 v2025. */
  isrRetentionType: ["01", "02", "03", "04", "05", "06", "07", "08", "09"],
  /** Anexo A, tabla de forma de pago. */
  paymentMethod: ["01", "02", "03", "04", "05", "06", "07"],
  /** Anexo B / instructivo 607, tipo de ingreso. */
  incomeType: ["01", "02", "03", "04", "05", "06"],
  /** Anexo C, tabla de tipo de anulación. */
  annulmentType: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
} as const;

/** Comprobantes de consumo (factura de consumo y su e-CF): en el 607 solo desde RD$250.000 (NG 10-2018). */
const CONSUMER_TYPES: readonly string[] = ["B02", "E32"];
const CONSUMER_THRESHOLD: Minor = 25_000_000n;

export interface DgiiFile {
  readonly fileName: string;
  /** Detalle, una fila por registro con los campos en el orden oficial. */
  readonly lines: readonly (readonly string[])[];
  readonly txt: string;
  /** Errores que impedirían la remisión (la DGII rechaza el formato con inexactitudes, art. 10). */
  readonly errors: readonly string[];
}

export interface Dgii606Row {
  readonly taxId: string;
  readonly purchaseType: string;
  readonly ncf: string;
  readonly modifiedNcf: string;
  readonly issuedOn: CivilDate;
  /** Vacía si no se ha pagado. */
  readonly paidOn: CivilDate;
  readonly services: Minor;
  readonly goods: Minor;
  readonly itbisBilled: Minor;
  readonly itbisWithheld: Minor;
  readonly itbisProportional: Minor;
  readonly itbisToCost: Minor;
  readonly isrRetentionType: string;
  readonly isrWithheld: Minor;
  readonly selectiveTax: Minor;
  readonly otherTaxes: Minor;
  readonly legalTip: Minor;
  readonly paymentMethod: string;
}

export interface Dgii607Row {
  readonly taxId: string;
  readonly ncf: string;
  readonly modifiedNcf: string;
  readonly incomeType: string;
  readonly issuedOn: CivilDate;
  /** Vacía si no hubo retención. */
  readonly withheldOn: CivilDate;
  readonly billed: Minor;
  readonly itbisBilled: Minor;
  readonly itbisWithheldByThirdParty: Minor;
  readonly isrWithheldByThirdParty: Minor;
  readonly selectiveTax: Minor;
  readonly otherTaxes: Minor;
  readonly legalTip: Minor;
  readonly payments: { readonly cash: Minor; readonly transfer: Minor; readonly card: Minor; readonly credit: Minor; readonly giftCards: Minor; readonly barter: Minor; readonly other: Minor };
}

export interface Dgii608Row {
  readonly ncf: string;
  /** Fecha en que se anuló el comprobante (Anexo C). */
  readonly annulledOn: CivilDate;
  readonly type: string;
}

const amount = (v: Minor): string => formatMinor(v);

/**
 * Número de comprobante: NCF de serie B (11 posiciones) o e-NCF de serie E (13; Informe Técnico e-CF
 * §7). En el comprobante modificado del 606/607 también se admite el NCF anterior a mayo de 2018 (19).
 */
const NCF = /^(B\d{10}|E\d{12})$/;
const MODIFIED_NCF = /^(B\d{10}|E\d{12}|[A-Z]\d{18})$/;
const validNcf = (ncf: string, modified = false): boolean => (modified ? ncf === "" || MODIFIED_NCF.test(ncf) : NCF.test(ncf));
const ymd = (d: CivilDate): string => d.replaceAll("-", "");

function validDate(d: string): boolean {
  const t = new Date(`${d}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** Tipo de identificación: 1 RNC (9 dígitos), 2 cédula (11); en el 607, 3 pasaporte/ID tributaria (otros). */
function idType(taxId: string, allowPassport: boolean): "1" | "2" | "3" | undefined {
  if (/^\d{9}$/.test(taxId)) return "1";
  if (/^\d{11}$/.test(taxId)) return "2";
  return allowPassport && taxId.trim() !== "" ? "3" : undefined;
}

function header(kind: "606" | "607" | "608", rnc: string, period: string, count: number, errors: string[]): string {
  if (!/^\d{9}(\d{2})?$/.test(rnc)) errors.push("RNC del remitente no válido (9 u 11 dígitos)");
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(period)) errors.push("periodo no válido (AAAAMM)");
  return `${kind}|${rnc}|${period}|${String(count)}`;
}

const file = (kind: string, rnc: string, period: string, head: string, lines: string[][], errors: string[]): DgiiFile => ({
  fileName: `DGII_F_${kind}_${rnc}_${period}.TXT`,
  lines,
  txt: [head, ...lines.map((l) => l.join("|"))].map((l) => `${l}\r\n`).join(""),
  errors,
});

export function buildDgii606(input: { readonly rnc: string; readonly period: string; readonly rows: readonly Dgii606Row[] }): DgiiFile {
  const errors: string[] = [];
  const head = header("606", input.rnc, input.period, input.rows.length, errors);
  const lines = input.rows.map((r, i) => {
    const at = `registro ${String(i + 1)}`;
    const id = idType(r.taxId, false);
    if (!id) errors.push(`${at}: RNC o cédula del proveedor no válido`);
    if (!(DGII_CODES.purchaseType as readonly string[]).includes(r.purchaseType)) errors.push(`${at}: tipo de bienes y servicios no válido`);
    if (!(DGII_CODES.paymentMethod as readonly string[]).includes(r.paymentMethod)) errors.push(`${at}: forma de pago no válida`);
    if (!validDate(r.issuedOn) || (r.paidOn !== "" && !validDate(r.paidOn))) errors.push(`${at}: fecha no válida`);
    if (r.isrWithheld > 0n && !(DGII_CODES.isrRetentionType as readonly string[]).includes(r.isrRetentionType)) errors.push(`${at}: falta el tipo de retención de ISR`);
    if (r.itbisToCost > r.itbisBilled) errors.push(`${at}: el ITBIS llevado al costo supera el facturado`);
    if (!validNcf(r.ncf) || !validNcf(r.modifiedNcf, true)) errors.push(`${at}: número de comprobante no válido (B de 11 o e-NCF de 13 posiciones)`);
    return [
      r.taxId, id ?? "", r.purchaseType, r.ncf, r.modifiedNcf, validDate(r.issuedOn) ? ymd(r.issuedOn) : "", r.paidOn && validDate(r.paidOn) ? ymd(r.paidOn) : "",
      amount(r.services), amount(r.goods), amount(r.services + r.goods), amount(r.itbisBilled), amount(r.itbisWithheld), amount(r.itbisProportional), amount(r.itbisToCost),
      // 15 = ITBIS facturado − ITBIS llevado al costo (Anexo A); 16 y 19 (percepciones) no habilitados.
      amount(r.itbisBilled - r.itbisToCost), "", r.isrWithheld > 0n ? r.isrRetentionType : "", amount(r.isrWithheld), "",
      amount(r.selectiveTax), amount(r.otherTaxes), amount(r.legalTip), r.paymentMethod,
    ];
  });
  return file("606", input.rnc, input.period, head, lines, errors);
}

export function buildDgii607(input: { readonly rnc: string; readonly period: string; readonly rows: readonly Dgii607Row[] }): DgiiFile {
  const errors: string[] = [];
  if (input.rows.length > 65_000) errors.push("el 607 admite como máximo 65.000 registros");
  const head = header("607", input.rnc, input.period, input.rows.length, errors);
  const lines = input.rows.map((r, i) => {
    const at = `registro ${String(i + 1)}`;
    const id = idType(r.taxId, true);
    if (!id && r.taxId !== "") errors.push(`${at}: identificación del comprador no válida`);
    if (!(DGII_CODES.incomeType as readonly string[]).includes(r.incomeType)) errors.push(`${at}: tipo de ingreso no válido`);
    if (!validDate(r.issuedOn) || (r.withheldOn !== "" && !validDate(r.withheldOn))) errors.push(`${at}: fecha no válida`);
    if ((r.itbisWithheldByThirdParty > 0n || r.isrWithheldByThirdParty > 0n) && r.withheldOn === "") errors.push(`${at}: una retención exige la fecha de retención`);
    if (!validNcf(r.ncf) || !validNcf(r.modifiedNcf, true)) errors.push(`${at}: número de comprobante no válido (B de 11 o e-NCF de 13 posiciones)`);
    const p = r.payments;
    const total = r.billed + r.itbisBilled + r.selectiveTax + r.otherTaxes + r.legalTip;
    if (p.cash + p.transfer + p.card + p.credit + p.giftCards + p.barter + p.other !== total) errors.push(`${at}: las formas de cobro no suman el total del comprobante`);
    return [
      r.taxId, id ?? "", r.ncf, r.modifiedNcf, r.incomeType, validDate(r.issuedOn) ? ymd(r.issuedOn) : "", r.withheldOn && validDate(r.withheldOn) ? ymd(r.withheldOn) : "",
      // 11 y 13 (percepciones) no habilitados.
      amount(r.billed), amount(r.itbisBilled), amount(r.itbisWithheldByThirdParty), "", amount(r.isrWithheldByThirdParty), "",
      amount(r.selectiveTax), amount(r.otherTaxes), amount(r.legalTip),
      amount(p.cash), amount(p.transfer), amount(p.card), amount(p.credit), amount(p.giftCards), amount(p.barter), amount(p.other),
    ];
  });
  return file("607", input.rnc, input.period, head, lines, errors);
}

export function buildDgii608(input: { readonly rnc: string; readonly period: string; readonly rows: readonly Dgii608Row[] }): DgiiFile {
  const errors: string[] = [];
  const head = header("608", input.rnc, input.period, input.rows.length, errors);
  const lines = input.rows.map((r, i) => {
    const at = `registro ${String(i + 1)}`;
    if (!(DGII_CODES.annulmentType as readonly string[]).includes(r.type)) errors.push(`${at}: tipo de anulación no válido`);
    if (!validDate(r.annulledOn)) errors.push(`${at}: fecha de anulación no válida`);
    if (!validNcf(r.ncf)) errors.push(`${at}: número de comprobante no válido (B de 11 o e-NCF de 13 posiciones)`);
    return [r.ncf, validDate(r.annulledOn) ? ymd(r.annulledOn) : "", r.type];
  });
  return file("608", input.rnc, input.period, head, lines, errors);
}

/** ¿Va el comprobante al detalle del 607? Consumo solo desde RD$250.000 (NG 10-2018, art. 1); el resto, siempre. */
export function includeIn607(documentType: string, totalMinor: Minor): boolean {
  return !CONSUMER_TYPES.includes(documentType) || totalMinor >= CONSUMER_THRESHOLD;
}
