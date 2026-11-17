import type { Ledger, RegisterChartInput, RegisterRuleInput } from "../core/ledger.js";
import type { Account, Chart, PostingRule } from "../core/types.js";
import { MIJEX_EVENTS, type Role } from "./events.js";

// Marcos contables de las entidades PLATFORM de MIJEX (spec 001, fase 1b). Datos, no lógica:
// cuentas por rol y reglas por evento, con regla (R-…) y referencias (REF-…) en cada una.
// Decisión del usuario 2026-11-17 (REF-DEC-006): proceder sin esperar al contador, con las
// normas oficiales verificadas; la revisión del contador queda recomendada, no bloqueante.

export interface FrameworkAccount extends Account {
  /** Rol de negocio que cubre (una cuenta por rol). */
  readonly role: Role;
  /** Cuenta oficial de la que es subcuenta (ES: código del cuadro del PGC PYMES). */
  readonly official?: string | undefined;
}

/** Gastos que forman el coste de ventas (presentación de la cuenta de resultados). */
const COST_OF_SALES_ROLES: ReadonlySet<Role> = new Set(["COST_OF_SERVICES", "COST_OF_MATERIALS"]);

export interface FrameworkData {
  readonly framework: string;
  readonly country: string;
  readonly version: string;
  readonly validFrom: string;
  readonly referenceIds: readonly string[];
  /** Prefijo de los IDs de regla de cada evento (R-ES-1xx, R-DO-1xx). */
  readonly rulePrefix: string;
  readonly accounts: readonly FrameworkAccount[];
}

const a = (role: Role, code: string, name: string, type: Account["type"], normalSide: Account["normalSide"], official?: string): FrameworkAccount => ({ role, code, name, type, normalSide, ...(official ? { official } : {}), ...(COST_OF_SALES_ROLES.has(role) ? { group: "COST_OF_SALES" as const } : {}) });

/**
 * España — PGC PYMES (RD 1515/2007). Numeración y denominación no vinculantes (art. 3.1): MIJEX
 * desarrolla subcuentas de 4 dígitos dentro de la cuenta oficial (`official`), respetando sus
 * criterios. Sin ISR/ITBIS: en España MIJEX no retiene IRPF (spec 033 de HS).
 */
export const ES_PGC_PYMES: FrameworkData = {
  framework: "ES-PGC-PYMES",
  country: "ES",
  version: "2026.1",
  validFrom: "2026-01-01",
  referenceIds: ["REF-ES-005", "REF-ES-006", "REF-ES-004", "REF-DEC-006"],
  rulePrefix: "R-ES-1",
  accounts: [
    a("BANK", "5720", "Bancos e instituciones de crédito c/c vista, euros", "ASSET", "DEBIT", "572"),
    a("GATEWAY", "4402", "Deudores: entidades de pago (pasarelas)", "ASSET", "DEBIT", "440"),
    a("CASH_WITH_TECHS", "4401", "Deudores: técnicos por cobros en efectivo", "ASSET", "DEBIT", "440"),
    a("LEGACY_RECEIVABLE", "4300", "Clientes (euros)", "ASSET", "DEBIT", "430"),
    a("PURCHASE_TAX", "4720", "Hacienda Pública, IVA soportado", "ASSET", "DEBIT", "472"),
    a("AP_SUPPLIERS", "4000", "Proveedores (euros)", "LIABILITY", "CREDIT", "400"),
    a("AP_TECHS", "4100", "Acreedores por prestaciones de servicios (euros)", "LIABILITY", "CREDIT", "410"),
    a("CLIENT_FUNDS", "4101", "Acreedores por cobros por cuenta de técnicos", "LIABILITY", "CREDIT", "410"),
    a("CLIENT_CREDIT", "4380", "Anticipos de clientes", "LIABILITY", "CREDIT", "438"),
    a("SALES_TAX", "4770", "Hacienda Pública, IVA repercutido", "LIABILITY", "CREDIT", "477"),
    a("SHARE_CAPITAL", "1000", "Capital social", "EQUITY", "CREDIT", "100"),
    a("RESULT", "1290", "Resultado del ejercicio", "EQUITY", "CREDIT", "129"),
    a("OWN_SERVICES_REVENUE", "7050", "Prestaciones de servicios", "REVENUE", "CREDIT", "705"),
    a("COMMISSION_REVENUE", "7051", "Prestaciones de servicios: comisiones de intermediación", "REVENUE", "CREDIT", "705"),
    a("MATERIALS_REVENUE", "7000", "Ventas de mercaderías", "REVENUE", "CREDIT", "700"),
    a("SALES_RETURNS", "7080", "Devoluciones de ventas de mercaderías", "REVENUE", "DEBIT", "708"),
    a("COST_OF_SERVICES", "6400", "Sueldos y salarios", "EXPENSE", "DEBIT", "640"),
    a("COST_OF_MATERIALS", "6000", "Compras de mercaderías", "EXPENSE", "DEBIT", "600"),
    a("GATEWAY_FEES", "6260", "Servicios bancarios y similares", "EXPENSE", "DEBIT", "626"),
  ],
};

/**
 * República Dominicana — NIIF para las PYMES (ICPARD, Resolución 002 Acta 2010-004; Ley 479-08
 * art. 31). No hay plan oficial obligatorio: plan propio de MIJEX con los códigos actuales de HS.
 */
