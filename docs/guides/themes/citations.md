---
layout: guide
title: Customizing citations content & style
id: customizing-citations
---

This guide will show an example of how to customize the content and style of
citations within a [custom MetacatUI theme]({{ site.url
}}/install/configuration/index.html). This guide assumes that you have already
set up a custom theme and have a basic understanding of how to customize the
theme.

# Background

## The Citation Model

All Citation content is stored in the [Citation
Model]({{site.url}}/docs/Citation.html). The Citation Model can be populated
from metrics service results, a SOLR model, a DataONE Object, an EML model, or
any extension of these models. How each attribute in the model is populated is
defined by a set of methods set by the `attrGetters` property.

## The Citation View

The Citation View is responsible for rendering the Citation Model. It is
currently set to render citations in APA format, but can be extended to render
citations in other formats. Eventually, we will likely use a library like
[citation.js](https://citation.js.org/) to handle citation formatting. See
[issue #567](https://github.com/NCEAS/metacatui/issues/567).

## Links

* [Planned Enhancements for Citations](https://github.com/NCEAS/metacatui/issues?q=is%3Aissue+is%3Aopen+label%3Acitations)
* [Citation Model]({{site.url}}/docs/Citation.html)
* [Citation View]({{site.url}}/docs/CitationView.html)
# Customization

## Extending the Citation Model

In your theme's config.js file, define the current Citation Model as the "Base"
Citation Model and create a path to an extended version of that model within
your theme's models folder. This will allow you to extend the Citation Model
without having to copy the entire Citation Model file into your theme.

```js
// config.js
MetacatUI.themeMap = {
    '*': {
        // ...
        // The default Citation Model
        'models/BaseCitationModel': MetacatUI.root + '/js/models/CitationModel.js',
        // The Citation Model for your theme
        'models/CitationModel': MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/CitationModel.js',
    }
};
```

Create your theme's extended Citation Model file in the location: `src/js/themes/{YOUR-THEME-NAME}/models/CitationModel.js`

```js
// src/js/themes/{YOUR-THEME-NAME}/models/CitationModel.js
define(["models/BaseCitationModel"], function(BaseCitationModel) {

    var CitationModel = BaseCitationModel.extend({
        // Add your customizations here
    });

    return CitationModel;
});
```

For example, if you would like to add another attribute to the model that is
populated from the source model, extend the `attrGetters` property.

```js
// src/js/themes/{YOUR-THEME-NAME}/models/CitationModel.js
define(["models/BaseCitationModel"], function (BaseCitationModel) {
  var CitationModel = BaseCitationModel.extend({

    attrGetters: function () {
      return Object.assign(BaseCitationModel.prototype.attrGetters(), {
        // Add a new attribute to the Citation Model
        my_attribute: function (sourceModel) {
          // Given the input model (DataONE Object, EML, Solr model, etc), return
          // the value for the "my_attribute" attribute
        },
      });
    },

  });
});
```

Alternatively, if you would just like to change the way an existing attribute is
populated, you can override the method that the `attrGetters` property calls.

```js
// src/js/themes/{YOUR-THEME-NAME}/models/CitationModel.js
define(["models/BaseCitationModel"], function(BaseCitationModel) {

    var CitationModel = BaseCitationModel.extend({
        getJournalFromSourceModel: function(sourceModel) {
            // Given the input model (DataONE Object, EML, Solr model, etc), return
            // the value for the "journal" attribute
        }
    });

    return CitationModel;
});
```

## Changing the Citation Template

Templates used for each style in the Citation View are defined in the `styles`
property. For example, the "apa" style in "full" context uses the
`src/js/templates/citations/citationAPA.html` template. Override this template
like you would any other template in your theme.

```js
// config.js
'templates/citations/citationAPA.html': MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/citations/citationAPA.html',
```

Options passed to the template include the Citation Model attributes as JSON, 
plus a class for the title element and the citationsMetadata container element.
In the case of the "apa" style, these options are further modified before being
passed to the template by the `renderAPA` method. This methods handles formatting
the author list in APA format.

## Extending the Citation View

Extend the Citation View in the same way as the Citation Model, above.

```js
// config.js
MetacatUI.themeMap = {
    '*': {
        // ...
        // The default CitationView
        'views/BaseCitationView': MetacatUI.root + '/js/views/CitationView.js',
        // The CitationView for your theme
        'views/CitationView': MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/views/CitationView.js',
    }
};
```

```js
// src/js/themes/{YOUR-THEME-NAME}/views/CitationView.js
define(["views/BaseCitationView"], function(BaseCitationView) {

    var CitationView = BaseCitationView.extend({
        // Add your customizations here
    });

    return CitationView;
});
```

## Adding a new style

You can extend the Citation View to add a new style. At a minimum, define
a style with a template for the citation shown in both complete form ("full")
and in-text form ("inText").

```js
// src/js/themes/{YOUR-THEME-NAME}/views/CitationView.js
define([
    "views/BaseCitationView",
    "text!templates/citations/myStyle.html",
    "text!templates/citations/myStyleInText.html",
], function(BaseCitationView, MyStyleTemplate, MyStyleInTextTemplate) {
    "use strict";

    var CitationView = BaseCitationView.extend({
        styles: Object.assign({}, BaseCitationView.prototype.styles, {
            "my-style": {
                full: {
                    template: _.template(MyStyleTemplate),
                },
                inText: {
                    template: _.template(MyStyleInTextTemplate),
                },
            },
        }),

        // Set the default citation style to "my-style"
        style: "my-style",
    });

    return CitationView;
});
```

If your style requires more complex logic, you can also configure a custom
render method for each context. The render method will be passed the template
options and the underscore template object that is configured for the style.

```js
// src/js/themes/{YOUR-THEME-NAME}/views/CitationView.js
define([
    "views/BaseCitationView",
    "text!templates/citations/myStyle.html",
    "text!templates/citations/myStyleInText.html",
], function(BaseCitationView, MyStyleTemplate, MyStyleInTextTemplate) {
    "use strict";

    var CitationView = BaseCitationView.extend({
        styles: Object.assign({}, BaseCitationView.prototype.styles, {
            "my-style": {
                full: {
                    template: _.template(MyStyleTemplate),
                    render: renderMyStyle,
                },
                inText: {
                    template: _.template(MyStyleInTextTemplate),
                    render: renderMyStyleInText,
                },
            },
        }),

        // Set the default citation style to "my-style"
        style: "my-style",

        // Write a custom render function for the "my-style" citation style
        // when displayed in complete form
        renderMyStyle: function(options, template) {
            // modify the options here
            this.el.innerHTML = template(options);
            // modify the DOM here
        },

        // Write a custom render function for the "my-style" citation style
        // when displayed in in-text form
        renderMyStyleInText: function(options, template) {
            // modify the options here
            this.el.innerHTML = template(options);
            // modify the DOM here
        },

        return CitationView;
    });
})
```

You may also configure a "archivedTemplate" for each context, which will be used
in place for the main template if the object being cited is archived and
archived material is not indexed.
