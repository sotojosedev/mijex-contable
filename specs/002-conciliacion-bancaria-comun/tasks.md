# Tareas — Spec 002

- [x] T01 Tests rojos: lectura (formatos ES/RD, exactitud, errores por línea, huella de Property) y casado (políticas de Property y HS, empates, signo, reparto).
- [x] T02 `src/reconciliation/statement.ts` (reutiliza `parseMinor`/`formatMinor` de fiscal-core).
- [x] T03 `src/reconciliation/match.ts` (política como dato).
- [x] T04 Verificación: lint, typecheck, 30 tests, build, knip.
- [ ] T05 HS y Property usan el módulo y retiran su copia (*stop condition*: borrar código contable; requiere confirmación). El lector de HS pasa a admitir errores por línea (cambio de comportamiento: hoy aborta todo el extracto).