export const DO_NIIF_PYMES: FrameworkData = {
  framework: "DO-NIIF-PYMES",
  country: "DO",
  version: "2026.1",
  validFrom: "2026-01-01",
  referenceIds: ["REF-DO-025", "REF-DO-026", "REF-DO-011", "REF-DO-003", "REF-DEC-006"],
  rulePrefix: "R-DO-1",
  accounts: [
    a("BANK", "1110", "Bancos", "ASSET", "DEBIT"),
    a("GATEWAY", "1115", "Cuentas por cobrar a procesadores de pago", "ASSET", "DEBIT"),
    a("LEGACY_RECEIVABLE", "1120", "Cuentas por cobrar a clientes", "ASSET", "DEBIT"),
    a("CASH_WITH_TECHS", "1150", "Cuentas por cobrar a técnicos (efectivo cobrado)", "ASSET", "DEBIT"),
    a("PURCHASE_TAX", "1160", "ITBIS pagado (adelantado)", "ASSET", "DEBIT"),
    a("AP_TECHS", "2110", "Cuentas por pagar a técnicos", "LIABILITY", "CREDIT"),
    a("SALES_TAX", "2120", "ITBIS por pagar", "LIABILITY", "CREDIT"),
    a("ISR_WITHHELD", "2130", "Retenciones de ISR por pagar (IR-17)", "LIABILITY", "CREDIT"),
    a("ITBIS_WITHHELD", "2140", "ITBIS retenido por pagar", "LIABILITY", "CREDIT"),
    a("CLIENT_FUNDS", "2150", "Fondos recibidos por cuenta de técnicos", "LIABILITY", "CREDIT"),
    a("CLIENT_CREDIT", "2155", "Anticipos de clientes", "LIABILITY", "CREDIT"),
    a("AP_SUPPLIERS", "2160", "Cuentas por pagar a proveedores", "LIABILITY", "CREDIT"),
    a("SHARE_CAPITAL", "3100", "Capital social", "EQUITY", "CREDIT"),
    a("RESULT", "3200", "Resultados acumulados", "EQUITY", "CREDIT"),
    a("OWN_SERVICES_REVENUE", "4100", "Ingresos por servicios", "REVENUE", "CREDIT"),
    a("COMMISSION_REVENUE", "4110", "Ingresos por comisiones de intermediación", "REVENUE", "CREDIT"),
    a("MATERIALS_REVENUE", "4120", "Ventas de materiales", "REVENUE", "CREDIT"),
    a("SALES_RETURNS", "4190", "Devoluciones sobre ventas", "REVENUE", "DEBIT"),
    a("COST_OF_SERVICES", "5100", "Costo de servicios (personal técnico)", "EXPENSE", "DEBIT"),
    a("COST_OF_MATERIALS", "5200", "Costo de materiales", "EXPENSE", "DEBIT"),
    a("GATEWAY_FEES", "6100", "Comisiones de procesadores de pago", "EXPENSE", "DEBIT"),
  ],
};

export const MIJEX_FRAMEWORKS: readonly FrameworkData[] = [ES_PGC_PYMES, DO_NIIF_PYMES];

/** Plan de cuentas del marco, listo para `registerChart`. */
export function chartInput(fw: FrameworkData): RegisterChartInput {
  return { framework: fw.framework, version: fw.version, validFrom: fw.validFrom, referenceIds: fw.referenceIds, accounts: fw.accounts.map(({ code, name, type, normalSide, group }) => ({ code, name, type, normalSide, ...(group ? { group } : {}) })) };
}

/** Reglas de asiento del marco: una por evento; las líneas de roles que el marco no tiene se omiten (p. ej. ISR en ES). */
export function ruleInputs(fw: FrameworkData): RegisterRuleInput[] {
  const byRole = new Map(fw.accounts.map((x) => [x.role, x.code]));
  return MIJEX_EVENTS.map((event, i) => ({
    framework: fw.framework,
    eventType: event.type,
    version: fw.version,
    validFrom: fw.validFrom,
    ruleId: `${fw.rulePrefix}${String(i + 1).padStart(2, "0")}`,
    referenceIds: fw.referenceIds,
    lines: event.lines.flatMap((l) => {
      const account = byRole.get(l.role);
      return account ? [{ side: l.side, account, amount: l.amount }] : [];
    }),
  }));
}

/** Da de alta y aprueba el plan y las reglas de un marco (una vez por versión: repetirla es un error). */
export async function installFramework(ledger: Ledger, fw: FrameworkData, input: { readonly approvedBy: string }): Promise<{ readonly chart: Chart; readonly rules: readonly PostingRule[] }> {
  const chart = await ledger.registerChart(chartInput(fw));
  const approved = await ledger.approveChart(chart.id, { actor: input.approvedBy });
  const rules: PostingRule[] = [];
  for (const rule of ruleInputs(fw)) rules.push(await ledger.registerRule(rule));
  return { chart: approved, rules };
}

/** Instala el marco solo si su versión no existe todavía (arranque de las apps). */
export async function ensureFramework(ledger: Ledger, fw: FrameworkData, input: { readonly approvedBy: string }): Promise<"INSTALLED" | "PRESENT"> {
  if ((await ledger.charts(fw.framework)).some((c) => c.version === fw.version)) return "PRESENT";
  await installFramework(ledger, fw, input);
  return "INSTALLED";
}

/** Marco de la entidad PLATFORM de MIJEX en un país (dato: el país de cada marco). */
export function frameworkForCountry(country: string): FrameworkData | undefined {
  return MIJEX_FRAMEWORKS.find((fw) => fw.country === country);
}
