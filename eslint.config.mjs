import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "safari/**",
      // ~26MB of generated map/scene data, not hand-written logic
      "scenedata/**",
      "assets/**",
      "images/**",
      "audio/**",
      "**/*.min.js",
      // vendored third-party code kept as plain files, not npm packages (see docs/MODERNIZATION.md)
      "color-picker.js",
      "jquery.contextMenu.js",
      "jquery.csv.js",
      "jquery.ui.touch-punch.js",
      "onedrive/onedrivemsal.js",
    ],
  },
  js.configs.recommended,
  {
    // Everything under Load.js is a classic global <script>, not a module:
    // functions/vars defined in one file are consumed as implicit globals by
    // many others, so no-undef mostly flags legitimate cross-file references.
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        chrome: "readonly",
        browser: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "warn",
    },
  },
  {
    // A handful of files are real ES modules despite the .js extension
    // (imported via `import`, not loaded as a <script> — see Load.js).
    files: ["**/*.mjs", "ajaxQueue/ajaxQueue.js", "ajaxQueue/jquery.module.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        chrome: "readonly",
        browser: "readonly",
      },
    },
    rules: {
      // Same transitional-architecture reason as the script files above:
      // these modules still consume globals defined by plain <script> files.
      "no-undef": "off",
      "no-unused-vars": "warn",
    },
  },
  {
    files: ["lock.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
];
