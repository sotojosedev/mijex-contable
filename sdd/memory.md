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

## Deuda y huecos del proceso conocidos (2026-11-22)
- Spec 002 sin `clarify.md` ni `plan.md`.
- Constitución v1.1.0 ratificada (REF-DEC-014). Spec 004 cerró I-K12-1, 3 y 4; la spec 005 (2026-11-23) cerró I-K12-2
  en esta librería (catálogo retirado; reglas solo en fiscal-core). Fuera queda Property (021/055), etapa 3 de la 014.
- Las reglas de Property siguen como propuestas en el catálogo de fiscal-core: verificarlas y publicarlas (tres
  personas distintas) es trabajo del dueño (ficha `emision-003` de `mijex-fiscal`).
- Property y HS aplican las migraciones de la librería **al arrancar**: actualizar la librería en un entorno ejecuta
  sus migraciones allí. Una migración destructiva necesita aprobación antes de publicar la versión.
- `npm run lint` y `npm run knip` fallan por ficheros de `.agents/` (skills de terceros, no se tocan); `eslint src tests`
  queda limpio.
