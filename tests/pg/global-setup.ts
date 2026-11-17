import pg from "pg";
import { migrate } from "../../src/persistence/pg/migrate.js";

/** Base de pruebas con el esquema `contable` recién migrado en cada ejecución de `npm run test:pg`. */
export default async function setup(): Promise<void> {
  const connectionString = process.env.CONTABLE_TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Falta CONTABLE_TEST_DATABASE_URL (base de pruebas con «test» en el nombre)");
  if (!/test/i.test(new URL(connectionString).pathname)) throw new Error("CONTABLE_TEST_DATABASE_URL debe apuntar a una base de pruebas (nombre con «test»)");
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS contable CASCADE");
    await migrate(pool);
  } finally {
    await pool.end();
  }
}
