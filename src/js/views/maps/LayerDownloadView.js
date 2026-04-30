"use strict";

define(["underscore", "backbone"], (_, Backbone) => {
  const BASE_CLASS = "layer-download";

  // HTML classes used inside this view
  const CLASS_NAMES = {
    header: `${BASE_CLASS}__header`,
    checkbox: `${BASE_CLASS}__checkbox`,
    title: `${BASE_CLASS}__title`,
    content: `${BASE_CLASS}__content`,

    dropdown: "downloads-dropdown",
    resolutionDropdown: "resolution-dropdown",
    fileTypeDropdown: "fileType-downloads-dropdown",
    dropdownWrapper: "downloads-dropdown-wrapper",
    dropdownContainer: "downloads-dropdown-container",
    fileSizeBox: "downloads-textbox",
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
        return this.$el.hasClass("show-content");
      },

      /** Show the content section without changing the checkbox state. */
      expand() {
        this.$el.addClass("show-content");
      },

      /** Hide the content section without changing the checkbox state. */
      collapse() {
        this.$el.removeClass("show-content");
      },

      /**
       * Reset both dropdowns to their default/disabled state and clear the
       * file-size label.
       */
      resetDropdowns() {
        const { dropdownOptions } = this.downloadPanelView;
        if (this.resolutionDropdown) {
          this.resolutionDropdown.value =
            dropdownOptions.resolution.defaultValue;
        }
        if (this.fileTypeDropdown) {
          this.fileTypeDropdown.disabled = true;
          this.fileTypeDropdown.value = dropdownOptions.fileType.defaultValue;
        }
        this.selectedResolution = "";
        this.selectedFileType = "";
        if (this.fileSizeInfoBox) {
          this.fileSizeInfoBox.textContent =
            "Select resolution and file format to download...";
          this.fileSizeInfoBox.classList.remove("error", "wmts-copy");
          this.fileSizeInfoBox.classList.add("downloads-textbox--warning");
        }
      },

      /**
       * Render the complete panel: a header row with [checkbox] [title] [caret]
       * and a collapsible content section with the download controls.
       * @returns {LayerDownloadView} this
       */
      render() {
        this.$el.empty();
        const view = this;
        const { item, downloadPanelView } = this;

        // ── Header row ────────────────────────────────────────────────────────
        const header = document.createElement("div");
        header.classList.add(CLASS_NAMES.header);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add(CLASS_NAMES.checkbox);
        this.checkbox = checkbox;

        const titleSpan = document.createElement("span");
        titleSpan.classList.add(CLASS_NAMES.title);
        titleSpan.textContent = item.layerName;

        header.appendChild(checkbox);
        header.appendChild(titleSpan);

        // ── Content section ───────────────────────────────────────────────────
        const content = document.createElement("div");
        content.classList.add(CLASS_NAMES.content);

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
        const resolutionDropdownWrapper = document.createElement("div");
        resolutionDropdownWrapper.classList.add(CLASS_NAMES.dropdownWrapper);

        const resolutionDropdownId = `resolution-dropdown-${item.layerID}`;
        const resolutionLabel = document.createElement("label");
        resolutionLabel.textContent =
          downloadPanelView.dropdownOptions.resolution.label;
        resolutionLabel.htmlFor = resolutionDropdownId;

        const resolutionDropdown = document.createElement("select");
        resolutionDropdown.id = resolutionDropdownId;
        resolutionDropdown.classList.add(
          CLASS_NAMES.dropdown,
          CLASS_NAMES.resolutionDropdown,
        );

        const defaultResolutionOption = document.createElement("option");
        defaultResolutionOption.value =
          downloadPanelView.dropdownOptions.resolution.defaultValue;
        defaultResolutionOption.textContent =
          downloadPanelView.dropdownOptions.resolution.defaultText;
        defaultResolutionOption.disabled = true;
        defaultResolutionOption.selected = true;
        resolutionDropdown.appendChild(defaultResolutionOption);

        Object.entries(downloadPanelView.zoomLevels).forEach(
          ([zoomLevel, pixelResolution]) => {
            const option = document.createElement("option");
            option.value = zoomLevel;
            option.textContent = `${zoomLevel} - ${pixelResolution}`;
            resolutionDropdown.appendChild(option);
          },
        );

        resolutionDropdownWrapper.appendChild(resolutionLabel);
        resolutionDropdownWrapper.appendChild(resolutionDropdown);
        this.resolutionDropdown = resolutionDropdown;

        // File-type dropdown
        const fileTypeDropdownWrapper = document.createElement("div");
        fileTypeDropdownWrapper.classList.add(CLASS_NAMES.dropdownWrapper);

        const fileTypeDropdownId = `fileType-dropdown-${item.layerID}`;
        const fileTypeLabel = document.createElement("label");
        fileTypeLabel.textContent =
          downloadPanelView.dropdownOptions.fileType.label;
        fileTypeLabel.htmlFor = fileTypeDropdownId;

        const fileTypeDropdown = document.createElement("select");
        fileTypeDropdown.id = fileTypeDropdownId;
        fileTypeDropdown.classList.add(
          CLASS_NAMES.dropdown,
          CLASS_NAMES.fileTypeDropdown,
        );
        fileTypeDropdown.disabled = true; // enabled only once a resolution is chosen

        const defaultFileTypeOption = document.createElement("option");
        defaultFileTypeOption.value =
          downloadPanelView.dropdownOptions.fileType.defaultValue;
        defaultFileTypeOption.textContent =
          downloadPanelView.dropdownOptions.fileType.defaultText;
        defaultFileTypeOption.disabled = true;
        defaultFileTypeOption.selected = true;
        fileTypeDropdown.appendChild(defaultFileTypeOption);

        Object.entries(fileTypeOptions).forEach(([fileType, fileTypeName]) => {
          const option = document.createElement("option");
          option.value = fileType;
          option.textContent = fileTypeName;
          fileTypeDropdown.appendChild(option);
        });

        fileTypeDropdownWrapper.appendChild(fileTypeLabel);
        fileTypeDropdownWrapper.appendChild(fileTypeDropdown);
        this.fileTypeDropdown = fileTypeDropdown;

        const dropdownContainer = document.createElement("div");
        dropdownContainer.classList.add(CLASS_NAMES.dropdownContainer);
        dropdownContainer.appendChild(resolutionDropdownWrapper);
        dropdownContainer.appendChild(fileTypeDropdownWrapper);

        const fileSizeInfoBox = document.createElement("span");
        fileSizeInfoBox.classList.add(
          CLASS_NAMES.fileSizeBox,
          "downloads-textbox--warning",
        );
        fileSizeInfoBox.textContent =
          "Select resolution and file format to download...";
        this.fileSizeInfoBox = fileSizeInfoBox;

        content.appendChild(dropdownContainer);
        content.appendChild(fileSizeInfoBox);

        // ── Assemble ──────────────────────────────────────────────────────────
        this.el.appendChild(header);
        this.el.appendChild(content);

        // ── Event listeners ───────────────────────────────────────────────────

        // Checking the checkbox selects the layer and expands the content;
        // unchecking deselects, collapses, and resets the dropdowns.
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            view.isSelected = true;
            view.expand();
          } else {
            view.isSelected = false;
            view.collapse();
            view.resetDropdowns();
          }
          downloadPanelView.layerSelection();
        });

        // Resolution change: enable file-type dropdown, clear its value,
        // delete stale download links, update hint, recalculate button state
        resolutionDropdown.addEventListener("change", () => {
          view.selectedResolution = resolutionDropdown.value;
          fileTypeDropdown.disabled = false;
          fileTypeDropdown.value = defaultFileTypeOption.value;
          view.selectedFileType = "";

          delete downloadPanelView.dataDownloadLinks[item.layerID];

          fileSizeInfoBox.textContent = "Select file format to download...";
          fileSizeInfoBox.classList.add("downloads-textbox--warning");
          fileSizeInfoBox.classList.remove("error", "wmts-copy");
          downloadPanelView.layerSelection();
        });

        // File-type change: recalculate file size and notify parent
        fileTypeDropdown.addEventListener("change", () => {
          view.selectedFileType = fileTypeDropdown.value;
          fileSizeInfoBox.classList.remove("downloads-textbox--warning");
          downloadPanelView.fileTypeSelection(item.layerID);
          const fileSize = downloadPanelView.getRawFileSize(
            resolutionDropdown.value,
            fileTypeDropdown.value,
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
            fileSizeInfoBox,
            fileSize,
            fileTypeDropdown.value,
            item.layerID,
          );
        });

        return this;
      },
    },
  );

  return LayerDownloadView;
});
