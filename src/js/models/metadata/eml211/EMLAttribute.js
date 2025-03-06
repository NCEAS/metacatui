define([
  "jquery",
  "underscore",
  "backbone",
  "uuid",
  "models/metadata/eml211/EMLMeasurementScale",
  "models/metadata/eml211/EMLAnnotation",
  "collections/metadata/eml/EMLMissingValueCodes",
  "models/DataONEObject",
], (
  $,
  _,
  Backbone,
  uuid,
  EMLMeasurementScale,
  EMLAnnotation,
  EMLMissingValueCodes,
  DataONEObject,
) => {
  /**
   * @class EMLAttribute
   * @classdesc EMLAttribute represents a data attribute within an entity, such as
   * a column variable in a data table, or a feature attribute in a shapefile.
   * @see https://eml.ecoinformatics.org/schema/eml-attribute_xsd.html
   * @classcategory Models/Metadata/EML211
   */
  const EMLAttribute = Backbone.Model.extend(
    /** @lends EMLAttribute.prototype */ {
      /**
       * Attributes of an EML attribute object
       * @returns {object} - The EMLAttribute attributes
       * @property {string} xmlID - The XML id of the attribute
       * @property {string} attributeName - The name of the attribute
       * @property {Array} attributeLabel - Zero or more human readable labels
       * @property {string} attributeDefinition - The definition of the attribute
       * @property {Array} storageType - Zero or more storage types
       * @property {Array} typeSystem - Zero or more system types for storage type
       * @property {EMLMeasurementScale} measurementScale - An EML{Non}NumericDomain
       * or EMLDateTimeDomain object
       * @property {EMLMissingValueCodes} missingValueCodes - An EMLMissingValueCodes
       * collection
       * @property {EMLAccuracy} accuracy - An EMLAccuracy object
       * @property {EMLCoverage} coverage - An EMLCoverage object
       * @property {Array} methods - Zero or more EMLMethods objects
       * @property {string} references - A reference to another EMLAttribute by id
       * @property {Array} annotation - Zero or more EMLAnnotation objects
       * @property {string} type - The element type in the DOM
       * @property {EML211} parentModel - The parent model this attribute belongs to
       * @property {Element} objectXML - The serialized XML of this EML attribute
       * @property {Element} objectDOM - The DOM of this EML attribute
       * @property {Array} nodeOrder - The order of the top level XML element nodes
       */
      defaults() {
        return {
          // Attributes from EML
          xmlID: null,
          attributeName: null,
          attributeLabel: [],
          attributeDefinition: null,
          storageType: [],
          typeSystem: [],
          measurementScale: null,
          missingValueCodes: new EMLMissingValueCodes(),
          accuracy: null,
          coverage: null,
          methods: [],
          references: null,
          annotation: [],
          // Attributes not from EML
          type: "attribute",
          parentModel: null,
          objectXML: null,
          objectDOM: null,
          nodeOrder: [
            "attributeName",
            "attributeLabel",
            "attributeDefinition",
            "storageType",
            "measurementScale",
            "missingValueCode",
            "accuracy",
            "coverage",
            "methods",
            "annotation",
          ],
        };
      },

      /**
       * The map of lower case to camel case node names
       * needed to deal with parsing issues with $.parseHTML().
       * Use this until we can figure out issues with $.parseXML().
       * @type {object}
       */
      nodeNameMap: {
        attributename: "attributeName",
        attributelabel: "attributeLabel",
        attributedefinition: "attributeDefinition",
        sourced: "source",
        storagetype: "storageType",
        typesystem: "typeSystem",
        measurementscale: "measurementScale",
        missingvaluecode: "missingValueCode",
        propertyuri: "propertyURI",
        valueuri: "valueURI",
      },

      /** @inheritdoc */
      initialize(attributes = {}) {
        // If initialized with missingValueCode as an array, convert it to a collection
        if (
          attributes.missingValueCodes &&
          attributes.missingValueCodes instanceof Array
        ) {
          this.missingValueCodes = new EMLMissingValueCodes(
            attributes.missingValueCode,
          );
        }

        this.stopListening(this.get("missingValueCodes"));
        this.listenTo(
          this.get("missingValueCodes"),
          "update",
          this.trickleUpChange,
        );
        this.on(
          "change:attributeName " +
            "change:attributeLabel " +
            "change:attributeDefinition " +
            "change:storageType " +
            "change:measurementScale " +
            "change:missingValueCodes " +
            "change:accuracy " +
            "change:coverage " +
            "change:methods " +
            "change:references " +
            "change:annotation",
          this.trickleUpChange,
        );
      },

      /** @inheritdoc */
      parse(attrs = {}) {
        // copy the attributes so we can modify them
        const attributes = { ...attrs };
        let $objectDOM;

        if (attributes.objectDOM) {
          $objectDOM = $(attributes.objectDOM);
        } else if (attributes.objectXML) {
          $objectDOM = $(attributes.objectXML);
        } else {
          return {};
        }

        // Add the XML id
        if (typeof $objectDOM.attr("id") !== "undefined") {
          attributes.xmlID = $objectDOM.attr("id");
        }

        // Add the attributeName
        attributes.attributeName = $objectDOM.children("attributename").text();

        // Add the attributeLabel
        attributes.attributeLabel = [];
        const attributeLabels = $objectDOM.children("attributelabel");
        _.each(attributeLabels, (attributeLabel) => {
          attributes.attributeLabel.push(attributeLabel.textContent);
        });

        // Add the attributeDefinition
        attributes.attributeDefinition = $objectDOM
          .children("attributedefinition")
          .text();

        // Add the storageType
        attributes.storageType = [];
        attributes.typeSystem = [];
        const storageTypes = $objectDOM.children("storagetype");
        _.each(storageTypes, (storageType) => {
          attributes.storageType.push(storageType.textContent);
          const type = $(storageType).attr("typesystem");
          attributes.typeSystem.push(type || null);
        });

        const measurementScale = $objectDOM.find("measurementscale")[0];
        if (measurementScale) {
          attributes.measurementScale = EMLMeasurementScale.getInstance(
            measurementScale.outerHTML,
          );
          attributes.measurementScale.set("parentModel", this);
        }

        // Add annotations
        const annotations = $objectDOM.children("annotation");
        attributes.annotation = [];

        _.each(
          annotations,
          (anno) => {
            const annotation = new EMLAnnotation(
              {
                objectDOM: anno,
                objectXML: anno.outerHTML,
              },
              { parse: true },
            );

            attributes.annotation.push(annotation);
          },
          this,
        );

        // Add the missingValueCodes as a collection
        attributes.missingValueCodes = new EMLMissingValueCodes();
        attributes.missingValueCodes.parse(
          $objectDOM.children("missingvaluecode"),
        );

        [attributes.objectDOM] = $objectDOM;

        return attributes;
      },

      serialize() {
        const objectDOM = this.updateDOM();
        let xmlString = objectDOM.outerHTML;

        // Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
      },

      /**
       * Copy the original XML and update fields in a DOM object
       * with the current model values
       * @param {Element} [dom] - The original DOM object to update
       * @returns {Element} The updated DOM object
       */
      updateDOM(dom) {
        let objectDOM = dom;
        let nodeToInsertAfter;
        const type = this.get("type") || "attribute";
        if (!objectDOM) {
          objectDOM = this.get("objectDOM");
        }
        const objectXML = this.get("objectXML");

        // If present, use the cached DOM
        if (objectDOM) {
          objectDOM = objectDOM.cloneNode(true);

          // otherwise, use the cached XML
        } else if (objectXML) {
          objectDOM = $(objectXML)[0].cloneNode(true);

          // This is new, create it
        } else {
          objectDOM = document.createElement(type);
        }

        // update the id attribute
        const xmlID = this.get("xmlID");
        if (xmlID) {
          $(objectDOM).attr("id", xmlID);
        }

        // Update the attributeName
        if (
          typeof this.get("attributeName") === "string" &&
          this.get("attributeName").trim().length
        ) {
          if ($(objectDOM).find("attributename").length) {
            $(objectDOM).find("attributename").text(this.get("attributeName"));
          } else {
            nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeName");

            if (!nodeToInsertAfter) {
              $(objectDOM).append(
                $(document.createElement("attributename")).text(
                  this.get("attributeName"),
                )[0],
              );
            } else {
              $(nodeToInsertAfter).after(
                $(document.createElement("attributename")).text(
                  this.get("attributeName"),
                )[0],
              );
            }
          }
        }
        // If there is no attribute name, return an empty string because it
        // is invalid
        else {
          return "";
        }

        // Update the attributeLabels
        nodeToInsertAfter = undefined;
        let attributeLabels = this.get("attributeLabel");
        if (attributeLabels) {
          if (attributeLabels.length) {
            // Copy and reverse the array for inserting
            attributeLabels = Array.from(attributeLabels).reverse();
            // Remove all current attributeLabels
            $(objectDOM).find("attributelabel").remove();
            nodeToInsertAfter = this.getEMLPosition(
              objectDOM,
              "attributeLabel",
            );

            if (!nodeToInsertAfter) {
              // Add the new list back in
              _.each(attributeLabels, (attributeLabel) => {
                // If there is an empty string or falsey value in the label, don't add it to the XML
                // We check purposefuly for falsey types (instead of just doing !attributeLabel) because
                // it's ok to serialize labels that are the number 0.
                if (
                  (typeof attributeLabel === "string" &&
                    !attributeLabel.trim().length) ||
                  attributeLabel === false ||
                  attributeLabel === null ||
                  typeof attributeLabel === "undefined"
                ) {
                  return;
                }

                $(objectDOM).append(
                  $(document.createElement("attributelabel")).text(
                    attributeLabel,
                  )[0],
                );
              });
            } else {
              // Add the new list back in after its previous sibling
              _.each(attributeLabels, (attributeLabel) => {
                // If there is an empty string or falsey value in the label, don't add it to the XML
                // We check purposefuly for falsey types (instead of just doing !attributeLabel) because
                // it's ok to serialize labels that are the number 0.
                if (
                  (typeof attributeLabel === "string" &&
                    !attributeLabel.trim().length) ||
                  attributeLabel === false ||
                  attributeLabel === null ||
                  typeof attributeLabel === "undefined"
                ) {
                  return;
                }

                $(nodeToInsertAfter).after(
                  $(document.createElement("attributelabel")).text(
                    attributeLabel,
                  )[0],
                );
              });
            }
          }
          // If the label array is empty, remove all the labels from the DOM
          else {
            $(objectDOM).find("attributelabel").remove();
          }
        }
        // If there is no attribute label, remove them from the DOM
        else {
          $(objectDOM).find("attributelabel").remove();
        }

        // Update the attributeDefinition
        nodeToInsertAfter = undefined;
        if (this.get("attributeDefinition")) {
          if ($(objectDOM).find("attributedefinition").length) {
            $(objectDOM)
              .find("attributedefinition")
              .text(this.get("attributeDefinition"));
          } else {
            nodeToInsertAfter = this.getEMLPosition(
              objectDOM,
              "attributeDefinition",
            );

            if (!nodeToInsertAfter) {
              $(objectDOM).append(
                $(document.createElement("attributedefinition")).text(
                  this.get("attributeDefinition"),
                )[0],
              );
            } else {
              $(nodeToInsertAfter).after(
                $(document.createElement("attributedefinition")).text(
                  this.get("attributeDefinition"),
                )[0],
              );
            }
          }
        }
        // If there is no attribute definition, then return an empty String
        // because it is invalid
        else {
          return "";
        }

        // Update the storageTypes
        nodeToInsertAfter = undefined;
        let storageTypes = this.get("storageTypes");
        if (storageTypes) {
          if (storageTypes.length) {
            // Copy and reverse the array for inserting
            storageTypes = Array.from(storageTypes).reverse();
            // Remove all current attributeLabels
            $(objectDOM).find("storagetype").remove();
            nodeToInsertAfter = this.getEMLPosition(objectDOM, "storageType");

            if (!nodeToInsertAfter) {
              // Add the new list back in
              _.each(storageTypes, (storageType) => {
                if (!storageType) return;

                $(objectDOM).append(
                  $(document.createElement("storagetype")).text(storageType)[0],
                );
              });
            } else {
              // Add the new list back in after its previous sibling
              _.each(storageTypes, (storageType) => {
                if (!storageType) return;

                $(nodeToInsertAfter).after(
                  $(document.createElement("storagetype")).text(storageType)[0],
                );
              });
            }
          }
        }
        /* If there are no storage types, remove them all from the DOM.
                TODO: Uncomment this out when storage type is supported in editor
                else{
                  $(objectDOM).find("storagetype").remove();
                }
                */

        // Update the measurementScale
        nodeToInsertAfter = undefined;
        const measurementScale = this.get("measurementScale");
        let measurementScaleNodes;
        let measurementScaleNode;
        let domainNode;
        if (typeof measurementScale !== "undefined" && measurementScale) {
          // Find the measurementScale child or create a new one
          measurementScaleNodes = $(objectDOM).children("measurementscale");
          if (measurementScaleNodes.length) {
            [measurementScaleNode] = measurementScaleNodes;
          } else {
            measurementScaleNode = document.createElement("measurementscale");
            nodeToInsertAfter = this.getEMLPosition(
              objectDOM,
              "measurementScale",
            );

            if (typeof nodeToInsertAfter === "undefined") {
              $(objectDOM).append(measurementScaleNode);
            } else {
              $(nodeToInsertAfter).after(measurementScaleNode);
            }
          }

          // Append the measurementScale domain content
          domainNode = measurementScale.updateDOM();
          if (typeof domainNode !== "undefined") {
            $(measurementScaleNode).children().remove();
            $(measurementScaleNode).append(domainNode);
          }
        }

        // Update annotations
        const annotation = this.get("annotation");

        // Always remove all annotations to start with
        $(objectDOM).children("annotation").remove();

        _.each(
          annotation,
          (anno) => {
            if (anno.isEmpty()) {
              return;
            }

            const after = this.getEMLPosition(objectDOM, "annotation");
            $(after).after(anno.updateDOM());
          },
          this,
        );

        // Update the missingValueCodes
        nodeToInsertAfter = undefined;
        const missingValueCodes = this.get("missingValueCodes");
        $(objectDOM).children("missingvaluecode").remove();
        if (missingValueCodes) {
          const missingValueCodeNodes = missingValueCodes.updateDOM();
          if (missingValueCodeNodes) {
            nodeToInsertAfter = this.getEMLPosition(
              objectDOM,
              "missingValueCode",
            );
            if (typeof nodeToInsertAfter === "undefined") {
              $(objectDOM).append(missingValueCodeNodes);
            } else {
              $(nodeToInsertAfter).after(missingValueCodeNodes);
            }
          }
        }

        return objectDOM;
      },

      /**
       * Get the DOM node preceding the given nodeName to find what position in
       * the EML document the named node should be appended
       * @param {Element} objectDOM - The DOM of the EML document
       * @param {string} nodeName - The name of the node to find the position of
       * @returns {Element} The DOM node to insert the named node after
       * or undefined if the node should be appended to the end of the objectDOM
       */
      getEMLPosition(objectDOM, nodeName) {
        const nodeOrder = this.get("nodeOrder");

        const position = _.indexOf(nodeOrder, nodeName);

        // Append to the bottom if not found
        if (position === -1) {
          return $(objectDOM).children().last()[0];
        }

        // Otherwise, go through each node in the node list and find the
        // position where this node will be inserted after
        for (let i = position - 1; i >= 0; i -= 1) {
          if ($(objectDOM).find(nodeOrder[i].toLowerCase()).length) {
            return $(objectDOM).find(nodeOrder[i].toLowerCase()).last()[0];
          }
        }
        return undefined;
      },

      /**
       * Format the given XML string
       * @param {string} xmlString - The XML string to format
       * @returns {string} The formatted XML string
       */
      formatXML(xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },

      /** @inheritdoc */
      validate() {
        const errors = {};

        // If there is no attribute name, add that error message
        if (!this.get("attributeName"))
          errors.attributeName = "Provide a name for this attribute.";

        // If there is no attribute definition, add that error message
        if (!this.get("attributeDefinition"))
          errors.attributeDefinition =
            "Provide a definition for this attribute.";

        // Get the EML measurement scale model
        const measurementScaleModel = this.get("measurementScale");

        // If there is no measurement scale model, then add that error message
        if (!measurementScaleModel) {
          errors.measurementScale =
            "Choose a measurement scale category for this attribute.";
        } else if (!measurementScaleModel.isValid()) {
          errors.measurementScale = "More information is needed.";
        }

        // Validate the missing value codes
        const missingValueCodesErrors =
          this.get("missingValueCodes")?.validate();
        if (missingValueCodesErrors) {
          // Just display the first error message
          [errors.missingValueCodes] = Object.values(missingValueCodesErrors);
        }

        // If there is a measurement scale model and it is valid and there are no other
        // errors, then trigger this model as valid and exit.
        if (!Object.keys(errors).length) {
          this.trigger("valid", this);
          return null;
        }
        // If there is at least one error, then return the errors object
        return errors;
      },

      /**
       * Validates each of the EMLAnnotation models on this model
       * @returns {Array} - Returns an array of error messages for all the
       * EMLAnnotation models
       */
      validateAnnotations() {
        const errors = [];

        // Validate each of the EMLAttributes
        _.each(this.get("annotation"), (anno) => {
          if (anno.isValid()) {
            return;
          }

          errors.push(anno.validationError);
        });

        return errors;
      },

      /**
       * Climbs up the model heirarchy until it finds the EML model
       * @returns {EML211|false} - Returns the EML 211 Model or false if not
       * found
       */
      getParentEML() {
        let emlModel = this.get("parentModel");
        let tries = 0;

        while (emlModel.type !== "EML" && tries < 6) {
          emlModel = emlModel.get("parentModel");
          tries += 1;
        }

        if (emlModel && emlModel.type === "EML") return emlModel;
        return false;
      },

      /** Let the top level package know of attribute changes from this object */
      trickleUpChange() {
        MetacatUI.rootDataPackage.packageModel.set("changed", true);
      },

      /** Set a new UUID on the xmlID property */
      createID() {
        this.set("xmlID", uuid.v4());
      },
    },
  );

  return EMLAttribute;
});
