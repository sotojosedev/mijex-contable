# Memoria SDD — MIJEX Contable

> Dónde vive cada cosa que la fase 0 del [proceso SDD](README.md) debe leer. Este archivo **no duplica** contenido;
> solo lo enlaza, para que no haya dos versiones de una misma decisión.

| Qué | Dónde |
|-----|-------|
| Principios | [`constitucion.md`](constitucion.md) |
| Reglas de ingeniería y *stop conditions* | [`AGENTS.md`](../AGENTS.md) |
| Memoria del proyecto (operación, skills, notas del dueño) | [`MEMORY.md`](../MEMORY.md) |
| Estado implementado y registro de cambios | [`docs/diseno-tecnico.md`](../docs/diseno-tecnico.md) |
| Catálogo de reglas (`R-…`) | [`docs/reglas/README.md`](../docs/reglas/README.md) |
| Catálogo de fuentes (`REF-…`, incluidas las decisiones del dueño `REF-DEC-…`) | [`docs/referencias/README.md`](../docs/referencias/README.md) |
| Decisiones de cada feature | `specs/NNN-slug/clarify.md` (o la sección de decisiones de su `spec.md`) |

## Decisiones duraderas
Una decisión del dueño que afecta a más de una feature se registra como `REF-DEC-NNN` en `docs/referencias/` y en el
registro de cambios de `docs/diseno-tecnico.md`. Las decisiones propias de una sola feature se quedan en su
`clarify.md`.

## Deuda y huecos del proceso conocidos (2026-11-21)
- Specs 002 y 003 sin `clarify.md` ni `plan.md`: se hicieron antes de existir esta carpeta.
- Spec 003, T5 (catálogo de reglas de Property): se solapa con el catálogo de la spec 055 de Property y con las
  validaciones por país de su spec 062. Hay que reconciliarlo antes de implementarlo, para no duplicar catálogos.
- La constitución está pendiente de ratificación del dueño.
