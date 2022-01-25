define(["jquery", "underscore", "backbone"],
  function ($, _, Backbone) {

    /**
     * @class EMLAnnotation
     * @classdesc Stores EML SemanticAnnotation elements.
     * @classcategory Models/Metadata/EML211
     * @see https://eml.ecoinformatics.org/eml-2.2.0/eml-semantics.xsd
     */
    var EMLAnnotation = Backbone.Model.extend(
          /** @lends EMLAnnotation.prototype */{

        type: "EMLAnnotation",

        defaults: function () {
          return {
            isNew: true,
            propertyLabel: null,
            propertyURI: null,
            valueLabel: null,
            valueURI: null,
            objectDOM: null,
            objectXML: null
          }
        },

        initialize: function (attributes, opions) {
          this.on("change", this.trickleUpChange);
        },

        parse: function (attributes, options) {
          // If parsing, this is an existing annotation so it's not isNew
          attributes.isNew = false;

          var propertyURI = $(attributes.objectDOM).find("propertyuri");
          var valueURI = $(attributes.objectDOM).find("valueuri");

          if (propertyURI.length !== 1 || valueURI.length !== 1) {
            return;
          }

          attributes.propertyURI = $(propertyURI).text().trim();

          attributes.valueURI = $(valueURI).text().trim();

          var propertyLabel = $(propertyURI).attr("label");
          var valueLabel = $(valueURI).attr("label");

          if (!propertyLabel || !valueLabel) {
            return;
          }

          attributes.propertyLabel = propertyLabel.trim();
          attributes.valueLabel = valueLabel.trim();

          return attributes;
        },

        validate: function () {
          var errors = [];

          if (this.isEmpty()) {
            this.trigger("valid");

            return;
          }

          var propertyURI = this.get("propertyURI");

          if (!propertyURI || propertyURI.length <= 0) {
            errors.push({ category: "propertyURI", message: "Property URI must be set." });
          } else if (propertyURI.match(/http[s]?:\/\/.+/) === null) {
            errors.push({ category: "propertyURI", message: "Property URI should be an HTTP(S) URI." });
          }

          var propertyLabel = this.get("propertyLabel");

          if (!propertyLabel || propertyLabel.length <= 0) {
            errors.push({ category: "propertyLabel", message: "Property Label must be set." });
          }

          var valueURI = this.get("valueURI");

          if (!valueURI || valueURI.length <= 0) {
            errors.push({ category: "valueURI", message: "Value URI must be set." });
          } else if (valueURI.match(/http[s]?:\/\/.+/) === null) {
            errors.push({ category: "valueURI", message: "Value URI should be an HTTP(S) URI." });
          }

          var valueLabel = this.get("valueLabel");

          if (!valueLabel || valueLabel.length <= 0) {
            errors.push({ category: "valueLabel", message: "Value Label must be set." });
          }

          if (errors.length === 0) {
            this.trigger("valid");

            return;
          }

          return errors;
        },

        updateDOM: function (objectDOM) {
          objectDOM = document.createElement("annotation");

          if (this.get("propertyURI")) {
            var propertyURIEl = document.createElement("propertyuri");
            $(propertyURIEl).html(this.get("propertyURI"));

            if (this.get("propertyLabel")) {
              $(propertyURIEl).attr("label", this.get("propertyLabel"));
            }

            $(objectDOM).append(propertyURIEl);
          }

          if (this.get("valueURI")) {
            var valueURIEl = document.createElement("valueuri");
            $(valueURIEl).html(this.get("valueURI"));

            if (this.get("valueLabel")) {
              $(valueURIEl).attr("label", this.get("valueLabel"));
            }

            $(objectDOM).append(valueURIEl);
          }

          return objectDOM;
        },

        formatXML: function (xmlString) {
          return DataONEObject.prototype.formatXML.call(this, xmlString);
        },

        /**
         * isEmpty
         *
         * Check whether the model's properties are all empty for the purpose
         * of skipping the model during serialization to avoid invalid EML
         * documents.
         *
         * @return {boolean} - Returns true if all child elements have no
         * content
         */
        isEmpty: function () {
          return (typeof this.get("propertyLabel") !== "string" || this.get("propertyLabel").length <= 0) &&
            (typeof this.get("propertyURI") !== "string" || this.get("propertyURI").length <= 0) &&
            (typeof this.get("valueLabel") !== "string" || this.get("valueLabel").length <= 0) &&
            (typeof this.get("valueURI") !== "string" || this.get("valueURI").length <= 0)
        },

        /* Let the top level package know of attribute changes from this object */
        trickleUpChange: function () {
          MetacatUI.rootDataPackage.packageModel.set("changed", true);
        }
      });

    return EMLAnnotation;
  }
);
