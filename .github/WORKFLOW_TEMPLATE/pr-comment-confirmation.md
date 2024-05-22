**Hi! Thanks for contributing to MetacatUI :tada:**

As we strive to improve our code quality, we've implemented automated checks to help ensure all contributions meet the set of standards outlined in the [contributing guidelines](https://github.com/NCEAS/metacatui/blob/main/CONTRIBUTING.md). All of the checks have passed! :white_check_mark: Here's a summary of the checks that were performed:

  - **Formatting**: {{ formatting_out_md }}
    - Checks for standardized indenting, spacing, line breaks, etc. using [prettier](https://prettier.io/)
  - **Linting**: {{ linting_out_md }}
    - Checks JS files for code quality, style issues, and JSdoc comments using [ESLint](https://eslint.org/). Generally follows the [Airbnb style guide](https://github.com/airbnb/javascript)
  - **Unit Tests**: {{ unit_out_md }}
    - Runs unit tests to ensure that the code changes do not break existing functionality. If you have added new functionality, please add tests to cover it.
  - **JSDoc**: {{ jsdocs_out_md }}
    - Ensures that building the docs website succeeds and that there are no JSDoc warnings.
