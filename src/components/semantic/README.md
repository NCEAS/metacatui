# Semantic UI

The Semantic UI component library, also known as Formantic UI, is integrated into MetacatUI via npm and compiled using Gulp. This process creates a single minimized JavaScript and CSS file containing only the components we use. For detailed instructions on installation and updates, refer to the [Semantic UI Getting Started Guide](https://semantic-ui.com/introduction/getting-started.html) and the [build tools documentation](https://semantic-ui.com/introduction/build-tools.html).

## Update Instructions
To update, run: `npm update fomantic-ui` then follow the installation instructions below. If the update includes changes to the `semantic.json` file, ensure the project directory and relative semantic path are set correctly.

## Customizations
We utilize the default theme with specific overrides for the dropdown component to address conflicts with Bootstrap and MetacatUI global styles. These are located at `src/components/semantic/src/site/modules/dropdown.overrides`. Additionally, unused CSS rules are disabled in `src/components/semantic/src/site/globals/site.variables`, and these modifications are included in the final `semantic.min.css` during the build.

## Installation
We ignore most of the files provided by the gulp build process, and only retain the necessary files in the `semantic` directory. To obtain the full library locally:

```bash
npm install fomantic-ui
cd node_modules/fomantic-ui
npx gulp install
```

During the build, if prompted to create a new `semantic.json` because none is found, accept the default settings. Set the project directory to `path/to/metacatui/src/components/semantic` and the relative semantic path to `.`. Afterwards, execute:

```bash
cd src/components/semantic
npx gulp build
```