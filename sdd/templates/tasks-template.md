# Tasks NNN — <Título>

| Campo | Valor |
|-------|-------|
| Estado | Pendiente · En curso · Hecho · Verificado |
| Plan | [plan.md](plan.md) |
| Fecha | AAAA-MM-DD |

> Fases 4 a 7 del [proceso SDD](../README.md). Tareas de ½ día como máximo, ordenadas por dependencia. **Cada tarea de
> código empieza por su test** (rojo → verde → refactor). `[P]` = paralelizable.

## A · Preparación
- [ ] **T001** Leer `sdd/constitucion.md`, `sdd/memory.md` y `AGENTS.md`; confirmar que `clarify.md` está resuelto.
- [ ] **T002** Línea base de verificación; anotar los fallos preexistentes.

## B · Reglas y referencias
- [ ] **T010** `docs/referencias/`: REF-… con organismo, norma, artículo, versión, fecha y URL.
- [ ] **T011** `docs/reglas/`: R-… enlazada a su referencia.

## C · Tests primero
- [ ] **T020** `describe('[R-…] …')` en `tests/<módulo>/` (debe fallar).
- [ ] **T021** [P] Contrato PG (`tests/pg/`) si hay persistencia.

## D · Implementación
- [ ] **T030** Migración `migrations/000N_….sql` (si aplica).
- [ ] **T031** Código mínimo que hace pasar T020.

## E · Verificación
- [ ] **T090** `npm run lint && npm run typecheck && npm test && npm run test:pg && npm run build && npm run knip`
- [ ] **T091** Revisión adversarial (otra organización o país, vigencias, redondeo, repetición, concurrencia).
- [ ] **T092** `code-review-typescript`; `security-audit` si toca secretos, permisos, entradas o datos personales.

## F · Cierre
- [ ] **T095** `docs/diseno-tecnico.md` (secciones afectadas y registro de cambios).
- [ ] **T096** Índice de `sdd/README.md` y deuda en `sdd/memory.md`.

---

## Analyze · trazabilidad
| Criterio / regla | Tareas | Tests | Estado |
|------------------|--------|-------|--------|
| CA1 · R-… | T020, T031 | `tests/…` › `[R-…] …` | ⬜ |

- [ ] Todo criterio y toda regla tienen tarea y test.
- [ ] Ninguna tarea sin requisito.
- [ ] Sin contradicciones entre spec, clarify y plan.

## Resultados de verificación
| Comando | Resultado | Fecha |
|---------|-----------|-------|
| lint / typecheck / build / knip | | |
| test (unit) | | |
| test:pg | | |

Fallos preexistentes (no causados por este cambio):
- …
