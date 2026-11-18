-- Spec 003 (R-CORE-012/013): registro de operaciones de cada organización (no son sus libros
-- oficiales). Solo inserción; único por origen; consultas por organización y fecha.
CREATE TABLE contable.operation_record (
  id              uuid PRIMARY KEY,
  organization_id text NOT NULL CHECK (organization_id <> ''),
  kind            text NOT NULL CHECK (kind IN ('INVOICE', 'RECEIPT', 'COLLECTION', 'PAYMENT', 'SUPPLIER_INVOICE', 'EXTERNAL')),
  occurred_on     date NOT NULL,
  amount          bigint NOT NULL,
  currency        text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  counterparty    text NOT NULL,
  document_type   text,
  document_number text,
  source_system   text NOT NULL CHECK (source_system <> ''),
  source_id       text NOT NULL CHECK (source_id <> ''),
  links           uuid[] NOT NULL DEFAULT '{}',
  origin          text NOT NULL CHECK (origin IN ('AUTOMATIC', 'MANUAL')),
  recorded_by     text NOT NULL CHECK (recorded_by <> ''),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_record_source_key UNIQUE (source_system, source_id),
  CONSTRAINT operation_record_document CHECK ((document_type IS NULL) = (document_number IS NULL))
);
CREATE INDEX operation_record_org_date_idx ON contable.operation_record (organization_id, occurred_on, id);
CREATE TRIGGER operation_record_immutable BEFORE UPDATE OR DELETE ON contable.operation_record FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
