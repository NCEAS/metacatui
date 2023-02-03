define([
  "jquery",
  "underscore",
  "backbone",
  "models/CitationModel",
  "text!templates/citationView.html",
  "text!templates/citationArchived.html",
], function ($, _, Backbone, CitationModel, Template, ArchivedTemplate) {
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
       * Reference to the main templates for this view. HTML files are converted to
       * Underscore.js templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /**
       * Reference to templates that is used for this view when the object being
       * cited has been archived.
       * @type {Underscore.Template}
       */
      archivedTemplate: _.template(ArchivedTemplate),

      /**
       * The message to display in place of a citation when the object is
       * archived.
       * @type {string}
       */
      archivedMessage: "This content has been archived.",

      /**
       * The CitationModel that this view is displaying. The view can be instantiated
       * by passing in a CitationModel, or a SolrResult, DataONEObject, or an
       * extension of those, and the view will create a CitationModel from it.
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
       * The maximum number of authors to show in the citation. Any authors
       * after this will be shown as "et al." (e.g. "Smith, J., Jones, K., et
       * al."). Set to any falsy value to show all authors.
       * @type {number}
       * @since x.x.x
       * @default 5
       */
      maxAuthors: 5,

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
        // and ID options, which we will set up separately.
        options = !options || typeof options != "object" ? {} : options;
        const modelOpt = options.model;
        const metadataOpt = options.metadata;
        const idOpt = options.id;
        delete options.model;
        delete options.metadata;
        delete options.id;
        Object.keys(options).forEach(function (key) {
          this[key] = options[key];
        }, this);
        this.setModel(modelOpt, metadataOpt, idOpt);
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
       * @since x.x.x
       */
      setModel: function (newModel, metadata, id) {
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
          this.render();
        } catch (error) {
          console.log("Error setting the model for the CitationView: ", error);
        }
      },

      /**
       * Renders the view.
       * @return {CitationView} Returns the view.
       */
      render: function () {
        // Cases where we don't want to render.
        // TODO - start with a skeleton/loading template, so that if we have no
        // data, we don't show an empty citation
        if (!this.model) {
          this.$el.html("");
          return;
        } else {
          // TODO - needed or not?
          // If this object is in progress of saving, don't RErender this view.
          if (
            this.$el.children().length &&
            this.model.getUploadStatus() == "p"
          ) {
            return;
          }
          if (this.model.isArchivedAndNotIndexed()) {
            // TODO set template options?
            this.showArchived();
            return;
          }
        }

        // TODO
        // Collections will get the collection class added
        if (this.isCollection) {
          this.el.classList.add("collection");
        } else {
          this.el.classList.remove("collection");
        }

        const options = this.model.toJSON();

        // PANGAEA specific override. If this is a PANGAEA object, then do not
        // show the UUID if the seriesId is a DOI.
        if (
          this.model.isFromNode("urn:node:PANGAEA") &&
          options.seriesId &&
          this.model.isDOI(options.seriesId)
        ) {
          options.pid = "";
        }

        // Format the authors
        options.origin = this.getAuthorString(options.originArray);

        this.$el.html(this.template(options));

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
          this.$el.html(
            this.archivedTemplate({
              message: this.archivedMessage,
              id: this.createIDElement(), // TODO!!!
            })
          );
          return this;
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
