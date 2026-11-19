---
name: do-contabilidad
description: "Contabilidad de República Dominicana para MIJEX Contable (Property y Home Services). Úsalo SIEMPRE antes de definir, implementar o revisar cualquier regla contable o tributaria dominicana: marco contable (NIIF / NIIF para PYMES del ICPARD, Ley 479-08), libros y conservación, ejercicio y cierre, ISR de personas jurídicas y físicas, anticipos, ITBIS, retenciones de ISR e ITBIS (art. 309 CT, Decreto 293-11), depreciación (art. 287 CT), formatos 606/607/608, IR-17, IR-2, recargos e intereses, Ley 30-26 y su calendario, y particularidades de alquileres (Property) y servicios técnicos (HS). Disparadores: DGII, ICPARD, RD, República Dominicana, dominicana, ITBIS, ISR RD, retención 309, IR-2, IR-17, 606, 607, NCF, e-CF contable, Ley 11-92, Ley 30-26, Ley 253-12, NIIF PYMES RD, R-DO-, REF-DO-."
metadata:
  jurisdiction: "DO"
  owner: "mijex-contable"
  last_verified: "2026-11-16"
  sources: "DGII (dgii.gov.do, ayuda.dgii.gov.do), ICPARD (icpard.org)"
---

# Contabilidad dominicana: MIJEX Contable

Este skill recoge **solo lo verificado** en fuentes oficiales de la DGII y el ICPARD a fecha
2026-11-16. No sustituye a la fuente: cada dato lleva su referencia y su **nivel de
confianza**. Lo que no está verificado se marca `[verificar]` y **no se implementa**
hasta confirmarlo con el usuario (ver `AGENTS.md` §1 y §4).

## 0. Cómo usar este skill

1. Busca aquí la regla y su fuente. Si el dato es `[verificar]`, para y consulta al usuario.
2. Antes de implementar, abre la fuente: la DGII cambia normas a menudo. La Ley 30-26
   (18/06/2026) modificó retenciones, recargos, anticipos y tasas.
3. Toda cifra (tasa, porcentaje, umbral, plazo) es un **dato configurable con vigencia**
   (`desde`/`hasta`) en la librería, nunca una constante en el código. Este skill da el
   valor inicial y su referencia.
4. Cada regla implementada genera `R-DO-NNN` en `docs/reglas/`, su `REF-DO-NNN` en
   `docs/referencias/` y un test `describe('[R-DO-NNN] …')`.
5. Al cambiar algo aquí, actualiza `last_verified`, la ficha `docs/paises/DO.md` y
   `docs/diseno-tecnico.md`.

### Niveles de confianza

| Nivel | Significado | ¿Se puede implementar? |
|-------|-------------|------------------------|
| **A** | Texto normativo oficial leído (ley, decreto, norma, aviso DGII) | Sí |
| **B** | Página oficial de la DGII (dgii.gov.do) que cita la base legal | Sí, citando la base legal; confirmar contra la norma cuando esté disponible |
| **C** | Respuesta "Solución oficial" en ayuda.dgii.gov.do que cita la base legal | Solo con confirmación del usuario |
| **D** | Fuente secundaria (firmas, prensa) o dato no confirmado | No: `[verificar]` |

## 1. Fuentes oficiales y referencias

