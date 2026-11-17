import pg from "pg";

export function testPool(max = 5): pg.Pool {
  const connectionString = process.env.CONTABLE_TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Falta CONTABLE_TEST_DATABASE_URL");
  return new pg.Pool({ connectionString, max });
}

/** Vacía los datos del esquema `contable` (desactiva los disparadores solo en esta transacción). */
export async function resetDatabase(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = replica");
    for (const t of ["journal_line", "journal_entry", "posting_rule", "account", "chart", "entity"]) await client.query(`DELETE FROM contable.${t}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
