define([
  "jquery",
  "underscore",
  "backbone",
  "models/CitationModel",
  "text!templates/citationView.html",
  "text!templates/citationInText.html",
  "text!templates/citationArchived.html",
], function (
  $,
  _,
  Backbone,
  CitationModel,
  Template,
  InTextTemplate,
  ArchivedTemplate
) {
  "use strict";

  /**
   * @class CitationView
   * @classdesc The CitationView shows a formatted citation for a package,
   * including title, authors, year, UUID/DOI, etc.
   * @classcategory Views
   * @extends Backbone.View
   * @screenshot views/CitationView.png
   * @constructor
   */
  var CitationView = Backbone.View.extend(
    /** @lends CitationView.prototype */ {
      /**
       * The name of this type of view
       * @type {string}
       */
      type: "Citation",

      /**
       * The HTML tag name for this view's element
       * @type {string}
       */
      tagName: "cite",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "citation",

      /**
       * The templates for this view. HTML files are converted to Underscore.js
       * templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /**
       * @typedef {Object} StyleOption
       * @property {number} maxAuthors - The maximum number of authors to
       * display. See {@link CitationModel#maxAuthors}
       * @property {Underscore.Template} template - The Underscore.js template
       * to use. See {@link CitationView#template}
       * @property {boolean} default - Whether this is the default style
       * @property {Underscore.Template} archivedTemplate - The Underscore.js
       * template to use when the object is archived. See
       * {@link CitationView#archivedTemplate}
       * @since x.x.x
       * @example
       * {
       *  inText: {
       *   maxAuthors: 1,
       *   template: _.template(InTextTemplate),
       * }
       */

      /**
       * The format and layout options that are available for this view. The
       * `default` option is used when no format is specified in the options.
       * @type {StyleOption}
       * @since x.x.x
       */
      styles: {
        inText: {
          maxAuthors: 1,
          template: _.template(InTextTemplate),
        },
        full: {
          maxAuthors: 5,
          template: _.template(Template),
          archivedTemplate: _.template(ArchivedTemplate),
          default: true,
        },
      },

      /**
       * The CitationModel that this view is displaying. The view can be
       * instantiated by passing in a CitationModel, or a SolrResult,
       * DataONEObject, or an extension of those, and the view will create a
       * CitationModel from it. To change the model after the view has been
       * instantiated, use the {@link CitationView#setModel} method.
       * @type {CitationModel}
       */
      model: null,

      /**
       * A default title for when there isn't one (e.g. a new document being edited)
       * TODO: Option used by EML211EditorView. Rename to defaultTitle?
       * @type {string}
       */
      title: null,

      /**
       * TODO
       * Used by CitationListView, MDQRun, MetadataView, ProvChart, EML211EditorView
       * @type {boolean}
       */
      createLink: true,

      /**
       * TODO
       * Used by MDQRun, EML211EditorView
       * @type {boolean}
       */
      createTitleLink: true,

      /**
       * The maximum number of authors to show in a full citation. Any authors
       * after this will be shown as "et al." (e.g. "Smith, J., Jones, K., et
       * al."). Set to any falsy value to show all authors.
       * @type {number}
       * @since x.x.x
       */
      maxAuthors: null,

      /**
       * The layout and style of the citation. Set this when instantiating the
       * view, or with the setStyle() method. Any style that is defined in the
       * {@link CitationView#styles} property can be used. If the style is not
       * defined, then the default style will be used.
       * @type {string}
       * @since x.x.x
       * @default "full"
       */
      style: null,

      /**
       * Is executed when a new CitationView is created.
       * @param {Object} options - A literal object with options to pass to the
       * view.
       * @param {Backbone.Model} [options.model] - A CitationModel with info to
       * display in this view. For backwards compatibility, this can also be a
       * SolrResult, DataONEObject, or an extension of those. If one of those is
       * provided, then a CitationModel will be populated from it, and set on
       * this view.
       * @param {Backbone.Model} [options.metadata] - This option is allowed for
       * backwards compatibility, but it is recommended to use the model option
       * instead. This will be ignored if a model is set. A model passed in this
       * option will be used to populate a CitationModel.
       * @param {string} [options.id] - When no model and no metadata are
       * provided, this option can be used to query for an object to cite. If a
       * model or metadata model is provided, then the ID will be ignored.
       */
      initialize: function (options) {
        // Get all the options and apply them to this view, excluding the model
        // and ID options, as well as style option, which we will set using
        // special methods.
        options = !options || typeof options != "object" ? {} : options;

        const style = options.style;
        const modelOpt = options.model;
        const metadataOpt = options.metadata;
        const idOpt = options.id;

        delete options.style;
        delete options.model;
        delete options.metadata;
        delete options.id;

        Object.keys(options).forEach(function (key) {
          this[key] = options[key];
        }, this);
        this.setStyle(style, false);
        this.setModel(modelOpt, metadataOpt, idOpt, false);
        this.render();
      },

      /**
       * Use this method to set or change the model for this view, and
       * re-render. If a CitationModel is provided, then it will be used. If a
       * SolrResult, DataONEObject, or an extension of those is provided as
       * either the first or second argument, then a CitationModel will be
       * created from it. Otherwise, if there is an ID provided, then a
       * CitationModel will be created from a SolrResult with that ID. If none
       * of those are provided, then a new, empty CitationModel will be created.
       * @param {CitationModel} [newModel] - The new model to set on this view.
       * @param {Backbone.Model} [metadata] - This option is allowed for
       * backwards compatibility, but it is recommended to use the model option
       * instead. This will be ignored if a model is set. A model passed in this
       * option will be used to populate a CitationModel.
       * @param {string} [id] - When no model and no metadata are provided, this
       * option can be used to query for an object to cite.
       * @param {boolean} [render=true] - Whether to re-render the view after
       * setting the model.
       * @since x.x.x
       */
      setModel: function (newModel, metadata, id, render = true) {
        try {
          this.stopListening(this.model);

          let model = newModel;
          let sourceModel = newModel || metadata;
          if (!model || !(model instanceof CitationModel)) {
            model = new CitationModel();
            if (!sourceModel && id) {
              require(["models/SolrResult"], function (SolrResult) {
                sourceModel = new SolrResult({ id: id });
              });
              sourceModel.getCitationInfo();
            }
            model.setSourceModel(sourceModel);
          }
          this.model = model;

          // TODO - needed or not?
          this.isCollection = false;
          if (sourceModel && sourceModel.getType) {
            const type = sourceModel.getType();
            if (type == "collection" || type == "portal") {
              this.isCollection = true;
            }
          }
          // Set up listeners to re-render when there are any changes to the model
          this.listenTo(this.model, "change", this.render);
          if (render) this.render();
        } catch (error) {
          console.log("Error setting the model for the CitationView: ", error);
        }
      },

      /**
       *
       * @param {string} style - The style to set. If the style is not provided
       * or not defined in the {@link CitationView#styles} property, then the
       * default style will be used.
       * @param {*} [render=true] - Whether to re-render the view after setting
       * the style.
       * @since x.x.x
       */
      setStyle: function (style, render = true) {
        const allStyles = this.styles;
        const defaultStyle = Object.keys(allStyles).find(function (key) {
          return allStyles[key].default;
        });
        style = style || defaultStyle;
        // style = "inText"
        if (style && allStyles[style]) {
          Object.keys(allStyles[style]).forEach(function (key) {
            if (key != "default") {
              this[key] = allStyles[style][key];
            }
          }, this);
        }
        if (render) this.render();
      },

      /**
       * Renders the view.
       * @return {CitationView} Returns the view.
       */
      render: function () {
        // TODO - needed or not?
        if (this.isCollection) this.el.classList.add("collection");
        else this.el.classList.remove("collection");

        // Cases where we don't want to render.
        // TODO - start with a skeleton/loading template, so that if we have no
        // data, we don't show an empty citation
        if (!this.model) {
          this.$el.html("");
          return;
        }
        if (this.model.isArchivedAndNotIndexed()) {
          // TODO set template options?
          this.showArchived();
          return;
        }
        if (this.$el.children().length && this.model.getUploadStatus() == "p") {
          // If the model is still uploading, then don't re-render.
          return;
        }

        // Options to pass to the template
        const options = this.model.toJSON();

        // PANGAEA specific override. If this is a PANGAEA object, then do not
        // show the UUID if the seriesId is a DOI.
        if (
          this.model.isFromNode("urn:node:PANGAEA") &&
          this.model.isDOI(options.seriesId)
        ) {
          options.pid = "";
        }

        // Format the authors for display
        options.origin = this.getAuthorString(options.originArray);

        // Render the template
        this.$el.html(this.template(options));

        // If there are citationMetadata, as well as an element in the current
        // template where they should be inserted, then show them inline.
        if (options.citationMetadata) {
          const citationMetaEl = this.el.querySelector(".citation-metadata");
          if (citationMetaEl) {
            // Render a CitationView for each citationMetadata
            options.citationMetadata.forEach(function (citationMetadata, i) {
              const citationView = new CitationView({
                model: citationMetadata,
                style: "inText",
              });
              citationMetaEl.appendChild(citationView.el);
              // Put a comma after each citationMetadata except the last one
              if (i < options.citationMetadata.length - 1) {
                citationMetaEl.appendChild(document.createTextNode(", "));
              }
            });
          }
        }

        return this;
      },

      /**
       * Given a list of authors, format them as a single string for display in
       * a citation.
       * @param {string[]} authors - An array of author names. The string will
       * be truncated with et al. if there are more authors than this limit set
       * on this view.
       *
       * @returns {string} The formatted author string or an empty string if
       * there are no authors
       */
      getAuthorString: function (authors) {
        try {
          if (!authors) return "";

          const numAuthors = authors.length;
          // If the maxAuthors is not set then allow all authors to be shown
          const maxAuthors = this.maxAuthors || numAuthors;
          const displayAuthors = authors.slice(0, maxAuthors);
          const separator = numAuthors > 2 ? ", " : " ";
          const conjunction = numAuthors > 2 ? ", and " : " and ";

          const authorString = displayAuthors.reduce((str, author, i) => {
            if (i === 0) return author;
            if (i + 1 === numAuthors) return `${str}${conjunction}${author}`;
            return `${str}${separator}${author}`;
          }, "");

          return numAuthors > maxAuthors
            ? `${authorString}, et al`
            : authorString;
        } catch (error) {
          console.log(
            "There was an error formatting the authors. " +
              "Authors will not be shown in the citation",
            error
          );
          return "";
        }
      },

      /**
       * Render the template for when the document/object being cited is
       * archived
       * @returns {CitationView} the citation view
       */
      showArchived() {
        try {
          // Check if there is an archived template for this style
          if (this.archivedTemplate) {
            // If there is, then render it
            this.$el.html(this.archivedTemplate());
          }
          // If there is no archived template, then render an empty view
          else {
            this.$el.html("");
          }
        } catch (error) {
          console.log(
            "There was an error showing a citation for an archived document " +
              "in a CitationView. Error details: ".error
          );
        }
      },
    }
  );

  return CitationView;
});
