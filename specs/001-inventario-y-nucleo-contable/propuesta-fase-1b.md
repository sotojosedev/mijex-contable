# Propuesta fase 1b — Planes de cuentas y reglas de asiento de MIJEX (para revisión)

| Campo | Valor |
|-------|-------|
| Estado | **Propuesta: no cargada.** Cada cuenta y cada regla requiere la aprobación del usuario y la revisión del contador (*stop condition*, AGENTS.md §4) |
| Fecha | 2026-11-17 |
| Base | Mayor actual de HS (`wt-hs-contingencia/backend/src/services/ledger.ts`, 21 cuentas, unos 20 eventos) |
| Fuentes | ES: PGC PYMES, RD 1515/2007 (REF-ES-005, texto consolidado del BOE). Códigos y nombres copiados literalmente del cuadro de cuentas. RD: no hay plan oficial obligatorio; NIIF para PYMES (ICPARD, REF-DO-…) |

## 1. Correspondencia de cuentas

Leyenda:
- **[C]**: elección de criterio profesional; decide el contador.
- **N/A**: no aplica en ese país.
- La columna «RD» es una **propuesta de MIJEX** (plan propio alineado con NIIF para PYMES) que
  conserva los códigos actuales de HS para no romper la continuidad.

| Hoy en HS | Uso | ES: PGC PYMES (código y nombre oficiales) | RD: plan propio NIIF PYMES (propuesta) |
|---|---|---|---|
| 1110 Banco | Cobros y pagos por banco | **572.** Bancos e instituciones de crédito c/c vista, euros | 1110 Bancos |
| 1115 Pasarela | Saldo en Stripe o PayPal antes de su liquidación al banco | **572** con subcuenta propia (p. ej. 5729 Pasarela de pagos) **[C]** · alternativa: **555.** Partidas pendientes de aplicación (no encaja: la causa sí se conoce) | 1115 Pasarelas de pago |
| 1120 CxC | Modelo anterior (facturas de MIJEX como principal) | **430.** Clientes | 1120 Cuentas por cobrar clientes |
| 1150 Efectivo en técnicos | Dinero que cobró el técnico y debe a MIJEX | **440.** Deudores **[C]** | 1150 Cuentas por cobrar a técnicos |
| 1160 Impuesto soportado | Compras a proveedores | **472.** Hacienda Pública, IVA soportado | 1160 ITBIS pagado (adelantado) |
| 2110 CxP técnicos | Lo liquidado al técnico | **410.** Acreedores por prestaciones de servicios | 2110 Cuentas por pagar a técnicos |
| 2120 Impuesto repercutido | IVA o ITBIS de la comisión y de los materiales | **477.** Hacienda Pública, IVA repercutido | 2120 ITBIS por pagar |
| 2130 ISR retenido | RD: retención del art. 309 (IR-17) | N/A (en España MIJEX no retiene IRPF; spec 033 de HS) · si algún día aplica: **4751.** Hacienda Pública, acreedora por retenciones practicadas | 2130 Retenciones ISR por pagar (IR-17) |
| 2140 ITBIS retenido | RD: Decreto 293-11 art. 25 | N/A | 2140 ITBIS retenido por pagar |
| 2150 Fondos de clientes | Cobrado por cuenta de los técnicos (MIJEX intermedia) | **[C] El PGC no tiene una cuenta propia para cobros por cuenta de terceros.** Opciones: (a) **410** con subcuenta «Acreedores por cobros por cuenta de técnicos» (mi recomendación: es lo que se debe al técnico); (b) **438.** Anticipos de clientes (no encaja: no son entregas a cuenta de suministros de MIJEX); (c) **555** (no encaja: la causa se conoce) | 2150 Fondos de clientes por cuenta de terceros |
| 2155 Saldo a favor de clientes | Exceso pagado por un cliente | **438.** Anticipos de clientes **[C]** | 2155 Anticipos de clientes |
| 2160 CxP proveedores | Facturas de compra | **400.** Proveedores | 2160 Cuentas por pagar a proveedores |
| 3100 Capital | — | **100.** Capital social | 3100 Capital social |
| 3200 Resultados | — | **129.** Resultado del ejercicio (y **113.** Reservas voluntarias al distribuir) | 3200 Resultados acumulados |
| 4100 Ingresos por servicios | Técnico empleado: MIJEX presta el servicio | **705.** Prestaciones de servicios | 4100 Ingresos por servicios |
| 4110 Comisión MIJEX | Ingreso de intermediación | **705.** Prestaciones de servicios (subcuenta «Comisiones de intermediación») **[C]** | 4110 Ingresos por comisiones |
| 4120 Ventas de materiales | — | **700.** Ventas de mercaderías | 4120 Ventas de materiales |
| 4190 Devoluciones | — | **708.** Devoluciones de ventas y operaciones similares | 4190 Devoluciones sobre ventas |
| 5100 Coste de servicios | Bono y salario del técnico empleado | **640.** Sueldos y salarios **[C]** (si es un trabajador; si factura, **607.** Trabajos realizados por otras empresas o **623.** Servicios de profesionales independientes) | 5100 Costo de servicios |
| 5200 Coste de materiales | — | **600.** Compras de mercaderías | 5200 Costo de materiales |
| 6100 Comisiones de pasarela | Stripe o PayPal | **626.** Servicios bancarios y similares | 6100 Gastos financieros por pasarelas |

