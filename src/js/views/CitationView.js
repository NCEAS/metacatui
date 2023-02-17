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
       * The CitationModel that this view is displaying. The view can be
       * instantiated by passing in a CitationModel, or a SolrResult,
       * DataONEObject, or an extension of those, and the view will create a
       * CitationModel from it. To change the model after the view has been
       * instantiated, use the {@link CitationView#setModel} method.
       * @type {CitationModel}
       */
      model: null,

      /**
       * @typedef {Object} StyleOption
       * @property {number} maxAuthors - The maximum number of authors to
       * display. See {@link CitationModel#maxAuthors}
       * @property {Underscore.Template} template - The Underscore.js template
       * to use. HTML files are converted to Underscore.js templates. See
       * {@link CitationView#template}
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
       * @type {Object}
       * @property {StyleOption} styleName - Each property in the styles object
       * maps a style name to a StyleOption object.
       * @since x.x.x
       */
      styles: {
        inText: {
          maxAuthors: 1,
          template: _.template(InTextTemplate),
          archivedTemplate: _.template(InTextArchivedTemplate),
          render: "renderAPAInText",
        },
        full: {
          maxAuthors: 20,
          template: _.template(FullTemplate),
          archivedTemplate: _.template(FullArchivedTemplate),
          default: true,
          render: "renderAPA",
        },
        fullLink: {
          maxAuthors: 20,
          template: _.template(FullTemplate),
          archivedTemplate: _.template(FullArchivedTemplate),
          render: "renderAPALink",
        },
        fullNoLink: {
          maxAuthors: 20,
          template: _.template(FullTemplate),
          archivedTemplate: _.template(FullArchivedTemplate),
          render: "renderAPANoLink",
        },
      },

      /**
       * The layout and style of the citation. Set this when instantiating the
       * view, or with the setStyle() method. Any style that is defined in the
       * {@link CitationView#styles} property can be used. If the style is not
       * defined, then the default style will be used.
       * @type {string}
       * @since x.x.x
       */
      style: null,

      /**
       * The templates for this view. HTML files are converted to Underscore.js
       * templates. Configure this in the {@link CitationView#styles} property,
       * and set it using the {@link CitationView#setStyle} method.
       * @type {Underscore.Template}
       */
      template: null,

      /**
       * The maximum number of authors to show in a full citation. Any authors
       * after this will be shown as "et al." (e.g. "Smith, J., Jones, K., et
       * al."). Any falsy value will show all authors. Configure this in the
       * {@link CitationView#styles} property, and set it using the
       * {@link CitationView#setStyle} method.
       * @type {number}
       * @since x.x.x
       */
      maxAuthors: null,

      /** A default title for when the Citation Model does not have a title.
       * @type {string}
       * @since x.x.x
       */
      defaultTitle: null,

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
       * option will be used to populate a CitationModel. Using the metadata
       * option will also set the style to "fullLink", unless another style is
       * specified.
       * @param {string} [options.createLink] - Allowed for backwards
       * compatibility. Setting this option to true will set the style to
       * "fullLink", unless another style is specified. The preferred method
       * is to set the style option directly.
       * @param {string} [options.createTitleLink] - Allowed for backwards
       * compatibility. Setting this option to false will set the style to
       * "fullNoLink", unless another style is specified. The preferred method
       * is to set the style option directly.
       * @param {string} [options.title] - Allowed for backwards compatibility.
       * Setting this option will set the default title for this view, on the
       * {@link CitationView#defaultTitle} property. The preferred method is to
       * set the defaultTitle property directly.
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
          let style = options.style;
          if (
            (options.createLink === true && !optKeys.includes("style")) ||
            (options.metadata && !optKeys.includes("style"))
          ) {
            style = "fullLink";
          }
          if (options.createTitleLink === false && !optKeys.includes("style")) {
            style = "fullNoLink";
          }

          // Don't set any of the deprecated on the the model.
          delete options.model;
          delete options.metadata;
          delete options.id;
          delete options.title;
          delete options.createLink;
          delete options.createTitleLink;
          // The style is set with the setStyle() method.
          delete options.style;

          // Get all the options and apply them to this view.
          Object.keys(options).forEach(function (key) {
            this[key] = options[key];
          }, this);

          this.setStyle(style, false);
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
          const view = this;

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
       * Use this method to set the style for this view, and re-render.
       * @param {string} style - The style to set. If the style is not provided
       * or not defined in the {@link CitationView#styles} property, then the
       * default style will be used.
       * @param {*} [render=true] - Whether to automatically re-render the view
       * after setting the style.
       * @since x.x.x
       */
      setStyle: function (style, render = true) {
        // Find the attributes configured for the style, or the default style
        const allStyles = this.styles;
        const defaultStyle = Object.keys(allStyles).find(function (key) {
          return allStyles[key].default;
        });
        style = style || defaultStyle;
        let styleAttrs = style ? allStyles[style] : null;

        if (!styleAttrs) {
          console.log(
            `The style "${style}" is not defined in the CitationView and no ` +
              `default style is defined. The style will not be set and no ` +
              `attributes will be updated.`
          );
          return;
        }

        // make a copy of the style attributes so that they can be modified
        // without affecting the original. Use spread.
        styleAttrs = { ...styleAttrs };
        // Set the style attributes on this view, except for the default, which
        // is only used to determine the default style, and the render method,
        // which is used to find and set the render method separately.
        Object.keys(styleAttrs).forEach(function (key) {
          if (key != "default" && key != "render") {
            this[key] = styleAttrs[key];
          }
        }, this);
        // Find and set the render method for this style
        const renderMethod = styleAttrs.render ? this[styleAttrs.render] : null;
        if (typeof renderMethod == "function") {
          this.renderStyle = renderMethod;
        } else {
          this.renderStyle = null;
        }
        this.style = style;
        if (render) this.render();
      },

      /**
       * Renders the view.
       * @return {CitationView} Returns the view.
       */
      render: function () {
        try {
          // Cases where we don't want to render.
          // TODO - start with a skeleton/loading template, so that if we have no
          // data, we don't show an empty citation
          if (!this.model) {
            this.$el.html("");
            return;
          }
          if (
            this.$el.children().length &&
            this.model.getUploadStatus() == "p"
          ) {
            // If the model is still uploading, then don't re-render.
            return;
          }

          // Switch to archived template if the object is archived & not indexed.
          const template = this.model.isArchivedAndNotIndexed()
            ? this.archivedTemplate
            : this.template;

          // If for some reason there is no template, then render an empty view
          if (!template) {
            this.$el.html("");
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

          if (!options.title) {
            options.title = this.defaultTitle;
          }

          // Find the name of the render method to use that is in the style
          // definition
          if (typeof this.renderStyle == "function") {
            this.renderStyle(options, template);
          }
          return this;
        } catch (error) {
          console.log("Error rendering the CitationView: ", error);
          this.$el.html("");
          return this;
        }
      },

      /**
       * The render method for the "full" style. Renders the complete citation,
       * including the title, authors, and publication information. Includes a
       * link around the title that points to the view page for the object.
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
          const citationMetaEl = this.el.querySelector(".citation-metadata");
          if (citationMetaEl) {
            // Render a CitationView for each citationMetadata
            options.citationMetadata.forEach(function (citationMetadata, i) {
              const citationView = new CitationView({
                model: citationMetadata,
                style: "inText",
              });
              // citationMetaEl.appendChild(citationView.render().el);
              // citationMetaEl.app
              citationMetaEl.appendChild(citationView.render().el);
              // Put a comma after each citationMetadata except the last one
              if (i < options.citationMetadata.length - 1) {
                citationMetaEl.appendChild(document.createTextNode(", "));
              }
            });
          }
        }
      },

      /**
       * The render method for the "fullLink" style. Identical to the "full"
       * style, except that it includes a link around all the content that
       * points to the view page for the object.
       * @param {Object} options - The options to pass to the template.
       * @param {function} template - The template associated with this style,
       * or it's archive template if the object is archived and not indexed.
       * @since x.x.x
       */
      renderAPALink: function (options, template) {
        this.renderAPANoLink(options, template);
        // Add a link around all the content and update the html
        const url = options.view_url || "";
        if (url) {
          const id = options.pid || options.seriesId || "";
          const dataId = id ? ` data-id="${id}" ` : "";
          const content = this.el.innerHTML;
          const aClass = "route-to-metadata";
          this.el.innerHTML = `<a class="${aClass}"${dataId}href="${url}">${content}</a>`;
        }
      },

      /**
       * The render method for the "fullNoLink" style. Identical to the "full"
       * style, except that it removes any links in the content (e.g. the link
       * around the title).
       * @param {Object} options - The options to pass to the template.
       * @param {function} template - The template associated with this style,
       * or it's archive template if the object is archived and not indexed.
       * @since x.x.x
       */
      renderAPANoLink: function (options, template) {
        this.renderAPA(options, template);
        // Remove any <a> tags that are already in the HTML
        this.el.querySelectorAll("a").forEach(function (aTag) {
          aTag.outerHTML = aTag.innerHTML;
        });
      },

      /**
       * The render method for the "inText" style. Renders the citation in the
       * format of a parenthetical citation, including the authors and year.
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
       * Given a list of authors in CSL JSON, merge them all into a single
       * string for display in an APA citation.
       * @param {object[]} authors - An array of CSL JSON name objects
       * @returns {string} The formatted author string or an empty string if
       * there are no authors
       */
      CSLNamesToAPA: function (authors) {
        // Format authors as a proper APA style citation:
        if (!authors) return "";

        authors = authors.map(this.CSLNameToAPA);

        const numAuthors = authors.length;
        const maxAuthors = this.maxAuthors || numAuthors;
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

        // If there is no given name, just return the family name, if there is
        // one.
        if (!given) return familyName;

        // Handle full given names or just initials with or without periods.
        // SPlit on spaces and periods, then filter out empty strings.
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
        return `${authorStr[0]} et al`;
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
