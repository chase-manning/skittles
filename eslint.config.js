import js from "@eslint/js";
import globals from "globals";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "webapp", "node_modules", "example", "docs"]),
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
]);
