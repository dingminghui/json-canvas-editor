export default {
  extends: ["stylelint-config-standard"],
  ignoreFiles: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/storybook-static/**",
  ],
  rules: {
    "import-notation": "string",
    "alpha-value-notation": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "custom-property-empty-line-before": null,
    "custom-property-pattern": null,
    "declaration-empty-line-before": null,
    "no-descending-specificity": null,
    "selector-class-pattern": null,
  },
};