| REF | Fuente | Qué aporta | Nivel | URL |
|-----|--------|-----------|-------|-----|
| REF-DO-001 | Código Tributario, Ley 11-92 (DGII, PDF consolidado modificado 22/11/2021) | ISR (Tít. II), ITBIS (Tít. III), deberes formales art. 50 | A (texto base; reformas posteriores aparte) | https://dgii.gov.do/legislacion/leyesTributarias/Documents/Codigo%20Tributario%20y%20Leyes%20que%20lo%20modifican%20y%20complementan/11-92.pdf |
| REF-DO-002 | Ley 30-26 de medidas pro crecimiento económico, simplificación fiscal… (18/06/2026) | Reforma 2026 | Texto no leído (>10 MB, la DGII bloquea la descarga automática) → usar REF-DO-003 | https://dgii.gov.do/legislacion/leyesTributarias/Documents/Codigo%20Tributario%20y%20Leyes%20que%20lo%20modifican%20y%20complementan/30-26.pdf |
| REF-DO-003 | DGII, Aviso: Calendario de implementación de la Ley 30-26 (26/06/2026, mod. 29/06/2026) | Fecha de vigencia de cada artículo | **A** (copia: `docs/referencias/do/DGII-Aviso-10-26-calendario-Ley-30-26.pdf`) | https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/10-26.pdf |
| REF-DO-004 | Ley 253-12 de fortalecimiento de la capacidad recaudatoria | ISR PJ 27 % (art. 297 mod.), ITBIS 18 % (art. 23) | A | https://dgii.gov.do/legislacion/leyesTributarias/Documents/Codigo%20Tributario%20y%20Leyes%20que%20lo%20modifican%20y%20complementan/253-12.pdf |
| REF-DO-005 | Ley 495-06 de Rectificación Tributaria | Art. 50 lit. h) CT: conservación 10 años | A | https://dgii.gov.do/legislacion/leyesTributarias/Documents/Codigo%20Tributario%20y%20Leyes%20que%20lo%20modifican%20y%20complementan/495-06.pdf |
| REF-DO-006 | DGII, página Impuesto sobre la Renta | Tasas ISR PJ, escala asalariados 2026, recargos, ISA, IR-17 | B | https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/impuestoSobreRenta.aspx |
| REF-DO-007 | DGII, página ITBIS | Tasa 18 %, exenciones, recargos | B | https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/ITBIS.aspx |
| REF-DO-008 | DGII Ayuda CA59: retención a personas físicas por servicios | Porcentajes art. 309 tras Ley 30-26 | C | https://ayuda.dgii.gov.do/conversations/retenciones/ca59-qu-porcentaje-del-isr-deben-retener-las-personas-jurdicas-a-las-personas-fsicas-en-la-prestacin-de-servicios/5f3c175f8cd858ce879a130f |
| REF-DO-009 | DGII Ayuda CA3135: retención en alquileres | Alquileres: ISR e ITBIS | C | https://ayuda.dgii.gov.do/conversations/retenciones-y-retribuciones-complementarias/ca3135-qu-retencin-debo-aplicar-en-la-prestacin-del-servicio-de-alquiler-o-arrendamiento-de-bienes-muebles-o-inmuebles/5f3c175f8cd858ce879a0be1 |
| REF-DO-010 | Reglamento ISR, Decreto 139-98 | Art. 70: base presunta de servicios técnicos | A (texto disponible, artículo no releído) | https://dgii.gov.do/legislacion/reglamentos/Documents/2004/139-98.pdf |
| REF-DO-011 | Reglamento ITBIS, Decreto 293-11 + Norma General 02-05 | Retenciones de ITBIS | B/C | https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/itbis/Documents/1-Guia%207%20-%20(ITBIS).pdf |
| REF-DO-012 | Norma General 07-2018 | Formatos 606/607/608, día 15 | A | https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma07-18.pdf |
| REF-DO-013 | Ley 32-23 de Facturación Electrónica + Decreto 587-24 | e-CF (**lo emite mijex-fiscal**) | B | https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/marcoLegal.aspx |
| REF-DO-014 | ICPARD, Resolución 001, Acta 2010-004: adopción e implementación de las NIIF | Marco contable | A (PDF oficial; contenido no releído en detalle) | https://icpard.org/wp-content/uploads/2022/01/8-RESOLUCION-ADOPCION-E-IMPLEMENTACION-DE-LAS-NIIFSRESOLUCION-001-ACTA-2010-004.pdf |
| REF-DO-015 | ICPARD, Resolución adopción NIIF para PYMES, Acta 2010-004 | Marco PYMES | A (ídem) | https://icpard.org/wp-content/uploads/2022/01/9-RESOLUCION-ADOPCION-E-IMPLEMENTACION-NIIF-PARA-PYMES-ACTA-2010-004.pdf |
| REF-DO-016 | ICPARD, Resolución de confirmación de las NIIF, Acta 22-2014 | Confirma NIIF como marco | A (ídem) | https://icpard.org/wp-content/uploads/2022/01/10-RESOLUCION-CONFIRMACION-IMPLEMENTACION-DE-LAS-NIIFS-ACTA-22-2014.pdf |
| REF-DO-017 | Ley 479-08 de Sociedades Comerciales (mod. Ley 31-11) | Contabilidad societaria; art. 31: el ICPARD fija las normas contables | A (texto en la DGII; artículos no releídos) | https://dgii.gov.do/legislacion/leyesTributarias/Documents/Otras%20Leyes%20de%20Inter%C3%A9s/479-08.pdf |
| REF-DO-018 | DGII Guía del Contribuyente No. 12: anticipos | Cálculo de anticipos (antes de la Ley 30-26) | B | https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/isr/ISR%20Persona%20Fsica/7-Guia%2012-Liquidaci%C3%B3n%20y%20Pagos%20de%20Anticipos%20ISR.pdf |
| REF-DO-019 | DGII Instructivo IR-2 | Plazo: 120 días desde el cierre | B | https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/isr/ISR%20Persona%20Jurdica/9-Instructivo-IR-2-y-ANEXOS.pdf |

