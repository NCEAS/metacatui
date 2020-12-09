# Setting up a MetacatUI development environment

The first task is to get a development environment set up on your machine, which means:

1. [Get familiar with MetacatUI](#get-familiar-with-metacatui)
2. [Fork the MetacatUI GitHub repository](#fork-the-metacatui-repository)
3. [Install a local instance of MetacatUI](#install-a-local-instance-of-metacatui)

## Get familiar with MetacatUI
Read about the MetacatUI software on the MetacatUI Github (https://github.com/NCEAS/metacatui) and documentation website (https://nceas.github.io/metacatui/)

## Fork the MetacatUI repository

Fork the MetacatUI Git repository by going to https://github.com/NCEAS/metacatui and clicking on the “Fork” button.

Clone your fork to your local machine:

```bash
git clone https://github.com/your-username/metacatui.git
```

Open the forked repository (the `datadepot` folder) in your preferred code editor (e.g. Atom)

Test that your fork is ready to work with by making a small change to a file (e.g. add a space character) and committing and pushing the commit to your fork.

## Install a local instance of MetacatUI
Follow the [installation instructions](local.html) for using MetacatUI locally with a remote Metacat data repository.

When you have MetacatUI running locally, you should be able to navigate in your web browser to the localhost path that you have your server running at, and you'll see MetacatUI running like this:

## Next: Contributing to MetacatUI

### Review our [Contributing guidelines](https://github.com/NCEAS/metacatui/blob/master/CONTRIBUTING.md).

### Plug into the MetacatUI development pipeline

It is probably helpful to look over the MetacatUI issue tracker to get an idea of what we are currently working on in MetacatUI. We track all of our issues in Zenhub, here: https://app.zenhub.com/workspaces/data-portal-infrastructure-5d057ceca88c9959aefd0159/board

There are 7 different pipelines:
**New Issues** - Newly-created issues that have yet to be reviewed and assigned to a pipeline
**Icebox** - Issues that are not planned for a release anytime soon, but we still want to complete someday.
**Next** - Issues that are planned for the next release. They are not being actively worked on yet, but will be once the issues in the Current pipeline are closed.
**Current** - Issues that are planned for the current release and will be worked on after all the In Progress issues are closed.
**In Progress** - Issues currently being actively worked on by a developer. Once a developer begins coding for an issue, the issue is moved to this pipeline.
**Review/QA** - Issues that have pushed commits which resolve the feature or bug described, but the commits need to be reviewed by another developer (e.g. [Lauren](https://github.com/laurenwalker)).
**Closed** - These issues have code that is already merged into the `develop` branch and are completely reviewed and resolved.

We would suggest looking at the issues in this Zenhub board and getting a basic familiarity with the new features we’d like to add to MetacatUI. We’re always looking for enhancements to :

- the metadata editor
- portals
- the metadata/dataset view
- user and repository profiles
- CSS and design
- performance

### Submit a Pull Request

When you're ready to contribute the changes made on your fork to the main MetacatUI code base, follow the steps outlined in the [Contributing guidelines](https://github.com/NCEAS/metacatui/blob/master/CONTRIBUTING.md) for submitting a pull request to MetacatUI.
