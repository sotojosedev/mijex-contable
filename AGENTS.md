# MIJEX Contable — Reglas de ingeniería para agentes

Librería de contabilidad para MIJEX Property y MIJEX Home Services, multi-país y
configurable sin código. Prioridad: **cumplimiento legal > corrección > seguridad >
compatibilidad de la API > rendimiento > comodidad**.

## 1. Todo desarrollo entrega tres cosas: regla, referencia y test

Ningún desarrollo se da por terminado sin las tres piezas, enlazadas entre sí:

| Pieza | Dónde | Qué contiene |
|-------|-------|--------------|
| **Regla** | `docs/reglas/` | La regla de negocio o contable en lenguaje claro, con un ID estable (`R-<ÁMBITO>-NNN`). |
| **Referencia** | `docs/referencias/` | La fuente oficial que justifica la regla, con un ID (`REF-<PAÍS>-NNN`): organismo, documento, artículo, versión, fecha y URL. |
| **Test** | `tests/` | Al menos un test por regla, con el ID de la regla en su nombre: `describe('[R-ES-001] …')`. |

Trazabilidad obligatoria: **regla → referencia(s) → test(s)**. Una regla sin referencia
oficial no se implementa: queda `[verificar]` y se consulta al usuario. Una regla sin
test no está terminada.

Las reglas técnicas propias de la librería (dinero exacto, inmutabilidad, etc.) usan el
ámbito `CORE` y su referencia puede ser una decisión documentada del usuario
(`REF-DEC-NNN`), nunca una suposición.

## 2. Proceso
1. **SDD** (skill `sdd`): `specs/NNN-slug/` con `spec.md` → `clarify.md` → `plan.md` →
   `tasks.md`. La spec enumera las reglas y referencias que crea o modifica.
2. **TDD** (skills `test-driven-development` y `ts-testing`): test rojo con el ID de la
   regla → código mínimo → refactor.
3. **Cierre**: actualizar `docs/reglas/`, `docs/referencias/` y `docs/diseno-tecnico.md`
   (secciones afectadas y registro de cambios).

## 3. Fuentes oficiales (únicas válidas)
- **España:** ICAC (normativa contable), BOE (legislación), Agencia Tributaria.
- **República Dominicana:** DGII, ICPARD.
- Un país nuevo no se empieza sin que el usuario defina sus fuentes oficiales.
- Un skill de terceros nunca sustituye a una fuente oficial.
- Skills por país (punto de partida; siempre contrastar con la fuente):
  - **ES:** `spain-bookkeeping`, `es-corporate-tax`, `es-vat-return`, `es-autonomous-worker`
    y `spain-einvoice` (todos de terceros).
  - **DO:** `do-contabilidad` (propio). Solo se implementan datos de nivel A o B; los de
    nivel C requieren confirmación del usuario y los de nivel D o `[verificar]` no se usan.

## 4. STOP CONDITIONS (requieren confirmación explícita del usuario)
- Cualquier regla contable, fiscal o legal nueva o modificada.
- Duda o contradicción entre fuentes, código y documentación.
- Cálculo de dinero, redondeo, tipos de cambio o impuestos.
- Borrar código contable en `mijex-home-services`, `mijex-property` o `mijex-fiscal`.
- Cambios incompatibles en la API pública o en la arquitectura.
- Git: commit, PR, push, merge, ramas o publicación de versiones.

## 5. Diseño multi-país
- Ningún país, moneda, impuesto, plan de cuentas o tipo fijo en el código
  (`if (country === 'ES')` está prohibido). Todo es **dato configurable, versionado
  por vigencia**, gestionable desde la app.
- Las reglas configurables también llevan su ID de regla y su referencia en los datos.

## 6. Estándar profesional: seguridad, reutilización, eficiencia y calidad
**Seguridad (lo primero):**
- Validar toda entrada externa en el límite de la API; tipos estrictos, sin `any`.
- Secretos por referencia inyectada; nunca en código, logs ni errores.
- SQL siempre parametrizado; privilegio mínimo; sin dependencias innecesarias ni sin auditar.
- Datos contables inmutables una vez registrados: se corrigen con asientos nuevos, con
  traza de quién, cuándo y por qué.
- Revisión con `security-audit` en todo lo que toque secretos, permisos, entradas o datos personales.

**Reutilización:**
- Antes de escribir código, buscar si ya existe aquí o en `@mijex/fiscal-core`. No duplicar.
- Utilidades comunes (dinero, fechas, vigencias, IDs, errores) en un único módulo del núcleo.
- Lo que se migra desde HS, Property o `mijex-fiscal` se extrae una sola vez y se reutiliza desde aquí.

**Eficiencia:**
- Código mínimo que cumpla la regla; sin abstracciones especulativas.
- Consultas e índices pensados para el volumen contable; sin N+1; operaciones por lotes cuando proceda.
- Todo trabajo de PostgreSQL (esquema, migraciones, índices, SQL, bloqueos) sigue el skill
  `supabase-postgres-best-practices`.
- Dinero exacto en unidades menores (`bigint`); nunca `number` flotante.

**Calidad:**
- TypeScript estricto, funciones pequeñas, nombres claros, errores tipados.
- Antes de cerrar: lint + typecheck + tests + build en verde, y revisión con
  `code-review-typescript`. En cambios relevantes: `/code-review` y `/simplify`.
- Documentación al día: reglas, referencias, fichas de país y `docs/diseno-tecnico.md`.

## 7. Tratamiento fiscal solo con regla validada (dueño, 2026-11-22)
- Ningún tratamiento fiscal (tipo, exención, retención o documento) se aplica sin una regla **validada** y respaldada
  por fuentes oficiales (§3).
- Las excepciones solo **eximen** o **remiten** a reglas validadas; nunca crean porcentajes. Quien propone una regla o
  excepción **no** puede aprobarla.
- Frontera: `@mijex/fiscal-core` es responsable de las reglas y los cálculos fiscales. Esta librería valida la
  **procedencia y el estado** del resultado fiscal antes de contabilizarlo, sin duplicar reglas ni cálculos.
- Tratamiento indeterminado: no hay emisión fiscal automática y la operación va a **revisión**, sin bloquear los
  cobros y pagos permitidos.
- Los documentos emitidos son **inmutables**: se corrigen con documentos nuevos (rectificativa, anulación o reversión).

