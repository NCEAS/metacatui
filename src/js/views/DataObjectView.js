"use strict";

define([
  "underscore",
  "backbone",
  "models/SolrResult",
  "views/TableEditorView",
  "text!templates/loading.html",
  "text!templates/alert.html",
], (
  _,
  Backbone,
  SolrResult,
  TableEditorView,
  LoadingTemplate,
  AlertTemplate,
) => {
  // The classes used by this view
  const BASE_CLASS = "object-view";
  const CLASS_NAMES = {
    base: BASE_CLASS,
    well: "well", // Bootstrap class
    downloadButton: ["btn", "download"],
    downloadIcon: ["icon", "icon-cloud-download"],
    loadingContainer: ["notification", "loading"],
  };

  // User-facing text
  const DOWNLOAD_BUTTON_TEXT = "Download";
  const LOADING_MESSAGE = "Downloading data...";
  const PARSE_RESPONSE_MESSAGE = "Parsing data...";
  const ERROR_TITLE = "Uh oh 😕";
  const ERROR_MESSAGE =
    "There was an error displaying the object. Please try again later or send us an email.";
  const MORE_DETAILS_PREFIX = "<strong>More details: </strong>";
  const FILE_TYPE_ERROR = "This file type is not supported.";
  const FILE_SIZE_ERROR = "This file is too large to display.";
  const GETINFO_ERROR =
    "There was an error retrieving metadata for this data object.";

  // Fields for metadata values that we require to display the object
  const REQUIRED_FIELDS = ["formatId", "size"];
  const OPTIONAL_FIELDS = ["fileName"];

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
       * The file size limit for viewing files, in bytes. If the file is larger
       * than this limit, the object will not be displayed. Default is 20 megabytes.
       * @type {number|null}
       */
      sizeLimit: 20971520,

      /**
       * The data formats that are supported by this view, mapped to the
       * functions that render them, i.e. { renderFunction: [format1, format2]
       * }. Formats should include all relevant DataONE object formats as well
       * as the possible Content-Type values from the headers of the response.
       * @type {object}
       */
      formatMap: {
        renderTable: ["text/csv", "text/tsv", "text/tab-separated-values"],
      },

      /**
       * Initializes the DataObjectView
       * @param {object} options - Options for the view
       * @param {SolrResult} options.model - A SolrResult model
       * @param {string} options.id - The ID of the DataONE object to view. Used
       * to create a SolrResult model if one is not provided.
       * @param {Element} [options.buttonContainer] - The container for the
       * download button (defaults to the view's element)
       */
      initialize(options) {
        this.model = options.model;
        this.buttonContainer = options.buttonContainer || this.el;
        if (!this.model && options.id) {
          this.model = new SolrResult({ id: options.id });
        }
      },

      /**
       * Checks if the size and format of the object are valid
       * @returns {boolean|object} True if the size and format are valid, or an
       * object with error messages if they are not
       */
      isValidSizeAndFormat() {
        const format =
          this.model.get("formatId") || this.model.get("mediaType");
        const size = this.model.get("size");

        const sizeValid = !this.sizeLimit || size <= this.sizeLimit;

        const supportedFormats = Object.values(this.formatMap).flat();
        const formatValid = supportedFormats.includes(format);
        if (sizeValid && formatValid) {
          return true;
        }
        const errors = {};
        if (!sizeValid) {
          errors.sizeValid = FILE_SIZE_ERROR;
        }
        if (!formatValid) {
          errors.formatValid = FILE_TYPE_ERROR;
        }
        return errors;
      },

      /** @inheritdoc */
      render() {
        // If missing formatId, size, filename, query Solr first
        if (!this.hasRequiredMetadata()) {
          this.fetchMetadata(this.render);
          return this;
        }

        const valid = this.isValidSizeAndFormat();

        if (valid !== true) {
          this.showError(Object.values(valid).join(" "));
          return this;
        }
        this.$el.empty();
        this.showLoading(LOADING_MESSAGE);
        this.downloadObject()
          .then((response) => this.handleResponse(response))
          .catch((error) => this.showError(error?.message || error));
        return this;
      },

      /**
       * Checks if the model has the required metadata fields
       * @returns {boolean} True if the model has the required metadata fields
       * and they are not empty
       */
      hasRequiredMetadata() {
        if (!this.model) return false;
        return REQUIRED_FIELDS.every((field) => {
          const val = this.model.get(field);
          return val && val !== 0;
        });
      },

      /**
       * Fetches the metadata for the object
       * @param {Function} callback - The function to call when the metadata is
       * fetched
       */
      fetchMetadata(callback) {
        const view = this;
        const { model } = view;
        view.stopListening(model);
        const fields = REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).join(",");

        view.listenTo(model, "sync", () => {
          if (view.hasRequiredMetadata()) {
            callback.call(view);
          } else {
            view.showError(GETINFO_ERROR);
          }
          view.stopListening(model);
        });

        view.listenTo(model, "getInfoError", () => {
          view.showError(GETINFO_ERROR);
          view.stopListening(model);
        });

        model.getInfo(fields);
      },

      /**
       * Indicate that the data is loading
       * @param {string} [message] - The message to display while loading
       */
      showLoading(message) {
        this.$el.html(
          this.loadingTemplate({
            msg: message || LOADING_MESSAGE,
          }),
        );
        this.el.classList.add(CLASS_NAMES.well);
      },

      /** Remove the loading spinner */
      hideLoading() {
        this.el.classList.remove(CLASS_NAMES.well);
        this.$el.find(`.${CLASS_NAMES.loadingContainer.join(".")}`).remove();
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
          this.showLoading(PARSE_RESPONSE_MESSAGE);
          const format = response.headers.get("Content-Type");

          // Map format to render function
          const methods = this.formatMap;
          // Find the key which includes the format in the array value
          const method = Object.keys(methods).find((key) =>
            methods[key].includes(format),
          );
          if (!method) {
            throw new Error(FILE_TYPE_ERROR);
          }

          this[method](response);
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
          view.model.downloadFromResponse(response);
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

      /**
       * Shows the CSV file as a table
       * @param {Response} response - The response from the DataONE object API
       */
      renderTable(response) {
        response.text().then((text) => {
          this.csv = text;
          this.hideLoading();
          this.table = new TableEditorView({
            viewMode: true,
            csv: this.csv,
          });
          this.listenTo(this.table, "error", (message) => {
            this.showError(message);
            requestAnimationFrame(() => this.table.remove());
          });
          this.table.render();
          this.el.appendChild(this.table.el);
        });
      },
    },
  );

  return DataObjectView;
});
