"use strict";

define(["underscore", "backbone", "text!templates/maps/layer-download.html"], (
  _,
  Backbone,
  Template,
) => {
  const BASE_CLASS = "layer-download";

  // HTML classes used inside this view
  const CLASS_NAMES = {
    header: `${BASE_CLASS}__header`,
    checkbox: `${BASE_CLASS}__checkbox`,
    title: `${BASE_CLASS}__title`,
    content: `${BASE_CLASS}__content`,
    contentVisible: `${BASE_CLASS}__content--visible`,
    dropdown: `${BASE_CLASS}__dropdown`,
    resolutionDropdown: `${BASE_CLASS}__dropdown--resolution`,
    fileTypeDropdown: `${BASE_CLASS}__dropdown--file-type`,
    dropdownLabel: `${BASE_CLASS}__dropdown-label`,
    dropdownWrapper: `${BASE_CLASS}__dropdown-wrapper`,
    dropdownContainer: `${BASE_CLASS}__dropdown-container`,
    information: `${BASE_CLASS}__information`,
    informationWarning: `${BASE_CLASS}__information--warning`,
    informationWmts: `${BASE_CLASS}__information--wmts`,
    error: "error",
  };

  const MESSAGES = {
    selectResolutionAndFormat:
      "Select resolution and file format to download...",
    selectFormat: "Select file format to download...",
  };

  /**
   * @class LayerDownloadView
   * @classdesc A self-contained panel row for a single downloadable map layer.
   * Renders a header with a checkbox (for selection) and the layer name, plus
   * a content area with resolution and file-format dropdowns and a file-size
   * label. The label shows an orange warning when dropdowns are incomplete and
   * switches to a success state once a format is chosen.
   * @classcategory Views/Maps
   * @name LayerDownloadView
   * @augments Backbone.View
   * @since 0.0.0
   * @screenshot views/maps/LayerDownloadView.png
   * @constructs LayerDownloadView
   */
  const LayerDownloadView = Backbone.View.extend(
    /** @lends LayerDownloadView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerDownloadView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The primary HTML template for this view.
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /** @inheritdoc */
      events: {
        [`change .${CLASS_NAMES.checkbox}`]: "handleCheckboxChange",
        [`change .${CLASS_NAMES.resolutionDropdown}`]: "handleResolutionChange",
        [`change .${CLASS_NAMES.fileTypeDropdown}`]: "handleFileTypeChange",
      },

      /**
       * Initialise the view.
       * @param {object} options - Options for the view.
       * @param {object} options.item - The layer data object for this row.
       * @param {DownloadPanelView} options.downloadPanelView - Reference to
       *   the parent view for shared logic (save-button state, file-size).
       */
      initialize({ item, downloadPanelView }) {
        this.item = item;
        this.downloadPanelView = downloadPanelView;
        /** Whether the layer is currently selected for download. */
        this.isSelected = false;
        /** The currently selected resolution zoom level (string). */
        this.selectedResolution = "";
        /** The currently selected file type (e.g. "png", "tif"). */
        this.selectedFileType = "";
      },

      /** @returns {boolean} Whether the content section is currently visible. */
      isExpanded() {
        return (
          this.contentEl?.classList.contains(CLASS_NAMES.contentVisible) ??
          false
        );
      },

      /** Show the content section without changing the checkbox state. */
      expand() {
        this.contentEl?.classList.add(CLASS_NAMES.contentVisible);
      },

      /** Hide the content section without changing the checkbox state. */
      collapse() {
        this.contentEl?.classList.remove(CLASS_NAMES.contentVisible);
      },

      /**
       * Reset both dropdowns to their default/disabled state and clear the
       * file-size label.
       */
      resetDropdowns() {
        const { dropdownOptions } = this.downloadPanelView;
        if (this.resolutionDropdownEl) {
          this.resolutionDropdownEl.value =
            dropdownOptions.resolution.defaultValue;
        }
        if (this.fileTypeDropdownEl) {
          this.fileTypeDropdownEl.disabled = true;
          this.fileTypeDropdownEl.value = dropdownOptions.fileType.defaultValue;
        }
        this.selectedResolution = "";
        this.selectedFileType = "";
        if (this.informationEl) {
          this.informationEl.textContent = MESSAGES.selectResolutionAndFormat;
          this.informationEl.classList.remove(
            CLASS_NAMES.error,
            CLASS_NAMES.informationWmts,
          );
          this.informationEl.classList.add(CLASS_NAMES.informationWarning);
        }
      },

      /**
       * Handles changes to the layer checkbox. If checked, selects the layer
       * and expands the content; if unchecked, deselects, collapses, and resets
       * the dropdowns.
       */
      handleCheckboxChange() {
        if (this.checkboxEl.checked) {
          this.isSelected = true;
          this.expand();
        } else {
          this.isSelected = false;
          this.collapse();
          this.resetDropdowns();
        }
        this.downloadPanelView.layerSelection();
      },

      /**
       * Handles changes to the resolution dropdown. Enables the file-type
       * dropdown, clears the file-type selection, removes stale download links,
       * and updates the info box and save-button state.
       */
      handleResolutionChange() {
        this.selectedResolution = this.resolutionDropdownEl.value;
        this.fileTypeDropdownEl.disabled = false;
        this.fileTypeDropdownEl.value =
          this.downloadPanelView.dropdownOptions.fileType.defaultValue;
        this.selectedFileType = "";
        delete this.downloadPanelView.dataDownloadLinks[this.item.layerID];
        this.informationEl.textContent = MESSAGES.selectFormat;
        this.informationEl.classList.add(CLASS_NAMES.informationWarning);
        this.informationEl.classList.remove(
          CLASS_NAMES.error,
          CLASS_NAMES.informationWmts,
        );
        this.downloadPanelView.layerSelection();
      },

      /**
       * Handles changes to the file-type dropdown. Calculates the estimated
       * file size and updates the info box and save-button state.
       */
      handleFileTypeChange() {
        const { item, downloadPanelView } = this;
        this.selectedFileType = this.fileTypeDropdownEl.value;
        this.informationEl.classList.remove(CLASS_NAMES.informationWarning);
        downloadPanelView.fileTypeSelection(item.layerID);
        const fileSize = downloadPanelView.getRawFileSize(
          this.resolutionDropdownEl.value,
          this.fileTypeDropdownEl.value,
          item.layerID,
          item.fullDownloadLink,
          item.pngDownloadLink,
          item.gpkgDownloadLink,
          item.ID,
          item.layerName,
          item.wmtsDownloadLink,
          item.metadataPid,
          item.tiffDownloadLink,
        );
        downloadPanelView.updateTextbox(
          this.informationEl,
          fileSize,
          this.fileTypeDropdownEl.value,
          item.layerID,
        );
      },

      /**
       * Render the complete panel: a header row with [checkbox] [title] and
       * a collapsible content section with the download controls.
       * @returns {LayerDownloadView} this
       */
      render() {
        const { item, downloadPanelView } = this;
        const { dropdownOptions, zoomLevels } = downloadPanelView;
        const resolutionDropdownId = `resolution-dropdown-${item.layerID}`;
        const fileTypeDropdownId = `fileType-dropdown-${item.layerID}`;

        this.el.innerHTML = this.template({
          layerName: item.layerName,
          resolutionDropdownId,
          resolutionLabel: dropdownOptions.resolution.label,
          resolutionDefaultValue: dropdownOptions.resolution.defaultValue,
          resolutionDefaultText: dropdownOptions.resolution.defaultText,
          fileTypeDropdownId,
          fileTypeLabel: dropdownOptions.fileType.label,
          fileTypeDefaultValue: dropdownOptions.fileType.defaultValue,
          fileTypeDefaultText: dropdownOptions.fileType.defaultText,
          initialMessage: MESSAGES.selectResolutionAndFormat,
        });

        // Cache element references for use in event handlers and helper methods
        this.checkboxEl = this.el.querySelector(`.${CLASS_NAMES.checkbox}`);
        this.resolutionDropdownEl = this.el.querySelector(
          `.${CLASS_NAMES.resolutionDropdown}`,
        );
        this.fileTypeDropdownEl = this.el.querySelector(
          `.${CLASS_NAMES.fileTypeDropdown}`,
        );
        this.informationEl = this.el.querySelector(
          `.${CLASS_NAMES.information}`,
        );
        this.contentEl = this.el.querySelector(`.${CLASS_NAMES.content}`);

        // Append zoom-level options to the resolution dropdown
        Object.entries(zoomLevels).forEach(([zoomLevel, pixelResolution]) => {
          const option = document.createElement("option");
          option.value = zoomLevel;
          option.textContent = `${zoomLevel} - ${pixelResolution}`;
          this.resolutionDropdownEl.appendChild(option);
        });

        // Append only file-type options that have a corresponding download link
        [
          [item.tiffDownloadLink, "tif", "Geotiff"],
          [item.pngDownloadLink, "png", "PNG"],
          [item.wmtsDownloadLink, "wmts", "WMTS file"],
          [item.gpkgDownloadLink, "gpkg", "Geopackage"],
        ].forEach(([link, value, text]) => {
          if (link == null) return;
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          this.fileTypeDropdownEl.appendChild(option);
        });

        return this;
      },
    },
  );

  return LayerDownloadView;
});
