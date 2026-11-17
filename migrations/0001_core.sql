-- 0001 · Núcleo contable multiempresa (spec 001).
-- R-CORE-002 cuadre · R-CORE-003 solo inserción · R-CORE-004 idempotencia · R-CORE-005 datos con vigencia.
-- Importes en unidades menores (BIGINT, R-CORE-001). Fechas contables como DATE.

CREATE TABLE contable.entity (
  id              UUID PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('PLATFORM','ORGANIZATION','COMMUNITY','OWNER')),
  country         CHAR(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency        CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  framework       TEXT NOT NULL,
  external_system TEXT NOT NULL,
  external_ref    TEXT NOT NULL,
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (external_system, external_ref)
);

CREATE TABLE contable.chart (
  id            UUID PRIMARY KEY,
  framework     TEXT NOT NULL,
  version       TEXT NOT NULL,
  valid_from    DATE NOT NULL,
  valid_to      DATE,
  status        TEXT NOT NULL CHECK (status IN ('DRAFT','APPROVED')),
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  reference_ids TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (framework, version),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK ((status = 'APPROVED') = (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
-- Un solo plan aprobado con vigencia abierta por marco (la versión nueva cierra la anterior).
CREATE UNIQUE INDEX chart_one_open_approved ON contable.chart (framework) WHERE status = 'APPROVED' AND valid_to IS NULL;

CREATE TABLE contable.account (
  chart_id    UUID NOT NULL REFERENCES contable.chart (id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_side TEXT NOT NULL CHECK (normal_side IN ('DEBIT','CREDIT')),
  position    INT NOT NULL,
  PRIMARY KEY (chart_id, code)
);

CREATE TABLE contable.posting_rule (
  id            UUID PRIMARY KEY,
  framework     TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  version       TEXT NOT NULL,
  valid_from    DATE NOT NULL,
  valid_to      DATE,
  rule_id       TEXT NOT NULL,
  reference_ids TEXT[] NOT NULL DEFAULT '{}',
  lines         JSONB NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) >= 2),
  UNIQUE (framework, event_type, version),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX posting_rule_one_open ON contable.posting_rule (framework, event_type) WHERE valid_to IS NULL;

CREATE TABLE contable.journal_entry (
  id              UUID PRIMARY KEY,
  entity_id       UUID NOT NULL REFERENCES contable.entity (id),
  entry_date      DATE NOT NULL,
  currency        CHAR(3) NOT NULL,
  chart_id        UUID NOT NULL REFERENCES contable.chart (id),
  posting_rule_id UUID NOT NULL REFERENCES contable.posting_rule (id),
  event_type      TEXT NOT NULL,
  source_system   TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  memo            TEXT,
  reversal_of     UUID UNIQUE REFERENCES contable.journal_entry (id),
  reason          TEXT,
  actor           TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  -- R-CORE-004: un hecho, un asiento.
  UNIQUE (entity_id, source_system, source_id, name),
  -- R-CORE-003: toda reversión lleva actor y motivo.
  CHECK (reversal_of IS NULL OR (reason IS NOT NULL AND actor IS NOT NULL))
);
CREATE INDEX journal_entry_entity_date ON contable.journal_entry (entity_id, entry_date);

CREATE TABLE contable.journal_line (
  entry_id UUID NOT NULL REFERENCES contable.journal_entry (id),
  line_no  INT NOT NULL,
  account  TEXT NOT NULL,
  debit    BIGINT NOT NULL CHECK (debit >= 0),
  credit   BIGINT NOT NULL CHECK (credit >= 0),
  memo     TEXT,
  PRIMARY KEY (entry_id, line_no),
  -- Cada línea va a un solo lado.
  CHECK ((debit > 0) <> (credit > 0))
);

-- R-CORE-003: el mayor y los datos maestros no se editan ni se borran.
CREATE FUNCTION contable.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'contable.%: solo inserción (%)', TG_TABLE_NAME, TG_OP;
END $$;

CREATE TRIGGER entity_immutable BEFORE UPDATE OR DELETE ON contable.entity FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
CREATE TRIGGER account_immutable BEFORE UPDATE OR DELETE ON contable.account FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
CREATE TRIGGER journal_entry_immutable BEFORE UPDATE OR DELETE ON contable.journal_entry FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();
CREATE TRIGGER journal_line_immutable BEFORE UPDATE OR DELETE ON contable.journal_line FOR EACH ROW EXECUTE FUNCTION contable.reject_mutation();

-- Plan: solo aprobar (DRAFT → APPROVED) y cerrar una vigencia abierta.
CREATE FUNCTION contable.chart_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'contable.chart: un plan no se borra'; END IF;
  IF (to_jsonb(NEW) - 'status' - 'approved_by' - 'approved_at' - 'valid_to') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'approved_by' - 'approved_at' - 'valid_to')
     OR (OLD.status = 'APPROVED' AND (NEW.status, NEW.approved_by, NEW.approved_at) IS DISTINCT FROM (OLD.status, OLD.approved_by, OLD.approved_at))
     OR (OLD.valid_to IS NOT NULL AND NEW.valid_to IS DISTINCT FROM OLD.valid_to) THEN
    RAISE EXCEPTION 'contable.chart: solo se aprueba un borrador o se cierra una vigencia abierta';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER chart_guard BEFORE UPDATE OR DELETE ON contable.chart FOR EACH ROW EXECUTE FUNCTION contable.chart_guard();

-- Las cuentas se dan de alta con el plan en borrador.
CREATE FUNCTION contable.account_draft_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT status FROM contable.chart WHERE id = NEW.chart_id) <> 'DRAFT' THEN
    RAISE EXCEPTION 'contable.account: un plan aprobado no admite cuentas nuevas';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_draft_only BEFORE INSERT ON contable.account FOR EACH ROW EXECUTE FUNCTION contable.account_draft_only();

-- Regla: solo cerrar una vigencia abierta.
CREATE FUNCTION contable.posting_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'contable.posting_rule: una regla no se borra'; END IF;
  IF (to_jsonb(NEW) - 'valid_to') IS DISTINCT FROM (to_jsonb(OLD) - 'valid_to') OR OLD.valid_to IS NOT NULL THEN
    RAISE EXCEPTION 'contable.posting_rule: solo se cierra una vigencia abierta';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posting_rule_guard BEFORE UPDATE OR DELETE ON contable.posting_rule FOR EACH ROW EXECUTE FUNCTION contable.posting_rule_guard();

-- R-CORE-002: al confirmar, cada asiento tiene líneas y cuadra (también si alguien escribe sin la librería).
CREATE FUNCTION contable.entry_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d BIGINT; c BIGINT; n INT;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*) INTO d, c, n FROM contable.journal_line WHERE entry_id = NEW.id;
  IF n = 0 OR d <> c THEN
    RAISE EXCEPTION 'contable.journal_entry %: asiento sin líneas o descuadrado (debe %, haber %)', NEW.id, d, c;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER entry_balanced AFTER INSERT ON contable.journal_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION contable.entry_balanced();
