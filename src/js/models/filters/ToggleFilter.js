define(["jquery", "underscore", "backbone", "models/filters/Filter"], function (
  $,
  _,
  Backbone,
  Filter,
) {
  /**
   * @class ToggleFilter
   * @classdesc A search filter whose search term is only one of two opposing choices
   * @classcategory Models/Filters
   * @constructs ToggleFilter
   * @extends Filter
   */
  var ToggleFilter = Filter.extend(
    /** @lends ToggleFilter.prototype */ {
      type: "ToggleFilter",

      /**
       * The Backbone Model attributes set on this ToggleFilter
       * @type {object}
       * @extends Filter#defaultts
       * @property {string}         trueLabel - A human-readable label for the first search term
       * @property {string}         falseLabel - A human-readable label for the second search term
       * @property {string|boolean} trueValue - The exact search value to use for search term one
       * @property {string|boolean} falseValue - The exact search value to use for search term two
       * @property {string}         nodeName - The XML node name to use when serializing this model into XML
       */
      defaults: function () {
        return _.extend(Filter.prototype.defaults(), {
          trueLabel: "On",
          trueValue: null,
          falseLabel: "Off",
          falseValue: null,
          nodeName: "toggleFilter",
        });
      },

      /*
       * Parses the ToggleFilter XML node into JSON
       *
       * @param {Element} xml - The XML Element that contains all the ToggleFilter elements
       * @return {JSON} - The JSON object literal to be set on the model
       */
      parse: function (xml) {
        var modelJSON = Filter.prototype.parse.call(this, xml);

        //Parse the trueLabel and falseLabels
        modelJSON.trueLabel = this.parseTextNode(xml, "trueLabel");
        modelJSON.trueValue = this.parseTextNode(xml, "trueValue");
        modelJSON.falseLabel = this.parseTextNode(xml, "falseLabel");
        modelJSON.falseValue = this.parseTextNode(xml, "falseValue");

        //Delete any attributes from the JSON that don't exist in the XML
        if (!modelJSON.trueLabel) {
          delete modelJSON.trueLabel;
        }
        if (!modelJSON.falseLabel) {
          delete modelJSON.falseLabel;
        }
        if (!modelJSON.trueValue && modelJSON.trueValue !== false) {
          delete modelJSON.trueValue;
        }
        if (!modelJSON.falseValue && modelJSON.falseValue !== false) {
          delete modelJSON.falseValue;
        }

        return modelJSON;
      },

      /**
       * Updates the XML DOM with the new values from the model
       *  @inheritdoc
       *  @return {XMLElement} An updated toggleFilter XML element from a portal document
       */
      updateDOM: function (options) {
        try {
          var objectDOM = Filter.prototype.updateDOM.call(this, options);

          if (
            typeof options == "undefined" ||
            (typeof options == "object" && this.get("isUIFilterType"))
          ) {
            var toggleData = {
              trueValue: this.get("trueValue"),
              trueLabel: this.get("trueLabel"),
              falseValue: this.get("falseValue"),
              falseLabel: this.get("falseLabel"),
            };

            // Make and append new subnodes
            _.map(
              toggleData,
              function (value, nodeName) {
                // Remove the node if it exists in the DOM already
                $(objectDOM).find(nodeName).remove();

                // Don't serialize falsey or default values
                if (
                  (value || value === false) &&
                  value != this.defaults()[nodeName]
                ) {
                  var nodeSerialized =
                    objectDOM.ownerDocument.createElement(nodeName);
                  $(nodeSerialized).text(value);
                  $(objectDOM).append(nodeSerialized);
                }
              },
              this,
            );

            //Move the filterOptions node to the end of the filter node
            /*  var filterOptionsNode = $(objectDOM).find("filterOptions");
          filterOptionsNode.detach();
          $(objectDOM).append(filterOptionsNode);*/
          }
          //For collection definitions, serialize the filter differently
          else {
            //Remove the filterOptions
            $(objectDOM).find("filterOptions").remove();

            //Change the root element into a <filter> element
            var newFilterEl = objectDOM.ownerDocument.createElement("filter");
            $(newFilterEl).html($(objectDOM).children());

            //Return this node
            return newFilterEl;
          }

          return objectDOM;
        } catch (e) {
          //If there's an error, return the original DOM or an empty string
          console.log(
            "error updating the toggle filter object DOM, returning un-updated object DOM instead. Error message: " +
              e,
          );
          return this.get("objectDOM") || "";
        }
      },

      /**
       * Checks if the values set on this model are valid and expected
       * @return {object} - Returns a literal object with the invalid attributes and their
       * corresponding error message
       */
      validate: function () {
        try {
          // Validate most of the ToggleFilter attributes using the parent validate
          // function
          var errors = Filter.prototype.validate.call(this);

          // If everything is valid so far, then we have to create a new object to store
          // errors
          if (typeof errors != "object") {
            errors = {};
          }

          // Delete error messages for the attributes that are going to be validated
          // specially for the ToggleFilter
          ["trueLabel", "trueValue", "falseLabel", "falseValue"].forEach(
            function (attr) {
              delete errors[attr];
            },
          );

          // At least one trueValue required
          var trueValue = this.get("trueValue");
          if (!trueValue) {
            errors.trueValue =
              "The filter requires a term to search for when the toggle is on";
          }

          // Return the errors, if there are any
          if (Object.keys(errors).length) return errors;
          else {
            return;
          }
        } catch (error) {
          console.log(
            "There was an error validating a ToggleFilter" +
              ". Error details: " +
              error,
          );
        }
      },
    },
  );

  return ToggleFilter;
});
