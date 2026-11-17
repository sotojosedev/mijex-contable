# Tareas — Spec 002

- [x] T01 Tests rojos: lectura (formatos ES/RD, exactitud, errores por línea, huella de Property) y casado (políticas de Property y HS, empates, signo, reparto).
- [x] T02 `src/reconciliation/statement.ts` (reutiliza `parseMinor`/`formatMinor` de fiscal-core).
- [x] T03 `src/reconciliation/match.ts` (política como dato).
- [x] T04 Verificación: lint, typecheck, 30 tests, build, knip.
- [x] T05 HS y Property usan el módulo y retiran su copia (confirmado por el usuario el 2026-11-17: «si a todo»).
  - Librería: opción `requireDescription` (HS admite líneas sin concepto); `tieBreak` en la política (Property: la factura más antigua); sin recortes, para que la huella sea la de Property.
  - HS (`bankReconciliation.ts`): el lector y el casado son los comunes; conserva su huella de 40 caracteres (fórmula anterior); una línea ilegible se informa (`errors`) y ya no aborta el extracto. El frontend lo muestra.
  - Property (`bankStatement.ts`, `platformReconciliationMath.ts`): adaptadores finos sobre la librería con la misma firma; sus tests pasan sin cambios.
  - Verificación: librería 33; HS 36 (contabilidad y conciliación); Property 421 unitarios y 10 e2e de bancos y conciliación.
