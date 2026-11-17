import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "coverage/", "node_modules/", "specs/", ".claude/", "docs/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ["eslint.config.js"] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "no-restricted-properties": ["error", { object: "process", property: "env", message: "La configuración se inyecta; process.env solo en tests." }],
    },
  },
  { files: ["tests/**", "*.config.ts"], rules: { "no-restricted-properties": "off" } },
);
