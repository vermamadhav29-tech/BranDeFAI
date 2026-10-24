import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Generated from the design template: links are routed client-side by DraftrEffects.
  {
    files: ["src/components/draftr/**"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },
  // App → marketing links are deliberately full page loads so marketing CSS never leaks into the app.
  {
    files: ["src/app/**", "src/components/layout/**"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      // Data-fetch effects here reset local state on route/prop change; pre-existing pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
