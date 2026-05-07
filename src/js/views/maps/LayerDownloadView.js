"use strict";

define(["underscore", "backbone"], (_, Backbone) => {
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

      /** @inheritdoc */
      events() {
        const CN = CLASS_NAMES;
        return {
          [`change .${CN.checkbox}`]: "handleCheckboxChange",
          [`change .${CN.resolutionDropdown}`]: "handleResolutionChange",
          [`change .${CN.fileTypeDropdown}`]: "handleFileTypeChange",
        };
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
       * Render the complete panel: a header row with [checkbox] [title] [caret]
       * and a collapsible content section with the download controls.
       * @returns {LayerDownloadView} this
       */
      render() {
        this.$el.empty();
        const { item, downloadPanelView } = this;

        // ── Header row ────────────────────────────────────────────────────────
        const headerEl = document.createElement("div");
        headerEl.classList.add(CLASS_NAMES.header);

        const checkboxEl = document.createElement("input");
        checkboxEl.type = "checkbox";
        checkboxEl.classList.add(CLASS_NAMES.checkbox);

        const titleEl = document.createElement("span");
        titleEl.classList.add(CLASS_NAMES.title);
        titleEl.textContent = item.layerName;

        headerEl.appendChild(checkboxEl);
        headerEl.appendChild(titleEl);

        // ── Content section ───────────────────────────────────────────────────
        const contentEl = document.createElement("div");
        contentEl.classList.add(CLASS_NAMES.content);

        // Pruned file-type options per layer configuration
        const fileTypeOptions = {
          tif: "Geotiff",
          png: "PNG",
          wmts: "WMTS file",
          gpkg: "Geopackage",
        };
        if (item.tiffDownloadLink == null) delete fileTypeOptions.tif;
        if (item.pngDownloadLink == null) delete fileTypeOptions.png;
        if (item.wmtsDownloadLink == null) delete fileTypeOptions.wmts;
        if (item.gpkgDownloadLink == null) delete fileTypeOptions.gpkg;

        // Resolution dropdown
        const resolutionDropdownWrapperEl = document.createElement("div");
        resolutionDropdownWrapperEl.classList.add(CLASS_NAMES.dropdownWrapper);

        const resolutionDropdownId = `resolution-dropdown-${item.layerID}`;
        const resolutionLabelEl = document.createElement("label");
        resolutionLabelEl.classList.add(CLASS_NAMES.dropdownLabel);
        resolutionLabelEl.textContent =
          downloadPanelView.dropdownOptions.resolution.label;
        resolutionLabelEl.htmlFor = resolutionDropdownId;

        const resolutionDropdownEl = document.createElement("select");
        resolutionDropdownEl.id = resolutionDropdownId;
        resolutionDropdownEl.classList.add(
          CLASS_NAMES.dropdown,
          CLASS_NAMES.resolutionDropdown,
        );

        const defaultResolutionOptionEl = document.createElement("option");
        defaultResolutionOptionEl.value =
          downloadPanelView.dropdownOptions.resolution.defaultValue;
        defaultResolutionOptionEl.textContent =
          downloadPanelView.dropdownOptions.resolution.defaultText;
        defaultResolutionOptionEl.disabled = true;
        defaultResolutionOptionEl.selected = true;
        resolutionDropdownEl.appendChild(defaultResolutionOptionEl);

        Object.entries(downloadPanelView.zoomLevels).forEach(
          ([zoomLevel, pixelResolution]) => {
            const option = document.createElement("option");
            option.value = zoomLevel;
            option.textContent = `${zoomLevel} - ${pixelResolution}`;
            resolutionDropdownEl.appendChild(option);
          },
        );

        resolutionDropdownWrapperEl.appendChild(resolutionLabelEl);
        resolutionDropdownWrapperEl.appendChild(resolutionDropdownEl);

        // File-type dropdown
        const fileTypeDropdownWrapperEl = document.createElement("div");
        fileTypeDropdownWrapperEl.classList.add(CLASS_NAMES.dropdownWrapper);

        const fileTypeDropdownId = `fileType-dropdown-${item.layerID}`;
        const fileTypeLabelEl = document.createElement("label");
        fileTypeLabelEl.classList.add(CLASS_NAMES.dropdownLabel);
        fileTypeLabelEl.textContent =
          downloadPanelView.dropdownOptions.fileType.label;
        fileTypeLabelEl.htmlFor = fileTypeDropdownId;

        const fileTypeDropdownEl = document.createElement("select");
        fileTypeDropdownEl.id = fileTypeDropdownId;
        fileTypeDropdownEl.classList.add(
          CLASS_NAMES.dropdown,
          CLASS_NAMES.fileTypeDropdown,
        );
        fileTypeDropdownEl.disabled = true; // enabled only once a resolution is chosen

        const defaultFileTypeOptionEl = document.createElement("option");
        defaultFileTypeOptionEl.value =
          downloadPanelView.dropdownOptions.fileType.defaultValue;
        defaultFileTypeOptionEl.textContent =
          downloadPanelView.dropdownOptions.fileType.defaultText;
        defaultFileTypeOptionEl.disabled = true;
        defaultFileTypeOptionEl.selected = true;
        fileTypeDropdownEl.appendChild(defaultFileTypeOptionEl);

        Object.entries(fileTypeOptions).forEach(([fileType, fileTypeName]) => {
          const option = document.createElement("option");
          option.value = fileType;
          option.textContent = fileTypeName;
          fileTypeDropdownEl.appendChild(option);
        });

        fileTypeDropdownWrapperEl.appendChild(fileTypeLabelEl);
        fileTypeDropdownWrapperEl.appendChild(fileTypeDropdownEl);

        const dropdownContainerEl = document.createElement("div");
        dropdownContainerEl.classList.add(CLASS_NAMES.dropdownContainer);
        dropdownContainerEl.appendChild(resolutionDropdownWrapperEl);
        dropdownContainerEl.appendChild(fileTypeDropdownWrapperEl);

        const informationEl = document.createElement("span");
        informationEl.classList.add(
          CLASS_NAMES.information,
          CLASS_NAMES.informationWarning,
        );
        informationEl.textContent = MESSAGES.selectResolutionAndFormat;

        contentEl.appendChild(dropdownContainerEl);
        contentEl.appendChild(informationEl);

        // ── Assemble ──────────────────────────────────────────────────────────
        this.checkboxEl = checkboxEl;
        this.resolutionDropdownEl = resolutionDropdownEl;
        this.fileTypeDropdownEl = fileTypeDropdownEl;
        this.informationEl = informationEl;
        this.contentEl = contentEl;
        this.el.appendChild(headerEl);
        this.el.appendChild(contentEl);

        return this;
      },
    },
  );

  return LayerDownloadView;
});
