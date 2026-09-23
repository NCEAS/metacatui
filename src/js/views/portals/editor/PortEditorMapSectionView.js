define([
  "views/portals/editor/PortEditorSectionView",
  "views/maps/mapEditor/MapEditorView",
], (PortEditorSectionView, MapEditorView) => {
  const CLASS_NAMES = {
    mapContainer: "port-editor-map__map-container",
  };

  /**
   * @class PortEditorMapSectionView
   * @classdesc A Portal Editor section representing a Cesium map page.
   * @classcategory Views/Maps/MapEditor
   * @augments PortEditorSectionView
   * @screenshot views/maps/mapEditor/PortEditorMapSectionView.png // TODO
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
      className: `${PortEditorSectionView.prototype.className} ${CLASS_NAMES.mapContainer}`,

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
        this.$el.data("view", this);
        this.$el.html(this.template());
        const mapContainer = this.el.querySelector(
          `.${CLASS_NAMES.mapContainer}`,
        );
        this.mapEditorView = new MapEditorView({
          model: this.model.get("mapModel"),
          el: mapContainer,
        });
        this.mapEditorView.render();
        return this;
      },

      /** Cleans up the map editor view and stops listening to events. */
      onClose() {
        if (this.mapEditorView) {
          this.mapEditorView.onClose();
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
