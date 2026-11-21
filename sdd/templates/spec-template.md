# Spec NNN — <Título>

| Campo | Valor |
|-------|-------|
| Estado | Borrador · En revisión · Aprobado · Implementado · Verificado |
| Solicitado por | <dueño / producto> |
| Fecha | AAAA-MM-DD |
| Países | ES · DO · ambos |
| Consumidores | Property · Home Services · ambos |

> Fase 1 del [proceso SDD](../README.md). Describe **qué** y **por qué**, sin tablas, módulos ni funciones. Toda duda
> se marca `[NEEDS CLARIFICATION: …]` y se resuelve en `clarify.md`.

## 1. Problema y contexto
<Qué pasa hoy, a quién afecta y por qué importa, con ejemplos reales.>

## 2. Objetivo
<Resultado medible.>

## 3. Historias
- **H1** — Como <Property / HS / organización / plataforma>, quiero <acción>, para <beneficio>.

## 4. Criterios de aceptación
| ID | Historia | Criterio (Dado / Cuando / Entonces) |
|----|----------|-------------------------------------|
| CA1 | H1 | **Dado** … **cuando** … **entonces** … |

## 5. Reglas y referencias
| Regla | Qué dice | Referencia oficial | Nivel / estado |
|-------|----------|--------------------|----------------|
| R-<ÁMBITO>-NNN | … | REF-<PAÍS>-NNN (organismo, norma, artículo, fecha, URL) | A/B · `[verificar]` |

Una regla sin referencia oficial no se implementa (AGENTS.md §1).

## 6. Casos límite
- Otra organización o país (debe fallar o no verse).
- Vigencias que empiezan o vencen en el periodo; datos sin vigencia.
- Redondeo, importes cero o negativos, monedas distintas.
- Operación repetida o concurrente (idempotencia).

## 7. Requisitos no funcionales
- Seguridad y datos personales:
- Multi-país por datos (sin constantes por país):
- Inmutabilidad y auditoría:
- Volumen y rendimiento:

## 8. Fuera de alcance
- …

## 9. Preguntas abiertas
- [NEEDS CLARIFICATION: …]
