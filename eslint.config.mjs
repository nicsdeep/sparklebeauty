// ESLint (flat config) with the Next.js rules: core web vitals, React hooks and TypeScript.
// Run with `npm run lint`.
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `const { onHand, ...rest } = row` drops a field on purpose; that is not an unused variable.
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }] } },
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**", "td/**", "td2/**", "design/**"] },
];

export default eslintConfig;
