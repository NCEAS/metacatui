"use strict";

define([
  "underscore",
  "backbone",
  "views/TableEditorView",
  "text!templates/loading.html",
  "text!templates/alert.html",
], (_, Backbone, TableEditorView, LoadingTemplate, AlertTemplate) => {
  // The classes used by this view
  const BASE_CLASS = "object-view";
  const CLASS_NAMES = {
    base: BASE_CLASS,
    well: "well", // Bootstrap class
    downloadButton: ["btn", "download"],
    downloadIcon: ["icon", "icon-cloud-download"],
  };

  // User-facing text
  const DOWNLOAD_BUTTON_TEXT = "Download";
  const LOADING_MESSAGE = "Loading data...";
  const ERROR_TITLE = "Uh oh 😕";
  const ERROR_MESSAGE =
    "There was an error displaying the object. Please try again later or send us an email.";
  const MORE_DETAILS_PREFIX = "More details: ";

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
      className: CLASS_NAMES.base,

      /** @inheritdoc */
      tagName: "div",

      /**
       * The template for the loading spinner
       * @type {UnderscoreTemplate}
       */
      loadingTemplate: _.template(LoadingTemplate),

      /**
       * The template for the alert message
       * @type {UnderscoreTemplate}
       */
      alertTemplate: _.template(AlertTemplate),

      /**
       * Initializes the DataObjectView
       * @param {object} options - Options for the view
       * @param {SolrResult} options.model - A SolrResult model
       * @param {Element} [options.buttonContainer] - The container for the
       * download button (defaults to the view's element)
       */
      initialize(options) {
        this.model = options.model;
        this.buttonContainer = options.buttonContainer || this.el;
        // TODO: We get format from the response headers, should we compare it,
        // or prevent downloading the object if it's not a supported type?
        // this.format = this.model.get("formatId") ||
        // this.model.get("mediaType");
      },

      /** @inheritdoc */
      render() {
        this.$el.empty();
        this.showLoading();
        this.downloadObject()
          .then((response) => this.handleResponse(response))
          .catch((error) => this.showError(error?.message || error));
        return this;
      },

      /** Indicate that the data is loading */
      showLoading() {
        this.$el.html(
          this.loadingTemplate({
            msg: LOADING_MESSAGE,
          }),
        );
        this.el.classList.add(CLASS_NAMES.well);
      },

      /** Remove the loading spinner */
      hideLoading() {
        this.el.classList.remove(CLASS_NAMES.well);
      },

      /**
       * Display an error message to the user
       * @param {string} message - The error message to display
       */
      showError(message) {
        this.hideLoading();
        const alertTitle = `<center><h3>${ERROR_TITLE}</h3></center>`;
        let alertMessage = alertTitle + ERROR_MESSAGE;
        if (message) {
          alertMessage += `<br><br>${MORE_DETAILS_PREFIX}${message}`;
        }
        this.$el.html(
          this.alertTemplate({
            includeEmail: true,
            msg: alertMessage,
            remove: false,
          }),
        );
      },

      /**
       * Handle the response from the DataONE object API. Renders the data and
       * shows the download button if the response is successful.
       * @param {Response} response - The response from the DataONE object API
       */
      handleResponse(response) {
        if (response.ok) {
          this.hideLoading();
          this.$el.html("");
          // Response can only be consumed once (e.g. to text), so keep a copy
          // to convert to a blob for downloading if user requests it.
          this.response = response.clone();
          this.renderObject(response);
          this.renderDownloadButton();
        } else {
          this.showError(response.statusText);
        }
      },

      /**
       * With the already fetched DataONE object, check the format and render
       * the object accordingly.
       * @param {Response} response - The response from the DataONE object API
       */
      renderObject(response) {
        try {
          this.hideLoading();
          const format = response.headers.get("Content-Type");
          if (format === "text/csv") {
            response.text().then((text) => {
              this.csv = text;
              this.showTable();
            });
          }
        } catch (error) {
          this.showError(error?.message || error);
        }
      },

      /** Renders a download button */
      renderDownloadButton() {
        const view = this;
        const downloadButton = document.createElement("a");
        downloadButton.textContent = DOWNLOAD_BUTTON_TEXT;
        downloadButton.classList.add(...CLASS_NAMES.downloadButton);
        const icon = document.createElement("i");
        icon.classList.add(...CLASS_NAMES.downloadIcon);
        downloadButton.appendChild(icon);
        downloadButton.onclick = (e) => {
          e.preventDefault();
          const response = view.response.clone();
          view.model.downloadFromResposne(response);
        };
        this.buttonContainer.appendChild(downloadButton);
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
        this.el.appendChild(this.table.render().el);
      },
    },
  );

  return DataObjectView;
});