## 2. Marco contable

| Tema | Regla | Fuente | Nivel |
|------|-------|--------|-------|
| Quién fija las normas | El ICPARD, por mandato del art. 31 de la Ley 479-08 | REF-DO-017, perfil IFRS de RD | B |
| Marco general | **NIIF** (IASB), adoptadas por el ICPARD | REF-DO-014, REF-DO-016 | A |
| PYMES | **NIIF para las PYMES** para entidades sin obligación pública de rendir cuentas (Sección 1 de la norma) | REF-DO-015, REF-DO-016 | A |
| Entrada en vigor de nuevas versiones | 6 meses después de la traducción oficial al español | Resolución ICPARD (vía IAS Plus) | D `[verificar]` |
| NIIF para PYMES, 3.ª edición | Aplicación en RD | Prensa | D `[verificar]` |
| Clasificación MIPYMES (Ley 488-08 y sus modificaciones) | Define quién es micro, pequeña o mediana | — | D `[verificar]` |
| **Plan de cuentas** | La RD **no tiene** un catálogo de cuentas oficial obligatorio equivalente al PGC español (ninguna fuente lo establece) | — | `[verificar]` con el usuario: el catálogo es un **dato configurable** |

Consecuencia para la librería: la contabilidad es NIIF / NIIF para PYMES (devengo, partida
doble) y el catálogo de cuentas DO es configuración con su propia vigencia.

## 3. Libros, conservación y ejercicio

| Tema | Regla | Fuente | Nivel |
|------|-------|--------|-------|
| Conservación | **10 años**: libros, registros, comprobantes y documentos físicos o electrónicos | Art. 50 lit. h) CT, mod. Ley 495-06 (REF-DO-005) | A |
| e-CF | El emisor conserva los e-CF; el facturador gratuito de la DGII solo los guarda 2 años | Norma 01-20 y FAQ del facturador gratuito | B |
| Libros obligatorios (diario, mayor, inventario) y su formato | — | Ley 479-08, CT | `[verificar]` |
| Ejercicio fiscal | Cierre 31/03, 30/06, 30/09 o 31/12 según el IR-2; cambiarlo requiere autorización de la DGII | Art. 300 CT (vía PHLaw) + REF-DO-019 | C `[verificar art. 300]` |
| Declaración IR-2 (PJ) | A más tardar **120 días** después del cierre; si el último día es feriado, el siguiente día laborable | REF-DO-019 | B |
| Asamblea anual | Dentro de los 120 días siguientes al cierre | Ley 479-08 (vía PHLaw) | D `[verificar]` |

## 4. Impuesto sobre la Renta (ISR)

| Tema | Valor | Vigencia | Fuente | Nivel |
|------|-------|----------|--------|-------|
| Tasa PJ | **27 %** | desde el ejercicio 2015 | Art. 297 CT, mod. Ley 253-12 (REF-DO-004) | A |
| Tasa PJ con ingresos ≥ RD$1.000.000.000 | **30 %** | ejercicios 2026, 2027 y 2028 (el primero con cierre fiscal 30/06/2026) | Ley 30-26 art. 15 (REF-DO-003), REF-DO-006 | A |
| Escala PF 2027 | Exento hasta RD$480.000; 27 % por encima de RD$4.800.000,01; tramos intermedios `[verificar en la ley]` | desde el ejercicio 2027 | Ley 30-26 art. 10 (REF-DO-003) | A (parcial) |
| Escala retención asalariados 2026 | Exento hasta RD$416.220,00; 15 % hasta RD$624.329,00; RD$31.216 + 20 % hasta RD$867.123,00; RD$79.776 + 25 % por encima | 2026 | REF-DO-006 | B |
| Ganancia de capital de rentas inmobiliarias PF | **10 %** | inmediato (18/06/2026) | Ley 30-26 art. 14 (REF-DO-003) | A |
| Anticipos (régimen vigente) | Si la TET > 1,5 %: 1/12 del impuesto liquidado; si ≤ 1,5 %: 1,5 % de los ingresos brutos ÷ 12. Se pagan los primeros 15 días de cada mes | hasta el ejercicio 2026 | REF-DO-018 | B |
| Anticipos (Ley 30-26) | Pequeñas empresas: 3 cuotas; microempresas: exentas | desde el ejercicio 2027 | Ley 30-26 art. 23 (REF-DO-003) | A |
| ISA (activos) | 1 % de los activos imponibles | — | REF-DO-006 | B |

