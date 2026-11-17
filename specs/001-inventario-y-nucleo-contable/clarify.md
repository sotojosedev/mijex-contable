# Clarify — Spec 001

| # | Pregunta | Respuesta del usuario (2026-11-17) |
|---|----------|------------------------------------|
| Q1 | ¿De quién son los libros? | **Multiempresa y por país desde el inicio.** Además de los libros de MIJEX por país, también los de cada organización cliente (Property) y de cada comunidad. |
| Q2 | Plan de cuentas por país | **ES:** PGC o PGC PYMES oficial (BOE, RD 1514/2007 y RD 1515/2007), cargado como datos. **RD:** plan propio de MIJEX alineado con NIIF para PYMES (ICPARD), revisado por el contador. |
| Q3 | 606/607/608 e IR-17 | En **`mijex-contable`**: salen de los libros y de los documentos registrados. `mijex-fiscal` sigue con la emisión y el envío. |
| Q4 | Persistencia | **Como `mijex-fiscal`:** librería TypeScript con puertos, almacén en memoria y PostgreSQL (esquema propio `contable`), tests de contrato y migraciones propias. |

## Consecuencias en el diseño
- **Entidad contable:** dueña de un juego de libros, con identificador externo (sistema y ref),
  tipo (`PLATFORM` | `ORGANIZATION` | `COMMUNITY` | `OWNER`), país, moneda funcional, marco
  contable y plan de cuentas vigente. Ningún tipo de entidad está fijo en la lógica: el tipo
  solo selecciona qué marco y qué plan se le asignan por defecto (datos).
- **Marco contable** por entidad y vigencia: ES-PGC, ES-PGC-PYMES y DO-NIIF-PYMES.
  - El de comunidades de propietarios en España queda **`[verificar]`**: no están obligadas al
    PGC; la Ley 49/1960 de Propiedad Horizontal exige presupuesto, fondo de reserva y
    liquidación anual. El de condominios en RD también queda `[verificar]`. Sin fuente
    oficial no se implementan sus reglas: el núcleo los admite como entidades, pero sus
    planes y reglas se definen en una spec posterior.
- **PGC:** el texto oficial se descarga del BOE y se guarda en `docs/referencias/es/` antes de
  cargar el cuadro de cuentas. Se cargan solo las cuentas que usan los eventos implementados,
  con su código y nombre oficiales.
- **Plan de RD:** propuesta de MIJEX marcada como «pendiente de revisión del contador». No se
  activa en producción sin esa revisión, que queda registrada.
- **Aislamiento entre entidades:** cada lectura y escritura va acotada por la entidad, y no hay
  asientos entre entidades. Los saldos entre entidades (MIJEX ↔ organización) se reflejan como
  asientos espejo en cada libro, nunca compartidos.
