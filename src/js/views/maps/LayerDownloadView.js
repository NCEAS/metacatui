"use strict";

define(["underscore", "backbone"], (_, Backbone) => {
  // HTML classes used inside this view
  const CLASS_NAMES = {
    ƒ: "download-expansion-panel__checkbox",
    dropdown: "downloads-dropdown",
    resolutionDropdown: "resolution-dropdown",
    fileTypeDropdown: "fileType-downloads-dropdown",
    dropdownWrapper: "downloads-dropdown-wrapper",
    dropdownContainer: "downloads-dropdown-container",
    fileSizeBox: "downloads-textbox",
  };

  /**
   * @class LayerDownloadView
   * @classdesc Renders the download controls (checkbox, resolution and
   * file-type dropdowns, estimated file-size label) for a single map layer.
   * An instance of this view is passed as the `contentViewInstance` option of
   * an {@link ExpansionPanelView}, one per selected layer, inside
   * {@link DownloadPanelView}.
   * @classcategory Views/Maps
   * @name LayerDownloadView
   * @augments Backbone.View
   * @since 2.33.0
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
      className: "layer-download",

      /**
       * Initialise the view.
       * @param {object} options
       * @param {object} options.item - The layer data object for this row,
       *   as built in {@link DownloadPanelView#generatePreviewPanel}.
       * @param {DownloadPanelView} options.downloadPanelView - Reference to
       *   the parent DownloadPanelView so that shared logic (file-size
       *   calculation, save-button state) can be delegated to it.
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

      /**
       * Render the checkbox, resolution dropdown, file-type dropdown, and
       * file-size info label into this view's element.
       * @returns {LayerDownloadView} this
       */
      render() {
        const view = this;
        const { item, downloadPanelView } = this;

        // ── Checkbox ─────────────────────────────────────────────────────────
        // The checkbox is checked/unchecked automatically via onPanelOpen /
        // onPanelClose. It acts as a data carrier and visual indicator that
        // the layer is included in the next download.
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add(CLASS_NAMES.checkbox);

        // Attach all layer attributes for use in getRawFileSize / updateTextbox
        checkbox.dataset.layerId = item.layerID;
        checkbox.dataset.downloadLink = item.downloadLink;
        checkbox.dataset.layerName = item.layerName;
        checkbox.dataset.fullDownloadLink = item.fullDownloadLink;
        checkbox.dataset.pngDownloadLink = item.pngDownloadLink;
        checkbox.dataset.id = item.ID;
        checkbox.dataset.wmtsDownloadLink = item.wmtsDownloadLink;
        checkbox.dataset.gpkgDownloadLink = item.gpkgDownloadLink;
        checkbox.dataset.tiffDownloadLink = item.tiffDownloadLink;
        checkbox.dataset.metadataPid = item.metadataPid;
        this.checkbox = checkbox;

        // ── Available file-type options (pruned per layer config) ─────────────
        const fileTypeOptions = {
          tif: "Geotiff",
          png: "PNG",
          wmts: "WMTS file",
          gpkg: "Geopackage",
        };
        if (item.tiffDownloadLink == null) delete fileTypeOptions.tif;
        if (item.gpkgDownloadLink == null) delete fileTypeOptions.gpkg;

        // ── Resolution dropdown ───────────────────────────────────────────────
        const resolutionDropdownWrapper = document.createElement("div");
        resolutionDropdownWrapper.classList.add(CLASS_NAMES.dropdownWrapper);

        const resolutionLabel = document.createElement("label");
        resolutionLabel.textContent =
          downloadPanelView.dropdownOptions.resolution.label;

        const resolutionDropdown = document.createElement("select");
        resolutionDropdown.classList.add(CLASS_NAMES.dropdown);
        resolutionDropdown.classList.add(CLASS_NAMES.resolutionDropdown);

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

        // ── File-type dropdown ────────────────────────────────────────────────
        const fileTypeDropdownWrapper = document.createElement("div");
        fileTypeDropdownWrapper.classList.add(CLASS_NAMES.dropdownWrapper);

        const fileTypeLabel = document.createElement("label");
        fileTypeLabel.textContent =
          downloadPanelView.dropdownOptions.fileType.label;

        const fileTypeDropdown = document.createElement("select");
        fileTypeDropdown.classList.add(CLASS_NAMES.dropdown);
        fileTypeDropdown.classList.add(CLASS_NAMES.fileTypeDropdown);
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

        // ── Dropdown container ────────────────────────────────────────────────
        const dropdownContainer = document.createElement("div");
        dropdownContainer.classList.add(CLASS_NAMES.dropdownContainer);
        dropdownContainer.appendChild(resolutionDropdownWrapper);
        dropdownContainer.appendChild(fileTypeDropdownWrapper);

        // ── File-size info label ──────────────────────────────────────────────
        const fileSizeInfoBox = document.createElement("label");
        fileSizeInfoBox.classList.add(CLASS_NAMES.fileSizeBox);
        fileSizeInfoBox.textContent =
          "Select resolution and file format to download...";
        this.fileSizeInfoBox = fileSizeInfoBox;

        // ── Assemble ──────────────────────────────────────────────────────────
        this.el.appendChild(checkbox);
        this.el.appendChild(dropdownContainer);
        this.el.appendChild(fileSizeInfoBox);

        // ── Dropdown event listeners ──────────────────────────────────────────

        // When resolution changes, enable the file-type dropdown and reset it
        resolutionDropdown.addEventListener("change", () => {
          view.selectedResolution = resolutionDropdown.value;
          if (view.selectedResolution !== "") {
            fileTypeDropdown.disabled = false;
          }
          // Reset file-type whenever resolution changes
          fileTypeDropdown.value = defaultFileTypeOption.value;
          view.selectedFileType = "";
        });

        // When file type changes, update state, recalculate file size, and
        // notify the parent to refresh the save-button status
        fileTypeDropdown.addEventListener("change", () => {
          view.selectedFileType = fileTypeDropdown.value;
          downloadPanelView.fileTypeSelection(checkbox.dataset.layerId);
          const fileSize = downloadPanelView.getRawFileSize(
            resolutionDropdown.value,
            fileTypeDropdown.value,
            checkbox.dataset.layerId,
            checkbox.dataset.fullDownloadLink,
            checkbox.dataset.pngDownloadLink,
            checkbox.dataset.gpkgDownloadLink,
            checkbox.dataset.id,
            checkbox.dataset.layerName,
            checkbox.dataset.wmtsDownloadLink,
            checkbox.dataset.metadataPid,
            checkbox.dataset.tiffDownloadLink,
          );
          downloadPanelView.updateTextbox(
            fileSizeInfoBox,
            fileSize,
            fileTypeDropdown.value,
            checkbox.dataset.layerId,
          );
        });

        return this;
      },

      /**
       * Called by the parent DownloadPanelView when its wrapping
       * ExpansionPanelView is opened. Checks the checkbox, resets the
       * dropdowns, and asks the parent to re-evaluate the save-button state.
       */
      onPanelOpen() {
        this.isSelected = true;
        if (this.checkbox) this.checkbox.checked = true;
        if (this.resolutionDropdown) {
          this.resolutionDropdown.value =
            this.downloadPanelView.dropdownOptions.resolution.defaultValue;
        }
        if (this.fileTypeDropdown) {
          this.fileTypeDropdown.disabled = true;
          this.fileTypeDropdown.value =
            this.downloadPanelView.dropdownOptions.fileType.defaultValue;
        }
        this.selectedResolution = "";
        this.selectedFileType = "";
        this.downloadPanelView.layerSelection();
      },

      /**
       * Called by the parent DownloadPanelView when its wrapping
       * ExpansionPanelView is collapsed. Unchecks the checkbox and asks the
       * parent to re-evaluate the save-button state.
       */
      onPanelClose() {
        this.isSelected = false;
        if (this.checkbox) this.checkbox.checked = false;
        this.downloadPanelView.layerSelection();
      },
    },
  );

  return LayerDownloadView;
});
