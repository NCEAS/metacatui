define([
  "jquery",
  "underscore",
  "backbone",
  "models/portals/PortalSectionModel",
  "models/maps/Map",
], ($, _, Backbone, PortalSectionModel, Map) => {
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

      defaults() {
        return _.extend(PortalSectionModel.prototype.defaults(), {
          sectionType: "visualization",
          visualizationType: "",
          supportedVisualizationTypes: ["fever", "cesium"],
        });
      },

      /**
       * Parses a <section> element from a portal document
       *  @param {XMLElement} objectDOM - A ContentSectionType XML element from
       *  a portal document
       *  @returns {JSON} The result of the parsed XML, in JSON. To be set
       *  directly on the model.
       */
      parse(objectDOM) {
        if (!objectDOM) {
          return {};
        }

        // Create a jQuery object of the XML DOM
        const $objectDOM = $(objectDOM);
        // Parse the XML using the parent class, PortalSectionModel.parse()
        const modelJSON = this.constructor.__super__.parse(objectDOM);

        // Parse the visualization type
        const allOptions = $objectDOM.children("option");
        let vizType = "";

        const vizTypeNode = allOptions.find(
          "optionName:contains(visualizationType)",
        );
        if (vizTypeNode.length) {
          vizType = vizTypeNode.first().siblings("optionValue").text();

          // Right now, only support "fever" as a visualization type, until this
          // feature is expanded.
          if (vizType == "fever") {
            //  modelJSON.visualizationType = "fever";
          }

          const vizTypes = this.get("supportedVisualizationTypes");
          if (Array.isArray(vizTypes) && vizTypes.includes(vizType)) {
            modelJSON.visualizationType = vizType;
          }

          // Find the map configuration JSON in the section option, if there is
          // one.
          if (vizType == "cesium") {
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
       *  @returns {XMLElement} An updated ContentSectionType XML element from a
       *  portal document
       */
      updateDOM() {
        var objectDOM = this.get("objectDOM");

        // Clone the DOM if it exists already
        if (objectDOM) {
          objectDOM = objectDOM.cloneNode(true);
          // Or create a new DOM
        } else {
          // create an XML section element from scratch
          const xmlText =
            "<section>  <content>FEVer visualization</content><option><optionName>sectionType</optionName><optionValue>visualization</optionValue>" +
            "</option><option><optionName>visualizationType</optionName><optionValue>fever</optionValue></option></section>";
          var objectDOM = new DOMParser().parseFromString(xmlText, "text/xml");
          var objectDOM = $(objectDOM).children()[0];
        }

        // Get and update the simple text strings (everything but content)
        const sectionTextData = {
          label: this.get("label"),
        };

        _.map(
          sectionTextData,
          function (value, nodeName) {
            // Don't serialize default values, except for default label strings,
            // since labels are required
            if (
              value &&
              (value != this.defaults()[nodeName] ||
                (nodeName == "label" && typeof value === "string"))
            ) {
              // Make new sub-node
              const sectionSubnodeSerialized =
                objectDOM.ownerDocument.createElement(nodeName);
              $(sectionSubnodeSerialized).text(value);

              this.addUpdatedXMLNode(objectDOM, sectionSubnodeSerialized);
            }
            // If the value was removed from the model, then remove the element
            // from the XML
            else {
              $(objectDOM).children(nodeName).remove();
            }
          },
          this,
        );

        // Make sure the content element is valid
        const contentEl = $(objectDOM).children("content");
        if (contentEl.length) {
          // If there is content in the content element
          if (contentEl[0].childNodes.length) {
            // If there is only text in the <content> element, we need to wrap
            // it in a <markdown> element so it's schema valid
            if (contentEl[0].childNodes[0].nodeType == 3) {
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
       * @returns {object} If there are errors, an object comprising error
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
        } catch (e) {
          console.error(e);
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
