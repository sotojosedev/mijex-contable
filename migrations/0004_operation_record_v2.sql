-- Spec 003, corte 2 (REF-DEC-013, aprobado el 2026-11-22): corrección por reversión, naturaleza del importe y
-- tipos nuevos. Aditiva: las filas de la 0003 quedan en la versión 1, sin naturaleza ni reversión. La tabla sigue
-- siendo de solo inserción (trigger operation_record_immutable).
ALTER TABLE contable.operation_record
  ADD COLUMN nature         text CHECK (nature IN ('OWN_INCOME', 'THIRD_PARTY_FUNDS', 'WITHHOLDING', 'TAX_PAYMENT', 'SETTLEMENT')),
  ADD COLUMN source_version integer NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  ADD COLUMN reverses       uuid REFERENCES contable.operation_record (id),
  ADD COLUMN reason         text;

-- Tipos nuevos: retención y devengo de honorarios (los anteriores siguen valiendo).
ALTER TABLE contable.operation_record DROP CONSTRAINT operation_record_kind_check;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_kind_check
  CHECK (kind IN ('INVOICE', 'RECEIPT', 'COLLECTION', 'PAYMENT', 'SUPPLIER_INVOICE', 'EXTERNAL', 'WITHHOLDING', 'FEE_ACCRUAL'));

-- Varias versiones por origen; cada registro se revierte como mucho una vez; una reversión lleva motivo.
ALTER TABLE contable.operation_record DROP CONSTRAINT operation_record_source_key;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_source_key UNIQUE (source_system, source_id, source_version);
CREATE UNIQUE INDEX operation_record_reverses_key ON contable.operation_record (reverses) WHERE reverses IS NOT NULL;
ALTER TABLE contable.operation_record ADD CONSTRAINT operation_record_reversal_reason
  CHECK (reverses IS NULL OR (reason IS NOT NULL AND btrim(reason) <> ''));
