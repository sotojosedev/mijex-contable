# Clarify 003 — Registro de operaciones de organizaciones y comunidades

| Campo | Valor |
|-------|-------|
| Estado | **Resuelto** (2026-11-22): Q1–Q5 aprobadas por el dueño con condiciones; Q6 técnica, en el plan |
| Spec | [spec.md](spec.md) · Tareas: [tasks.md](tasks.md) |
| Fecha | 2026-11-22 |

> Fase 2 del [proceso SDD](../../sdd/README.md), hecha **a posteriori**: el núcleo (T1–T3b) y la parte de Property
> (T4a, T4b) se implementaron sin clarify ni plan. Este documento recoge las decisiones ya tomadas y lo que hay que
> decidir antes de terminar T4 y T5. Las stop conditions (AGENTS.md §4) las responde solo el dueño.

## Ya decidido (para dejarlo trazado)
| ID | Decisión | Fuente |
|----|----------|--------|
| D1 | MIJEX genera los registros de lo que administra y admite documentos externos. No son los libros oficiales de la organización. | REF-DEC-008 (2026-11-18) |
| D2 | Se respeta lo aprobado. Las reglas van a un catálogo con tres estados; en producción la aprobación funcional no basta; si falta la regla o algún dato, la emisión de esa operación va a revisión manual sin bloquear cobros ni pagos. Recibos, facturas, ingresos propios, fondos de terceros, honorarios y retenciones van separados. | REF-DEC-009 (2026-11-18) |
| D3 | El catálogo se conecta en la emisión de Property detrás de la bandera `FISCAL_RULE_GATE`. | Aprobado por el dueño el 2026-11-19 (T4b) |
| D4 | La 055 de Property es la fuente única de reglas fiscales, con o sin motor. | REF-DEC-012 (2026-11-21) |
| D5 | Las excepciones manuales se sustituirán por excepciones fiscales verificables en la 055; ningún porcentaje arbitrario. | Decisión del dueño, 2026-11-21 (Property 062, `inventario-excepciones.md`) |

## Resumen
| ID | Pregunta | Stop condition | Estado | Decisión |
|----|----------|----------------|--------|----------|
| Q1 | ¿Cómo se reconcilia el catálogo de la 003 (T5) con la 055 como fuente única? | Sí: reglas fiscales y arquitectura | Resuelta | A, con condiciones |
| Q2 | ¿Dónde vive el catálogo: constante en el código o datos con vigencia? | Sí: reglas fiscales | Resuelta | A (datos versionados), con condiciones |
| Q3 | ¿Cómo se corrige un registro cuando cambia su origen (fallo detectado)? | Sí: inmutabilidad contable | Resuelta | A + B, con condiciones |
| Q4 | ¿Qué operaciones faltan por registrar en este corte? | Sí: separación de fondos (REF-DEC-009) | Resuelta | Ampliar, con cinco naturalezas; honorarios al devengarse |
| Q5 | ¿Entra Home Services en la 003? | Sí: alcance entre repositorios | Resuelta | A (fuera) |
| Q6 | ¿Cuándo se generan los registros: al consultar o al ocurrir la operación? | No (técnica) | Propuesta | Recomendación en el plan |

---

## Q1 · Catálogo de la 003 (T5) frente a la 055 como fuente única

**Contexto.**
- Hoy Property tiene **dos puertas** antes de emitir, una detrás de otra, en `fiscalBridge.issuePendingWithFiscalCore`:
  1. la de la 055, `issuableByDecision`: con el motor, solo se emite una cuota con decisión vigente
     ELECTRONIC/CONVENTIONAL decidida;
  2. la de la 003, `decideInvoiceIssuance` con el catálogo `fiscalRuleCatalog.ts`.
- El catálogo de la 003 trata toda cuota ARRIENDO, COMUNIDAD u OTRO como factura fiscal `APPROVED_PENDING_VERIFICATION`.
  Solo pasa a VERIFIED un ARRIENDO con `RentalTaxRule` validada y con referencia legal.
