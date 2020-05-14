# MetacatUI Github Pages website
This folder of the MetacatUI repository houses the files for a simple website about MetacatUI. This website contains:
- Basic information about MetacatUI
- Developer documentation for the MetacatUI application

## Building Developer documentation
The MetacatUI uses [JSDoc](https://github.com/jsdoc/jsdoc) comments to provide inline documentation of classes, methods, and variables. A JSDoc documentation generator will collect all those comments and generate HTML webpages for easier reading and navigation.

The MetacatUI git repository already contains these generated HTML pages in the `docs/docs` directory. However, if you have amde changes to the MetacatUI code and documentation and want to update the HTML doc pages, then you will need to run the JSDoc generator.

To build a fresh version of the MetacatUI developer docs, simply run the `docs/build.sh` script. This script must be run from the root directory of MetacatUI (`datadepot`) or from the first `docs` directory (`datadepot/docs`)

To view the JSDoc documentation, you can navigate to the file in your browser. E.g. file:///Users/walker/git/datadepot/docs/docs/index.html
