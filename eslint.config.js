import js from "@eslint/js";
import { defineConfig } from "eslint/config";

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
      "backend/**",
      "frontend/**",
    ],
  },
  js.configs.recommended,
]);

export default eslintConfig;
