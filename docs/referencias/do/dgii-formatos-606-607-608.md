# DGII — Formatos de envío 606, 607 y 608 (estructura vigente)

Extracto verificado el 2026-11-17 a partir de las fuentes oficiales:

| Fuente | Copia | sha256 |
|---|---|---|
| Norma General 07-2018 sobre Remisión de Informaciones (09/03/2018), anexos A, B y C | `DGII-Norma-General-07-2018.pdf` | 46b093a5a3ff1fea… |
| Norma General 10-2018 (modifica el art. 4 de la 07-2018: umbral de facturas de consumo en el 607, RD$250.000) | `DGII-Norma-General-10-2018.pdf` | 39bcabd81c4a759d… |
| Norma General 05-2019 (comprobantes especiales; no cambia la estructura de los formatos) | `DGII-Norma-General-05-2019.pdf` | a5707ff809adacc6… |
| Instructivo de llenado y remisión del 607 (diciembre de 2025) | `DGII-Instructivo-607-2025-12.pdf` | 1a7884bb37cd9334… |
| Instructivo de llenado y remisión del 608 (marzo de 2026) | `DGII-Instructivo-608-2026-03.pdf` | 725c6c6176519e82… |
| Plantilla oficial 606, «Versión 2025» (zip del 28/10/2025) | no se copia (lleva macros); leída sin ejecutar | d89833ac2f184b7b… |
| Plantilla oficial 607, «Version 2023.1.1» (zip del 31/05/2023) | ídem | 184d381f1a84f7e4… |
| Plantilla oficial 608, «Version 2018.2.1» (zip del 23/07/2021) | ídem | b21f1b305338bdbd… |

## Común (Norma 07-2018, anexos)
- **TXT delimitado por pipe (`|`).**
- **Cabecera:** `código|RNC o cédula del remitente|periodo AAAAMM|cantidad de registros`. La
  cantidad no cuenta la cabecera.
- **Fechas:** AAAAMMDD.
- **Importes:** con punto decimal y centavos.
- **Plazo:** los primeros 15 días del mes siguiente (art. 8).
- **Sin operaciones:** se remiten en cero, de forma informativa (art. 8, párr. II).
- **Comprobantes del detalle:** NCF de 11 posiciones según la norma. Los e-NCF tienen 13; queda
  **[verificar]** cómo los admite la DGII en estos formatos y si los e-CF, que la DGII ya
  recibe, siguen remitiéndose.

## 606 — Compras de bienes y servicios (Anexo A; plantilla 2025): 23 campos
1. RNC o Cédula
2. Tipo Id
3. Tipo Bienes y Servicios Comprados
4. NCF
5. NCF ó Documento Modificado
6. Fecha Comprobante
7. Fecha Pago
8. Monto Facturado en Servicios
9. Monto Facturado en Bienes
10. Total Monto Facturado
11. ITBIS Facturado
12. ITBIS Retenido
13. ITBIS sujeto a Proporcionalidad (Art. 349)
14. ITBIS llevado al Costo
15. ITBIS por Adelantar (= 11 − 14)
16. ITBIS percibido en compras
17. Tipo de Retención en ISR
18. Monto Retención Renta
19. ISR Percibido en compras
20. Impuesto Selectivo al Consumo
21. Otros Impuesto/Tasas
22. Monto Propina Legal
23. Forma de Pago

- **Tipo Id:** 1 RNC · 2 Cédula.
- **Tipo de bienes y servicios:**
  - 01 Gastos de personal
  - 02 Gastos por trabajos, suministros y servicios
  - 03 Arrendamientos
  - 04 Gastos de activos fijos
  - 05 Gastos de representación
  - 06 Otras deducciones admitidas
  - 07 Gastos financieros
  - 08 Gastos extraordinarios
  - 09 Compras y gastos que formarán parte del costo de venta
  - 10 Adquisiciones de activos
  - 11 Gastos de seguros
- **Tipo de retención ISR:**
  - 01 Alquileres
  - 02 Honorarios por servicios
  - 03 Otras rentas
  - 04 Otras rentas (rentas presuntas)
  - 05 Intereses pagados a personas jurídicas residentes
  - 06 Intereses pagados a personas físicas residentes
  - 07 Retención por proveedores del Estado
  - 08 Juegos telefónicos
  - **09 Retenciones subsector de ganadería de carne bovina** (solo en la plantilla 2025)
- **Forma de pago:**
  - 01 Efectivo
  - 02 Cheques/transferencias/depósito
  - 03 Tarjeta crédito/débito
  - 04 Compra a crédito
  - 05 Permuta
  - 06 Nota de crédito
  - 07 Mixto

## 607 — Ventas de bienes y servicios (Anexo B; NG 10-2018; instructivo 12/2025; plantilla 2023.1.1): 23 campos
1. RNC/Cédula o Pasaporte
2. Tipo Identificación
3. Número Comprobante Fiscal
4. Número Comprobante Fiscal Modificado
5. Tipo de Ingreso
6. Fecha Comprobante
7. Fecha de Retención
8. Monto Facturado (sin impuestos)
9. ITBIS Facturado
10. ITBIS Retenido por Terceros
11. ITBIS Percibido
12. Retención Renta por Terceros
13. ISR Percibido
14. Impuesto Selectivo al Consumo
15. Otros Impuestos/Tasas
16. Monto Propina Legal
17. Efectivo
18. Cheque/Transferencia/Depósito
19. Tarjeta Débito/Crédito
20. Venta a Crédito
21. Bonos o Certificados de Regalo
22. Permuta
23. Otras Formas de Ventas

- **Tipo Identificación:** 1 RNC · 2 Cédula · 3 Pasaporte o ID tributaria.
- **Tipo de ingreso:**
  - 01 Ingresos por operaciones (no financieros)
  - 02 Ingresos financieros
  - 03 Ingresos extraordinarios
  - 04 Ingresos por arrendamientos
  - 05 Ingresos por venta de activo depreciable
  - 06 Otros ingresos
- **Formas de cobro (17 a 23):** incluyen impuestos y suman el total del comprobante.
- **Retenciones:** si hay retención (10 o 12), la fecha de retención (7) es obligatoria.
- **Qué va en el detalle** (art. 4, mod. NG 10-2018): facturas de crédito fiscal y comprobantes
  especiales. Las facturas de consumo, solo si valen ≥ RD$250.000; el resto se declara como
  resumen en la OFV.
- **Máximo:** 65.000 registros (instructivo).

## 608 — Comprobantes anulados (Anexo C; plantilla 2018.2.1): 3 campos
1. Número de Comprobante Fiscal
2. Fecha de Comprobante (fecha de la anulación, AAAAMMDD)
3. Tipo de Anulación

Tipos de anulación:
- 01 Deterioro de factura preimpresa
- 02 Errores de impresión (factura preimpresa)
- 03 Impresión defectuosa
- 04 Corrección de la información
- 05 Cambio de productos
- 06 Devolución de productos
- 07 Omisión de productos
- 08 Errores en secuencias de NCF
- 09 Por cese de operaciones
- 10 Pérdida o hurto de talonarios

**Nota:** el Anexo C define el campo 2 como «Fecha en que se anuló el NCF». HS usa hoy la fecha
de emisión: **hay que corregirlo**.
