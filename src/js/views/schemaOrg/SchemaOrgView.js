"use strict";

define(["backbone", "models/schemaOrg/SchemaOrg"], (Backbone, SchemaOrg) => {
  const SCRIPT_TYPE = "application/ld+json";
  const JSON_LD_ID = "jsonld";
  /**
   * @class SchemaOrgView
   * @classdesc Inserts and updates the Schema.org JSON-LD script tag in the
   * head of the document. This view will only work if the JSON-LD feature is
   * enabled in the MetacatUI configuration. Otherwise, no JSON-LD script tag
   * will be inserted into the head of the document.
   * @classcategory Views/Maps
   * @name SchemaOrgView
   * @augments Backbone.View
   * @since 0.0.0
   * @constructs SchemaOrgView
   */
  const SchemaOrgView = Backbone.View.extend(
    /** @lends SchemaOrgView.prototype */ {
      /** @inheritdoc */
      initialize() {
        if (!this.isEnabled()) return;
        this.model = new SchemaOrg();
        this.stopListening();
        this.listenTo(this.model, "change", this.updateJsonldEl);
      },

      /**
       * Checks if the JSON-LD feature is enabled in the MetacatUI configuration.
       * @returns {boolean} True if the JSON-LD feature is enabled, false otherwise.
       */
      isEnabled() {
        return MetacatUI.appModel.get("isJSONLDEnabled");
      },

      /** @inheritdoc */
      render() {
        if (!this.isEnabled()) return;
        this.removeExistingJsonldEls();
        this.addJsonldEl();
      },

      /**
       * Updates the JSON-LD script tag in the head of the document based on the
       * type of page being viewed.
       * @param {"Dataset"|"DataCatalog"} type - The type of page being viewed.
       * If neither "Dataset" nor "DataCatalog" is provided, the schema will be
       * set to the default schema.
       * @param {object} model - The model to use for the schema.
       * @since 0.0.0
       */
      setSchema(type, model = null) {
        if (!this.isEnabled()) return;
        this.model.setSchema(type, model);
      },

      /**
       * Sets the schema based on a template.
       * @param {string} template - The template to use for the schema. This
       * must be stringified JSON that follows the schema.org schema.
       */
      setSchemaFromTemplate(template) {
        if (!this.isEnabled()) return;
        if (typeof template === "string") {
          this.model.setSchemaFromTemplate(template);
        }
      },

      /**
       * Create the JSON LD element to insert into the head of the document.
       * @returns {HTMLScriptElement} The JSON LD element.
       */
      createJsonldEl() {
        const jsonldEl = document.createElement("script");
        jsonldEl.type = SCRIPT_TYPE;
        jsonldEl.id = JSON_LD_ID;
        this.jsonldEl = jsonldEl;
        return jsonldEl;
      },

      /**
       * Updates the JSON-LD script tag in the head of the document based on the
       * model values.
       */
      updateJsonldEl() {
        if (!this.isEnabled()) return;
        let el = this.jsonldEl;
        if (!el) {
          el = this.addJsonldEl();
        }
        const text = this.model.serialize();
        el.text = text;
      },

      /**
       * Inserts the JSON-LD script tag into the head of the document.
       * @returns {HTMLScriptElement} The JSON-LD element.
       */
      addJsonldEl() {
        if (!this.isEnabled()) return null;
        const el = this.createJsonldEl();
        document.head.appendChild(el);
        return el;
      },

      /**
       * Get all the existing JSON-LD elements in the head of the document.
       * @returns {NodeListOf<HTMLScriptElement>} The existing JSON-LD elements.
       */
      getExistingJsonldEls() {
        return document.head.querySelectorAll(`script[type="${SCRIPT_TYPE}"]`);
      },

      /**
       * Removes any existing JSON-LD elements from the head of the document.
       */
      removeExistingJsonldEls() {
        const els = this.getExistingJsonldEls();
        els.forEach((el) => {
          document.head.removeChild(el);
        });
        this.jsonldEl = null;
      },

      /** What to do when the view is closed. */
      onClose() {
        this.removeExistingJsonldEls();
        this.stopListening();
        this.model.destroy();
      },
    },
  );

  return SchemaOrgView;
});
