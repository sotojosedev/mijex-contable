# Spec 003 · T034 · Liquidación guardada al propietario (opción A)

> Estado: **aprobada e implementada** (2026-11-22). El dueño aprobó la migración y las 4 preguntas de §4 con la opción
> propuesta. Migración `20261122100000_spec003_liquidacion_guardada` validada en la base e2e; sin aplicar en desarrollo
> ni en producción.
> Decisión previa: opción A aprobada (`migraciones-y-regresion.md` §3). Esta es la migración concreta y su flujo.

## 1. Problema
- La liquidación al propietario (`computeOwnerStatement`, specs 050 y 051) se calcula al consultarla y no se guarda.
- El `Payout` al propietario no dice qué periodo liquida.
- Sin eso no se puede registrar con seguridad **qué honorario devengado se compensó en qué transferencia**
  (clarify Q4: los honorarios se registran al devengarse; su cobro o compensación, aparte).

## 2. Migración Prisma propuesta (aditiva)
```prisma
enum OwnerSettlementStatus {
  CONFIRMED
  VOID
}

model OwnerSettlement {
  id             String                @id @default(cuid())
  organizationId String
  organization   Organization          @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  ownerId        String
  owner          Owner                 @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  periodFrom     DateTime              @db.Date   // primer día de un mes
  periodTo       DateTime              @db.Date   // último día de un mes (meses cerrados)
  currency       String
  // Copia de la liquidación al confirmar (mismo cálculo, ningún importe nuevo):
  collected      Decimal               @db.Decimal(14, 2)
  expenses       Decimal               @db.Decimal(14, 2)
  managementFee  Decimal               @db.Decimal(14, 2)
  net            Decimal               @db.Decimal(14, 2)
  feeSource      String                // CONTRACT | OWNER (spec 051)
  payoutId       String?               @unique
  payout         Payout?               @relation(fields: [payoutId], references: [id], onDelete: Restrict)
  status         OwnerSettlementStatus @default(CONFIRMED)
  confirmedById  String
  confirmedAt    DateTime              @default(now())
  voidReason     String?
  voidedAt       DateTime?
  createdAt      DateTime              @default(now())

  @@index([organizationId, periodFrom])
  @@index([ownerId])
  @@map("owner_settlements")
}
```
SQL adicional en la misma migración:
- Una sola liquidación vigente por propietario, periodo y moneda:
  `CREATE UNIQUE INDEX owner_settlements_active_key ON owner_settlements ("ownerId", "periodFrom", "periodTo", currency) WHERE status <> 'VOID';`
- `CHECK` de importes: `collected >= 0`, `expenses >= 0`, `"managementFee" >= 0`,
  `net = collected - expenses - "managementFee"`.
- `CHECK` de periodo: `"periodFrom" <= "periodTo"`, empieza el día 1 y termina el último día del mes.
- `CHECK` de anulación: `status <> 'VOID' OR (btrim(coalesce("voidReason", '')) <> '' AND "voidedAt" IS NOT NULL)`.
- Trigger que impide modificar los importes, el periodo, el propietario y la moneda (la liquidación es una foto). Solo
  cambian `payoutId` (una vez, de null a un valor) y la anulación.

Las filas existentes no cambian: es una tabla nueva. Rollback: `DROP TABLE owner_settlements; DROP TYPE ...`.

## 3. Flujo propuesto
1. **Confirmar** (`POST /rentals/owners/:id/settlements`, ORG_ADMIN y PROPERTY_MANAGER, auditado):
   - el servidor calcula `computeOwnerStatement` del periodo y la moneda y guarda la foto;
   - solo meses enteros y cerrados, para que cuadre con los devengos mensuales (T033).
2. **Pagar:** el `Payout` al propietario puede indicar `settlementId`. Se exige que sea del mismo propietario y moneda,
   y que la liquidación no tenga ya otra transferencia. Las transferencias sin liquidación siguen como hoy.
3. **Registro (spec 003):** al confirmar, `fee-compensation:<liquidación>` como cobro (`COLLECTION`) de **ingreso
   propio** por el honorario, enlazado a los devengos de esos meses y, cuando exista, al `Payout`.
4. **Anular** (solo si su `Payout` no está pagado): la liquidación pasa a VOID con motivo y la compensación se revierte.

## 4. Preguntas para el dueño
1. ¿Apruebas la migración de §2 tal cual?
2. ¿Liquidación solo por **meses enteros y cerrados**? Alinea los devengos y las compensaciones; hoy la consulta admite
   cualquier rango.
3. ¿Enlazar el `Payout` con un `settlementId` opcional, sin obligar a que toda transferencia al propietario tenga
   liquidación?
4. ¿La compensación es un `COLLECTION` de ingreso propio, enlazado al devengo y al `Payout`?

## 5. Pruebas previstas
- e2e en rojo: confirmar, foto igual a la consulta, otra igual del mismo periodo → 409, `Payout` enlazado, compensación
  registrada y enlazada, anulación revertida, otra organización → 404, roles sin permiso → 403.
- Prisma: los CHECK y el trigger en la base de pruebas (importe modificado → error).
- Regresión: liquidaciones (050/051), transferencias, conciliación y el registro (003).

## 6. Implementado (2026-11-22), con dos precisiones
- Una liquidación cuya transferencia se **rechazó o canceló** puede enlazar otra (si no, quedaría bloqueada para
  siempre). El trigger lo comprueba en la base, igual que la coherencia de propietario, organización y moneda.
- La compensación se registra con la fecha de **confirmación** de la liquidación. Antes asegura los devengos de sus
  meses, aunque caigan fuera del periodo recuperado. La transferencia pagada se enlaza a la compensación.
