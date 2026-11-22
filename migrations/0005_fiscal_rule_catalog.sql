-- Spec 003, corte 2 (R-CORE-014, REF-DEC-013, aprobado el 2026-11-22): catálogo de reglas fiscales en datos
-- versionados, genérico (sin nada específico de una aplicación). Solo inserción: un cambio es una versión nueva, así
-- se conservan el histórico y la auditoría (quién, por qué y cuándo).
CREATE TABLE contable.fiscal_rule (
  id                uuid PRIMARY KEY,
  rule_id           text NOT NULL CHECK (rule_id <> ''),
  version           integer NOT NULL CHECK (version >= 1),
  country           text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  jurisdiction      text NOT NULL CHECK (jurisdiction <> ''),
  organization_type text NOT NULL CHECK (organization_type <> ''),
  operation_type    text NOT NULL CHECK (operation_type <> ''),
  treatment         text NOT NULL CHECK (treatment <> ''),
  validation        text NOT NULL CHECK (validation IN ('VERIFIED', 'APPROVED_PENDING_VERIFICATION', 'UNDETERMINED')),
  reference         text,
  valid_from        date NOT NULL,
  valid_to          date,
  recorded_by       text NOT NULL CHECK (recorded_by <> ''),
  reason            text NOT NULL CHECK (btrim(reason) <> ''),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_rule_version_key UNIQUE (rule_id, version),
  CONSTRAINT fiscal_rule_verified_reference CHECK (validation <> 'VERIFIED' OR (reference IS NOT NULL AND btrim(reference) <> '')),
  CONSTRAINT fiscal_rule_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX fiscal_rule_lookup_idx ON contable.fiscal_rule (country, organization_type, operation_type, valid_from);
CREATE TRIGGER fiscal_rule_immutable BEFORE UPDATE OR DELETE ON contable.fiscal_rule FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
