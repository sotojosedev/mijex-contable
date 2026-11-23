-- Spec 005 (K12, REF-DEC-016, aprobada por el dueño el 2026-11-23): retirada del catálogo de reglas fiscales de esta
-- librería. Las reglas fiscales viven solo en `@mijex/fiscal-core` (spec 014 de mijex-fiscal, migraciones 0021/0022).
-- Las migraciones 0005 y 0006 no se modifican: esta las deshace.
--
-- Nunca borra datos en silencio: si la tabla tiene alguna fila, la migración falla y no cambia nada (una transacción por
-- migración). Sin CASCADE: si otro objeto dependiera de la tabla, también falla. El bloqueo exclusivo impide que se
-- inserte algo entre la comprobación y el borrado.
--
-- Vuelta atrás: restaurar la copia previa, o ejecutar a mano el SQL de 0005 y 0006 (la tabla estaba vacía: no hay datos
-- que recuperar).
DO $$
BEGIN
  IF to_regclass('contable.fiscal_rule') IS NOT NULL THEN
    LOCK TABLE contable.fiscal_rule IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM contable.fiscal_rule) THEN
      RAISE EXCEPTION 'contable.fiscal_rule tiene filas: no se elimina (spec 005). Revisa y traslada esas reglas a @mijex/fiscal-core antes de migrar.'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
END
$$;

-- Con la tabla se van su índice y sus disparadores (fiscal_rule_immutable y fiscal_rule_review_guard). La función
-- compartida contable.reject_mutation() se queda: la usan las demás tablas.
DROP TABLE IF EXISTS contable.fiscal_rule;
DROP FUNCTION IF EXISTS contable.fiscal_rule_review_guard();
