"use strict";

define(["backbone"], (Backbone) => {
  const BLOCK = "export-panel";

  const TEMPLATE = `
    <div class="${BLOCK}__header">
      <div class="${BLOCK}__title-group">
        <i class="icon-camera ${BLOCK}__icon"></i>
        <h3 class="${BLOCK}__title">Export map</h3>
      </div>
      <button class="map-view__button ${BLOCK}__close-button" type="button" data-action="cancel" aria-label="Cancel export" title="Cancel export">
        <i class="icon-remove"></i>
      </button>
    </div>
    <p class="${BLOCK}__instructions">
      Pan and zoom to position the map inside the dashed frame. Right-click and drag, or Ctrl-click and drag, to rotate it.
      Resize your browser window to adjust the size of the frame. The legend, scale bar and north arrow shown will be in
      the saved PNG. Data citations will be appended beneath the map.
    </p>
    <p class="${BLOCK}__details" data-role="details"></p>
    <ul class="${BLOCK}__notices" data-role="notices" hidden></ul>
    <p class="${BLOCK}__status" data-role="status" role="status" aria-live="polite"></p>
    <div class="${BLOCK}__actions">
      <button class="map-view__button ${BLOCK}__button" type="button" data-action="cancel">Cancel</button>
      <button class="map-view__button map-view__button--active ${BLOCK}__button ${BLOCK}__save" type="button" data-action="save">Save PNG</button>
    </div>`;

  /**
   * @class ExportPanelView
   * @classdesc The panel that is docked at the bottom of the map toolbar while the
   * map is being exported. It explains how to position the map, reports the size
   * of the image and anything that will be left out or reduced, and has the Save
   * and Cancel buttons. It does not change the map; the
   * {@link MapExportController} listens to its events.
   * @classcategory Views/Maps/Export
   * @name ExportPanelView
   * @augments Backbone.View
   * @screenshot views/maps/export/ExportPanelView.png
   * @since 0.0.0
   * @constructs
   * @fires ExportPanelView#save
   * @fires ExportPanelView#cancel
   */
  const ExportPanelView = Backbone.View.extend(
    /** @lends ExportPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ExportPanelView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: BLOCK,

      /** @inheritdoc */
      events: {
        "click [data-action='save']": "handleSave",
        "click [data-action='cancel']": "handleCancel",
      },

      /**
       * Renders this view
       * @returns {ExportPanelView} Returns the rendered view
       */
      render() {
        this.el.innerHTML = TEMPLATE;
        return this;
      },

      /**
       * @param {string} role The value of the element's data-role attribute.
       * @returns {HTMLElement|null} The element.
       */
      getPart(role) {
        return this.el.querySelector(`[data-role='${role}']`);
      },

      /**
       * @returns {HTMLButtonElement|null} The Save button.
       */
      getSaveButton() {
        return this.el.querySelector("[data-action='save']");
      },

      /**
       * Show the size of the image that will be saved.
       * @param {{width: number, height: number}|null} size The size in pixels,
       * or null when it is not known.
       */
      setOutputSize(size) {
        const el = this.getPart("details");
        if (!el) return;
        el.textContent = size
          ? `Image size: ${size.width.toLocaleString()} \u00d7 ${size.height.toLocaleString()} px`
          : "";
      },

      /**
       * Show things the user should know about, such as layers that did not fit
       * in the legend.
       * @param {string[]} messages The messages. Pass none to hide the list.
       */
      setNotices(messages) {
        const list = this.getPart("notices");
        if (!list) return;
        list.replaceChildren(
          ...messages.map((message) => {
            const item = document.createElement("li");
            item.textContent = message;
            return item;
          }),
        );
        list.hidden = messages.length === 0;
      },

      /**
       * Show progress or an error message. The message is announced by screen
       * readers.
       * @param {string} message The message. Pass an empty string to clear it.
       * @param {object} [options] Options.
       * @param {boolean} [options.isError] True to style the message as an error.
       */
      setStatus(message, { isError = false } = {}) {
        const el = this.getPart("status");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle(`${BLOCK}__status--error`, isError);
      },

      /**
       * Enable or disable the Save button.
       * @param {boolean} enabled Whether the button is enabled.
       */
      setSaveEnabled(enabled) {
        const button = this.getSaveButton();
        if (button) button.disabled = !enabled;
      },

      /**
       * Called when the Save button is clicked.
       * @param {Event} event The click event.
       */
      handleSave(event) {
        event.preventDefault();
        /**
         * @event ExportPanelView#save
         */
        this.trigger("save");
      },

      /**
       * Called when the Cancel button or the close button is clicked.
       * @param {Event} event The click event.
       */
      handleCancel(event) {
        event.preventDefault();
        /**
         * @event ExportPanelView#cancel
         */
        this.trigger("cancel");
      },
    },
  );

  return ExportPanelView;
});
