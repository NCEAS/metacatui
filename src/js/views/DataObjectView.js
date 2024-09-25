"use strict";

define(["backbone", "views/TableEditorView"], (Backbone, TableEditorView) => {
  // The base class for the view
  const BASE_CLASS = "object-view";

  /**
   * @class DataObjectView
   * @classdesc A view that downloads and displays a DataONE object. Currently
   * there is support for displaying CSV files as a table.
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @since 0.0.0
   * @screenshot views/DataObjectView.png //TODO
   */
  const DataObjectView = Backbone.View.extend(
    /** @lends DataObjectView.prototype */
    {
      /** @inheritdoc */
      type: "DataObjectView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      tagName: "div",

      /**
       * Initializes the DataObjectView
       * @param {object} options - Options for the view
       * @param {SolrResult} options.model - A SolrResult model
       */
      initialize(options) {
        this.model = options.model;
        // TODO: We get format from the response headers, should we compare it,
        // or prevent downloading the object if it's not a supported type?
        // this.format = this.model.get("formatId") ||
        // this.model.get("mediaType");
      },

      /** @inheritdoc */
      render() {
        this.$el.empty();
        this.downloadObject().then((response) => this.renderObject(response));
        return this;
      },

      /**
       * With the already fetched DataONE object, check the format and render
       * the object accordingly.
       * @param {Response} response - The response from the DataONE object API
       */
      renderObject(response) {
        const format = response.headers.get("Content-Type");
        if (format === "text/csv") {
          response.text().then((text) => {
            this.csv = text;
            this.showTable();
          });
        }
      },

      /**
       * Downloads the DataONE object
       * @returns {Promise} Promise that resolves with the Response from DataONE
       */
      downloadObject() {
        return this.model.fetchDataObjectWithCredentials();
      },

      /** Shows the CSV file as a table */
      showTable() {
        this.table = new TableEditorView({
          viewMode: true,
          csv: this.csv,
        });
        this.el.innerHTML = "";
        this.el.appendChild(this.table.render().el);
      },
    },
  );

  return DataObjectView;
});