- La 055 decide por cuota de alquiler (factura, recibo, exenta, revisión) con su matriz validada.
- D4 dice que la 055 es la fuente única. T5 tal como está escrita crearía un segundo inventario de reglas de
  alquiler, contra I-4 («sin catálogos duplicados»).

**Alternativas.**
| Opción | Descripción | Pros | Contras / riesgo |
|--------|-------------|------|------------------|
| A | La 003 queda como **primitiva genérica** de la librería (`decideFiscalIssuance`, tres estados). Property le pasa los datos: para ARRIENDO, la decisión de la 055; para COMUNIDAD, OTRO, honorarios y liquidaciones, un catálogo propio de Property hasta que la 055 (u otra spec) los cubra. | Una sola fuente para alquileres; la librería sigue siendo reutilizable por HS. | Durante la transición, COMUNIDAD y OTRO siguen en el catálogo de Property. |
| B | Llevar **todo** (comunidades, honorarios, liquidaciones) a la 055 y quitar el catálogo de Property. | Una única fuente para todo. | La 055 es el motor de alquiler: ampliarlo a comunidades y honorarios es una spec nueva y grande. |
| C | Mantener las dos puertas como hoy. | Sin trabajo. | Dos fuentes que pueden contradecirse; incumple D4 e I-4. |

**Recomendación.** **A.** Para ARRIENDO, una sola puerta: la decisión de la 055. Con el motor activo, la 003 no vuelve a
decidir; sin él, el catálogo hace de red de seguridad. Para las demás operaciones, T5 inventaría sus reglas como datos
(Q2) con su referencia, y no inventa ninguna. B queda como evolución posible en otra spec.

**Decisión.** **A**, aprobada por el dueño el 2026-11-22, con estas condiciones:
- En alquiler, la 055 es la **única** responsable de decidir la preparación fiscal y si la operación puede pasar a
  emisión.
- La 003 conserva las capacidades fiscales genéricas compartidas y cubre lo que la 055 no gestiona (comunidades y
  otras facturas).
- No se duplican decisiones fiscales ni se crean motores contradictorios.
- Se mantienen las validaciones técnicas obligatorias antes de emitir.

---

## Q2 · Dónde vive el catálogo

**Contexto.**
- `PROPERTY_FISCAL_RULES` es una constante en TypeScript (país × tipo de organización × tipo de factura) con
  `validFrom: 2000-01-01`.
- AGENTS.md §5 y la constitución (K4) piden reglas como **datos versionados por vigencia, gestionables desde la app**,
  con su ID y su referencia.
- Pasar una regla a VERIFIED exige hoy cambiar el código.

**Alternativas.**
| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| A | Tabla de catálogo en Property (o en el esquema `contable`) con versión, vigencia, estado, referencia, quién validó y auditoría; gestionada por PLATFORM_ADMIN del país, como las reglas de la 055 y las validaciones de la 062. | Cumple K4; se verifica sin desplegar. | Migración y pantalla nuevas. |
| B | Mantener la constante y cambiar el código para cada verificación. | Sin migración. | Incumple K4; cada verificación necesita un despliegue. |

**Recomendación.** **A**, en el esquema `contable` de la librería, con el adaptador PG que ya existe (migración 0004).
Así HS puede reutilizarlo y Property no duplica tablas. El contenido inicial es el inventario actual, todo en
`APPROVED_PENDING_VERIFICATION`: no cambia ningún comportamiento.

**Decisión.** **A**, aprobada por el dueño el 2026-11-22. Cada regla lleva:
- país y jurisdicción;
- tipo de operación;
- regla fiscal y fuente oficial;
- vigencia y estado de validación;
- versión y auditoría.

Condiciones:
- Las reglas históricas se conservan.
- La carga inicial migra las reglas existentes sin cambiar su comportamiento.
- Los administradores de organizaciones no pueden modificar las reglas fiscales generales.
- Las reglas pendientes de verificación no activan comportamientos fiscales definitivos nuevos.

