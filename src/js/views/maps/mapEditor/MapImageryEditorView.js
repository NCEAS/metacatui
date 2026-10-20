"use strict";

define(["backbone", "models/maps/assets/CesiumImagery"], (
  Backbone,
  CesiumImagery,
) => {
  const CLASS_NAMES = {
    BASE: "map-imagery-editor",
    FIELD: "map-asset-editor__field",
    SOURCE: "map-asset-editor__source",
    EXTENT: "map-asset-editor__extent",
    ERROR: "map-asset-editor__error",
  };
  const { PROVIDER_TYPES } = CesiumImagery;
  const TILING_SCHEMES = {
    GEOGRAPHIC: "GeographicTilingScheme",
    WEB_MERCATOR: "WebMercatorTilingScheme",
  };
  const ATTRIBUTES = {
    PROVIDER: "data-provider",
    ERROR: "data-error",
  };
  const ID_SUFFIXES = {
    WMTS_HELP: "wmts-help",
    WMTS_ERROR: "wmts-error",
    EXTENT_ERROR: "extent-error",
    ION_ERROR: "ion-error",
    OSM_ERROR: "osm-error",
    WMS_HELP: "wms-help",
    WMS_ERROR: "wms-error",
    TMS_ERROR: "tms-error",
    WMS_LAYERS_HELP: "wms-layers-help",
    WMS_LAYERS_ERROR: "wms-layers-error",
    BING_ERROR: "bing-error",
    BING_KEY_HELP: "bing-key-help",
  };
  const LABELS = {
    PROVIDER: "Imagery provider",
    WMTS: "Web Map Tile Service (WMTS)",
    WMS: "Web Map Service (WMS)",
    TMS: "Tile Map Service (TMS)",
    ION: "Cesium Ion",
    OSM: "OpenStreetMap",
    BING: "Bing Maps",
    NATURAL_EARTH: "Natural Earth II",
    USGS: "USGS Imagery Topo",
    TILE_URL: "Tile URL",
    TILING_SCHEME: "Tiling scheme",
    PROVIDER_DEFAULT: "Provider default",
    GEOGRAPHIC: "Geographic",
    WEB_MERCATOR: "Web Mercator",
    EXTENT: "Geographic extent (optional)",
    WEST: "West longitude (degrees)",
    SOUTH: "South latitude (degrees)",
    EAST: "East longitude (degrees)",
    NORTH: "North latitude (degrees)",
    ION_ASSET_ID: "Ion asset ID",
    TILE_SERVER_URL: "Tile server URL",
    SERVICE_URL: "Service URL",
    TILE_SERVICE_URL: "Tile service URL",
    LAYERS: "Layer names",
    BING_KEY: "Bing Maps API key (optional)",
  };
  const HELP_TEXT = {
    WMTS_URL:
      "Tile URL example: https://example.com/wmts/{TileMatrix}/{TileCol}/{TileRow}.png. Include all three placeholders.",
    WMS_URL:
      "Service URL example: https://example.com/geoserver/wms. Enter the layer names below.",
    WMS_LAYERS:
      "Use the layer names provided by the WMS service. Separate multiple names with commas.",
    BING_KEY:
      "Leave blank to use this site's Bing Maps API key, if configured.",
    NATURAL_EARTH:
      "Displays a world basemap with shaded terrain. No source settings are needed.",
    USGS: "Displays USGS aerial imagery with topographic map details. No source settings are needed.",
  };
  const GENERAL_ERROR_KEY = "general";

  /**
   * @class MapImageryEditorView
   * @classdesc Edits source settings for supported Cesium imagery providers.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapImageryEditorView.png
   * @since 0.0.0
   */
  const MapImageryEditorView = Backbone.View.extend(
    /** @lends MapImageryEditorView.prototype */ {
      /**
       * The existing imagery model supplied by the caller.
       * @type {CesiumImagery}
       */
      model: null,

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      events() {
        return {
          'change [name="type"]': "changeProvider",
          "change input, textarea, select": "updateModel",
          [`focusout .${CLASS_NAMES.EXTENT}`]: "validateExtent",
        };
      },

      /**
       * Build native controls for the supported imagery providers.
       * @returns {string} Markup containing no values from the model
       */
      template() {
        const fieldClass = CLASS_NAMES.FIELD;
        const sourceClass = CLASS_NAMES.SOURCE;
        const extentClass = CLASS_NAMES.EXTENT;
        const errorClass = CLASS_NAMES.ERROR;
        const id = this.cid;

        const extentHTML = ["west", "south", "east", "north"]
          .map(
            (coord) => `
            <label class="${fieldClass}">${LABELS[coord.toUpperCase()]}
              <input name="${coord}" type="number" step="any" aria-describedby="${id}-${ID_SUFFIXES.EXTENT_ERROR}" />
            </label>
          `,
          )
          .join("");

        return `
          <label class="${fieldClass}">${LABELS.PROVIDER}
            <select name="type">
              <option value="${PROVIDER_TYPES.WMTS}">${LABELS.WMTS}</option>
              <option value="${PROVIDER_TYPES.WMS}">${LABELS.WMS}</option>
              <option value="${PROVIDER_TYPES.TMS}">${LABELS.TMS}</option>
              <option value="${PROVIDER_TYPES.ION}">${LABELS.ION}</option>
              <option value="${PROVIDER_TYPES.OSM}">${LABELS.OSM}</option>
              <option value="${PROVIDER_TYPES.BING}">${LABELS.BING}</option>
              <option value="${PROVIDER_TYPES.NATURAL_EARTH}">${LABELS.NATURAL_EARTH}</option>
              <option value="${PROVIDER_TYPES.USGS}">${LABELS.USGS}</option>
            </select>
          </label>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.WMTS}" hidden>
            <label class="${fieldClass}">${LABELS.TILE_URL}
              <textarea name="url" rows="3" aria-describedby="${id}-${ID_SUFFIXES.WMTS_HELP} ${id}-${ID_SUFFIXES.WMTS_ERROR}"></textarea>
              <small id="${id}-${ID_SUFFIXES.WMTS_HELP}">${HELP_TEXT.WMTS_URL}</small>
              <span id="${id}-${ID_SUFFIXES.WMTS_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.url" role="alert"></span>
            </label>
            <label class="${fieldClass}">${LABELS.TILING_SCHEME}
              <select name="tilingScheme">
                <option value="">${LABELS.PROVIDER_DEFAULT}</option>
                <option value="${TILING_SCHEMES.GEOGRAPHIC}">${LABELS.GEOGRAPHIC}</option>
                <option value="${TILING_SCHEMES.WEB_MERCATOR}">${LABELS.WEB_MERCATOR}</option>
              </select>
            </label>
            <details>
              <summary>${LABELS.EXTENT}</summary>
               <div class="${extentClass}">${extentHTML}</div>
            </details>
            <p id="${id}-${ID_SUFFIXES.EXTENT_ERROR}" class="${errorClass}"
              ${ATTRIBUTES.ERROR}="cesiumOptions.rectangle" role="alert"></p>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.WMS}" hidden>
            <label class="${fieldClass}">${LABELS.SERVICE_URL}
              <input name="url" type="text" inputmode="url" aria-required="true"
                aria-describedby="${id}-${ID_SUFFIXES.WMS_HELP} ${id}-${ID_SUFFIXES.WMS_ERROR}" />
              <small id="${id}-${ID_SUFFIXES.WMS_HELP}">${HELP_TEXT.WMS_URL}</small>
              <span id="${id}-${ID_SUFFIXES.WMS_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.url" role="alert"></span>
            </label>
            <label class="${fieldClass}">${LABELS.LAYERS}
              <input name="layers" type="text" aria-required="true"
                aria-describedby="${id}-${ID_SUFFIXES.WMS_LAYERS_HELP} ${id}-${ID_SUFFIXES.WMS_LAYERS_ERROR}" />
              <small id="${id}-${ID_SUFFIXES.WMS_LAYERS_HELP}">${HELP_TEXT.WMS_LAYERS}</small>
              <span id="${id}-${ID_SUFFIXES.WMS_LAYERS_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.layers" role="alert"></span>
            </label>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.TMS}" hidden>
            <label class="${fieldClass}">${LABELS.TILE_SERVICE_URL}
              <input name="url" type="text" inputmode="url" aria-required="true"
                aria-describedby="${id}-${ID_SUFFIXES.TMS_ERROR}" />
              <span id="${id}-${ID_SUFFIXES.TMS_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.url" role="alert"></span>
            </label>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.ION}" hidden>
            <label class="${fieldClass}">${LABELS.ION_ASSET_ID}
              <input name="ionAssetId" type="text" inputmode="numeric"
                aria-describedby="${id}-${ID_SUFFIXES.ION_ERROR}" />
              <span id="${id}-${ID_SUFFIXES.ION_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.ionAssetId" role="alert"></span>
            </label>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.OSM}" hidden>
            <label class="${fieldClass}">${LABELS.TILE_SERVER_URL}
              <input name="url" type="text" inputmode="url"
                aria-describedby="${id}-${ID_SUFFIXES.OSM_ERROR}" />
              <span id="${id}-${ID_SUFFIXES.OSM_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.url" role="alert"></span>
            </label>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.BING}" hidden>
            <label class="${fieldClass}">${LABELS.SERVICE_URL}
              <input name="url" type="text" inputmode="url"
                aria-describedby="${id}-${ID_SUFFIXES.BING_ERROR}" />
              <span id="${id}-${ID_SUFFIXES.BING_ERROR}" class="${errorClass}"
                ${ATTRIBUTES.ERROR}="cesiumOptions.url" role="alert"></span>
            </label>
            <label class="${fieldClass}">${LABELS.BING_KEY}
              <input name="key" type="password" autocomplete="off"
                aria-describedby="${id}-${ID_SUFFIXES.BING_KEY_HELP}" />
              <small id="${id}-${ID_SUFFIXES.BING_KEY_HELP}">${HELP_TEXT.BING_KEY}</small>
            </label>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.NATURAL_EARTH}" hidden>
            <p>${HELP_TEXT.NATURAL_EARTH}</p>
          </section>

          <section class="${sourceClass}" ${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.USGS}" hidden>
            <p>${HELP_TEXT.USGS}</p>
          </section>

          <p class="${errorClass}" ${ATTRIBUTES.ERROR}="${GENERAL_ERROR_KEY}" role="alert"></p>
        `;
      },

      /**
       * Fill the source controls from the imagery model.
       * @returns {MapImageryEditorView} This view
       */
      render() {
        this.el.innerHTML = this.template();
        const type = this.model.get("type");
        this.el.querySelector('[name="type"]').value = type;
        this.changeProvider();

        const controls = this.el.querySelector(
          `[${ATTRIBUTES.PROVIDER}="${type}"]`,
        );
        const options = this.model.get("cesiumOptions") || {};
        const url = controls.querySelector('[name="url"]');
        // Keep the default URL from changeProvider when the model has no URL.
        if (url) url.value = options.url || url.value;
        ["ionAssetId", "layers", "key"].forEach((name) => {
          const input = controls.querySelector(`[name="${name}"]`);
          if (input) input.value = options[name] ?? "";
        });
        const tilingScheme = controls.querySelector('[name="tilingScheme"]');
        if (tilingScheme) tilingScheme.value = options.tilingScheme || "";
        if (type === PROVIDER_TYPES.WMTS && options.rectangle) {
          ["west", "south", "east", "north"].forEach((name, index) => {
            controls.querySelector(`[name="${name}"]`).value =
              options.rectangle[index];
          });
        }
        return this;
      },

      /** Show fresh source controls for the selected provider */
      changeProvider() {
        const type = this.el.querySelector('[name="type"]').value;
        this.el
          .querySelectorAll(`[${ATTRIBUTES.PROVIDER}]`)
          .forEach((section) => {
            section.toggleAttribute(
              "hidden",
              section.dataset.provider !== type,
            );
            const inputs = section.querySelectorAll("input, textarea, select");
            for (let index = 0; index < inputs.length; index += 1) {
              inputs[index].value = "";
            }
          });
        this.el.querySelector(
          `[${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.OSM}"] [name="url"]`,
        ).value = CesiumImagery.OSM_DEFAULT_URL;
        this.el.querySelector(
          `[${ATTRIBUTES.PROVIDER}="${PROVIDER_TYPES.BING}"] [name="url"]`,
        ).value = CesiumImagery.BING_DEFAULT_URL;
        this.el.querySelector("details").open = false;
        this.el.querySelectorAll(`.${CLASS_NAMES.ERROR}`).forEach((message) => {
          message.replaceChildren();
        });
        this.el.querySelectorAll("[aria-invalid]").forEach((input) => {
          input.removeAttribute("aria-invalid");
        });
      },

      /**
       * Keep source edits in the model, including incomplete settings.
       * Portal Save checks them before writing the config.
       * @param {Event} event The changed field
       */
      updateModel(event) {
        const { name } = event.target;
        const type = this.el.querySelector('[name="type"]').value;
        const controls = this.el.querySelector(
          `[${ATTRIBUTES.PROVIDER}="${type}"]`,
        );
        const cesiumOptions =
          type === this.model.get("type")
            ? { ...this.model.get("cesiumOptions") }
            : {};

        const url = controls.querySelector('[name="url"]');
        if (url) {
          if (url.value) cesiumOptions.url = url.value;
          else delete cesiumOptions.url;
        }

        if (type === PROVIDER_TYPES.ION) {
          cesiumOptions.ionAssetId = controls.querySelector(
            '[name="ionAssetId"]',
          ).value;
        }

        if (type === PROVIDER_TYPES.WMS) {
          cesiumOptions.layers =
            controls.querySelector('[name="layers"]').value;
        }

        if (type === PROVIDER_TYPES.BING) {
          const key = controls.querySelector('[name="key"]').value;
          if (key) cesiumOptions.key = key;
          else delete cesiumOptions.key;
        }

        if (type === PROVIDER_TYPES.WMTS) {
          const scheme = controls.querySelector('[name="tilingScheme"]').value;
          if (scheme) cesiumOptions.tilingScheme = scheme;
          else delete cesiumOptions.tilingScheme;

          const rectangle = ["west", "south", "east", "north"].map(
            (coordinate) =>
              controls.querySelector(`[name="${coordinate}"]`).value,
          );
          if (rectangle.every((coordinate) => coordinate === "")) {
            delete cesiumOptions.rectangle;
          } else {
            cesiumOptions.rectangle = rectangle.map((coordinate) =>
              coordinate === "" ? null : Number(coordinate),
            );
          }
        }

        this.model.set({ type, cesiumOptions });
        if (["url", "ionAssetId", "layers"].includes(name)) {
          this.showValidation(`cesiumOptions.${name}`);
        }
      },

      /**
       * Validate coordinates once focus leaves the extent group.
       * @param {FocusEvent} event The coordinate focus change
       */
      validateExtent(event) {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        this.showValidation("cesiumOptions.rectangle");
      },

      /**
       * Show source errors for one field, or all fields on Save.
       * @param {string} [field] The source field to check
       */
      showValidation(field) {
        const errors = this.model.validate(this.model.attributes) || {};
        const controls = this.el.querySelector(
          `[${ATTRIBUTES.PROVIDER}="${this.model.get("type")}"]`,
        );
        this.el.querySelectorAll(`.${CLASS_NAMES.ERROR}`).forEach((message) => {
          if (field && message.dataset.error !== field) return;
          message.replaceChildren();
          this.el
            .querySelectorAll(`[aria-describedby~="${message.id}"]`)
            .forEach((input) => {
              input.removeAttribute("aria-invalid");
            });
        });
        Object.entries(errors).forEach(([name, message]) => {
          if (field && name !== field) return;
          const error =
            controls.querySelector(`[${ATTRIBUTES.ERROR}="${name}"]`) ||
            this.el.querySelector(
              `[${ATTRIBUTES.ERROR}="${GENERAL_ERROR_KEY}"]`,
            );
          error.textContent = message;
          controls
            .querySelectorAll(`[aria-describedby~="${error.id}"]`)
            .forEach((input) => {
              input.setAttribute("aria-invalid", "true");
            });
        });
        if (!field) {
          const input = this.el.querySelector('[aria-invalid="true"]');
          if (input) {
            const details = input.closest("details");
            if (details) details.open = true;
            input.focus();
          }
        }
      },
    },
  );

  /**
   * Imagery provider types this editor can display.
   * @type {string[]}
   */
  MapImageryEditorView.SUPPORTED_TYPES = Object.values(PROVIDER_TYPES);

  return MapImageryEditorView;
});
