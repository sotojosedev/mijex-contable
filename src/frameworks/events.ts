import type { Side } from "../core/types.js";

// Catálogo de eventos de negocio de MIJEX (spec 001, fase 1b), derivado del mayor actual de HS
// (`ledger.ts`). Cada evento usa ROLES de cuenta; cada marco contable (país) asigna a cada rol su
// cuenta. Así la misma regla de negocio sirve para España y RD sin `if (país)` (R-CORE-005).

export type Role =
  | "BANK"
  | "GATEWAY"
  | "CASH_WITH_TECHS"
  | "LEGACY_RECEIVABLE"
  | "PURCHASE_TAX"
  | "AP_SUPPLIERS"
  | "AP_TECHS"
  | "CLIENT_FUNDS"
  | "CLIENT_CREDIT"
  | "SALES_TAX"
  | "ISR_WITHHELD"
  | "ITBIS_WITHHELD"
  | "SHARE_CAPITAL"
  | "RESULT"
  | "OWN_SERVICES_REVENUE"
  | "COMMISSION_REVENUE"
  | "MATERIALS_REVENUE"
  | "SALES_RETURNS"
  | "COST_OF_SERVICES"
  | "COST_OF_MATERIALS"
  | "GATEWAY_FEES";

export interface EventLine {
  readonly side: Side;
  readonly role: Role;
  /** Clave del importe en `BusinessEvent.amounts` (las líneas a cero no se registran). */
  readonly amount: string;
}

export interface EventDefinition {
  readonly type: string;
  readonly description: string;
  readonly lines: readonly EventLine[];
}

const D = (role: Role, amount: string): EventLine => ({ side: "DEBIT", role, amount });
const C = (role: Role, amount: string): EventLine => ({ side: "CREDIT", role, amount });

/**
 * MIJEX intermedia entre cliente y técnico por cuenta propia: lo cobrado por cuenta del técnico
 * es una deuda con él, no un ingreso; el ingreso de MIJEX es su comisión (ES: PGC NRV 14.ª y
 * Resolución ICAC 10/02/2021 art. 26.4; DO: NIIF para las PYMES, sección 23).
 */
export const MIJEX_EVENTS: readonly EventDefinition[] = [
  { type: "PaymentVerified", description: "Cobro verificado de un cliente (por cuenta de los técnicos hasta liquidar)", lines: [D("BANK", "bank"), D("GATEWAY", "gateway"), D("CASH_WITH_TECHS", "cash"), D("CLIENT_CREDIT", "creditApplied"), C("CLIENT_FUNDS", "total")] },
  { type: "ServiceSettledAgent", description: "Servicio liquidado de un técnico por cuenta propia: comisión de MIJEX y deuda con el técnico", lines: [D("CLIENT_FUNDS", "gross"), C("COMMISSION_REVENUE", "commission"), C("SALES_TAX", "commissionTax"), C("AP_TECHS", "technicianPayable"), C("CASH_WITH_TECHS", "technicianCash")] },
  { type: "ServiceSettledEmployee", description: "Servicio de un técnico empleado: MIJEX presta el servicio (ingreso propio) y su bono", lines: [D("CLIENT_FUNDS", "gross"), C("OWN_SERVICES_REVENUE", "labor"), C("SALES_TAX", "tax"), D("COST_OF_SERVICES", "bonus"), C("AP_TECHS", "bonus")] },
  { type: "PayoutApproved", description: "Liquidación aprobada: impuesto de la comisión, retenciones y retención del cliente", lines: [D("AP_TECHS", "total"), C("SALES_TAX", "commissionTax"), C("ISR_WITHHELD", "isr"), C("ITBIS_WITHHELD", "itbis"), C("CLIENT_FUNDS", "clientWithheld")] },
  { type: "TechnicianPaid", description: "Pago al técnico (liquidación o ganancia)", lines: [D("AP_TECHS", "amount"), C("BANK", "amount")] },
  { type: "CashDebtSettled", description: "Deuda de efectivo del técnico saldada por banco o descontada de su liquidación", lines: [D("BANK", "byBank"), D("AP_TECHS", "byPayout"), C("CASH_WITH_TECHS", "total")] },
  { type: "CashDebtIncreased", description: "Deuda de efectivo del técnico que aumenta (devolución de lo descontado)", lines: [D("CASH_WITH_TECHS", "total"), C("BANK", "byBank"), C("AP_TECHS", "byPayout")] },
  { type: "RefundCompleted", description: "Reembolso a un cliente", lines: [D("CLIENT_FUNDS", "total"), C("BANK", "bank"), C("GATEWAY", "gateway")] },
  { type: "ClientCreditReceived", description: "Exceso recibido de un cliente: saldo a favor", lines: [D("BANK", "amount"), C("CLIENT_CREDIT", "amount")] },
  { type: "ClientCreditRefunded", description: "Saldo a favor devuelto al cliente", lines: [D("CLIENT_CREDIT", "amount"), C("BANK", "amount")] },
  { type: "OrgStatementCreditApplied", description: "Saldo a favor aplicado a un estado de cuenta de organización", lines: [D("CLIENT_CREDIT", "amount"), C("CLIENT_FUNDS", "amount")] },
  { type: "OrgStatementPaid", description: "Estado de cuenta de organización pagado", lines: [D("BANK", "bank"), D("GATEWAY", "gateway"), D("CASH_WITH_TECHS", "cash"), C("CLIENT_FUNDS", "total")] },
  // R-CORE-009 (REF-DEC-007): solo la reventa con margen es venta propia; el suplido no.
  { type: "MaterialsSold", description: "Reventa de materiales por MIJEX con margen (con su impuesto sobre el precio entero)", lines: [D("CLIENT_FUNDS", "gross"), C("MATERIALS_REVENUE", "base"), C("SALES_TAX", "tax")] },
  // R-DO-302: con un E41 de MIJEX, el 100 % del ITBIS se retiene (a la DGII) y al vendedor se le debe la base.
  { type: "PurchaseInvoiced", description: "Factura de proveedor de materiales (o E41 de MIJEX con el ITBIS retenido)", lines: [D("COST_OF_MATERIALS", "subtotal"), D("PURCHASE_TAX", "tax"), C("AP_SUPPLIERS", "total"), C("ITBIS_WITHHELD", "itbisWithheld")] },
  { type: "PurchasePaid", description: "Pago a proveedor", lines: [D("AP_SUPPLIERS", "amount"), C("BANK", "amount")] },
  { type: "SupplierPassThroughPaid", description: "Suplido: pago a un proveedor por cuenta y orden del cliente (fondos de terceros, sin ingreso ni gasto)", lines: [D("CLIENT_FUNDS", "amount"), C("BANK", "amount")] },
];
