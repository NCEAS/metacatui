define(["jquery", "models/portals/PortalSectionModel", "models/maps/Map"], (
  $,
  PortalSectionModel,
  Map,
) => {
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

        // Create a jQuery object of the XML DOM
        const $objectDOM = $(objectDOM);
        // Parse the XML using the parent class, PortalSectionModel.parse()
        const modelJSON = PortalSectionModel.prototype.parse.call(
          this,
          objectDOM,
        );

        // Parse the visualization type
        const allOptions = $objectDOM.children("option");
        let vizType = "";

        const vizTypeNode = allOptions.find(
          "optionName:contains(visualizationType)",
        );
        if (vizTypeNode.length) {
          vizType = vizTypeNode.first().siblings("optionValue").text();

          const vizTypes = this.get("supportedVisualizationTypes");
          if (Array.isArray(vizTypes) && vizTypes.includes(vizType)) {
            modelJSON.visualizationType = vizType;
          }

          // Find the map configuration JSON in the section option, if there is
          // one.
          if (vizType === "cesium") {
            const mapConfigNode = allOptions.find(
              "optionName:contains(mapConfig)",
            );
            let mapConfig = {};
            if (mapConfigNode.length) {
              mapConfig = mapConfigNode.first().siblings("optionValue").text();
              if (mapConfig && mapConfig.length) {
                mapConfig = JSON.parse(mapConfig);
              }
            }
            modelJSON.mapModel = new Map(mapConfig);
          }
        }

        return modelJSON;
      },

      /**
       *  Makes a copy of the original XML DOM and updates it with the new
       *  values from the model. For now, this function only updates the label.
       *  All other parts of Viz sections are not editable in MetacatUI, since
       *  this is still an experimental feature.
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
          const xmlText =
            "<section>  <content>FEVer visualization</content><option><optionName>sectionType</optionName><optionValue>visualization</optionValue>" +
            "</option><option><optionName>visualizationType</optionName><optionValue>fever</optionValue></option></section>";
          const xmlDocument = new DOMParser().parseFromString(
            xmlText,
            "text/xml",
          );
          [objectDOM] = $(xmlDocument).children();
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
