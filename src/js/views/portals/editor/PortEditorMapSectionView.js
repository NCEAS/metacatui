define([
  "views/portals/editor/PortEditorSectionView",
  "views/maps/mapEditor/MapEditorView",
], (PortEditorSectionView, MapEditorView) => {
  const CLASS_NAMES = {};

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
      className: `${PortEditorSectionView.prototype.className} port-editor-map port-editor-viz`,

      /**
       * The HTML attributes to set on this view's element.
       * @type {object}
       */
      attributes: {
        "data-category": "sections",
      },

      /**
       * The type of section view this is.
       * @type {string}
       * @readonly
       */
      sectionType: "cesium",

      /**
       * The events this view listens to and their associated handlers.
       * @type {object}
       */
      events: {},

      /**
       * Creates the HTML for this view.
       * @param {object} variables The variables to use in the template.
       * @returns {string} The HTML for this view.
       */
      template(variables) {
        const { title } = variables;
        const CN = CLASS_NAMES;
        return `<h2>${title}</h2>
          <div class="${CN.mapContainer}"></div>`;
      },

      /**
       * Attaches this view to its element for lookup by the portal editor.
       * @returns {PortEditorMapSectionView} This view
       */
      render() {
        this.$el.data("view", this);
        const vars = {
          title: this.model.get("title"),
        };
        this.$el.html(this.template(vars));
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

      onClose() {
        if (this.mapEditorView) {
          this.mapEditorView.onClose();
          this.mapEditorView.remove();
          this.mapEditorView = null;
        }
        this.stopListening();
      },

      remove() {
        this.onClose();
        return PortEditorSectionView.prototype.remove.call(this);
      },
    },
  );

  return PortEditorMapSectionView;
});
