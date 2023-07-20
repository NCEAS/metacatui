/* global define */
define(["backbone", "models/metadata/eml211/EMLMissingValueCode"], function (
  Backbone,
  EMLMissingValueCode
) {
  /**
   * @class EMLMissingValueView
   * @classdesc An EMLMissingValueView provides an editing interface for a
   * single EML Missing Value Code. The view provides two inputs, one of the
   * code and one for the code explanation. If the model is part of a
   * collection, the view will also provide a button to remove the model from
   * the collection.
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLMissingValueView.png // <- TODO
   * @extends Backbone.View
   * @since x.x.x
   */
  var EMLMissingValueView = Backbone.View.extend(
    /** @lends EMLMissingValueView.prototype */ {
      tagName: "div",

      /**
       * The className to add to the view container
       * @type {string}
       */
      className: "eml-missing-values",

      /**
       * The classes to add to the HTML elements in this view
       * @type {Object}
       * @property {string} removeButton - The class to add to the remove button
       */
      classes: {
        removeButton: "remove",
        codeInput: "code",
        codeExplanationInput: "codeExplanation",
      },

      /**
       * User-facing text strings that will be displayed in this view.
       * @type {Object}
       * @property {string} codePlaceholder - The placeholder text for the code
       * input
       * @property {string} codeExplanationPlaceholder - The placeholder text
       * for the code explanation input
       */
      text: {
        codePlaceholder: "Missing Value Code",
        codeExplanationPlaceholder: "Missing Value Code Explanation",
      },

      /**
       * Set this to true if this row is for a blank input row. This will
       * prevent the view from rendering a remove button until the user starts
       * typing.
       * @type {boolean}
       * @default false
       */
      isNew: false,

      /**
       * Creates a new EMLMissingValueView
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttribute} [options.model] - The EMLMissingValueCode model
       * to render. If no model is provided, an empty model will be created.
       */
      initialize: function (options) {
        if (!options || typeof options != "object") options = {};
        this.model = options.model || new EMLMissingValueCode();
        this.isNew = options.isNew === true;
      },

      /**
       * Renders this view
       * @return {EMLMissingValueView} A reference to this view
       */
      render: function () {
        try {
          if (!this.model) {
            console.warn(
              "An EMLMissingValueView model is required to render this view."
            );
            return this;
          }

          this.el.innerHTML = "";

          this.renderInput("code");
          this.renderInput("codeExplanation");

          // Don't show a remove button if the model is marked as new
          if (!this.isNew) {
            this.renderRemoveButton();
          }

          // Set a listener for when the user types anything
          this.setListeners();

          return this;
        } catch (error) {
          console.log("Error rendering EMLMissingValueView", error);
        }
      },

      /**
       * Set listeners on the view's DOM elements
       */
      setListeners: function () {
        this.removeListeners();
        // Listen for typing in inputs
        this.el.addEventListener("input", this.handleTyping.bind(this));
      },

      /**
       * Remove listeners from the view's DOM elements
       */
      removeListeners: function () {
        this.el.removeEventListener("input", this.handleTyping.bind(this));
      },

      /**
       * When a user types anything into any input, update the model and show
       * the remove button if it was not yet rendered.
       * @param {Event} e - The event that was triggered by the user
       */
      handleTyping: function (e) {
        // If the user has typed in a new row, render a remove button and mark
        // the row as no longer new
        if (this.isNew) {
          this.trigger("change:isNew");
          this.isNew = false;
          if (!this.removeButton) {
            this.renderRemoveButton();
          }
        }
        // Update the model with the new value in whichever input was typed in
        this.updateModelFromInput(e.target.name);
      },

      /**
       * Create and insert the input element for one of the model's attributes.
       * This will add the input to the end of the view's element.
       * @param {string} attr - The name of the attribute to create an input
       * for, either "code" or "codeExplanation"
       * @return {Element} The input element
       */
      renderInput(attr) {
        if (!this.model) return;
        const elName = `${attr}Input`;
        const placeholder = this.text[`${attr}Placeholder`];
        const classStr = this.classes[elName];
        if (this[elName]) this[elName].remove();
        const input = document.createElement("input");
        input.classList.add(classStr);
        input.setAttribute("type", "text");
        input.setAttribute("name", attr);
        input.setAttribute("placeholder", placeholder);
        input.setAttribute("value", this.model.get(attr));
        this.el.appendChild(input);
        this[elName] = input;
        return input;
      },

      /**
       * Create and insert the remove button
       * @return {Element} The remove button
       */
      renderRemoveButton: function () {
        // The model must be part of a collection to remove it from anything
        if (!this.model.collection) return;
        if (this.button) this.button.remove();
        const button = document.createElement("button");
        button.setAttribute("type", "button");
        button.classList.add(this.classes.removeButton);
        button.textContent = "Remove";
        this.el.appendChild(button);
        this.button = button;
        // remove self when the button is clicked
        button.addEventListener("click", this.removeSelf.bind(this));
        return button;
      },

      /**
       * Update the model with the value in the input
       * @param {string} attr - The name of the attribute to update, either
       * "code" or "codeExplanation"
       * @return {string} The new value
       */
      updateModelFromInput: function (attr) {
        if (!this.model) return;
        const newVal = this[`${attr}Input`]?.value;
        this.model.set(attr, newVal);
        return newVal;
      },

      /**
       * Remove this view from the DOM and collection and remove any event
       * listeners
       */
      removeSelf: function () {
        this.removeListeners();
        // Remove the model from the collection, if it exists
        if (this.model.collection) {
          this.model.collection.remove(this.model);
        }
        // Remove the view from the DOM
        this.remove();
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

  return EMLMissingValueView;
});
