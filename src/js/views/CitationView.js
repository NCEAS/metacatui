define([
  "jquery",
  "underscore",
  "backbone",
  "models/CitationModel",
  "text!templates/citations/citationAPA.html",
  "text!templates/citations/citationFullArchived.html",
  "text!templates/citations/citationAPAInText.html",
  "text!templates/citations/citationAPAInTextArchived.html",
], function (
  $,
  _,
  Backbone,
  CitationModel,
  APATemplate,
  ArchivedTemplate,
  APAInTextTemplate,
  InTextArchivedTemplate
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
       * The HTML classes to use for the title element. This will be passed to
       * the template and will be used to identify the title element if the
       * createTitleLink option is set to true.
       * @since 2.23.0
       * @type {string}
       */
      titleClass: "title",

      /**
       * The HTML classes to use for the element that will contain the citation
       * metadata. The citation metadata are the citations that cite the main
       * citation. This class will be passed to the template and will be used to
       * identify the container element.
       * @since 2.23.0
       * @type {string}
       */
      citationMetadataClass: "citation-metadata",

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
       * Defines how to render a citation style for only it's in-text or full
       * citation format.
       * @typedef {Object} ContextDefinition
       * @property {Underscore.Template} template - The Underscore.js template
       * to use. HTML files are converted to Underscore.js templates.
       * @property {Underscore.Template} archivedTemplate - The Underscore.js
       * template to use when the object is archived.
       * @property {string} render - The name of the method in this view to use
       * to render the citation. This method will be passed the template (or
       * archived template if the object is archived), as well as the template
       * options.
       * @since 2.23.0
       * @example
       * {
       *  inText: {
       *    template: _.template(InTextAPATemplate),
       *    archivedTemplate: _.template(InTextAPAArchivedTemplate),
       *    render: "renderAPAInText",
       * }
       */

      /**
       * Defines how to render a citation style for both it's in-text and full
       * contexts.
       * @typedef {Object} StyleDefinition
       * @property {CitationView#ContextDefinition} full - The full citation
       * format.
       * @property {CitationView#ContextDefinition} inText - The in-text
       * citation format.
       * @since 2.23.0
       */

      /**
       * The format and layout options that are available for this view.
       * @type {Object}
       * @property {CitationView#StyleDefinition} styleName - Each property in
       * the styles object maps a style name to a StyleOption object.
       * @since 2.23.0
       */
      styles: {
        apa: {
          full: {
            template: _.template(APATemplate),
            archivedTemplate: _.template(ArchivedTemplate),
            render: "renderAPA",
          },
          inText: {
            template: _.template(APAInTextTemplate),
            archivedTemplate: _.template(InTextArchivedTemplate),
            render: "renderAPAInText",
          },
        },
        apaAllAuthors: {
          full: {
            template: _.template(APATemplate),
            archivedTemplate: _.template(ArchivedTemplate),
            render: "renderAPAAllAuthors",
          },
          inText: {
            template: _.template(APAInTextTemplate),
            archivedTemplate: _.template(InTextArchivedTemplate),
            render: "renderAPAInText",
          },
        },
      },

      /**
       * The citation style to use. Any style that is defined in the
       * {@link CitationView#styles} property can be used. If the style is not
       * defined then the view will not render.
       * @type {string}
       * @since 2.23.0
       */
      style: "apa",

      /**
       * The context to use when rendering the citation. This can be either
       * "inText" or "full". Configure this in the {@link CitationView#styles}
       * property.
       * @type {string}
       * @since 2.23.0
       */
      context: "full",

      /**
       * Set this to true to create a link to the object's landing page around
       * the entire citation. This will override the createTitleLink option.
       * @type {boolean}
       */
      createLink: false,

      /**
       * Set this to true to create a link to the object's landing page around
       * the title. This will be ignored if the createLink option is set to
       * true.
       * @type {boolean}
       */
      createTitleLink: true,

      /**
       * When links are created as part of this view, whether to open them in a
       * new tab or not. If the URL begins with "http" then it will always open
       * in a new tab. When this option is true, then relative URLs will also
       * open in a new tab.
       * @type {boolean}
       * @since 2.23.0
       */
      openLinkInNewTab: false,

      /** A default title for when the Citation Model does not have a title.
       * @type {string}
       * @since 2.23.0
       */
      defaultTitle: null,

      /**
       * Executed when a new CitationView is created. Options that are available
       * but which are not defined as properties of this view are defined below.
       * @param {Object} options - A literal object with options to pass to the
       * view.
       * @param {Backbone.Model} [options.metadata] - This option is allowed for
       * backwards compatibility, but it is recommended to use the model option
       * instead. This will be ignored if a model is set. A model passed in this
       * option will be used to populate a CitationModel.
       * @param {string} [options.title] - Allowed for backwards compatibility.
       * Setting this option will set the default title for this view, on the
       * {@link CitationView#defaultTitle} property.
       * @param {string} [options.id] - When no model and no metadata are
       * provided, this option can be used to query for an object to cite. If a
       * model or metadata model is provided, then the ID will be ignored.
       */
      initialize: function (options) {
        try {
          options = !options || typeof options != "object" ? {} : options;
          const optKeys = Object.keys(options);

          // Identify the model from the options, for backwards compatibility.
          const modelOpt = options.model;
          const metadataOpt = options.metadata;
          const idOpt = options.id;

          // Convert deprecated options to the new options.
          if (optKeys.includes("title") && !optKeys.includes("defaultTitle")) {
            options.defaultTitle = options.title;
          }

          // Don't set any of the deprecated on the the model.
          delete options.model;
          delete options.metadata;
          delete options.id;
          delete options.title;

          // Get all the options and apply them to this view.
          Object.keys(options).forEach(function (key) {
            this[key] = options[key];
          }, this);

          this.setModel(modelOpt, metadataOpt, idOpt, false);
        } catch (error) {
          console.log("Error initializing CitationView", error);
        }
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
       * @since 2.23.0
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
                sourceModel.getCitationInfo();
                model.setSourceModel(sourceModel);
              });
            } else {
              model.setSourceModel(sourceModel);
            }
          }
          this.model = model;
          // Set up listeners to re-render when there are any changes to the model
          this.listenTo(this.model, "change", this.render);
          if (render) this.render();
        } catch (error) {
          console.log("Error setting the model for the CitationView: ", error);
        }
      },

      /**
       * Renders the view.
       * @return {CitationView} Returns the view.
       */
      render: function () {
        try {
          // TODO - start with a placeholder.

          // Cases where we don't want to render.
          if (!this.model) return this.clear();

          // If the model is still uploading, then don't re-render.
          if (
            this.el.children.length &&
            this.model.getUploadStatus &&
            this.model.getUploadStatus() == "p"
          ) {
            return this;
          }

          // Get the attributes for the style and context
          let styleAttrs = this.style ? this.styles[this.style] : null;

          // Can't render without a set style
          if (!styleAttrs) return this.clear();

          // In text or full citation?
          styleAttrs = styleAttrs[this.context || "full"];

          // Can't render without a set style
          if (!styleAttrs) return this.clear();

          // Get the template for this style. If object is archived & not
          // indexed, use the archived template.
          let template = styleAttrs.template;
          if (
            this.model.isArchivedAndNotIndexed() &&
            styleAttrs.archivedTemplate
          ) {
            template = styleAttrs.archivedTemplate;
          }

          // If for some reason there is no template, then render an empty view
          if (!template) return this.clear();

          // Options to pass to the template
          const options = {
            titleClass: this.titleClass,
            citationMetadataClass: this.citationMetadataClass,
            ...this.model.toJSON(),
          };
          if (!options.title) options.title = this.defaultTitle || "";

          // PANGAEA specific override. If this is a PANGAEA object, then do not
          // show the UUID if the seriesId is a DOI.
          if (
            this.model.isFromNode("urn:node:PANGAEA") &&
            this.model.isDOI(options.seriesId)
          ) {
            options.pid = "";
          }

          // Find the render method to use that is in the style definition
          let renderMethod = styleAttrs.render;

          // Run the render method, if it exists
          if (typeof renderMethod == "function") {
            renderMethod.call(this, options, template);
          } else if (typeof this[renderMethod] == "function") {
            this[renderMethod](options, template);
          } else {
            // Default to just passing the options to the template
            this.el.innerHTML = template(options);
          }

          if (this.createLink) {
            this.addLink();
          } else if (this.createTitleLink) {
            this.addTitleLink();
          }

          return this;
        } catch (error) {
          console.log("Error rendering the CitationView: ", error);
          return this.clear();
        }
      },

      /**
       * Remove all HTML from the view.
       * @returns {CitationView} Returns the view.
       * @since 2.23.0
       */
      clear: function () {
        this.el.innerHTML = "";
        return this;
      },

      /**
       * Render a complete APA style citation.
       * @param {Object} options - The options to pass to the template.
       * @param {function} template - The template associated with this style,
       * or it's archive template if the object is archived and not indexed.
       * @param {number} [maxAuthors=20] - The maximum number of authors to
       * display. If there are more than this number of authors, then the
       * remaining authors will be replaced with an ellipsis. The default is 20
       * since that is the maximum that APA allows. Set to a falsy value to
       * display all authors.
       * @since 2.23.0
       */
      renderAPA: function (options, template, maxAuthors=20) {
        // Format the authors for display
        options.origin = this.CSLNamesToAPA(options.originArray, maxAuthors);
        this.el.innerHTML = template(options);
        // If there are citationMetadata, as well as an element in the current
        // template where they should be inserted, then show them inline.
        if (options.citationMetadata) {
          this.addCitationMetadata(options.citationMetadata);
        }
      },

      /**
       * Render an in-text APA style citation.
       * @param {Object} options - The options to pass to the template.
       * @param {function} template - The template associated with this style,
       * or it's archive template if the object is archived and not indexed.
       * @since 2.23.0
       */
      renderAPAInText: function (options, template) {
        options.origin = this.CSLNamesToAPAInText(options.originArray);
        this.el.innerHTML = template(options);
      },

      /**
       * Render a complete APA style citation with all authors listed.
       * @param {Object} options - The options to pass to the template.
       * @param {function} template - The template associated with this style,
       * or it's archive template if the object is archived and not indexed.
       * @since x.x.x
       */
      renderAPAAllAuthors: function (options, template) {
        this.renderAPA(options, template, false);
      },

      /**
       * Render the list of in-text citations that cite the main citation. This
       * function will find the element in the template that is designated as
       * the container for the in-text citations and will render any citations
       * from the model's citationMetadata attribute.
       * @param {Object[]} citationMetadata - The citationMetadata to render.
       * See {@link CitationModel#defaults}.
       * @since 2.23.0
       */
      addCitationMetadata: function (citationMetadata) {
        const citationMetaEl = this.el.querySelector(
          "." + this.citationMetadataClass
        );
        if (citationMetaEl) {
          // Render a CitationView for each citationMetadata
          citationMetadata.forEach(function (cm, i) {
            const citationView = new CitationView({
              model: cm,
              style: this.style,
              context: "inText",
              createLink: true,
              openLinkInNewTab: true,
            });
            citationMetaEl.appendChild(citationView.render().el);
            // Put a comma after each citationMetadata except the last one
            if (i < citationMetadata.length - 1) {
              citationMetaEl.appendChild(document.createTextNode(", "));
            }
          }, this);
        }
      },

      /**
       * Make the entire citation a link to the view page or the source URL.
       * @since 2.23.0
       */
      addLink: function () {
        const url = this.model.getURL();
        if (!url) return;
        // Remove any existing links, but keep the content of each link in place
        const links = this.el.querySelectorAll("a");
        links.forEach((link) => {
          const content = link.innerHTML;
          link.outerHTML = content;
        });
        const id = this.model.getID();
        const target =
          url.startsWith("http") || this.openLinkInNewTab
            ? ' target="_blank"'
            : "";
        const dataId = id ? ` data-id="${id}" ` : "";
        const content = this.el.innerHTML;
        const aClass = "route-to-metadata";
        this.el.innerHTML = `<a class="${aClass}"${dataId}href="${url}"${target}>${content}</a>`;
      },

      /**
       * Make the title a link to the view page or the source URL.
       * @since 2.23.0
       */
      addTitleLink: function () {
        const url = this.model.getURL();
        if (!url) return;
        const titleEl = this.el.querySelector("." + this.titleClass);
        if (!titleEl) return;
        const target =
          url.startsWith("http") || this.openLinkInNewTab
            ? ' target="_blank"'
            : "";
        titleEl.innerHTML = `<a href="${url}"${target}>${titleEl.outerHTML}</a>`;
      },

      /**
       * Given a list of authors in CSL JSON, merge them all into a single
       * string for display in an APA citation.
       * @param {object[]} authors - An array of CSL JSON name objects
       * @returns {string} The formatted author string or an empty string if
       * there are no authors 
       * @param {number} [maxAuthors=20] - The maximum number of authors to
       * display. If there are more than this number of authors, then the
       * remaining authors will be replaced with an ellipsis. The default is 20
       * since that is the maximum that APA allows. Set to a falsy value to
       * display all authors.
       * @since 2.23.0
       */
      CSLNamesToAPA: function (authors, maxAuthors=20) {
        // Format authors as a proper APA style citation:
        if (!authors) return "";

        // authors = authors.map(this.CSLNameToAPA);
        // Uncomment the line above, and remove the line below, in order to
        // make the author names follow the APA format. For now, we are showing
        // full author names to avoid organization names getting mangled. See
        // https://github.com/NCEAS/metacatui/issues/2106
        authors = authors.map(this.CSLNameToFullNameStr);

        const numAuthors = authors.length;
        const lastAuthor = authors[numAuthors - 1];

        // Set maxAuthors to the number of authors if it is a falsy value.
        maxAuthors = maxAuthors || numAuthors;

        if (numAuthors === 1) return authors[0];
        // Two authors: Separate author names with a comma. Use the ampersand.
        if (numAuthors === 2) return authors.join(", & ");
        // Two to maxAuthors: commas separate author names, while the last
        // author name is preceded again by ampersand.
        if (numAuthors > 2 && numAuthors <= maxAuthors) {
          const authorsGrp1 = authors.slice(0, numAuthors - 1);
          return `${authorsGrp1.join(", ")}, & ${lastAuthor}`;
        }
        // More than maxAuthors: "After the first 19 authors’ names, use an
        // ellipsis in place of the remaining author names. Then, end with the
        // final author's name (do not place an ampersand before it). There
        // should be no more than twenty names in the citation in total."
        if (numAuthors > maxAuthors) {
          const authorsGrp1 = authors.slice(0, maxAuthors);
          return `${authorsGrp1.join(", ")}, ... ${lastAuthor}`;
        }
      },

      /**
       * Given one name object in CSL-JSON format, return the author's name in
       * the format required for a full APA citation: Last name first, followed
       * by author initials with a period after each initial. See
       * {@link EMLParty#toCSLJSON}
       * @param {object} cslJSON - A CSL-JSON name object
       * @since 2.23.0
       */
      CSLNameToAPA: function (cslJSON) {
        const {
          family,
          given,
          literal,
          "non-dropping-particle": nonDropPart,
        } = cslJSON;

        // Literal is the organization or position name
        if (!family && !given) return literal || "";

        let familyName = family;
        // If there is a non-dropping-particle, add it to the family name
        familyName =
          family && nonDropPart ? `${nonDropPart} ${family}` : family;

        // If there is no given name, just return the family name.
        if (!given) return familyName;

        // Handle full given names or just initials with or without periods.
        // Split on spaces and periods, then filter out empty strings.
        const initials = given
          .split(/[\s.]+/)
          .filter((str) => str.length > 0)
          .map((str) => str[0] + ".")
          .join("");

        // If there is no family name, just return the initials
        if (!familyName) return initials;

        // If there is a family name and initials, return the family name first,
        // followed by the initials
        return `${familyName}, ${initials}`;
      },

      /**
       * Given a list of authors in CSL JSON, merge them all into a single
       * string for display in an In-Text APA citation.
       * @param {object[]} authors - An array of CSL JSON name objects
       * @returns {string} The formatted author string or an empty string if
       * there are no authors
       * @since 2.23.0
       */
      CSLNamesToAPAInText: function (authors) {
        if (!authors || !authors.length) return "";
        // In the in-text citation provide the surname of the author. When there
        // are two authors, use the ampersand. When there are three or more
        // authors, list only the first author’s name followed by "et al."
        const nAuthors = authors.length;
        // Convert the authors to a string, either non-drop-particle + family
        // name, or literal
        const authorStr = authors.map((a) => {
          const { family, literal, "non-dropping-particle": ndp } = a;
          let name = family;
          name = family && ndp ? `${ndp} ${family}` : family;
          return name || literal;
        });
        if (nAuthors === 1) return authorStr[0];
        if (nAuthors === 2) return authorStr.join(" & ");
        return `${authorStr[0]} et al.`;
      },

      /**
       * Given a list of authors in CSL JSON, merge them all into a single
       * string where authors full names are separated by commas.
       * @param {object[]} authors - An array of CSL JSON name objects
       * @returns {string} The formatted author string or an empty string if
       * there are no authors
       * @since 2.23.0
       */
      CSLNameToFullNameStr: function (author) {
        if (!author) return "";
        const { given, family, literal, "non-dropping-particle": ndp } = author;
        let name = family;
        name = family && ndp ? `${ndp} ${family}` : family;
        name = name && given ? `${given} ${name}` : name;
        return name || literal;
      },
    }
  );

  return CitationView;
});
