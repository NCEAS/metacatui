/* global define */
define([
  "backbone",
  "models/metadata/eml211/EMLMissingValueCode",
  "collections/metadata/eml/EMLMissingValueCodes",
  "views/metadata/EML211MissingValueView",
], function (
  Backbone,
  EMLMissingValueCode,
  EMLMissingValueCodes,
  EML211MissingValueView
) {
  /**
   * @class EMLMissingValuesView
   * @classdesc An EMLMissingValuesView provides an editing interface for an EML
   * Missing Value Codes collection. For each missing value code, the view
   * provides two inputs, one of the code and one for the code explanation. Each
   * missing value code can be removed from the collection by clicking the
   * "Remove" button next to the code. A new row of inputs will automatically be
   * added to the view when the user starts typing in the last row of inputs.
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLMissingValuesView.png
   * @extends Backbone.View
   * @since x.x.x
   */
  var EMLMissingValuesView = Backbone.View.extend(
    /** @lends EMLMissingValuesView.prototype */ {
      tagName: "div",

      /**
       * The type of View this is
       * @type {string}
       */
      type: "EMLMissingValueCodesView",

      /**
       * The className to add to the view container
       * @type {string}
       */
      className: "eml-missing-values",

      /**
       * The classes to add to the HTML elements in this view
       * @type {Object}
       * @property {string} title - The class to add to the title element
       * @property {string} description - The class to add to the description
       * paragraph element
       * @property {string} notification - The class to add to the validation
       * message container element
       * @property {string} rows - The class to add to the container element for
       * the missing value code rows
       */
      classes: {
        title: "",
        description: "subtle",
        notification: "notification",
        rows: "eml-missing-value-rows",
      },

      /**
       * User-facing text strings that will be displayed in this view.
       * @type {Object}
       * @property {string} title - The title text for this view
       * @property {string[]} description - The description text for this view.
       * Each string in the array will be rendered as a separate paragraph.
       */
      text: {
        title: "Missing Value Codes",
        description: [
          `Specify the symbols or codes used to denote missing or
          unavailable data in this attribute. Enter the symbol or number
          representing the missing data along with a brief description
          of why this code is used.`,
          `Examples: "-9999, Sensor down time" or "NA, record not available"`,
        ]
      },

      /**
       * Creates a new EMLMissingValuesView
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttribute} [options.collection] - The EMLMissingValueCodes
       * collection to render in this view
       */
      initialize: function (options) {
        if (!options || typeof options != "object") options = {};
        this.collection = options.collection || new EMLMissingValueCodes();
      },

      /**
       * Renders this view
       * @return {EMLMissingValuesView} A reference to this view
       */
      render: function () {
        if (!this.collection) {
          console.warn(
            `The EMLMissingValuesView requires a MissingValueCodes collection` +
              ` to render.`
          );
          return;
        }
        this.setListeners();
        this.el.innerHTML = "";
        this.el.setAttribute("data-category", "missingValueCodes");
        this.renderText();
        this.renderRows();

        return this;
      },

      /**
       * Add the title, description, and placeholder for a validation message.
       */
      renderText: function () {

        this.title = document.createElement("h5");
        this.title.innerHTML = this.text.title;
        this.el.appendChild(this.title);

        this.text.description.forEach(descText => {
          this.description = document.createElement("p");
          this.description.classList.add(this.classes.description);
          this.description.innerHTML = descText;
          this.el.appendChild(this.description);
        });

        this.notification = document.createElement("p");
        this.notification.classList.add(this.classes.notification);
        this.el.appendChild(this.notification);

      },

      /**
       * Renders the rows for each missing value code in the collection, and
       * adds a new row for entry of a new missing value code.
       */
      renderRows: function () {
        // Create the div to hold each row
        this.rows = document.createElement("div");
        this.rows.classList.add(this.classes.rows);
        this.el.appendChild(this.rows);

        this.collection.each((model) => {
          this.addRow(model);
        });
        // For entry of new values
        this.addNewRow();
      },

      /**
       * Add a new, empty Missing Value Code model to the collection. This will
       * trigger the creation of a new row in the view.
       */
      addNewRow: function () {
        this.collection.add(new EMLMissingValueCode());
      },

      /**
       * Set listeners required for this view
       */
      setListeners: function () {
        this.removeListeners();
        // Add a row to the view when a model is added to the collection
        this.listenTo(this.collection, "add", this.addRow);
        // Make sure that removed models are removed from the view
        this.listenTo(this.collection, "remove", this.removeRow);
      },

      /**
       * Remove listeners that were previously set for this view
       */
      removeListeners: function () {
        this.stopListening(this.collection, "add");
        this.stopListening(this.collection, "remove");
      },

      /**
       * Tests is a model should be considered "new" for the purposes of
       * displaying it in the view. A "new" model is used to render a blank row
       * in the view for entry of a new missing value code. We consider it new
       * if it's the last in the collection and both attributes are blank.
       * @param {EMLMissingValueCode} model - The model to test
       * @return {boolean} Whether or not the model is new
       */
      modelIsNew: function (model) {
        if (!model || !model.collection) return false;
        const i = model.collection.indexOf(model);
        const isLast = i === model.collection.length - 1;
        return isLast && model.isEmpty();
      },

      /**
       * Creates a new row view for a missing value code model and inserts it
       * into this view at the end.
       * @param {EMLMissingValueCode} model - The model to create a row for
       * @returns {EML211MissingValueView} The row view that was created
       */
      addRow: function (model) {
        if (!model instanceof EMLMissingValueCode) return;

        // New rows will not have a remove button until the user starts typing
        const isNew = this.modelIsNew(model);

        // Create and render the row view
        const rowView = new EML211MissingValueView({
          model: model,
          isNew: isNew,
        }).render();

        // Add the model ID to the row view so we can match it to the model
        // Used by this.removeRow()
        rowView.el.setAttribute("data-model-id", model.cid);

        // Insert the row into the view
        this.rows.append(rowView.el);

        // If a user types in the last row, add a new row
        if (isNew) {
          this.listenToOnce(rowView, "change:isNew", this.addNewRow);
        }
      },

      /**
       * Removes a row view from this view
       * @param {EMLMissingValueCode} model - The model to remove a row for
       * @returns {EML211MissingValueView} The row view that was removed
       */
      removeRow: function (model) {
        if (!model instanceof EMLMissingValueCode) return;
        const rowView = this.el.querySelector(
          `[data-model-id="${model.cid}"]`
        );
        if (rowView) {
          rowView.remove();
          return rowView;
        }
      },

      /**
       * Shows validation errors on this view
       */
      showValidation: function () {
        //TODO
      },

      /**
       * Hides validation errors on this view
       * @param {Event} e - The event that was triggered by the user
       */
      hideValidation: function () {
        // TODO
      },
    }
  );

  return EMLMissingValuesView;
});
