import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 1. Global ignores (replaces .eslintignore)
  { 
    ignores: ["dist", "build", "node_modules", ".next"] 
  },
  
  // 2. Base JS configuration
  js.configs.recommended,

  // 3. React Specific configuration
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "react-refresh": pluginReactRefresh,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect", // Automatically detects your React version
      },
    },
    rules: {
      // Clones recommended rules manually since some plugins lack native flat config exports
      ...pluginReact.configs.flat.recommended.rules,
      ...pluginReact.configs.flat["jsx-runtime"].rules, // Safe for React 17+ JSX transform
      ...pluginReactHooks.configs.recommended.rules,

      // Custom adjustments
      "react/react-in-jsx-scope": "off", // Not needed in modern React
      "react/prop-types": "off",         // Turn off if you aren't using prop-types
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
