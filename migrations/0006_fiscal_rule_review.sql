-- Spec 004b (K12, REF-DEC-015, plan aprobado el 2026-11-22): separación obligatoria entre quien propone una regla
-- fiscal y quien la revisa (verifica o rechaza). Aditiva. La tabla sigue siendo solo de inserción: revisar es una
-- versión nueva justo encima de la propuesta pendiente.
-- Vuelta atrás:
--   DROP TRIGGER fiscal_rule_review_guard ON contable.fiscal_rule; DROP FUNCTION contable.fiscal_rule_review_guard();
--   ALTER TABLE contable.fiscal_rule DROP CONSTRAINT fiscal_rule_review_check, DROP CONSTRAINT fiscal_rule_proposed_by_check,
--     DROP CONSTRAINT fiscal_rule_validation_check,
--     ADD CONSTRAINT fiscal_rule_validation_check CHECK (validation IN ('VERIFIED', 'APPROVED_PENDING_VERIFICATION', 'UNDETERMINED')),
--     DROP COLUMN proposed_by, DROP COLUMN reviewed_by, DROP COLUMN reviewed_at;
-- (Solo si no hay filas REJECTED ni revisadas: en desarrollo, 0 filas el 2026-11-22.)

ALTER TABLE contable.fiscal_rule
  ADD COLUMN proposed_by text,
  ADD COLUMN reviewed_by text,
  ADD COLUMN reviewed_at timestamptz;

ALTER TABLE contable.fiscal_rule DROP CONSTRAINT fiscal_rule_validation_check;
ALTER TABLE contable.fiscal_rule
  ADD CONSTRAINT fiscal_rule_validation_check CHECK (validation IN ('VERIFIED', 'APPROVED_PENDING_VERIFICATION', 'UNDETERMINED', 'REJECTED'));

-- Las filas anteriores a esta migración no tienen proponente ni revisor: las restricciones nuevas valen para las filas
-- nuevas (NOT VALID no comprueba lo existente; la tabla es solo de inserción).
ALTER TABLE contable.fiscal_rule
  ADD CONSTRAINT fiscal_rule_proposed_by_check CHECK (proposed_by IS NOT NULL AND btrim(proposed_by) <> '') NOT VALID,
  ADD CONSTRAINT fiscal_rule_review_check CHECK (
    (validation NOT IN ('VERIFIED', 'REJECTED') AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (validation IN ('VERIFIED', 'REJECTED') AND reviewed_by IS NOT NULL AND btrim(reviewed_by) <> '' AND reviewed_at IS NOT NULL
        AND reviewed_by <> proposed_by AND recorded_by = reviewed_by)
  ) NOT VALID;

-- Una versión revisada solo puede ir justo encima de una propuesta pendiente de la misma regla, con el mismo
-- proponente: así ni la siembra ni una inserción directa pueden verificar, y nadie revisa su propia propuesta.
CREATE FUNCTION contable.fiscal_rule_review_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous contable.fiscal_rule%ROWTYPE;
BEGIN
  IF NEW.validation IN ('VERIFIED', 'REJECTED') THEN
    SELECT * INTO previous FROM contable.fiscal_rule WHERE rule_id = NEW.rule_id AND version = NEW.version - 1;
    IF NOT FOUND OR previous.validation <> 'APPROVED_PENDING_VERIFICATION'
       OR COALESCE(previous.proposed_by, previous.recorded_by) IS DISTINCT FROM NEW.proposed_by THEN
      RAISE EXCEPTION 'fiscal_rule_review: una versión revisada exige una propuesta pendiente justo debajo, del mismo proponente'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fiscal_rule_review_guard BEFORE INSERT ON contable.fiscal_rule
  FOR EACH ROW EXECUTE FUNCTION contable.fiscal_rule_review_guard();
