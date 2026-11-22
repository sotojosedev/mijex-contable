-- Spec 004c (K12, REF-DEC-015, plan aprobado el 2026-11-22): resultado fiscal verificado en el registro de operaciones
-- (contrato `FiscalResultEnvelope`, sin el contenido). Aditiva: lo anterior queda sin datos fiscales y no se reescribe.
-- Vuelta atrás:
--   ALTER TABLE contable.operation_record DROP CONSTRAINT operation_record_fiscal_check,
--     DROP COLUMN fiscal, DROP COLUMN fiscal_definitive;
ALTER TABLE contable.operation_record
  ADD COLUMN fiscal jsonb,
  ADD COLUMN fiscal_definitive boolean;

-- Con resultado fiscal, su indicador de definitivo; sin él, ninguno. El indicador coincide con el del sobre.
ALTER TABLE contable.operation_record
  ADD CONSTRAINT operation_record_fiscal_check CHECK (
    (fiscal IS NULL AND fiscal_definitive IS NULL)
    OR (jsonb_typeof(fiscal) = 'object' AND fiscal_definitive IS NOT NULL
        AND fiscal->>'provenance' IN ('FISCAL_CORE', 'EXTERNAL')
        AND (fiscal->>'definitive')::boolean = fiscal_definitive)
  );
