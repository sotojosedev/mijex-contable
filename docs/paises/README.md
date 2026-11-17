# Países

Cada país tiene una **ficha** (`docs/paises/<ISO>.md`) que lo deja bien definido antes de
implementar nada. La ficha describe **qué hay que configurar** para ese país; los valores
viven como datos configurables en la librería (sin código por país).

Un campo de la ficha solo se rellena con una referencia oficial (`REF-…`) o una decisión
del usuario. Si no, queda `[verificar]`.

## Estado

| ISO | País | Ficha | Estado |
|-----|------|-------|--------|
| ES | España | [ES.md](ES.md) | en definición (primer país) |
| DO | República Dominicana | [DO.md](DO.md) | en definición (primer país) |

## Añadir un país nuevo
1. El usuario define sus fuentes oficiales (`docs/referencias/README.md`).
2. Se copia `_plantilla.md` a `<ISO>.md` y se completa con referencias.
3. Se crean sus reglas `R-<ISO>-NNN` con tests.
4. Se carga su configuración desde la app; no se escribe código nuevo.
