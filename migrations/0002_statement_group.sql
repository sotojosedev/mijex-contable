-- 0002 · Presentación en la cuenta de resultados: grupo opcional de la cuenta (spec 001, fase 2).
-- Dato del plan (no del motor): qué gastos forman el coste de ventas. Solo aditivo.
ALTER TABLE contable.account ADD COLUMN statement_group TEXT CHECK (statement_group IN ('COST_OF_SALES'));
