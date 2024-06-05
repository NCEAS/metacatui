# Contributing to MetacatUI

**🎉 First off, thanks for contributing! 🎉**

- [✨ Types of Contributions](#-types-of-contributions)
- [🐈‍⬛ About MetacatUI](#-about-metacatui)
- [🌱 Getting Started with Contributions](#-getting-started-with-contributions)
  - [🔧 Setting Up Your Environment](#-setting-up-your-environment)
  - [✍️ Making Changes and Submitting Contributions](#️-making-changes-and-submitting-contributions)
  - [📤 Submitting a Pull Request](#-submitting-a-pull-request)
- [🎨 Code Style](#-code-style)
  - [🖋 Formatting](#-formatting)
  - [🔍 Linting](#-linting)
- [🔬 Testing](#-testing)
- [📚 Documentation](#-documentation)
- [📐 Key Quality Checks for Contributions](#-key-quality-checks-for-contributions)
- [🚀 Development Workflow](#-development-workflow)
  - [🌳 Branches](#-branches)
  - [🔀 Workflow Diagram](#-workflow-diagram)
  - [🚀 Release Process](#-release-process)
- [📄 Contributor license agreement](#-contributor-license-agreement)

## ✨ Types of Contributions

We welcome all types of contributions, including bug fixes, feature enhancements,
bug reports, documentation, graphics, and many others. You might consider contributing by:

- Report a bug or request a new feature in our [issue
  tracker](https://github.com/NCEAS/metacatui/issues)
- Fix a bug and contribute the code with a Pull Request
- Write or edit some documentation, such as this file!
- Sharing helpful tips or FAQ-type answers with users or future contributors
- Ask or answer a question on our [discussions
  board](https://github.com/NCEAS/metacatui/discussions)
- Create screenshots or tutorials of features of MetacatUI
- Answer questions on our mailing list or [Slack
  team](https://slack.dataone.org/)
- ...

MetacatUI is an open source project, and we welcome full
participation in the project. Contributions are reviewed and suggestions are
made to increase the value of MetacatUI to the community. We strive to
incorporate code, documentation, and other useful contributions quickly and
efficiently while maintaining a high-quality repository software product.

If you have any questions about contributing, please feel free to ask on the
[MetacatUI discussions board](https://github.com/NCEAS/metacatui/discussions) or
on the [DataONE Slack team](https://slack.dataone.org/).

## Pull Requests

We use the pull-request model for contributions. See [GitHub's help on pull-requests](https://help.github.com/articles/about-pull-requests/).

In short:

- add an [issue](https://github.com/NCEAS/metacatui/issues) describing your planned changes, or add a comment to an existing issue;
- on GitHub, fork the [MetacatUI repository](https://github.com/NCEAS/metacatui)
- on your computer, clone your forked copy of the MetacatUI repository
- checkout a development branch and commit your changes
- push your branch to your forked repository, and submit a pull-request
- our team will be notified of your Pull Request and will review your changes
- our team may request changes before we will approve the Pull Request, or we will make them for you
- once the code is reviewed, our team will merge in your changes and you're done!

## Development Workflow

Development is managed through the git repository at https://github.com/NCEAS/metacatui. The repository is organized into several branches, each with a specific purpose.

**main**. Releases are merged from the `develop` branch to the `main` branch, and the resulting commit is tagged with the release tag (e.g., `2.4.0`). The tip of the `main` branch always reflects the most recent release of the software. The version number in all configuration files and the README on the `main` branch follows [semantic versioning](https://semver.org/) and should always be set to the current release version, for example, `2.8.5`.

**develop**. The `develop` branch is a stable branch that is constantly
maintained in a state ready for release. Commits should only be pushed to this
branch once they are ready to be deployed to production immediately after being
pushed. Any unreleased code changes on the develop branch represent changes that
have been tested and staged for the next release. The tip of the develop branch
always represents the set of features that have been staged for the next
release. Commits are added to the develop branch via a pull request or after
consultation with the designated MetacatUI product owner.

**feature**. to isolate development on a specific set of capabilities,
especially if it may be disruptive to other developers working on the main
`develop` branch, feature branches should be created.

Feature branches are named as `feature-` + `#{issue}` + `-{short-description}-`.
With `{issue}` being the Github issue number related to that new feature. e.g.
`feature-#1456-new-search`.

All `feature-*` branches should be frequently merged with changes from `develop` to
ensure that the feature branch stays up to date with other features that have
been tested and are awaiting release. Thus, each `feature-*` branch represents an opportunity
for integration testing of the set of features intended to work together for a
particular release.

**dev-X.X**. Development branches named after their minor version number can be
used when a patch release needs to be created that is behind the main
**develop** branch.

**bugfix**. A final branch type are `bugfix` branches, which work the same as feature branches, but fix bugs rather than adding new functionality. Bugfix branches are named similarly, following the pattern: `bugfix-` + `{issue}` + `-{short-description}`, with `{issue}` being the GitHub issue number related to that bug. e.g. `bugfix-83-fix-name-display`.

### Development flow overview

```mermaid
%%{init: {  'theme': 'base',
%%{init: {  'theme': 'base',
            'gitGraph': {
                'rotateCommitLabel': false,
                'showCommitLabel': false
            },
            },
            'themeVariables': {
              'commitLabelColor': '#ffffffff',
              'commitLabelBackground': '#000000'
            }
}}%%
gitGraph
    commit id: "1" tag: "v1.0.0"
    branch develop
    checkout develop
    commit id: "2"
    branch feature-A
    commit id: "3"
    commit id: "4"
    checkout develop
    merge feature-A id: "5"
    commit id: "6"
    commit id: "7"
    branch feature-B
    commit id: "8"
    commit id: "9"
    checkout develop
    merge feature-B  id: "10" type: NORMAL
    checkout main
    merge develop id: "11" tag: "v1.1.0"
```

### 🚀 Release Process

1. Our release process starts with integration testing in a `develop` branch. Once all
   changes that are desired in a release are merged into the `develop` branch, we run
   the full set of tests on a clean checkout of the `develop` branch.
2. After testing, the `develop` branch is merged to main.
3. Then the `main` branch can be tagged with the new version number (e.g. `2.11.2`).
4. Releases can be downloaded from the [Github releases page for the MetacatUI repository](https://github.com/NCEAS/metacatui/releases).

## Testing

**Unit and integration tests**. MetacatUI has a full suite of unit tests and
integration tests in the `tests` subdirectory.
Any new code developed should include a robust set of unit tests for each public
method, as well as integration tests from new feature sets. Tests should fully
exercise the feature to ensure that it responds correctly to both good data inputs
and various classes of corrupt or bad data. All tests should pass before submitting a PR
or merging to `develop`.

Tests are automatically run via GitHub Actions. Check the root `README.md` file
for this GitHub Actions status badge and make sure it says "Passing":

![Tests Status](https://github.com/NCEAS/metacatui/actions/workflows/test.js.yml/badge.svg)

Read more documentation about how tests are run and viewed in [/test/README.md](/test/README.md)

## Code style

Code should be written to professional standards to enable clean, well-documented,
readable, and maintainable software. While there has been significant variability
in the coding styles applied historically, new contributions should strive for
clean code formatting.

## Documentation

All JavaScript code should be fully documented with [JSDoc](https://jsdoc.app/) comments.

For Models and Views:

- Gives a brief overview of what the class / file does and give a few short example of how you might use the class / file.
- Create a screenshot of the View and use the `@screenshot` tag to include it in the built docs.
- Use the `@classcategory` tag to organize the class file in the built docs navigational menu

For Model and View methods:

- Say what each class method does and how to use it (use `@param` and `@returns`)
- Use `@example` tags to give examples of parameters and return values
- Use `@fires` to indicate Backbone Events that are fired by a method

For Model and View attributes:

- Describe the purpose of the attribute, its `@default` value, and one or more `@example`s

For everything:

- Use the `@since` tag to indicate the version the class/method/attribute was added
- Use `@deprecated` for deprecated APIs and features
- Use `@link` to link to other JSDoc pages when mentioning other classes, attributes, and methods (e.g. `{@link Model#method}`)

Before merging a **feature** branch to the **develop** branch, [build the MetacatUI documentation](docs/README.md)
website and make sure that your documentation is displaying correctly and is thorough.

Things to check:

- There are no JSDoc build errors or warnings
- The class shows up in the right category in the class navigation menu
- All class methods and attributes are documented and displaying correctly
- Screenshots of views are displaying correctly

## PR Code Review Guidelines

When submitting a pull request (PR) to MetacatUI, it's essential to adhere not only to the above criteria on tests, formatting, and documentation, but also to additional aspects that ensure the quality and functionality of your contributions. Here are key points that reviewers will check during the code review process:

1. **Theme Compatibility**: Test your changes across all standard themes included in MetacatUI (such as `arctic`, `dataone`, `default`, `knb`) and those in the [metacatui-themes repository](https://github.com/NCEAS/metacatui-themes) (`drp` and `sctld`). This ensures consistency and compatibility across different visual presentations.

2. **Responsive Design**: Ensure that your changes perform well on various screen sizes, including mobile devices.

3. **Component Impact Analysis**: If you modify an existing model, collection, or view, review all instances where that component is utilized within MetacatUI. This is crucial to prevent unintended impacts, especially considering that our test coverage is not yet exhaustive.

4. **Performance Consideration**: Be mindful of the performance implications of your changes. This is particularly important for substantial additions, as we aim to maintain or improve the current performance levels of MetacatUI.

5. **Error Handling and Messaging**: Incorporate robust error handling in your code and ensure that any error messages are clear and user-friendly. If one component triggers an error for any reason, it should not disrupt the functionality of the entire application.

6. **Dependency Management**: When adding or updating dependencies, evaluate their necessity and impact on the project size. Avoid redundancy and prefer dependencies with a strong maintenance history and a large supporting community, as this increases the likelihood of long-term support.

7. **User Status Consideration**: If applicable, test the functionality of your changes for both signed-in and non-signed-in users.

8. **Documentation Updates**: In addition to updating JSDocs, if your changes affect any aspect covered in the MetacatUI guides (`docs/guide`), make the necessary updates. For significant features requiring configuration by MetacatUI administrators, consider adding a new guide.

9. **Security Assessment**: Ensure that any security implications of your changes are thoroughly considered and addressed.

## 📄 Contributor license agreement

In order to clarify the intellectual property license granted with Contributions
from any person or entity, you agree to a Contributor License Agreement ("CLA")
with the Regents of the University of California (hereafter, the "Regents").

1. Definitions. "You" (or "Your") shall mean the copyright owner or legal entity
   authorized by the copyright owner that is making this Agreement with the
   Regents. For legal entities, the entity making a Contribution and all other
   entities that control, are controlled by, or are under common control with
   that entity are considered to be a single Contributor. For the purposes of
   this definition, "control" means (i) the power, direct or indirect, to cause
   the direction or management of such entity, whether by contract or otherwise,
   or (ii) ownership of fifty percent (50%) or more of the outstanding shares,
   or (iii) beneficial ownership of such entity. "Contribution" shall mean any
   original work of authorship, including any modifications or additions to an
   existing work, that is intentionally submitted by You to the Regents for
   inclusion in, or documentation of, any of the products owned or managed by
   the Regents (the "Work"). For the purposes of this definition, "submitted"
   means any form of electronic, verbal, or written communication sent to the
   Regents or its representatives, including but not limited to communication on
   electronic mailing lists, source code control systems, and issue tracking
   systems that are managed by, or on behalf of, the Regents for the purpose of
   discussing and improving the Work, but excluding communication that is
   conspicuously marked or otherwise designated in writing by You as "Not a
   Contribution."
2. Grant of Copyright License. Subject to the terms and conditions of this
   Agreement, You hereby grant to the Regents and to recipients of software
   distributed by the Regents a perpetual, worldwide, non-exclusive, no-charge,
   royalty-free, irrevocable copyright license to reproduce, prepare derivative
   works of, publicly display, publicly perform, sublicense, and distribute Your
   Contributions and such derivative works.
3. Grant of Patent License. Subject to the terms and conditions of
   this Agreement, You hereby grant to the Regents and to
   recipients of software distributed by the Regents a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   (except as stated in this section) patent license to make, have
   made, use, offer to sell, sell, import, and otherwise transfer the
   Work, where such license applies only to those patent claims
   licensable by You that are necessarily infringed by Your
   Contribution(s) alone or by combination of Your Contribution(s)
   with the Work to which such Contribution(s) was submitted. If any
   entity institutes patent litigation against You or any other entity
   (including a cross-claim or counterclaim in a lawsuit) alleging
   that your Contribution, or the Work to which you have contributed,
   constitutes direct or contributory patent infringement, then any
   patent licenses granted to that entity under this Agreement for
   that Contribution or Work shall terminate as of the date such
   litigation is filed.
4. You represent that you are legally entitled to grant the above
   license. If your employer(s) has rights to intellectual property
   that you create that includes your Contributions, you represent
   that you have received permission to make Contributions on behalf
   of that employer, that your employer has waived such rights for
   your Contributions to the Regents, or that your employer has
   executed a separate Corporate CLA with the Regents.
5. You represent that each of Your Contributions is Your original
   creation (see section 7 for submissions on behalf of others). You
   represent that Your Contribution submissions include complete
   details of any third-party license or other restriction (including,
   but not limited to, related patents and trademarks) of which you
   are personally aware and which are associated with any part of Your
   Contributions.
