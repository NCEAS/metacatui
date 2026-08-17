const required = [
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "models/metadata/eml220/EMLText",
  "common/EMLUtilities",
];

if (MetacatUI.appModel.get("customEMLMethods").length) {
  required.push("models/metadata/eml/EMLSpecializedText");
}

define(
  required,
  (
    $,
    _,
    Backbone,
    DataONEObject,
    EMLText,
    EMLUtilities,
    EMLSpecializedText,
  ) => {
    /**
     * @class EMLMethodStep
     * @classdesc Represents the EML Method Steps. The methodStep field allows for repeated sets of
            elements that document a series of procedures followed to produce a
            data object. These include text descriptions of the procedures,
            relevant literature, software, instrumentation, source data and any
            quality control measures taken.
     * @classcategory Models/Metadata/EML
     * @augments Backbone.Model
     * @since 2.19.0
     */
    const EMLMethodStep = Backbone.Model.extend(
      /** @lends EMLMethodStep.prototype */ {
        /**
         * Default attributes for EMLMethodSteps
         * @returns {object}
         * @property {string} objectXML The original XML snippet string from the EML XML
         * @property {Element} objectDOM The original XML snippet as an Element
         * @property {EMLText|EMLSpecializedText} description A textual description of this method step
         * @property {string[]} instrumentation One or more instruments used for measurement and recording data
         * @property {EMLMethodStep[]} subStep Nested additional method steps within this step.  This is useful for hierarchical method descriptions. This is *not* fully supported in MetacatUI yet
         * @property {string[]} customMethodID A unique identifier for this Custom Method Step type, which is defined in {@link AppConfig#customEMLMethods}
         * @property {boolean} required If true, this method step is required in it's parent EML
         */
        defaults() {
          return {
            objectXML: null,
            objectDOM: null,
            description: null,
            instrumentation: [],
            subStep: [],
            customMethodID: "",
            required: false,
          };
        },

        initialize(attributes) {
          attributes = attributes || {};

          if (attributes.objectDOM) {
            this.set(this.parse(attributes.objectDOM));
          } else if (attributes.customMethodID) {
            try {
              const customMethodConfig = MetacatUI.appModel
                .get("customEMLMethods")
                .find((config) => config.id == attributes.customMethodID);

              this.set(
                "description",
                new EMLSpecializedText({
                  type: "description",
                  title: customMethodConfig.titleOptions[0],
                  titleOptions: customMethodConfig.titleOptions,
                }),
              );
            } catch (e) {
              console.error(e);
            }
          } else {
            this.set(
              "description",
              new EMLText({
                type: "description",
              }),
            );
          }

          // Set the required attribute
          if (typeof attributes.required === "boolean") {
            this.set("required", attributes.required);
          }

          // specific attributes to listen to
          this.on("change:instrumentation", this.trickleUpChange);
        },

        /**
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
         * Used during parse() and serialize()
         * @returns {object}
         */
        nodeNameMap() {
          return {
            alternateidentifier: "alternateIdentifier",
            methodstep: "methodStep",
            substep: "subStep",
            datasource: "dataSource",
            referencedentityid: "referencedEntityId",
            qualitycontrol: "qualityControl",
            shortname: "shortName",
          };
        },

        parse(objectDOM) {
          const modelJSON = {};

          if (!objectDOM) var objectDOM = this.get("objectDOM");

          const $objectDOM = $(objectDOM);
          const description = $objectDOM.children("description");

          // Get the titles of all the custom method steps from the App Config
          const customMethodOptions =
            MetacatUI.appModel.get("customEMLMethods");
          const customMethodTitles = _.flatten(
            _.pluck(customMethodOptions, "titleOptions"),
          );
          let isCustom = false;

          try {
            // If there is at least one custom method configured, check if this description is one
            if (customMethodOptions && customMethodOptions.length) {
              const specializedTextAttr = EMLSpecializedText.prototype.parse(
                description[0],
              );
              const matchingCustomMethod = customMethodOptions.find((options) =>
                options.titleOptions.includes(specializedTextAttr.title),
              );

              if (matchingCustomMethod) {
                isCustom = true;

                // Use the EMLSpecializedText model for custom methods
                modelJSON.description = new EMLSpecializedText({
                  objectDOM: description[0],
                  type: "description",
                  titleOptions: matchingCustomMethod.titleOptions,
                  parentModel: this,
                });
                // Save the other configurations of this custom method to this EMLMethodStep
                modelJSON.customMethodID = matchingCustomMethod.id;
                modelJSON.required = matchingCustomMethod.required;
              }
            }
          } catch (e) {
            console.error(e);
          }

          // Create a regular EMLText description for non-custom methods
          if (!isCustom) {
            modelJSON.description = new EMLText({
              objectDOM: description[0],
              type: "description",
              parentModel: this,
            });
          }

          // Parse the instrumentation
          modelJSON.instrumentation = [];
          $objectDOM.children("instrumentation").each((i, el) => {
            modelJSON.instrumentation.push(el.textContent);
          });

          /** @todo: Support parsing subSteps */

          return modelJSON;
        },

        serialize() {
          const objectDOM = this.updateDOM();

          if (!objectDOM) return "";

          let xmlString = objectDOM.outerHTML;

          // Camel-case the XML
          xmlString = this.formatXML(xmlString);

          return xmlString;
        },

        /**
         * Makes a copy of the original XML DOM and updates it with the new values from the model.
         */
        updateDOM() {
          // Return nothing if this model has only the default values
          if (this.isEmpty()) {
            return;
          }

          try {
            let objectDOM;

            if (this.get("objectDOM")) {
              objectDOM = this.get("objectDOM").cloneNode(true);
            } else {
              objectDOM = $(document.createElement("methodstep"));
            }

            const $objectDOM = $(objectDOM);

            // Update the description
            const description = this.get("description");
            if (description) {
              const updatedDescription = description.updateDOM();

              // Descriptions are required for method steps, so if updating the DOM didn't work, don't serialize this method step.
              if (!updatedDescription) {
                return;
              }

              // Add the description to the method step
              const existingDesc = $objectDOM.children("description");
              if (existingDesc.length) {
                existingDesc.replaceWith(updatedDescription);
              } else {
                $objectDOM.append(updatedDescription);
              }
            }

            try {
              // Update the instrumentation
              const instrumentation = this.get("instrumentation");
              $objectDOM.children("instrumentation").remove();

              if (instrumentation && instrumentation.length) {
                instrumentation.reverse().each((i) => {
                  const updatedI = document.createElement("instrumentation");
                  updatedI.textContent = i;
                  $objectDOM.children("description").after(updatedI);
                });
              }
            } catch (e) {
              console.error(
                "Failed to serialize method step instrumentation, skipping. ",
                e,
              );
            }

            /** @todo: Update software and subSteps */

            // Remove empty (zero-length or whitespace-only) nodes
            $objectDOM
              .find("*")
              .filter(function () {
                return $.trim(this.innerHTML) === "";
              })
              .remove();

            return objectDOM;
          } catch (e) {
            console.error(
              "Failed to update the EMLMethodStep. Won't serialize. ",
              e,
            );
          }
        },

        /**
         *  function isEmpty() - Will check if there are any values set on this model
         *  that are different than the default values and would be serialized to the EML.
         * @returns {boolean} - Returns true is this model is empty, false if not
         */
        isEmpty() {
          if (!this.get("description") || this.get("description").isEmpty()) {
            return true;
          }
        },

        /**
         * Returns whether or not this Method Step is a custom one, which currently only applies to the description
         * @returns {boolean}
         */
        isCustom() {
          return this.get("description")
            ? this.get("description").type == "EMLSpecializedText"
            : false;
        },

        /**
         * Overloads Backbone.Model.validate() to check if this model has valid values set on it
         * @augments Backbone.Model.validate
         * @returns {object}
         */
        validate() {
          try {
            const validationErrors = {};

            if (this.isCustom() && this.get("required")) {
              const desc = this.get("description");
              let isMissing = false;

              // If there is a missing description, we need to show the required error
              if (!desc) {
                isMissing = true;
              } else if (!desc.get("text")) {
                isMissing = true;
              } else if (!_.compact(desc.get("text")).length) {
                isMissing = true;
              }

              if (isMissing) {
                validationErrors.description = `${desc.get("title")} is required.`;
                return validationErrors;
              }
            }
          } catch (e) {
            console.error("Error while validating the Methods: ", e);
            return false;
          }
        },

        trickleUpChange() {
          EMLUtilities.markRootDataPackageChanged();
        },

        formatXML(xmlString) {
          return DataONEObject.prototype.formatXML.call(this, xmlString);
        },
      },
    );

    return EMLMethodStep;
  },
);
