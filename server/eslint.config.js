import js from "@eslint/js";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 1. Global ignores (replaces .eslintignore)
  { 
    ignores: ["node_modules/", "dist/", "build/", "coverage/"] 
  },
  
  // 2. Base JS configuration
  js.configs.recommended,

  // 3. Node/Express Environment Specifics
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module", // Use "commonjs" if your project uses require() instead of import
      globals: {
        ...globals.node,  // Enables node globals like process, require, module
        ...globals.es2021
      },
    },
    rules: {
      // Backend specific adjustments
      "no-console": "off",            // Off because console.log/error is standard for server logging
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",    // Allows unused Express args like next or _req
        "varsIgnorePattern": "^_" 
      }],
      "prefer-const": "error",
      "no-process-exit": "off"        // Off to allow process.exit() if you need to shut down the server safely
    },
  },
];
