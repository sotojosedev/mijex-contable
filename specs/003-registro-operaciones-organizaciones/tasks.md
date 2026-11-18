# Tareas — Spec 003

- [x] T1 Specify (`spec.md`) con la decisión del usuario (REF-DEC-008): no son los libros oficiales de la organización.
- [x] T2 Núcleo: `createOperationsRegister` (idempotente por origen, enlaces solo dentro de la organización, `trace`), `exportOperationsCsv` (cabecera estable, importes exactos, protegido frente a fórmulas) y obligaciones por tipo de organización (`resolveObligation`, `assertAutomaticIssuance`). R-CORE-012…014.
- [x] T3 PostgreSQL: migración 0003 (`contable.operation_record`, solo inserción, única por origen, índice por organización y fecha) y `createPgOperationsStore`; contrato común en memoria y PostgreSQL, incluida la carrera de dos registros del mismo origen.
- [ ] T4 Property: generar los registros desde sus facturas, recibos, cobros y pagos, aportar documentos externos, exportar por organización y consultar las obligaciones antes de cualquier emisión automática.
- [ ] T5 Perfiles de obligaciones con fuentes oficiales por tipo de organización y país. Hasta entonces, todo queda UNDETERMINED y la emisión automática se bloquea.
