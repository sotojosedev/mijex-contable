# Plan NNN — <Título>

| Campo | Valor |
|-------|-------|
| Estado | Borrador · Aprobado |
| Spec | [spec.md](spec.md) · Clarify: [clarify.md](clarify.md) |
| Fecha | AAAA-MM-DD |

> Fase 3 del [proceso SDD](../README.md). Describe **cómo** se implementa la spec aprobada. Requisito previo:
> `clarify.md` sin preguntas abiertas.

## 1. Resumen técnico
<Enfoque en 3 a 6 líneas.>

## 2. Inventario (localizar antes de diseñar, AGENTS.md §6)
| Tipo | Elemento existente | Uso en este plan |
|------|-------------------|------------------|
| Núcleo | `src/core/…` (dinero, fechas, vigencias, errores) | reutilizar / ampliar |
| Módulo | `src/<módulo>/…` | … |
| Librería fiscal | `@mijex/fiscal-core` | consumir (frontera K9) |
| Esquema PG | `migrations/000N_….sql` | sin cambio / migración nueva |
| Reglas y referencias | `docs/reglas/`, `docs/referencias/` | nuevas / modificadas |
| Tests | `tests/<módulo>/…`, `tests/pg/…` | ampliar |
| Consumidores | Property / HS (`…`) | impacto |

## 3. Diseño
### 3.1 API pública
<Tipos exportados, funciones y errores tipados. Si hay un cambio incompatible, es una stop condition (K3).>

### 3.2 Datos y migraciones
- Migración nueva `migrations/000N_<nombre>.sql` (nunca se reescribe una publicada).
- Datos existentes, compatibilidad y vuelta atrás.
- Índices y bloqueos según `supabase-postgres-best-practices`.

### 3.3 Reglas como datos
<Qué datos configurables con vigencia, con su ID de regla y su referencia (K4).>

## 4. Seguridad y aislamiento
| Riesgo | Mitigación | Test |
|--------|------------|------|
| Datos de otra organización o país | filtro por organización y país | test con identificador ajeno |
| Entrada maliciosa | validación en el límite | test de rechazo |
| Secretos o datos personales en logs | inyección, sin registrar | — |

## 5. Tests (TDD)
- Unit (`npm test`): una prueba por regla, `describe('[R-…] …')`.
- PostgreSQL (`npm run test:pg`): contrato común en memoria y en PG, concurrencia, idempotencia.
- Consumidores: e2e en Property o HS si el cambio los afecta.

## 6. Despliegue y vuelta atrás
<Orden, banderas, migraciones y cómo revertir.>

## 7. Constitution check ([`constitucion.md`](../../sdd/constitucion.md))
| Principio | Cumple | Cómo / por qué no aplica |
|-----------|--------|--------------------------|
| K1 Regla + referencia + test | ✅ | … |
| K2 Fuentes oficiales | ✅ | … |
| K3 Stop conditions | ✅ | decisiones en `clarify.md` |
| K4 Multi-país por datos | ✅ | … |
| K5 Dinero exacto | ✅ | … |
| K6 Inmutabilidad | ✅ | … |
| K7 Seguridad | ✅ | … |
| K8 Reutilización | ✅ | … |
| K9 Frontera fiscal | ✅ / N/A | … |
| K10 SDD + TDD | ✅ | … |
| K11 Calidad verificable | ✅ | … |

## 8. Alternativas descartadas
| Alternativa | Motivo |
|-------------|--------|
| … | … |
