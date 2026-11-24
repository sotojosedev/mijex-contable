---
"@sotojosedev/contable-core": minor
---

R-DO-206: `buildIr17Summary` traslada el vencimiento del IR-17 al siguiente día laborable cuando el día 10 cae en
sábado, domingo o en un feriado de la lista opcional `holidays` (AAAA-MM-DD), según el Calendario del Contribuyente
2026 de la DGII (REF-DO-037). Un feriado mal formado lanza `RangeError`.

Nuevo campo `itbisWithheldDueDate`: el ITBIS retenido se declara en la declaración jurada mensual del ITBIS, el día 20 o
el siguiente día laborable (Decreto 293-11 arts. 24 y 25 párrafo III).
