# MetacatUI Documentation
This folder of the MetacatUI repository contains the documentation for MetacatUI. This documentation includes:
- Basic information about MetacatUI
- Installation instructions
- Developer documentation for the MetacatUI application

## Building the documentation website
This directory is also built into a simple HTML website, using Jekyll, that is hosted on Github Pages. You can view the last published version of the Github site here: https://nceas.github.io/metacatui/

To build a local version of the MetacatUI Github pages site, ensure you have a relatively recent 2.x release of [Ruby](https://www.ruby-lang.org/) (e.g., 2.7.2) installed and make sure [Bundler](https://bundler.io/) is installed:

```
gem install bundler
```

Install the gems required to build the site with:

```
bundle install
```

Then serve the Jekyll site from the `docs` directory:

```
bundle exec jekyll serve
```

[See the Github Pages documentation for additional help](https://help.github.com/en/enterprise/2.14/user/articles/setting-up-your-github-pages-site-locally-with-jekyll#step-4-build-your-local-jekyll-site)

## Building Developer documentation
MetacatUI uses [JSDoc](https://github.com/jsdoc/jsdoc) comments to provide inline documentation of classes, methods, and variables. A JSDoc documentation generator will collect all those comments and generate HTML webpages for easier reading and navigation.

The MetacatUI git repository already contains these generated HTML pages in the `docs/docs` directory. However, if you have made changes to the MetacatUI code and documentation and want to update the HTML doc pages, you will need to run the JSDoc generator.

To build a fresh version of the MetacatUI developer docs, ensure you have [Node](https://nodejs.org/) installed and, from the top level of the repository, install JSDoc and other dependencies with:

```
npm install
```

and then, to build the documentation, run:

```
npm run jsdoc
```

If you're still running the `bundle exec jekyll serve` command above, your updated documentation will be automatically available at http://localhost:4000/docs/.

Once your changes to the JSDocs are merged into the `main` branch, they will go live on the Github pages site at https://nceas.github.io/metacatui/docs/index.html.

## Adding to this site
Feel free to add pages to the MetacatUI docs website by adding markdown files to this `docs` directory. Use subdirectories
as much as possible to keep things organized. Use relative links with `.html` suffixes instead of `.md` so that the links work on the Github Pages site.

## Anything missing?
We maintain a list of questions about MetacatUI that are reviewed and worked into this documentation. If you have a question that was not answered by these docs, or want to make a suggestion for these docs, please add to the list by commenting on [the FAQ Github issue](https://github.com/NCEAS/metacatui/issues/1389)
