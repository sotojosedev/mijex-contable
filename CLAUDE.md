# MIJEX Contable — guía para Claude Code

Librería de contabilidad para MIJEX Property y MIJEX Home Services. Lo fiscal
(emisión, numeración, VERI\*FACTU, e-CF) vive en `@mijex/fiscal-core` (`mijex-fiscal`).

## Reglas (se cargan automáticamente)
@AGENTS.md

## Documentos vivos
- `docs/diseno-tecnico.md`: lo implementado; se actualiza en cada cambio.
- `docs/reglas/README.md`: catálogo de reglas (`R-…`).
- `docs/referencias/README.md`: catálogo de fuentes oficiales (`REF-…`).

## Rápido
1. Todo desarrollo = regla + referencia oficial + test (ver AGENTS.md §1).
2. SDD + TDD siempre.
3. Español en documentación y mensajes; identificadores de código en inglés.
4. Git solo con permiso explícito del usuario, cada vez.
