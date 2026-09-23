define([
  "jquery",
  "models/portals/PortalSectionModel",
  "models/portals/PortalOption",
  "models/maps/Map",
], ($, PortalSectionModel, PortalOption, Map) => {
  /**
   * @class PortalVizSectionModel
   * @classdesc A Portal Section for Data Visualizations. This is still an
   * experimental feature and not recommended for general use.
   * @classcategory Models/Portals
   * @augments PortalSectionModel
   * @private
   */
  const PortalVizSectionModel = PortalSectionModel.extend(
    /** @lends PortalVizSectionModel.prototype */ {
      type: "PortalVizSection",

      /** @returns {object} The default visualization section attributes */
      defaults() {
        return {
          ...PortalSectionModel.prototype.defaults(),
          sectionType: "visualization",
          visualizationType: "",
          supportedVisualizationTypes: ["fever", "cesium"],
        };
      },

      /**
       * Initializes a PortalVizSectionModel instance.
       * @param {object} [attributes] - The attributes to set on the model
       * @param {object} [attributes.mapConfig] - The map configuration to
       * initialize the map model with
       * @param {object} [options] - Options to pass to the model
       * @since 0.0.0
       */
      initialize(attributes = {}, options = {}) {
        PortalSectionModel.prototype.initialize.call(this, attributes, options);

        // If this is a Cesium map section, initialize the map model
        const isCesium =
          this.get("visualizationType") === "cesium" ||
          attributes?.visualizationType === "cesium";
        const mapConfig = attributes?.mapConfig || this.get("mapConfig");
        const mapModel = attributes?.mapModel || this.get("mapModel");
        if (isCesium) {
          this.initializeCesiumMap(mapConfig || mapModel);
        }
      },

      /**
       * Parses a <section> element from a portal document
       *  @param {XMLElement} objectDOM - A ContentSectionType XML element from
       *  a portal document
       *  @returns {object} The parsed section attributes, to be set directly on
       *  the model.
       */
      parse(objectDOM) {
        if (!objectDOM) {
          return {};
        }

        // Parse the XML using the parent class, PortalSectionModel.parse()
        const modelJSON = PortalSectionModel.prototype.parse.call(
          this,
          objectDOM,
        );

        const vizTypeOption = PortalOption.findDirectChild(
          objectDOM,
          "visualizationType",
        );
        if (vizTypeOption) {
          const vizType =
            PortalOption.fromElement(vizTypeOption).optionValue[0];

          const vizTypes = this.get("supportedVisualizationTypes");
          if (Array.isArray(vizTypes) && vizTypes.includes(vizType)) {
            modelJSON.visualizationType = vizType;
          }

          // Find the map configuration JSON in the section option, if there is
          // one.
          if (vizType === "cesium") {
            const mapConfigOption = PortalOption.findDirectChild(
              objectDOM,
              "mapConfig",
            );
            let mapConfig = {};
            if (mapConfigOption) {
              mapConfig = JSON.parse(
                PortalOption.fromElement(mapConfigOption).optionValue[0],
              );
            }
            this.initializeCesiumMap(mapConfig);
          }
        }

        return modelJSON;
      },

      /**
       * Initializes a Cesium map model for this portal section.
       * @param {object|Map} [mapConfigOrModel] The map to initialize the map
       * model with
       * @since 0.0.0
       */
      initializeCesiumMap(mapConfigOrModel = {}) {
        const mapModel =
          mapConfigOrModel instanceof Map
            ? mapConfigOrModel
            : new Map(mapConfigOrModel || {});
        this.set("mapModel", mapModel);
      },

      /**
       * Write the map's exported configuration into this section's XML.
       * @param {Element} objectDOM Section element to update
       * @returns {undefined} No return value
       * @throws {Error} When the existing map option is invalid
       * @since 0.0.0
       */
      updateCesiumMapDOM(objectDOM) {
        const mapConfig = JSON.stringify(this.get("mapModel").toConfig());
        const existing = PortalOption.findDirectChild(objectDOM, "mapConfig");
        const option = existing
          ? PortalOption.fromElement(existing)
          : new PortalOption({
              optionName: "mapConfig",
              optionValue: [mapConfig],
            });
        if (existing) option.optionValue[0] = mapConfig;
        const element = option.toElement(objectDOM.ownerDocument);

        if (existing) {
          existing.replaceWith(element);
        } else {
          const insertAfter = this.getXMLPosition(objectDOM, "option");
          if (insertAfter) {
            insertAfter.after(element);
          } else {
            objectDOM.appendChild(element);
          }
        }
      },

      /**
       *  Makes a copy of the original XML DOM and updates its label and map
       *  configuration from the model. Other visualization settings are not
       *  editable in MetacatUI.
       *  @returns {(XMLElement|string)} An updated ContentSectionType XML
       *  element, or an empty string when nothing is serialized
       */
      updateDOM() {
        let objectDOM = this.get("objectDOM");

        // Clone the DOM if it exists already
        if (objectDOM) {
          objectDOM = objectDOM.cloneNode(true);
          // Or create a new DOM
        } else {
          // create an XML section element from scratch
          const xmlText = `
            <section>
              <label></label>
                <content>Visualization</content>
                <option>
                  <optionName>sectionType</optionName>
                  <optionValue>visualization</optionValue>
                </option>
                <option>
                  <optionName>visualizationType</optionName>
                  <optionValue>${this.get("visualizationType")}</optionValue>
                </option></section>`;
          const xmlDocument = new DOMParser().parseFromString(
            xmlText,
            "text/xml",
          );
          [objectDOM] = $(xmlDocument).children().toArray();
        }

        // Update the required label
        const label = this.get("label");
        if (label) {
          const labelElement = objectDOM.ownerDocument.createElement("label");
          $(labelElement).text(label);
          this.addUpdatedXMLNode(objectDOM, labelElement);
        } else {
          $(objectDOM).children("label").remove();
        }

        // Make sure the content element is valid
        const contentEl = $(objectDOM).children("content");
        if (contentEl.length) {
          // If there is content in the content element
          if (contentEl[0].childNodes.length) {
            // If there is only text in the <content> element, we need to wrap
            // it in a <markdown> element so it's schema valid
            if (contentEl[0].childNodes[0].nodeType === 3) {
              $(contentEl[0]).html(
                `<markdown>${contentEl[0].childNodes[0].textContent}</markdown>`,
              );
            }
          }
        }

        if (this.get("visualizationType") === "cesium") {
          this.updateCesiumMapDOM(objectDOM);
        }

        // If nothing was serialized, return an empty string
        if (!$(objectDOM).children().length) {
          return "";
        }

        return objectDOM;
      },

      /**
       * Overrides the default Backbone.Model.validate.function() to check if
       * this PortalSection model has all the required values necessary to save
       * to the server.
       * @returns {object|undefined} If there are errors, an object comprising error
       *                   messages. If no errors, returns nothing.
       */
      validate() {
        try {
          const errors = {};

          // --Validate the label-- Labels are always required
          if (!this.get("label")) {
            errors.label = "Please provide a page name.";
          }

          // ---Validate the section content--- Content is always required, but
          // for visualizations, we can just input dummy content
          if (!this.get("content")) {
            this.set("content", "visualization");
          }

          // Return the errors object
          if (Object.keys(errors).length) return errors;
          return undefined;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
          return undefined;
        }
      },

      /**
       * Override the handler function for the a portal section change.
       * @param {boolean} isActive Whether the active portal section model is
       * this portal section model.
       */
      reportSectionChange(isActive) {
        if (isActive) {
          this.get("mapModel").trigger("change:searchparams");
        }
      },
    },
  );

  return PortalVizSectionModel;
});
