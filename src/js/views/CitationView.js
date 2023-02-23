define([
  "jquery",
  "underscore",
  "backbone",
  "models/CitationModel",
  "text!templates/citations/citationAPA.html",
  "text!templates/citations/citationAPAInText.html",
  "text!templates/citations/citationFullArchived.html",
  "text!templates/citations/citationAPAInTextArchived.html",
], function (
  $,
  _,
  Backbone,
  CitationModel,
  FullTemplate,
  InTextTemplate,
  FullArchivedTemplate,
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
       * @since x.x.x
       * @type {string}
       */
      titleClass: "title",

      /**
       * The HTML classes to use for the element that will contain the citation
       * metadata. The citation metadata are the citations that cite the main
       * citation. This class will be passed to the template and will be used to
       * identify the container element.
       * @since x.x.x
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
       * @since x.x.x
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
       * @since x.x.x
       */

      /**
       * The format and layout options that are available for this view. The
       * `default` option is used when no format is specified in the options.
       * @type {Object}
       * @property {CitationView#StyleDefinition} styleName - Each property in
       * the styles object maps a style name to a StyleOption object.
       * @since x.x.x
       */
      styles: {
        apa: {
          full: {
            template: _.template(FullTemplate),
            archivedTemplate: _.template(FullArchivedTemplate),
            render: "renderAPA",
          },
          inText: {
            template: _.template(InTextTemplate),
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
       * @since x.x.x
       */
      style: "apa",

      /**
       * The context to use when rendering the citation. This can be either
       * "inText" or "full". Configure this in the {@link CitationView#styles}
       * property.
       * @type {string}
       * @since x.x.x
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
       * @since x.x.x
       */
      openLinkInNewTab: false,

      /** A default title for when the Citation Model does not have a title.
       * @type {string}
       * @since x.x.x
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
            console.log('setting default title to', options.title);
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
          const template = this.model.isArchivedAndNotIndexed()
            ? styleAttrs.archivedTemplate
            : styleAttrs.template;

          // If for some reason there is no template, then render an empty view
          if (!template) return this.clear();

          // Find the render method to use that is in the style definition
          let renderMethod = styleAttrs.render ? this[styleAttrs.render] : null;

          // Find the name of the render method to use that is in the style
          // definition
          if (typeof renderMethod != "function") return this.clear();

          // Options to pass to the template
          const options = {
            titleClass: this.titleClass,
            citationMetadataClass: this.citationMetadataClass,
            ...this.model.toJSON(),
          };
          if(!options.title) options.title = this.defaultTitle || '';

          // PANGAEA specific override. If this is a PANGAEA object, then do not
          // show the UUID if the seriesId is a DOI.
          if (
            this.model.isFromNode("urn:node:PANGAEA") &&
            this.model.isDOI(options.seriesId)
          ) {
            options.pid = "";
          }

          renderMethod.call(this, options, template);

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
       * @since x.x.x
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
       * @since x.x.x
       */
      renderAPA: function (options, template) {
        // Format the authors for display
        options.origin = this.CSLNamesToAPA(options.originArray);
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
       * @since x.x.x
       */
      renderAPAInText: function (options, template) {
        options.origin = this.CSLNamesToAPAInText(options.originArray);
        this.el.innerHTML = template(options);
      },

      /**
       * Render the list of in-text citations that cite the main citation. This
       * function will find the element in the template that is designated as
       * the container for the in-text citations and will render any citations
       * from the model's citationMetadata attribute.
       * @param {Object[]} citationMetadata - The citationMetadata to render.
       * See {@link CitationModel#defaults}.
       * @since x.x.x
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
              openLinkInNewTab: true
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
       * @since x.x.x
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
       * @since x.x.x
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
       * @since x.x.x
       */
      CSLNamesToAPA: function (authors) {
        // Format authors as a proper APA style citation:
        if (!authors) return "";

        authors = authors.map(this.CSLNameToAPA);

        const numAuthors = authors.length;
        const maxAuthors = 20;
        const lastAuthor = authors[numAuthors - 1];

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
       * @since x.x.x
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
       * @since x.x.x
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
       * @since x.x.x
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
