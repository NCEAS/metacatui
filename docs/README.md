# MetacatUI Documentation
This folder of the MetacatUI repository contains the documentation for MetacatUI. This documentation includes:
- Basic information about MetacatUI
- Installation instructions
- Developer documentation for the MetacatUI application


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

If you're still running the `bundle exec jekyll serve` command described below, your updated documentation will be automatically available at http://localhost:4000/docs/.

Once your changes to the JSDocs are merged into the `main` branch, they will go live on the Github pages site at https://nceas.github.io/metacatui/docs/index.html.

## Building the entire documentation website

This directory is also built into a simple HTML website, using Jekyll, that is hosted on Github Pages. You can view the last published version of the Github site here: https://nceas.github.io/metacatui/

To build a local version of the MetacatUI Github pages site, ensure you have the version of [Ruby](https://www.ruby-lang.org/) installed that is specified in the `docs/.ruby-version` file. (See the note below about Ruby versions.)

To check the version of Ruby installed on your system, run:

```
ruby -v
```

Then make sure [Bundler](https://bundler.io/) is installed:

```
gem install bundler
```

Make sure you're in the docs directory of the MetacatUI repository:

```
cd docs
```

Install the gems required to build the site with:

```
bundle install
```

Then serve the Jekyll site (still from the `docs` directory):

```
bundle exec jekyll serve
```

You can now access the MetacatUI documentation website at the localhost address shown by Jekyll (most likely localhost:4000). Jekyll will watch for changes and rebuild the site as you edit the content. NOTE: Changes to the website config in `_.config.yml` will NOT trigger a rebuild, so you will need to stop Jekyll and restart with `bundle exec jekyll serve` again.

[See the Github Pages documentation for additional help](https://help.github.com/en/enterprise/2.14/user/articles/setting-up-your-github-pages-site-locally-with-jekyll#step-4-build-your-local-jekyll-site)

### A note on Ruby versions

The ruby version required to build the site is specified in the `docs/.ruby-version` file. Ensure you have the correct version or a compatible version installed. You may need to use a Ruby version manager like `rbenv` to install and manage multiple versions of Ruby on your system.

For example, to install and use Ruby 3.1.x with `rbenv`:

1. Install `rbenv` and `ruby-build` following the instructions at [rbenv installation](https://github.com/rbenv/rbenv#installation).
2. Install Ruby 3.1.x using `rbenv install 3.1.x`.
3. Set Ruby 3.1.x as the global version with `rbenv global 3.1.x`.

After setting up the correct Ruby version, try running `bundle install` and then `bundle exec jekyll serve` again.

## Adding to this site
Feel free to add pages to the MetacatUI docs website by adding markdown files to this `docs` directory. Use subdirectories
as much as possible to keep things organized. Use relative links with `.html` suffixes instead of `.md` so that the links work on the Github Pages site.

## Anything missing?
We maintain a list of questions about MetacatUI that are reviewed and worked into this documentation. If you have a question that was not answered by these docs, or want to make a suggestion for these docs, please add to the list by commenting on [the FAQ Github issue](https://github.com/NCEAS/metacatui/issues/1389)
