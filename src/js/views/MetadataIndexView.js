define([
  "jquery",
  "underscore",
  "backbone",
  "common/QueryService",
  "models/viewService/ViewServiceDoc",
  "text!templates/loading.html",
  "text!templates/alert.html",
  "text!templates/attribute.html",
], (
  $,
  _,
  Backbone,
  QueryService,
  ViewServiceDoc,
  LoadingTemplate,
  alertTemplate,
  AttributeTemplate,
) => {
  const CLASS_NAMES = {
    ...ViewServiceDoc.CLASS_NAMES,
    alertWarning: "alert-warning",
    metadataIndex: "metadata-index",
  };
  const { IDS } = ViewServiceDoc;
  const MESSAGES = {
    dataSectionTitle: "Data",
    limitedContent:
      "<h4>There is limited information about this content.</h4>" +
      "<p>This data or science metadata is available to download, but " +
      "there seems to be an issue with displaying details on this webpage. " +
      "If this content was recently submitted, it may still be in the processing queue.</p>",
    noMetadataFound: "No metadata found for this dataset.",
    otherSectionTitle: "Other",
    privateContent:
      "<h4>This content is private.</h4>" +
      "<p>You may need to sign in or request access to view details for this dataset.</p>",
  };

  const SECTIONS = [
    {
      title: "General",
      keys: ["title", "id", "abstract", "pubDate", "keywords"],
    },
    {
      title: "Geographic Region",
      className: CLASS_NAMES.geographicCoverage,
      keys: [
        {
          field: "site",
          display: "Geographic Description",
          className: CLASS_NAMES.geographicDescription,
        },
        {
          field: "southBoundCoord",
          display: "South",
          className: CLASS_NAMES.southBoundingCoordinate,
          dataValue: true,
        },
        {
          field: "northBoundCoord",
          display: "North",
          className: CLASS_NAMES.northBoundingCoordinate,
          dataValue: true,
        },
        {
          field: "westBoundCoord",
          display: "West",
          className: CLASS_NAMES.westBoundingCoordinate,
          dataValue: true,
        },
        {
          field: "eastBoundCoord",
          display: "East",
          className: CLASS_NAMES.eastBoundingCoordinate,
          dataValue: true,
        },
      ],
    },
    {
      title: "Temporal Coverage",
      keys: ["beginDate", "endDate"],
    },
    {
      title: "Taxonomic Coverage",
      className: CLASS_NAMES.taxonomicCoverage,
      keys: ["order", "phylum", "family", "genus", "species", "scientificName"],
    },
    {
      title: "People and Associated Parties",
      keys: ["origin", "investigator", "contactOrganization", "project"],
    },
    {
      title: "Access Control",
      keys: [
        "isPublic",
        "submitter",
        "rightsHolder",
        "writePermission",
        "readPermission",
        "changePermission",
        "authoritativeMN",
      ],
    },
  ];

  /**
   * @class MetadataIndexView
   * @classdesc Renders indexed metadata when document rendering from the view
   * service is unavailable
   * @classcategory Views
   * @augments Backbone.View
   * @screenshot views/MetadataIndexView.png
   */
  const MetadataIndexView = Backbone.View.extend({
    /**
     * View type used when tracking metadata subviews.
     * @type {string}
     */
    type: "MetadataIndex",

    /** @inheritdoc */
    id: IDS.metadata,

    /** @inheritdoc */
    className: `${CLASS_NAMES.metadataIndex} ${CLASS_NAMES.container} ${CLASS_NAMES.formHorizontal}`,

    /** @inheritdoc */
    tagName: "article",

    /**
     * No main template is used because sections are built directly.
     * @type {null}
     */
    template: null,

    /**
     * Render the loading indicator.
     * @type {Function}
     */
    loadingTemplate: _.template(LoadingTemplate),

    /**
     * Render one metadata attribute.
     * @type {Function}
     */
    attributeTemplate: _.template(AttributeTemplate),

    /**
     * Render an alert message.
     * @type {Function}
     */
    alertTemplate: _.template(alertTemplate),

    /**
     * Index fields that support semantic annotation controls.
     * @type {object|null}
     */
    semanticFields: null,

    /** @inheritdoc */
    events: {},

    /**
     * Initialize index fallback rendering state.
     * @param {object} [options] View options
     * @param {string} [options.pid] Object identifier
     * @param {object[]} [options.indexResult] Existing index records
     * @param {DataPackage} [options.dataPackage] Loaded data package
     * @param {object} [options.displayState] Access and display state
     * @returns {void}
     */
    initialize(options = {}) {
      this.pid = options.pid || null;
      this.indexResult = options.indexResult || null;
      this.dataPackage = options.dataPackage || null;
      this.displayState = options.displayState || {};

      // use these to tailor the annotation ui widget
      this.semanticFields = {
        attribute: "sem_annotation",
        attributeName: "sem_annotation",
        attributeLabel: "sem_annotation",
        attributeDescription: "sem_annotation",
        attributeUnit: "sem_annotation",
        origin: "orcid_sm",
        investigator: "orcid_sm",
      };
    },

    /**
     * Render index fields and package data member sections.
     * @returns {Promise<MetadataIndexView|boolean>} This view, or false when no
     * PID is available
     * @throws {Error} When the index has no matching record
     */
    async render() {
      if (!this.pid) return false;

      const docs = await this.getIndexMetadata();

      if (!docs || docs.length === 0) {
        throw new Error(MESSAGES.noMetadataFound);
      }

      this.el.replaceChildren();
      this.metadataDetailsEl = document.createElement("section");
      this.metadataDetailsEl.id = "metadata-index-details";
      this.el.append(this.metadataDetailsEl);

      const specialKeys = SECTIONS.flatMap(({ keys }) =>
        keys.map((key) => (typeof key === "object" ? key.field : key)),
      );
      docs.forEach((doc) => {
        const allKeys = Object.keys(doc);
        const otherKeys = allKeys.filter((key) => !specialKeys.includes(key));
        SECTIONS.forEach(({ title, keys, className }) => {
          this.addSection(doc, keys, title, className);
        });
        this.addSection(doc, otherKeys, MESSAGES.otherSectionTitle);
      });

      this.insertDataDetails();
      return this;
    },

    /**
     * Load the full index record for this object
     * @returns {Promise<object[]>} Matching index records
     * @since 0.0.0
     */
    async getIndexMetadata() {
      if (this.indexResult) {
        return this.indexResult;
      }
      // Get all the fields from the Solr index using QueryService
      const q = QueryService.buildIdQuery(this.pid);
      const response = await QueryService.queryWithFetch({
        q,
        rows: 1,
        fields: "*",
        useAuth: true,
      });
      this.indexResult = QueryService.parseResponse(response);
      return this.indexResult;
    },

    /**
     * Build one populated metadata section
     * @param {object} doc Index record
     * @param {Array.<(string|object)>} keys Fields to render
     * @param {string} title Section title
     * @param {string} [className] Section class name
     * @returns {HTMLElement|null} Populated section or null
     * @since 0.0.0
     */
    createSection(doc, keys, title, className) {
      if (keys.length === 0) return null;
      const titleHTML = document.createElement("h4");
      const titleText = title || "";
      titleHTML.textContent = titleText;
      const sectionClass = className || titleText.replace(/ /g, "");

      let html = "";
      let populated = false;

      keys.forEach((key) => {
        if (
          typeof key === "object" &&
          (doc[key.field] || doc[key.field] === 0)
        ) {
          html += this.formatAttribute(key.field, doc[key.field], key);
          populated = true;
        } else if (doc[key] || doc[key] === 0) {
          html += this.formatAttribute(key, doc[key]);
          populated = true;
        }
      });

      if (populated) {
        const section = document.createElement("section");
        section.classList.add(sectionClass);
        section.append(titleHTML);
        section.insertAdjacentHTML("beforeend", html);

        return section;
      }
      return null;
    },

    /**
     * Append one populated metadata section
     * @param {object} doc Index record
     * @param {Array.<(string|object)>} keys Fields to render
     * @param {string} title Section title
     * @param {string} [className] Section class name
     * @returns {void}
     * @since 0.0.0
     */
    addSection(doc, keys, title, className) {
      const section = this.createSection(doc, keys, title, className);
      if (section) (this.metadataDetailsEl || this.el).append(section);
    },

    /**
     * Render one index field using the metadata attribute template.
     * @param {string} attribute Index field name
     * @param {*} value Index field value
     * @param {object} [options] Rendering options
     * @param {string} [options.className] CSS class for the field
     * @param {string} [options.display] Display label for the field
     * @param {boolean} [options.dataValue] Whether to include a data value
     * @returns {string} Rendered field markup
     */
    formatAttribute(attribute, value, options = {}) {
      let html = "";
      let embeddedAttributes = "";
      let type = "sem_annotation";
      const attributeClass = options.className || attribute;
      const formattedAttribute =
        options.display || this.transformCamelCase(attribute);
      const dataValue = options.dataValue ? value.toString() : null;

      // see if there is special handling for this field
      if (this.semanticFields[attribute]) {
        type = this.semanticFields[attribute];
      }

      // If this is a multi-valued field from Solr, the attribute value is
      // actually multiple embedded attribute templates
      const numAttributes =
        Array.isArray(value) && value.length > 1 ? value.length : 0;
      for (let i = 0; i < numAttributes; i += 1) {
        embeddedAttributes += this.attributeTemplate({
          attribute: "",
          attributeClass: "",
          controlGroupClass: CLASS_NAMES.controlGroup,
          controlLabelClass: CLASS_NAMES.controlLabel,
          controlsClass: CLASS_NAMES.controls,
          controlsWellClass: CLASS_NAMES.controlsWell,
          dataValue: null,
          formattedAttribute,
          value: value[i].toString(),
          id: `${attribute}_${i + 1}`,
          type,
          resource: `#xpointer(//${attribute}[${i + 1}])`,
        });
      }

      const renderedValue =
        !embeddedAttributes && value instanceof $ ? value[0].outerHTML : value;

      html += this.attributeTemplate({
        attribute,
        attributeClass,
        controlGroupClass: CLASS_NAMES.controlGroup,
        controlLabelClass: CLASS_NAMES.controlLabel,
        controlsClass: CLASS_NAMES.controls,
        controlsWellClass: CLASS_NAMES.controlsWell,
        dataValue,
        formattedAttribute,
        value: embeddedAttributes || renderedValue.toString(),
        id: attribute,
        type,
        resource: `#xpointer(//${attribute})`,
      });

      return html;
    },

    /**
     * Convert a camel case field name to a display label.
     * @param {string} string Field name
     * @returns {string} Display label
     */
    transformCamelCase(string) {
      const result = string
        .replace(/([A-Z]+)/g, " $1")
        .replace(/([A-Z][a-z])/g, " $1");
      return result.charAt(0).toUpperCase() + result.slice(1);
    },

    /**
     * Append one detail section for each data package member.
     * @returns {void}
     */
    insertDataDetails() {
      const dataMembers = this.dataPackage?.getData?.() || [];
      const container = this.metadataDetailsEl || this.el;
      dataMembers.forEach((member) => {
        const pid = member?.pid || "";
        const fileName =
          member?.getFileName?.() ||
          member?.viewServiceEntity?.fileName ||
          member?.fileName ||
          member?.filename ||
          "";
        const entityName =
          member?.viewServiceEntity?.entityName ||
          member?.entityName ||
          member?.title ||
          fileName ||
          pid;

        const entityGroup = document.createElement("div");
        entityGroup.classList.add(CLASS_NAMES.controlGroup, "entity");

        const section = document.createElement("div");
        section.classList.add(
          CLASS_NAMES.controls,
          CLASS_NAMES.controlsWell,
          CLASS_NAMES.entityDetails,
        );
        if (pid) section.dataset.id = pid;
        if (fileName) {
          section.dataset.objectName = fileName;
          section.dataset.filename = fileName;
        }
        if (entityName) section.dataset.entityName = entityName;

        const label = document.createElement("label");
        label.classList.add(CLASS_NAMES.controlLabel);
        label.textContent = MESSAGES.dataSectionTitle;
        section.append(label);
        if (entityName) {
          section.insertAdjacentHTML(
            "beforeend",
            this.formatAttribute("entityName", entityName, {
              display: "Entity Name",
              className: CLASS_NAMES.entityName,
            }),
          );
        }

        entityGroup.append(section);
        container.append(entityGroup);
      });
    },

    /**
     * Show the private or limited content message for an unindexed object.
     * @returns {void}
     */
    showNotIndexed() {
      const isPrivate =
        this.displayState.isPublic === false ||
        this.displayState.isAuthorized === false ||
        this.displayState.unauthorized === true;
      const message = this.alertTemplate({
        classes: CLASS_NAMES.alertWarning,
        msg: isPrivate ? MESSAGES.privateContent : MESSAGES.limitedContent,
        includeEmail: true,
      });
      this.$el.append(message);
    },

    /**
     * Reset the view when it closes.
     * @returns {void}
     */
    onClose() {
      this.$el.html(this.loadingTemplate());
      this.pid = null;
    },
  });
  return MetadataIndexView;
});