## 5. Retenciones de ISR (art. 309 CT, mod. Ley 30-26 art. 17)

Vigentes desde el **01/07/2026** (REF-DO-003, nivel A), también para pagos de operaciones
anteriores a esa fecha.

| Concepto (pagado a persona física) | Antes | Desde 01/07/2026 | Carácter | Fuente | Nivel |
|---|---|---|---|---|---|
| Alquiler de bienes muebles o inmuebles provistos por personas físicas | 10 % (pago a cuenta) | **15 %** | Pago único y definitivo (Ley 30-26 art. 17; antes, «pago a cuenta» en el CT) | REF-DO-002 (art. 17 leído), REF-DO-001 | A |
| Honorarios, comisiones y servicios profesionales sin dependencia | 10 % | **15 %** | Pago a cuenta | REF-DO-008 | C |
| Servicios técnicos (albañilería, plomería, limpieza, pintura, carpintería, fumigación, transporte…) | 2 % efectivo | **3 % efectivo** (15 % sobre una renta presunta del 20 %) | Pago a cuenta | REF-DO-008, Reglamento 139-98 art. 70 | C |
| Pagos al exterior: regalías | — | 15 % | — | Ley 30-26 art. 21 (REF-DO-003) | A |
| Pagos al exterior: licencias de software, publicidad en línea, uso o almacenamiento de datos | — | 15 % | — | Ley 30-26 art. 22 (REF-DO-003) | A |
| Dividendos, intereses, premios y otros | — | `[verificar]` | — | — | — |

- Agentes de retención: personas jurídicas, negocios de único dueño y el Estado. Las
  personas físicas no son agentes de retención (DGII, guía de retenciones; nivel B).
- Las retenciones se declaran y pagan en el **IR-17**, a más tardar el día 10 del mes
  siguiente (REF-DO-006, nivel B).

## 6. ITBIS

| Tema | Regla | Fuente | Nivel |
|------|-------|--------|-------|
| Tasa general | **18 %** desde 2016 | Ley 253-12 art. 23 §I-II (REF-DO-004, REF-DO-007) | A/B |
| Tasa reducida 16 % | Bienes y vigencia | — | `[verificar]` |
| Alquiler de vivienda | **Exento** | REF-DO-007 | B |
| Alquiler de locales comerciales u oficinas | **Gravado** ("no se considera vivienda") | REF-DO-007 | B |
| Retención: servicios de PF a PJ o negocio de único dueño | **100 %** del ITBIS facturado | Decreto 293-11 art. 25 (REF-DO-011) | B/C |
| Retención: servicios profesionales liberales y alquiler de muebles entre PJ | **30 %** del ITBIS facturado | Norma 02-05 (REF-DO-011) | B |
| Retención: proveedor en el RST | 100 % | REF-DO-011 | C |
| Norma General 02-26 | Desde el 16/09/2026 no se retiene ITBIS en el alquiler de muebles entre sociedades si se paga con e-CF | REF-DO-009 | C `[verificar texto NG 02-26]` |
| Exenciones nuevas de la Ley 30-26 | — | Prensa | D `[verificar]` |

## 7. Recargos, intereses y otros

| Tema | Valor | Vigencia | Fuente | Nivel |
|------|-------|----------|--------|-------|
| Recargo por mora | **3 %** (primer mes o fracción) | desde 01/07/2026 | Ley 30-26 art. 3 (REF-DO-003); arts. 26, 27, 251, 252 CT | A |
| Interés indemnizatorio | 1,10 % mensual acumulativo; tasa en revisión | revisión en enero de 2027 (art. 6) | REF-DO-006, REF-DO-003 | B/A |
| Amnistía | Hasta el 31/12/2026 | inmediato | Ley 30-26 art. 8 | A |
| Impuesto a cheques y transferencias electrónicas | **0,20 %** | desde 03/07/2026 | Ley 30-26 art. 40 | A |
| Impuesto sobre el registro de hipotecas | 1 % en 2027; derogado desde 2028 | ejercicios 2027 / 2028 | Ley 30-26 art. 59 | A |
| Impuesto por constitución de compañías y aumento de capital | Derogado | desde el ejercicio 2027 | Ley 30-26 art. 58 | A |
| Nuevo RST | Pendiente de reglamento | — | Ley 30-26 art. 25 | A (sin contenido aún) |
| Depreciación acelerada | Pendiente de la Norma General con el listado de bienes | — | Ley 30-26 art. 24 | A (sin contenido aún) |
| IPI (patrimonio inmobiliario) | — | — | — | `[verificar]` |

