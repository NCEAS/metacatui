import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";
import requirejs from "eslint-plugin-requirejs";
import jsdoc from "eslint-plugin-jsdoc";

// For compatibility with configs that don't use the new eslint flat config format:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ---------------------------------------------------------------------
// AIRBNB JAVASCRIPT STYLE GUIDE:
// Use the Airbnb style guide, excluding react- and node- specific rules & the
// rule that disallows "use strict"
const airbnbConfigs = [
  ...compat.extends("eslint-config-airbnb-base/rules/best-practices"),
  ...compat.extends("eslint-config-airbnb-base/rules/errors"),
  ...compat.extends("eslint-config-airbnb-base/rules/style"),
  ...compat.extends("eslint-config-airbnb-base/rules/variables"),
  ...compat.extends("eslint-config-airbnb-base/rules/es6"),
  ...compat.extends("eslint-config-airbnb-base/rules/imports"),
];
const airbnbRulesOverrides = {
  // We are using the AMD/RequireJS module pattern
  "import/no-amd": "off",
  "import/no-commonjs": "off",
  // We are using RequireJS
  "import/no-unresolved": "off",
  // Allow unused variables if they start with an underscore
  "no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
};

// ---------------------------------------------------------------------
// JSDOCS:
// Ensure JSDoc comments are used, and check validity
const jsdocConfig = jsdoc.configs["flat/recommended"];
const jsdocsRulesOverrides = {
  // Non-standard JSDoc tags we use to generate documentation.
  "jsdoc/check-tag-names": [
    "error",
    { definedTags: ["classcategory", "screenshot"] },
  ],
  // Avoiding this error would mean importing modules we don't use
  "jsdoc/no-undefined-types": "off",
};

// ---------------------------------------------------------------------
// REQUIREJS:
// Use all rules from the recommended config for RequireJS
const requirejsConfig = {
  name: "requirejs",
  plugins: {
    requirejs,
  },
  rules: {
    ...requirejs.configs.recommended.rules,
  },
};

// ---------------------------------------------------------------------
// METACATUI OVERRIDES:
const metacatuiConfig = {
  files: ["src/**/*.js"],
  languageOptions: {
    sourceType: "commonjs",
    ecmaVersion: 2020,
    globals: {
      ...globals.browser,
      ...globals.amd,
      MetacatUI: "readonly",
      google: "readonly",
    },
  },
  // Tells eslint-plugin-jsdoc to allow namepaths like MapConfig#CameraPosition
  settings: {
    jsdoc: {
      mode: "jsdoc",
    },
  },
  // Override rules that are not compatible with MetacatUI
  rules: {
    ...airbnbRulesOverrides,
    ...jsdocsRulesOverrides,
  },
};

// Ignores must be a separate object to be treated as global
const ignoreList = {
  ignores: [
    "src/components/",
    "docs/",
    "test/",
    "node_modules/",
    ".github",
    "server.js",
    "eslint.config.mjs",
  ],
};

export default [
  ignoreList,
  ...airbnbConfigs,
  jsdocConfig,
  requirejsConfig,
  metacatuiConfig,
  prettierConfig, // prettier must be the last config in the array
];