---

## Q3 · Corregir un registro cuando cambia su origen (fallo detectado)

**Contexto (fallo comprobado leyendo el código, 2026-11-22).**
- `record` es idempotente por origen. Si el mismo origen llega con otros datos, lanza `IDEMPOTENCY_CONFLICT`. Compara
  importe, fecha, contraparte, número de documento y enlaces (`src/operations/index.ts:63`).
- Property sincroniza al consultar (`GET /operations` y `/export` llaman a `syncOrganizationOperations`) y no captura
  ese error.
- Basta con que una cuota se registre y luego cambie para que esa consulta falle con un 500 y la organización no pueda
  listar ni exportar desde ese momento. Casos que lo provocan:
  - se registra sin número (retenida, o antes del número de VERI*FACTU o e-CF) y se numera después;
  - se edita el importe o la fecha (`PATCH /invoices/:id` lo permite en PENDIENTE y VENCIDA);
  - cambia el nombre del inquilino (contraparte);
  - se anula: la cuota deja de listarse, pero su registro sigue sin anulación.
- Esto afecta a T4a, ya cerrada. Hay que reproducirlo con una e2e antes de arreglarlo.

**Alternativas.**
| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| A | **Registro de corrección**: si el origen cambia, se añade un registro que anula el anterior (importe con signo contrario, enlazado) y otro con los datos nuevos, con origen `source.id` + versión. Nada se edita (R-CORE-003, K6). | Inmutable y trazable; la exportación cuadra. | Más registros; la gestoría ve la anulación y el nuevo. |
| B | Registrar **solo operaciones firmes**: la cuota cuando tiene número y la anulación como registro aparte. | Menos ruido. | Si cambia el importe después de numerar, vuelve el problema. |
| C | Hacer el registro editable. | Simple. | Incumple la inmutabilidad (K6, R-CORE-012). |

**Recomendación.** **A**, combinada con B en lo posible: no registrar la cuota mientras esté retenida o sin número. Las
anulaciones y los cambios posteriores van como corrección enlazada.

**Decisión.** **A + B**, aprobada por el dueño el 2026-11-22:
- Los registros económicos confirmados son inmutables.
- Las correcciones se hacen con una reversión y un registro nuevo, vinculados al original.
- Los documentos fiscales emitidos siguen el procedimiento legal de rectificación que corresponda.
- Los borradores se pueden modificar antes de confirmarse, conservando la auditoría.
- Las cuotas en revisión fiscal o sin numeración definitiva no se registran como documentos fiscales emitidos.

---

## Q4 · Operaciones que faltan por registrar (T4 resto)

**Contexto.**
- Hoy se registran las facturas ARRIENDO y COMUNIDAD (sin anuladas ni en revisión fiscal), los cobros conciliados
  enlazados a su factura y los gastos como salidas.
- REF-DEC-009 pide separar recibos, facturas, ingresos propios, fondos de terceros, honorarios y retenciones.
- Lo que no se registra:

| Origen en Property | Qué es | Propuesta |
|--------------------|--------|-----------|
| `PaymentReceipt` (052) | Recibo de cobro | Sí: `RECEIPT`, enlazado al cobro |
| `WithholdingDecision` (055/062) | Retención prevista o practicada | Sí: registro propio, separado del ingreso |
| `TaxRemittanceObligation` pagada | Ingreso de la retención por cuenta del propietario | Sí: `PAYMENT` de fondos de terceros |
| `Payout` ejecutado al propietario (`beneficiaryType = OWNER`) | Fondos de terceros que salen | Sí: `PAYMENT` de fondos de terceros |
| `Payout` ejecutado a un proveedor | Pago de un gasto | Sí: `PAYMENT`, enlazado a su `Expense` (sin contarlo dos veces) |
| Honorarios de la gestora | Ingreso propio. Hoy **no se guarda** como operación: lo calcula la liquidación (`ownerStatement`, `managementFeePercent`). | Sí, pero hay que decidir cuándo nace el registro: al liquidar o al cobrar (Q4b) |
| Anulaciones de cuota | — | Sí: como corrección (Q3) |
| Recargos por mora, saldos a favor y devoluciones | — | En un corte posterior |
| Cobros con tarjeta o pasarela no conciliados | — | No hasta que se concilien |