## 8. Depreciación fiscal (art. 287 CT)

| Categoría | Bienes | Tasa | Nivel |
|-----------|--------|------|-------|
| 1 | Edificaciones y sus componentes estructurales | 5 % | C |
| 2 | Automóviles y camiones livianos, mobiliario y equipo de oficina, computadoras y sistemas | 25 % | C |
| 3 | Resto de bienes depreciables | 15 % | C |

`[verificar en el texto del art. 287]`: el tratamiento del primer año (el 50 % del bien), los
bienes arrendados (50 % y 30 % según la ayuda de la DGII) y la exclusión del ITBIS del
costo. La depreciación **contable** (NIIF) es distinta de la **fiscal**: la librería registra
ambas y la diferencia (impuesto diferido) según la NIIF.

## 9. Informes a la DGII con origen contable

| Formato | Contenido | Plazo | Fuente | Nivel |
|---------|-----------|-------|--------|-------|
| 606 | Compras de bienes y servicios | Mensual, antes del día 15; también sin movimientos | REF-DO-012 | A |
| 607 | Ventas de bienes y servicios | Mensual, antes del día 15 | REF-DO-012 | A |
| 608 | Comprobantes anulados | Mensual | REF-DO-012 | A |
| IR-17 | Retenciones de ISR | Día 10 del mes siguiente | REF-DO-006 | B |
| IT-1 | ITBIS mensual | `[verificar plazo]` | — | — |
| IR-2 | ISR anual de PJ | 120 días tras el cierre | REF-DO-019 | B |

**Frontera con `mijex-fiscal`:** la emisión de e-CF/NCF, su numeración, firma y envío
pertenecen a `@mijex/fiscal-core`. Esta librería **consume** los documentos emitidos para
asentarlos y para preparar 606/607/608 e informes. Facturación electrónica: desde el
01/11/2026 los Grandes Locales y Medianos emiten solo e-CF; la prórroga de Pequeños,
Micro y No Clasificados termina el 15/11/2026 (aviso DGII, nivel B).

## 10. Particularidades por producto

**Property (alquileres)**
- Vivienda: exenta de ITBIS. Local u oficina: ITBIS 18 %.
- Si una PJ o un negocio de único dueño paga un alquiler a una PF: retiene 15 % de ISR
  (pago único y definitivo) desde el 01/07/2026. El ITBIS del local se retiene según §6.
- Venta de inmuebles por una PF: ganancia de capital al 10 % (Ley 30-26 art. 14).
- Hipotecas: impuesto del 1 % en 2027, derogado desde 2028.

**Home Services (servicios)**
- Técnico PF (plomería, limpieza, pintura…) que factura a una PJ: retención de ISR del 3 %
  efectivo y retención del 100 % del ITBIS facturado.
- Servicio profesional de una PF: retención de ISR del 15 %.
- La relación empleado/autónomo decide entre nómina (escala de asalariados) y retención;
  la regla de quién emite está en `mijex-fiscal`.

## 11. Pendientes `[verificar]` antes de implementar

1. Texto íntegro de la Ley 30-26: arts. 10, 17, 23 y 24 y cualquier cambio del ITBIS. La DGII
   bloquea la descarga automática: el usuario debe aportar el PDF en `docs/referencias/do/`.
2. Art. 309 completo: dividendos, intereses, premios y pagos al Estado.
3. Tasa reducida del ITBIS del 16 % y exenciones nuevas de la Ley 30-26.
4. Norma General 02-26 (retención de ITBIS en alquiler de muebles).
5. Art. 287 CT (primer año y arrendados) y la Norma de depreciación acelerada.
6. Art. 300 CT (ejercicio fiscal) y los libros obligatorios (Ley 479-08, CT).
7. Catálogo de cuentas: confirmar con el usuario que no existe uno oficial obligatorio.
8. Clasificación MIPYMES vigente y reglamento del nuevo RST.
9. IPI y plazo del IT-1.
