|      Test      |     Result     | Local Command           | Description                                                                                                                                                                              |
|:--------------:|:--------------:|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Formatting** | {{ .formatting_out_md }} | `npm run format`        | Automatically standardizes formatting, checks for syntax errors                                                                                                                                                                                          |
|   **Linting**  |   {{ .linting_out_md }}  | `npm run lint`          | Checks JS files for code quality, style issues, and JSdoc comments using [ESLint](https://eslint.org/). Generally follows the [Airbnb style guide](https://github.com/airbnb/javascript) |
| **Unit Tests** |    {{ .unit_out_md }}    | `npm test`              | Runs unit tests to ensure that the code changes do not break existing functionality.                                                                                                     |
|    **JSDoc**   |   {{ .jsdoc_out_md  }}  | `npm run jsdoc-dry-run` | Ensures that building the docs website succeeds and that there are no JSDoc warnings.                                                                                                    |s