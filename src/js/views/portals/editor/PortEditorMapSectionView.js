define([
  "views/portals/editor/PortEditorSectionView",
  "views/maps/mapEditor/MapEditorView",
], (PortEditorSectionView, MapEditorView) => {
  const BASE_CLASS = "port-editor-map";
  const CLASS_NAMES = {
    mapContainer: `${BASE_CLASS}__map-container`,
  };

  /**
   * @class PortEditorMapSectionView
   * @classdesc A Portal Editor section representing a Cesium map page.
   * @classcategory Views/Maps/MapEditor
   * @augments PortEditorSectionView
   * @screenshot views/maps/mapEditor/PortEditorMapSectionView.png
   * @since 0.0.0
   */
  const PortEditorMapSectionView = PortEditorSectionView.extend(
    /** @lends PortEditorMapSectionView.prototype */ {
      /**
       * The type of view this is.
       * @type {string}
       * @readonly
       */
      type: "PortEditorMapSection",

      /**
       * The HTML classes to use for this view's element.
       * @type {string}
       */
      className: `${PortEditorSectionView.prototype.className} ${BASE_CLASS}`,

      /** @inheritdoc */
      attributes: {
        "data-category": "sections",
      },

      /**
       * The type of section view this is.
       * @type {string}
       * @readonly
       */
      sectionType: "cesium",

      /** @inheritdoc */
      events: {},

      /**
       * Creates the HTML for this view.
       * @returns {string} The HTML for this view.
       */
      template() {
        return `<div class="${CLASS_NAMES.mapContainer}"></div>`;
      },

      /**
       * Attaches this view to its element for lookup by the portal editor.
       * @returns {PortEditorMapSectionView} This view
       */
      render() {
        this.onClose();
        this.$el.data("view", this);
        this.$el.html(this.template());
        const mapContainer = this.el.querySelector(
          `.${CLASS_NAMES.mapContainer}`,
        );
        const mapConfigError = this.model.get("mapConfigError");
        if (mapConfigError) {
          const message = document.createElement("p");
          message.className = "alert alert-warning";
          message.textContent = `${mapConfigError} The map editor is disabled. You can still edit the rest of the portal. Please contact support for assistance.`;
          mapContainer.appendChild(message);
          return this;
        }
        this.mapEditorView = new MapEditorView({
          model: this.model.get("mapModel"),
          el: mapContainer,
        });
        this.mapEditorView.render();
        this.model
          .get("mapModel")
          .getLayerGroups()
          .forEach((layers) => {
            this.listenTo(layers, "change", (asset) => {
              if (
                ["label", "description", "type", "cesiumOptions"].some(
                  (field) => asset.hasChanged(field),
                )
              ) {
                this.editorView?.showControls();
              }
            });
          });
        return this;
      },

      /** Open the map page and display invalid layer settings on portal Save. */
      showValidation() {
        if (!this.model.validate()?.map) return;
        this.editorView?.sectionsView?.switchSection(this);
        this.mapEditorView.showValidation();
      },

      /** Cleans up the map editor view and stops listening to events. */
      onClose() {
        if (this.mapEditorView) {
          this.mapEditorView.remove();
          this.mapEditorView = null;
        }
        this.stopListening();
      },

      /* Overrides remove to include onClose() */
      remove() {
        this.onClose();
        return PortEditorSectionView.prototype.remove.call(this);
      },
    },
  );

  return PortEditorMapSectionView;
});