## 2. Reglas de asiento (eventos del mayor de HS)

Mismas líneas en los dos países; solo cambia la cuenta según el marco. Cada evento será una
regla con su ID (R-ES-1xx o R-DO-1xx) cuando se apruebe.

| Evento (origen · nombre) | Debe | Haber |
|---|---|---|
| `Payment · verified` (cobro) | Tesorería según el método (572 / 5729 / 440) | Fondos por cuenta de terceros (2150), salvo lo compensado con saldo a favor (2155 al debe) |
| `TechnicianEarning · accrued_agent` (servicio liquidado, técnico por cuenta propia) | 2150 | 705 comisión + 410 técnico (en efectivo: 440) |
| `TechnicianEarning` (técnico empleado) | 2150 | 705 servicios + 477 impuesto; bono: 640 / 410 |
| `PayoutInvoice · approved` | 410 | 477 impuesto de la comisión + 4751/2130 ISR + 2140 ITBIS (solo RD) |
| `PayoutInvoice · paid` | 410 | 572 |
| `TechnicianCashDebt` (deuda de efectivo) | 572 (abono) o 410 (descontada) | 440 |
| `Refund · completed` | 2150 | 572 / 5729 |
| `ClientCreditEntry · received / refunded` | 572 · 438 | 438 · 572 |
| `OrgStatement · credit_applied / paid` | 438 / 572 | 2150 |
| `Quote · materials_sold` | 2150 | 700 + 477 |
| `PurchaseOrder · invoiced` | 600 + 472 | 400 |
| `PurchaseOrder · paid` | 400 | 572 |

## 3. Qué tiene que decidir el contador (y luego tú)
1. **Fondos cobrados por cuenta de los técnicos (2150) en España:** 410 con subcuenta, 438 o 555.
2. **Pasarela de pagos:** subcuenta de 572 o 555.
3. **Comisión de intermediación:** 705 con subcuenta, o 759 «Ingresos por servicios diversos».
4. **Técnico empleado:** 640 (nómina) frente a 607 o 623 si factura.
5. **RD:** aceptar el plan propio de la columna RD (códigos actuales) o darte el plan del contador.
6. **PGC normal o PGC PYMES para MIJEX en España:** hoy propongo PYMES (RD 1515/2007, art. 2: umbrales
   de activo, cifra de negocios y plantilla). Hay que confirmarlo con las cuentas de MIJEX.

Cuando estén aprobados, se cargan como datos (plan `APPROVED` con quién lo aprobó y cuándo, y una
regla por evento con su ID y referencia). El comparador de la fase 2 verifica, con datos copiados,
que el mayor nuevo da los mismos saldos que el actual de HS antes de retirarlo.
