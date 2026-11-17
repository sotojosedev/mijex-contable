import { access } from "node:fs/promises";
import { migrate as migrateSchema } from "@sotojosedev/fiscal-core/pg";
import type { Pool } from "pg";

/** Carpeta `migrations/` del paquete: se busca hacia arriba desde este módulo (en `src/` o en `dist/`). */
async function packagedMigrations(): Promise<URL> {
  for (let up = "./"; up.length < 20; up += "../") {
    const candidate = new URL(`${up}migrations/0001_core.sql`, import.meta.url);
    try {
      await access(candidate);
      return new URL("./", candidate);
    } catch {
      // seguir subiendo
    }
  }
  throw new Error("No se encuentra la carpeta migrations/ del paquete");
}

/** Aplica las migraciones del esquema `contable` con el mismo mecanismo que fiscal-core (bloqueo, checksum, una transacción por migración). */
export async function migrate(pool: Pool, options: { readonly directory?: URL } = {}): Promise<{ readonly applied: readonly string[] }> {
  return migrateSchema(pool, { schema: "contable", directory: options.directory ?? (await packagedMigrations()) });
}