- Para separar los fondos hace falta un campo nuevo en el registro: la naturaleza del importe (ingreso propio, fondos
  de terceros, retención o impuesto). Cambia la API pública de la librería.

**Recomendación.**
- Incluir en este corte los cinco orígenes de arriba y las anulaciones.
- Añadir al registro una **naturaleza** opcional (`OWN_INCOME`, `THIRD_PARTY_FUNDS`, `WITHHOLDING`, `TAX`). Es un
  cambio compatible (MINOR): los registros sin naturaleza siguen valiendo.
- Dejar recargos, saldos a favor y devoluciones para después.
- **Q4b (honorarios):** registrarlos al **liquidar** al propietario, que es cuando se descuentan y quedan firmes, y
  no al cobrar cada cuota. Es una regla contable: decide el dueño.

**Decisión.** Aprobada por el dueño el 2026-11-22. Se amplía el registro con:
- recibos;
- retenciones;
- pagos de obligaciones tributarias;
- transferencias a propietarios;
- pagos a proveedores;
- honorarios de administración;
- anulaciones y reversiones.

Condiciones:
- Distinguir expresamente **ingresos propios, fondos de terceros, retenciones, pagos fiscales y liquidaciones**.
- Los honorarios se registran **cuando se devengan**, y su cobro o compensación aparte. Esto sustituye la
  recomendación Q4b.
- No duplicar una operación económica que aparezca en varios módulos.
- Mantener idempotencia, referencias cruzadas y auditoría.
- Versionar o ampliar de forma compatible los esquemas de exportación y las API públicas.

---

## Q5 · ¿Entra Home Services en la 003?

**Contexto.**
- La spec habla de «organizaciones y comunidades» y de exportación para su gestoría; solo Property lo usa.
- Home Services no importa nada de la 003 (comprobado el 2026-11-22). Sus organizaciones y técnicos autónomos tienen
  ya su liquidación en la spec 001 (intermediación).

**Alternativas.**
- **A:** la 003 solo cubre Property; HS en otra spec cuando haga falta.
- **B:** incluir HS en este corte.

**Recomendación.** **A**: no hay ningún requisito de HS escrito, y la constitución (K10) no permite suponerlo.

**Decisión.** **A**, aprobada por el dueño el 2026-11-22:
- Home Services queda fuera de esta implementación y no se modifican sus flujos.
- La librería sigue siendo compatible con futuras integraciones, sin dependencias específicas de Property.

---

## Q6 · Cuándo se generan los registros (técnica)

**Contexto.**
- Hoy los registros se generan al consultar, con un límite silencioso de 5.000 cuotas y 5.000 gastos por periodo
  (`take: 5000`): una organización grande perdería registros sin aviso.
- Sincronizar al consultar también hace que el error de Q3 aparezca al leer.

**Recomendación (decisión técnica, sin stop condition).**
- Generar el registro **al ocurrir la operación**, después de confirmar la transacción de origen, de forma idempotente.
- Mantener una sincronización de recuperación por periodo, paginada, sin límite silencioso y con informe de lo que no
  pudo registrar.
- Detalle en el plan §3.

---

## Condiciones generales del dueño (2026-11-22)
- No modificar documentos fiscales históricos.
- No duplicar reglas fiscales.
- No alterar los importes económicos aprobados en specs anteriores.
- No confundir fondos de terceros con ingresos propios.
- No declarar una operación fiscalmente válida solo porque esté registrada internamente.
- Antes de implementar, presentar las migraciones, las dependencias afectadas y las pruebas de regresión necesarias:
  [`migraciones-y-regresion.md`](migraciones-y-regresion.md).

Decisión duradera registrada como **REF-DEC-013** en `docs/referencias/README.md`.
