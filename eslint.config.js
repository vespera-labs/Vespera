import { defineConfig } from "eslint/config";

// Root ESLint config.
//
// Scope: this config only lints repository-root JavaScript (config files,
// helper scripts). Each sub-package (backend/, frontend/, contract/) owns and
// runs its own lint setup, so they are ignored here to avoid double-linting
// with a weaker root ruleset. The baseline below is intentionally dependency
// free (no @eslint/js / globals packages) so `pnpm run lint` works at the root
// with only the already-installed `eslint` package and no lockfile changes.
const eslintConfig = defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/dist/**",
      "**/target/**",
      "**/.git/**",
      // Sub-packages have their own ESLint configs and CI lint steps.
      "backend/**",
      "frontend/**",
      "contract/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
    },
  },
]);

export default eslintConfig;
