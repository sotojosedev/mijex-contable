import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/**/*.test.ts"], exclude: ["tests/pg/**"] } },
      // Requiere CONTABLE_TEST_DATABASE_URL (base de pruebas; se vacía el esquema `contable`).
      { test: { name: "pg", include: ["tests/pg/**/*.test.ts"], globalSetup: ["tests/pg/global-setup.ts"], fileParallelism: false } },
    ],
  },
});
