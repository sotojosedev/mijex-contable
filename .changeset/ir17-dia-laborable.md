---
"@sotojosedev/contable-core": minor
---

R-DO-206: `buildIr17Summary` traslada el vencimiento del IR-17 al siguiente día laborable cuando el día 10 cae en
sábado, domingo o en un feriado de la lista opcional `holidays` (AAAA-MM-DD), según el Calendario del Contribuyente
2026 de la DGII (REF-DO-037). Un feriado mal formado lanza `RangeError`.
