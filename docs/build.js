/*
* ----- Require JS Optimization Build File -----
* This is an experimental build config file that isn't quite working yet, but
* is a work-in-progress for getting Require Optimization to work.
* It is meant to be executed from the root directory of metacatui ('datadepot')
* but it lives in /docs directory for now since it's not working as intended yet.
*
* Run `r.js -o build.js` to build
*
* Documentation: https://requirejs.org/docs/optimization.html
* Example build file: https://github.com/requirejs/r.js/blob/master/build/example.build.js
*/
({
  appDir: "src",
  baseUrl: "js/",
  dir: "dist",
  modules: [
    {
      name: "models/AppModel"
    },
    {
      name: "views/AppView"
    }
  ],
  optimize: "none",
//  include: ["../loader"],
//  name: "models/AppModel",
  paths: {
      jquery: '../components/jquery-1.9.1.min',
      jqueryui: '../components/jquery-ui.min',
      jqueryform: '../components/jquery.form',
      underscore: '../components/underscore-min',
      backbone: '../components/backbone-min',
      bootstrap: '../components/bootstrap.min',
      text: '../components/require-text',
      jws: '../components/jws-3.2.min',
      jsrasign: '../components/jsrsasign-4.9.0.min',
      async: '../components/async',
    nGeohash: '../components/geohash/main',
    fancybox: '../components/fancybox/jquery.fancybox.pack', //v. 2.1.5
      annotator: '../components/annotator/v1.2.10/annotator-full',
      bioportal: '../components/bioportal/jquery.ncbo.tree-2.0.2',
      clipboard: '../components/clipboard.min',
      uuid: '../components/uuid',
      md5: '../components/md5',
      rdflib: '../components/rdflib.min',
      x2js: '../components/xml2json',
      he: '../components/he',
      citation: '../components/citation.min',
    // showdown + extensions (used in the markdownView to convert markdown to html)
    showdown: '../components/showdown/showdown.min',
    showdownHighlight: '../components/showdown/extensions/showdown-highlight/showdown-highlight',
    highlight: '../components/showdown/extensions/showdown-highlight/highlight.pack',
    showdownFootnotes: '../components/showdown/extensions/showdown-footnotes',
    showdownBootstrap: '../components/showdown/extensions/showdown-bootstrap',
    showdownDocbook: '../components/showdown/extensions/showdown-docbook',
    showdownKatex: '../components/showdown/extensions/showdown-katex/showdown-katex.min',
    showdownCitation:  '../components/showdown/extensions/showdown-citation/showdown-citation',
    showdownImages:  '../components/showdown/extensions/showdown-images',
    showdownXssFilter: '../components/showdown/extensions/showdown-xss-filter/showdown-xss-filter',
    xss: '../components/showdown/extensions/showdown-xss-filter/xss.min',
    showdownHtags: '../components/showdown/extensions/showdown-htags',
    // drop zone creates drag and drop areas
    Dropzone: '../components/dropzone-amd-module',
    //Have a null fallback for our d3 ../components for browsers that don't support SVG
    d3: '../components/d3.v3.min',
    LineChart: 'views/LineChartView',
    BarChart: 'views/BarChartView',
    CircleBadge: 'views/CircleBadgeView',
    DonutChart: 'views/DonutChartView',
    MetricsChart: 'views/MetricsChartView',
    },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_',
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    },
    bootstrap: {
      deps: ['jquery'],
      exports: 'Bootstrap'
    },
    annotator: {
      exports: 'Annotator'
    },
    bioportal: {
      exports: 'Bioportal'
    },
    jws: {
      exports: 'JWS',
        deps: ['jsrasign'],
    },
  nGeohash: {
    exports: "geohash"
  },
  fancybox: {
    deps: ['jquery']
  },
  uuid: {
        exports: 'uuid'
    },
    rdflib: {
        exports: 'rdf'
    },
  xss: {
    exports: 'filterXSS'
  },
  citation: {
    exports: 'citationRequire'
  }
}
})
