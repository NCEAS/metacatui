"use strict";

define(["jquery", "backbone", "views/DataObjectView"], (
  $,
  Backbone,
  DataObjectView,
) => {
  // The base class for the view
  const BASE_CLASS = "view-data-button";
  const CLASS_NAMES = {
    base: [BASE_CLASS, "btn"],
    button: ["btn"],
    icon: ["icon", "icon-eye-open"],
    modal: ["modal", "hide", "fade", "full-screen"],
    header: ["modal-header"],
    closeButton: ["close"],
    body: ["modal-body"],
    footer: ["modal-footer"],
    titleIcon: ["icon", "icon-on-left"],
  };
  const BUTTON_TEXT = "View";
  const CLOSE_BUTTON_TEXT = "Close";

  /**
   * @class ViewDataButtonView
   * @classdesc Creates a button that opens a modal to view a DataONE object
   * (using the DataObjectView).
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @since 2.32.0
   * @screenshot views/ViewDataButtonView.png
   */
  const ViewDataButtonView = Backbone.View.extend(
    /** @lends ViewDataButtonView.prototype */
    {
      /** @inheritdoc */
      type: "ViewDataButtonView",

      /** @inheritdoc */
      className: CLASS_NAMES.base.join(" "),

      /** @inheritdoc */
      tagName: "a",

      /** @inheritdoc */
      events: {
        click: "openModal",
      },

      /**
       * A template for the modal that will be displayed when the button is
       * clicked. The modal will contain a DataObjectView.
       * @param {object} options - Options for the modal
       * @param {string} options.title - The title of the modal
       * @param {string} options.icon - The icon for the title
       * @returns {string} The HTML for the modal
       */
      modalTemplate({ title = "Data", icon = "file-text" } = {}) {
        const id = `modal-${this.model.cid}`;
        return `<div id="${id}" class="${CLASS_NAMES.modal.join(" ")}">
            <div class="${CLASS_NAMES.header.join(" ")}">
              <button type="button" class="${CLASS_NAMES.closeButton.join(" ")}" data-dismiss="modal">&times;</button>
              <h3><i class="${CLASS_NAMES.titleIcon.join(" ")} icon-${icon}"></i>${title}</h3>
            </div>
            <div class="${CLASS_NAMES.body.join(" ")}">
              <p>loading...</p>
            </div>
            <div class="${CLASS_NAMES.footer.join(" ")}">
              <button class="${CLASS_NAMES.button.join(" ")}" data-dismiss="modal" aria-hidden="true">${CLOSE_BUTTON_TEXT}</button>
            </div>
          </div>`;
      },

      /**
       * Initializes the ViewDataButtonView
       * @param {object} options - Options for the view
       */
      initialize(options) {
        this.model = options.model;
        this.modalContainer = options.modalContainer || document.body;
      },

      /**
       * @see DataObjectView#checkSizeAndFormat
       * @returns {boolean} True if the object is a valid type and size
       */
      isValidSizeAndFormat() {
        this.formatMap = DataObjectView.prototype.formatMap;
        this.sizeLimit = DataObjectView.prototype.sizeLimit;
        return DataObjectView.prototype.isValidSizeAndFormat.call(this);
      },

      /** @inheritdoc */
      render() {
        if (this.isValidSizeAndFormat() !== true) {
          this.el.style.display = "none";
          return this;
        }
        this.el.innerHTML = BUTTON_TEXT;
        const icon = document.createElement("i");
        icon.classList.add(...CLASS_NAMES.icon);
        this.el.appendChild(icon);
        return this;
      },

      /**
       * Renders the modal & DataObjectView
       * @returns {JQuery} The modal
       */
      renderModal() {
        const modalHTML = this.modalTemplate({
          title:
            this.model.get("title") || this.model.get("fileName") || "Data",
          icon: "table",
        });
        const modal = $(modalHTML).modal();
        const modalBody = modal.find(`.${CLASS_NAMES.body.join(".")}`);
        const modalFooter = modal.find(`.${CLASS_NAMES.footer.join(".")}`)[0];
        const objectView = new DataObjectView({
          model: this.model,
          buttonContainer: modalFooter,
        });
        modalBody.empty();
        modalBody.append(objectView.render().el);
        $(this.modalContainer).append(modal);
        return modal;
      },

      /**
       * Opens the modal. Called when the button is clicked.
       * @param {Event} e - The click event
       */
      openModal(e) {
        e.preventDefault();
        if (!this.modal) {
          this.modal = this.renderModal();
        }
        this.modal.modal("show");
      },
    },
  );

  return ViewDataButtonView;
});
