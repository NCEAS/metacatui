**Hi! Thanks for contributing to MetacatUI :tada:**

As we strive to improve our code quality, we've implemented automated checks to help ensure all contributions meet the set of standards outlined in the [contributing guidelines](https://github.com/NCEAS/metacatui/blob/main/CONTRIBUTING.md). These checks show that there may be some issues related to the changes you've submitted. Not to worry! These are typically easy to fix and we're here to help you through the process.

### What checks were performed?

Here is a summary of the checks that were performed and the issues that were found:

  - **Formatting**: {{ .formatting_out_md }}
    - Checks for standardized indenting, spacing, line breaks, etc. using [prettier](https://prettier.io/)
  - **Linting**: {{ .linting_out_md }}
    - Checks JS files for code quality, style issues, and JSdoc comments using [ESLint](https://eslint.org/). Generally follows the [Airbnb style guide](https://github.com/airbnb/javascript)
  - **Unit Tests**: {{ .unit_out_md }}
    - Runs unit tests to ensure that the code changes do not break existing functionality. If you have added new functionality, please add tests to cover it.
  - **JSDoc**: {{ .jsdocs_out_md }}
    - Ensures that building the docs website succeeds and that there are no JSDoc warnings.

### What are the next steps?

The github actions bot will add some comments below detailing any issues related to formatting or linting. If possible, the bot will include suggested fixes that you may be able to apply directly to your code. Errors with unit tests or the JS docs build can be reviewed on the [actions page](https://github.com/NCEAS/metacatui/actions).

To see errors on your local machine, run `npm install` and then:
  - Run `npm run format` to automatically fix formatting issues
  - Run `npm run lint` to see linting issues
  - Run `npm test` to run unit tests and see any failures
  - Run `npm run jsdoc-dry-run` to see JSDoc warnings

Review the warning and error messages, make the necessary updates to your code, and push the changes to your branch. The bot will re-run the checks and add new comments to this PR.

### Still running into issues?

If you're stuck or need help, don't hesitate to ask! Tag a maintainer in the comments or reach out on [slack](https://slack.dataone.org/).

We appreciate your effort to help us improve MetacatUI!!