'use strict';

module.exports = {
  "source": {
    "excludePattern": "themes/goa/|themes/nceas/|themes/ess-dive/"
  },
  "templates": {
    "default": {
      "outputSourceFiles" : true,
      "layoutFile" : "./docs/jsdoc-templates/metacatui/tmpl/layout.tmpl",
      "staticFiles": {
        "include": [
            "./docs/jsdoc-templates/metacatui/static/styles/style.css"
        ]
      }
    }
  }
}
