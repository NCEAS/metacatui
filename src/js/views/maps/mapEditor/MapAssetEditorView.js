"use strict";

define(["backbone", "models/maps/assets/CesiumImagery"], (
  Backbone,
  CesiumImagery,
) => {
  const BASE_CLASS = "map-asset-editor";
  const CLASS_NAMES = {
    BASE: BASE_CLASS,
    FIELD: `${BASE_CLASS}__field`,
    SOURCE: `${BASE_CLASS}__source`,
    EXTENT: `${BASE_CLASS}__extent`,
    ERROR: `${BASE_CLASS}__error`,
  };
  const PROVIDER_TYPES = {
    WMTS: "WebMapTileServiceImageryProvider",
    ION: "IonImageryProvider",
    OSM: "OpenStreetMapImageryProvider",
  };
  const HELP_TEXT = {
    WMTS_URL: "Include {TileMatrix}, {TileCol}, and {TileRow}.",
  };
  const GENERAL_ERROR_KEY = "general";

  /**
   * @class MapAssetEditorView
   * @classdesc Edits an existing Cesium imagery asset for portal Save.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapAssetEditorView.png
   * @since 0.0.0
   */
  const MapAssetEditorView = Backbone.View.extend(
    /** @lends MapAssetEditorView.prototype */ {
      /**
       * Existing imagery model supplied by the caller
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
       * Build native controls for the three supported imagery providers.
       * @returns {string} Markup containing no model-supplied values
       */
      template() {
        const fieldClass = CLASS_NAMES.FIELD;
        const sourceClass = CLASS_NAMES.SOURCE;
        const extentClass = CLASS_NAMES.EXTENT;
        const errorClass = CLASS_NAMES.ERROR;
        const wmtsType = PROVIDER_TYPES.WMTS;
        const ionType = PROVIDER_TYPES.ION;
        const osmType = PROVIDER_TYPES.OSM;
        const wmtsUrlHelpText = HELP_TEXT.WMTS_URL;
        const generalErrorKey = GENERAL_ERROR_KEY;
        const id = this.cid;

        return `
          <label class="${fieldClass}">Label
            <input name="label" type="text" />
          </label>
          <label class="${fieldClass}">Description
            <textarea name="description" rows="4"></textarea>
          </label>
          <label class="${fieldClass}">Imagery provider
            <select name="type">
              <option value="${wmtsType}">Web Map Tile Service (WMTS)</option>
              <option value="${ionType}">Cesium Ion</option>
              <option value="${osmType}">OpenStreetMap</option>
            </select>
          </label>

          <section class="${sourceClass}" data-provider="${wmtsType}" hidden>
            <label class="${fieldClass}">Tile URL template
              <textarea name="url" rows="3" aria-describedby="${id}-wmts-help ${id}-wmts-error"></textarea>
              <small id="${id}-wmts-help">${wmtsUrlHelpText}</small>
              <span id="${id}-wmts-error" class="${errorClass}"
                data-error="cesiumOptions.url" role="alert"></span>
            </label>
            <label class="${fieldClass}">Tiling scheme
              <select name="tilingScheme">
                <option value="">Provider default</option>
                <option value="GeographicTilingScheme">Geographic</option>
                <option value="WebMercatorTilingScheme">Web Mercator</option>
              </select>
            </label>
            <details>
              <summary>Geographic extent (optional)</summary>
              <div class="${extentClass}">
                <label class="${fieldClass}">West longitude (degrees)
                  <input name="west" type="number" step="any" aria-describedby="${id}-extent-error" />
                </label>
                <label class="${fieldClass}">South latitude (degrees)
                  <input name="south" type="number" step="any" aria-describedby="${id}-extent-error" />
                </label>
                <label class="${fieldClass}">East longitude (degrees)
                  <input name="east" type="number" step="any" aria-describedby="${id}-extent-error" />
                </label>
                <label class="${fieldClass}">North latitude (degrees)
                  <input name="north" type="number" step="any" aria-describedby="${id}-extent-error" />
                </label>
              </div>
            </details>
            <p id="${id}-extent-error" class="${errorClass}"
              data-error="cesiumOptions.rectangle" role="alert"></p>
          </section>

          <section class="${sourceClass}" data-provider="${ionType}" hidden>
            <label class="${fieldClass}">Ion asset ID
              <input name="ionAssetId" type="text" inputmode="numeric"
                aria-describedby="${id}-ion-error" />
              <span id="${id}-ion-error" class="${errorClass}"
                data-error="cesiumOptions.ionAssetId" role="alert"></span>
            </label>
          </section>

          <section class="${sourceClass}" data-provider="${osmType}" hidden>
            <label class="${fieldClass}">Tile server URL
              <input name="url" type="text" inputmode="url"
                aria-describedby="${id}-osm-error" />
              <span id="${id}-osm-error" class="${errorClass}"
                data-error="cesiumOptions.url" role="alert"></span>
            </label>
          </section>

          <p class="${errorClass}" data-error="${generalErrorKey}" role="alert"></p>
        `;
      },

      /**
       * Render editable values from the supplied asset.
       * @returns {MapAssetEditorView} This view
       */
      render() {
        this.el.innerHTML = this.template();
        this.el.querySelector('[name="label"]').value = this.model.get("label");
        this.el.querySelector('[name="description"]').value =
          this.model.get("description");
        const type = this.model.get("type");
        this.el.querySelector('[name="type"]').value = type;
        this.changeProvider();

        const controls = this.el.querySelector(`[data-provider="${type}"]`);
        const options = this.model.get("cesiumOptions") || {};
        const url = controls.querySelector('[name="url"]');
        if (url) {
          url.value =
            options.url ||
            (type === PROVIDER_TYPES.OSM ? CesiumImagery.OSM_DEFAULT_URL : "");
        }
        const ionId = controls.querySelector('[name="ionAssetId"]');
        if (ionId) ionId.value = options.ionAssetId ?? "";
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

      /**
       * Focus and select the label for editing.
       * @returns {void}
       * @since 0.0.0
       */
      focusLabel() {
        const label = this.el.querySelector('[name="label"]');
        label.focus();
        label.select();
      },

      /** Show fresh source controls for the selected provider */
      changeProvider() {
        const type = this.el.querySelector('[name="type"]').value;
        this.el.querySelectorAll("[data-provider]").forEach((section) => {
          section.toggleAttribute("hidden", section.dataset.provider !== type);
          const inputs = section.querySelectorAll("input, textarea, select");
          for (let index = 0; index < inputs.length; index += 1) {
            inputs[index].value = "";
          }
        });
        this.el.querySelector(
          `[data-provider="${PROVIDER_TYPES.OSM}"] [name="url"]`,
        ).value = CesiumImagery.OSM_DEFAULT_URL;
        this.el.querySelector("details").open = false;
        this.el.querySelectorAll(`.${CLASS_NAMES.ERROR}`).forEach((message) => {
          message.replaceChildren();
        });
        this.el.querySelectorAll("[aria-invalid]").forEach((input) => {
          input.removeAttribute("aria-invalid");
        });
      },

      /**
       * Keep field edits in the model, including incomplete source settings.
       * Portal Save validates them before writing the configuration.
       * @param {Event} event The changed field
       */
      updateModel(event) {
        const { name, value } = event.target;
        if (name === "label" || name === "description") {
          this.model.set(name, value);
          return;
        }
        const type = this.el.querySelector('[name="type"]').value;
        const controls = this.el.querySelector(`[data-provider="${type}"]`);
        const cesiumOptions =
          type === this.model.get("type")
            ? { ...this.model.get("cesiumOptions") }
            : {};

        if (type === PROVIDER_TYPES.ION) {
          cesiumOptions.ionAssetId = controls.querySelector(
            '[name="ionAssetId"]',
          ).value;
        } else {
          const url = controls.querySelector('[name="url"]').value;
          if (url) cesiumOptions.url = url;
          else delete cesiumOptions.url;
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
        if (name === "url" || name === "ionAssetId") {
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
       * Display source errors for one edited field, or all fields on Save.
       * @param {string} [field] The source field to check
       */
      showValidation(field) {
        const errors = this.model.validate(this.model.attributes) || {};
        const controls = this.el.querySelector(
          `[data-provider="${this.model.get("type")}"]`,
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
            controls.querySelector(`[data-error="${name}"]`) ||
            this.el.querySelector(`[data-error="${GENERAL_ERROR_KEY}"]`);
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
   * @since 0.0.0
   */
  MapAssetEditorView.SUPPORTED_TYPES = Object.values(PROVIDER_TYPES);

  return MapAssetEditorView;
});
