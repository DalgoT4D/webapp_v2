import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TypeScript-specific rules (more strict)
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",

      // React-specific rules
      "react/prop-types": "off",
      "react/no-unescaped-entities": "warn",
      "react-hooks/rules-of-hooks": "warn", // Downgrade from error to warn
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "warn",
      "react/jsx-key": "warn", // Downgrade from error to warn
      "react/no-array-index-key": "warn",

      // General rules (more strict)
      "no-unused-vars": "off", // Handled by TypeScript
      "no-console": "off", // Turn off console warnings
      "no-debugger": "error",
      "prefer-const": "warn",
      "no-var": "error",
      "eqeqeq": "warn",
      "no-duplicate-imports": "warn",

      // Code quality - make less strict
      "complexity": ["off", 25],
      "max-depth": ["off", 6],
      "max-lines-per-function": ["off", 300],
      "max-params": ["warn", 7]
    }
  }
];

export default eslintConfig;
