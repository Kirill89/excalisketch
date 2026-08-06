import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["node_modules", "public", "*.excalidraw"] },

  js.configs.recommended,

  // Browser React app.
  {
    files: ["src/**/*.{js,jsx}"],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: "detect" } },
    plugins: {
      ...react.configs.flat.recommended.plugins,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules, // no need to import React
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
    },
  },

  // Node scripts (server + build).
  {
    files: ["server.js", "build.mjs", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },

  // Allow empty catch blocks used for best-effort polling.
  { rules: { "no-empty": ["error", { allowEmptyCatch: true }] } },

  prettier,
];
