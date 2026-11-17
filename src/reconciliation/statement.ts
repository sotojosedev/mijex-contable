import { createHash } from "node:crypto";
import { formatMinor, parseMinor } from "@sotojosedev/fiscal-core";
import type { CivilDate, Minor } from "../core/types.js";

// Spec 002 · R-CORE-006: lectura de extractos bancarios en CSV, unión de los lectores de HS y
// Property. Importes exactos en bigint (sin `Number`); una línea ilegible se informa y las demás
// se conservan; huella idéntica a la de Property para no duplicar lo ya importado.

export interface StatementMovement {
  /** Huella estable del movimiento (`csv:` + 32 hex), la misma que guarda Property. */
  readonly externalId: string;
  readonly bookedOn: CivilDate;
  /** Con signo: ingreso > 0, cargo < 0. */
  readonly amount: Minor;
  readonly description: string;
  readonly counterparty: string | null;
  readonly reference: string | null;
}

export interface StatementResult {
  readonly movements: readonly StatementMovement[];
  /** `line` es el número de línea del fichero (la cabecera es la 1). */
  readonly errors: readonly { readonly line: number; readonly message: string }[];
}

const strip = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const HEADERS = {
  date: ["fecha", "fecha operacion", "fecha valor", "fecha transaccion", "date", "booking date"],
  description: ["concepto", "descripcion", "description", "detalle", "movimiento"],
  amount: ["importe", "monto", "amount", "cantidad", "valor"],
  debit: ["debe", "cargo", "debito", "debit", "retiro"],
  credit: ["haber", "abono", "credito", "credit", "deposito"],
  counterparty: ["ordenante", "beneficiario", "contraparte", "counterparty", "remitente"],
  reference: ["referencia", "reference", "ref", "no. referencia", "documento"],
} as const;

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i);
    if (ch === '"') {
      if (quoted && line.charAt(i + 1) === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** "1.234,56" / "1,234.56" / "(50,00)" / "-0,1" → unidades menores; `undefined` si no es un importe de hasta 2 decimales. */
export function parseStatementAmount(raw: string): Minor | undefined {
  let s = raw.replace(/[^\d,.\-+()]/g, "");
  if (s === "") return undefined;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()+-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  // Más de dos decimales o separadores sobrantes: no se redondea en silencio.
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const value = parseMinor(s);
  return negative ? -value : value;
}

/** AAAA-MM-DD o DD/MM/AA(AA) (también con «.» o «-»); `undefined` si la fecha no existe. */
export function parseStatementDate(raw: string): CivilDate | undefined {
  const s = raw.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), (dmy[3] ?? "").length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])];
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : undefined;
}

/** Huella de Property (`bankStatement.ts`): sha256 de cuenta|fecha|importe|concepto|referencia|ocurrencia. */
function fingerprint(accountId: string, m: { bookedOn: string; amount: Minor; description: string; reference: string | null }, occurrence: number): string {
  return "csv:" + createHash("sha256").update([accountId, m.bookedOn, formatMinor(m.amount), m.description, m.reference ?? "", occurrence].join("|")).digest("hex").slice(0, 32);
}

export function parseBankStatementCsv(csv: string, options: { readonly accountId: string; readonly requireDescription?: boolean | undefined }): StatementResult {
  // Property exige concepto (por defecto); HS admite líneas y extractos sin él.
  const requireDescription = options.requireDescription ?? true;
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== "");
  if (headerIndex < 0) return { movements: [], errors: [{ line: 1, message: "El fichero está vacío." }] };
  const first = lines[headerIndex] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";
  const header = splitLine(first, sep).map(strip);
  const col = (names: readonly string[]): number => header.findIndex((h) => names.includes(h));
  const idx = { date: col(HEADERS.date), description: col(HEADERS.description), amount: col(HEADERS.amount), debit: col(HEADERS.debit), credit: col(HEADERS.credit), counterparty: col(HEADERS.counterparty), reference: col(HEADERS.reference) };
  if (idx.date < 0 || (requireDescription && idx.description < 0) || (idx.amount < 0 && (idx.debit < 0 || idx.credit < 0))) {
    return { movements: [], errors: [{ line: headerIndex + 1, message: "Cabecera no reconocida: se necesitan columnas de fecha, concepto e importe (o debe y haber)." }] };
  }
  const cell = (cells: string[], i: number): string => (i >= 0 ? (cells[i] ?? "") : "");
  const seen = new Map<string, number>();
  const movements: StatementMovement[] = [];
  const errors: { line: number; message: string }[] = [];
  lines.forEach((line, i) => {
    if (i <= headerIndex || line.trim() === "") return;
    const cells = splitLine(line, sep);
    const bookedOn = parseStatementDate(cell(cells, idx.date));
    let amount: Minor | undefined;
    if (idx.amount >= 0) amount = parseStatementAmount(cell(cells, idx.amount));
    else {
      const debitRaw = cell(cells, idx.debit);
      const creditRaw = cell(cells, idx.credit);
      const debit = debitRaw === "" ? 0n : parseStatementAmount(debitRaw);
      const credit = creditRaw === "" ? 0n : parseStatementAmount(creditRaw);
      amount = debit === undefined || credit === undefined ? undefined : credit - (debit < 0n ? -debit : debit);
    }
    const description = cell(cells, idx.description);
    if (bookedOn === undefined || amount === undefined || (requireDescription && description === "")) {
      errors.push({ line: i + 1, message: "No se pudo leer la fecha, el concepto o el importe (hasta 2 decimales)." });
      return;
    }
    // Sin recortar: la huella debe coincidir con la de Property; cada app recorta al guardar.
    const reference = cell(cells, idx.reference) || null;
    const counterparty = cell(cells, idx.counterparty) || null;
    const key = [bookedOn, amount.toString(), description, reference ?? ""].join("|");
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const base = { bookedOn, amount, description, reference };
    movements.push({ ...base, counterparty, externalId: fingerprint(options.accountId, base, occurrence) });
  });
  return { movements, errors };
}
