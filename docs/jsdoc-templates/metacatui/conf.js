'use strict';

module.exports = {
  "source": {
    "excludePattern": "js/themes/|components/|config/|css/|font/|img/",
    "include": ["docs/other/addtlDocs.jsdoc"]
  },
  "plugins": ["./docs/jsdoc-templates/metacatui/plugins/screenshot"],
  "screenshot": {
    "dir": "../screenshots"
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
  },
  "opts": {
    "template": "./docs/jsdoc-templates/metacatui"
  }
}
