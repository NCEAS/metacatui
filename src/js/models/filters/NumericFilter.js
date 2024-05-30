/* global define */
define(["jquery", "underscore", "backbone", "models/filters/Filter"], function (
  $,
  _,
  Backbone,
  Filter,
) {
  /**
   * @class NumericFilter
   * @classdesc A search filter whose search term is always an exact number or numbber range
   * @classcategory Models/Filters
   * @extends Filter
   * @constructs
   */
  var NumericFilter = Filter.extend(
    /** @lends NumericFilter.prototype */ {
      type: "NumericFilter",

      /**
       * Default attributes for this model
       * @extends Filter#defaults
       * @type {Object}
       * @property {Date}    min - The minimum number to use in the query for this filter
       * @property {Date}    max - The maximum number to use in the query for this filter
       * @property {Date}    rangeMin - The lowest possible number that 'min' can be
       * @property {Date}    rangeMax - The highest possible number that 'max' can be
       * @property {string}  nodeName - The XML node name to use when serializing this model into XML
       * @property {boolean} range - If true, this Filter will use a numeric range as the search term instead of an exact number
       * @property {number}  step - The number to increase the search value by when incrementally increasing or decreasing the numeric range
       */
      defaults: function () {
        return _.extend(Filter.prototype.defaults(), {
          nodeName: "numericFilter",
          min: null,
          max: null,
          rangeMin: null,
          rangeMax: null,
          range: true,
          step: 1,
        });
      },

      initialize: function (attributes, options) {
        const model = this;
        Filter.prototype.initialize.call(this, attributes, options);

        // Limit the range min, range max, and update step if the model switches from
        // being a coordinate filter to a regular numeric filter or vice versa
        model.listenTo(model, "change:fields", function () {
          model.toggleCoordinateLimits();
        });
        model.toggleCoordinateLimits();
      },

      /**
       * For filters that represent geographic coordinates, return the
       * appropriate defaults for the NumericFilter model.
       * @param {'latitude'|'longitude'} coord - The coordinate type to get
       * defaults for.
       * @returns {Object} The rangeMin, rangeMax, and step values for the
       * given coordinate type
       */
      coordDefaults: function (coord = "longitude") {
        return {
          rangeMin: coord === "longitude" ? -180 : -90,
          rangeMax: coord === "longitude" ? 180 : 90,
          step: 0.00001,
        };
      },

      /**
       * Add or remove the rangeMin, rangeMax, and step associated with
       * coordinate queries. If the filter is a coordinate filter, then add
       * the appropriate defaults for the rangeMin, rangeMax, and step. If
       * the filter is NOT a coordinate filter, then set rangeMin, rangeMax,
       * and step to the regular defaults for a numeric filter.
       * @param {Boolean} [overwrite=false] - By default, the rangeMin,
       * rangeMax, and step will only be reset if they are currently set to
       * one of the default values (e.g. if the model has default values for
       * a numeric filter, they will be set to the default values for a
       * coordinate filter). To change this behaviour to always reset the
       * attributes to the new defaults values, set overwrite to true.
       */
      toggleCoordinateLimits: function (overwrite = false) {
        try {
          const model = this;
          const lonDefaults = model.coordDefaults("longitude");
          const latDefaults = model.coordDefaults("latitude");
          const numDefaults = model.defaults();
          const attrs = Object.keys(lonDefaults); // 'rangeMin', 'rangeMax', and 'step'

          const isDefault = function (attr) {
            const val = model.get(attr);
            return (
              val == numDefaults[attr] ||
              val == latDefaults[attr] ||
              val == lonDefaults[attr]
            );
          };

          // When the model has changed to a numeric filter, set the range min, range max,
          // and step to the default values for a numeric filter, if they are currently set
          // to the default values for a coordinate filter (or when overwrite is true).
          let defaultsToSet = numDefaults;

          // When the model has changed to a coordinate filter, set the range min, range max,
          // and step to the default values for a coordinate filter, if they are currently set
          // to the default values for a numeric filter (or when overwrite is true).
          if (model.isCoordinateQuery()) {
            // Use longitude range (-180, 180) for longitude only queries, or queries with
            // both longitude and latitude
            defaultsToSet = lonDefaults;
            if (model.isLatitudeQuery()) {
              defaultsToSet = latDefaults;
            }
          }
          attrs.forEach(function (attr) {
            if (isDefault(attr) || overwrite) {
              model.set(attr, defaultsToSet[attr]);
            }
          });

          model.limitToRange();
          model.roundToStep();
        } catch (error) {
          console.log(
            "There was an error toggling Coordinate limits in a NumericFilter" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Ensures that the min, max, and value are within the rangeMin and rangeMax.
       */
      limitToRange: function () {
        try {
          const model = this;
          const min = model.get("min");
          const max = model.get("max");

          const rangeMin = model.get("rangeMin");
          const rangeMax = model.get("rangeMax");

          const values = model.get("values");
          const value = values != null && values.length ? values[0] : null;

          // Set MIN to min or max if it is outside the range
          if (min != null) {
            if (rangeMin != null && min < rangeMin) {
              model.set("min", rangeMin);
            }
            if (rangeMax != null && min > rangeMax) {
              model.set("min", rangeMax);
            }
          }

          // Set the MAX to min or max if it is outside the range
          if (max != null) {
            if (rangeMax != null && max > rangeMax) {
              model.set("max", rangeMax);
            }
            if (rangeMin != null && max < rangeMin) {
              model.set("max", rangeMin);
            }
          }

          // Set the VALUE to min or max if it is outside the range
          if (value != null) {
            if (rangeMax != null && value > rangeMax) {
              values[0] = rangeMax;
              model.set("values", values);
            }
            if (rangeMin != null && value < rangeMin) {
              values[0] = rangeMin;
              model.set("values", values);
            }
          }
        } catch (error) {
          console.log(
            "There was an error limiting a NumericFilter to the range" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Rounds the min, max, and/or value to the same number of decimal
       * places as the step.
       */
      roundToStep: function () {
        try {
          const model = this;
          const min = model.get("min");
          const max = model.get("max");
          const step = model.get("step");

          const values = model.get("values");
          const value = values != null && values.length ? values[0] : null;

          // Returns the number of decimal places in a number
          function countDecimals(n) {
            let text = n.toString();
            // verify if number 0.000005 is represented as "5e-6"
            if (text.indexOf("e-") > -1) {
              let [base, trail] = text.split("e-");
              let deg = parseInt(trail, 10);
              return deg;
            }
            // count decimals for number in representation like "0.123456"
            if (Math.floor(n) !== n) {
              return n.toString().split(".")[1].length || 0;
            }
            return 0;
          }

          // Rounds a number to the specified number of decimal places
          function roundTo(n, digits) {
            if (digits === undefined) {
              digits = 0;
            }
            const multiplicator = Math.pow(10, digits);
            n = parseFloat((n * multiplicator).toFixed(11));
            const test = Math.round(n) / multiplicator;
            return +test.toFixed(digits);
          }

          // Round min & max to number of decimal places in step
          if (step != null) {
            let digits = countDecimals(step);
            if (min != null) {
              model.set("min", roundTo(min, digits));
            }
            if (max != null) {
              model.set("max", roundTo(max, digits));
            }
            if (value != null) {
              values[0] = roundTo(value, digits);
              model.set("values", values);
            }
          }
        } catch (error) {
          console.log(
            "There was an error rounding values in a NumericFilter to the step" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Parses the numericFilter XML node into JSON
       *
       * @param {Element} xml - The XML Element that contains all the NumericFilter elements
       * @return {JSON} - The JSON object literal to be set on the model
       */
      parse: function (xml) {
        try {
          var modelJSON = Filter.prototype.parse.call(this, xml);

          //Get the rangeMin and rangeMax nodes
          var rangeMinNode = $(xml).find("rangeMin"),
            rangeMaxNode = $(xml).find("rangeMax");

          //Parse the range min
          if (rangeMinNode.length) {
            modelJSON.rangeMin = parseFloat(rangeMinNode[0].textContent);
          }
          //Parse the range max
          if (rangeMaxNode.length) {
            modelJSON.rangeMax = parseFloat(rangeMaxNode[0].textContent);
          }

          //If this Filter is in a filter group, don't parse the values
          if (!this.get("isUIFilterType")) {
            //Get the min, max, and value nodes
            var minNode = $(xml).find("min"),
              maxNode = $(xml).find("max"),
              valueNode = $(xml).find("value");

            //Parse the min value
            if (minNode.length) {
              modelJSON.min = parseFloat(minNode[0].textContent);
            }
            //Parse the max value
            if (maxNode.length) {
              modelJSON.max = parseFloat(maxNode[0].textContent);
            }
            //Parse the value
            if (valueNode.length) {
              modelJSON.values = [parseFloat(valueNode[0].textContent)];
            }
          }
          //If a range min and max was given, or if a min and max value was given,
          // then this NumericFilter should be presented as a numeric range (rather than
          // an exact numeric value).
          if (
            rangeMinNode.length ||
            rangeMaxNode.length ||
            (minNode.length && maxNode.length)
          ) {
            //Set the range attribute on the JSON
            modelJSON.range = true;
          } else {
            //Set the range attribute on the JSON
            modelJSON.range = false;
          }

          //If a range step was given, save it
          if (modelJSON.range) {
            var stepNode = $(xml).find("step");

            if (stepNode.length) {
              //Parse the text content of the node into a float
              modelJSON.step = parseFloat(stepNode[0].textContent);
            }
          }
        } catch (e) {
          //If an error occurred while parsing the XML, return a blank JS object
          //(i.e. this model will just have the default values).
          return {};
        }

        return modelJSON;
      },

      /**
       * Builds a query string that represents this filter.
       *
       * @return {string} The query string to send to Solr
       */
      getQuery: function () {
        //Start the query string
        var queryString = "";

        if (
          // For numeric filters that are ranges, only construct the query if the min or max
          // is different than the default
          this.get("min") != this.get("rangeMin") ||
          this.get("max") != this.get("rangeMax") ||
          // Otherwise, a numeric filter could search for an exact value
          (this.get("values") && this.get("values").length)
        ) {
          //Iterate over each filter field and add to the query string
          _.each(
            this.get("fields"),
            function (field, i, allFields) {
              //Get the minimum, maximum, and value.
              var max = this.get("max"),
                min = this.get("min"),
                value = this.get("values") ? this.get("values")[0] : null,
                escapeMinus = function (val) {
                  return val.toString().replace("-", "\\%2D");
                },
                exists = function (val) {
                  return val !== null && val !== undefined;
                };

              //Construct a query string for ranges, min, or max
              if (this.get("range") || max || max === 0 || min || min === 0) {
                //If no min or max was set, but there is a value, construct an exact value match query
                if (
                  !min &&
                  min !== 0 &&
                  !max &&
                  max !== 0 &&
                  (value || value === 0)
                ) {
                  // Escape the minus sign if needed
                  queryString += field + ":" + escapeMinus(value);
                }
                //If there is no min or max or value, set an empty query string
                else if (
                  !min &&
                  min !== 0 &&
                  !max &&
                  max !== 0 &&
                  !value &&
                  value !== 0
                ) {
                  queryString = "";
                }
                //If there is at least a min or max
                else {
                  //If there's a min but no max, set the max to a wildcard (unbounded)
                  if (exists(min) && !exists(max)) {
                    max = "*";
                  }
                  //If there's a max but no min, set the min to a wildcard (unbounded)
                  else if (exists(max) && !exists(min)) {
                    min = "*";
                  }
                  //If the max is higher than the min, set the max to a wildcard (unbounded)
                  else if (exists(max) && exists(min) && max < min) {
                    max = "*";
                  }

                  //Add the range for this field to the query string
                  queryString +=
                    field +
                    ":[" +
                    escapeMinus(min) +
                    "%20TO%20" +
                    escapeMinus(max) +
                    "]";
                }
              }
              //If there is a value set, construct an exact numeric match query
              else if (value || value === 0) {
                // If there is a value set, construct an exact numeric match query
                queryString += field + ":" + escapeMinus(value);
              }

              //If there is another field, add an operator
              if (allFields[i + 1] && queryString.length) {
                queryString += "%20" + this.get("fieldsOperator") + "%20";
              }
            },
            this,
          );

          //If there is more than one field, wrap the query in parentheses
          if (this.get("fields").length > 1 && queryString.length) {
            queryString = "(" + queryString + ")";
          }
        }

        return queryString;
      },

      /**
       * Updates the XML DOM with the new values from the model
       *  @inheritdoc
       *  @return {XMLElement} An updated numericFilter XML element from a portal document
       */
      updateDOM: function (options) {
        try {
          if (typeof options == "undefined") {
            var options = {};
          }

          var objectDOM = Filter.prototype.updateDOM.call(this);

          //Numeric Filters don't use matchSubstring nodes
          $(objectDOM).children("matchSubstring").remove();

          //Get a clone of the original DOM
          var originalDOM;
          if (this.get("objectDOM")) {
            originalDOM = this.get("objectDOM").cloneNode(true);
          }

          // Get new numeric data
          var numericData = {
            min: this.get("min"),
            max: this.get("max"),
          };

          if (this.get("isUIFilterType")) {
            numericData = _.extend(numericData, {
              rangeMin: this.get("rangeMin"),
              rangeMax: this.get("rangeMax"),
              step: this.get("step"),
            });
          }

          // Make subnodes and append to DOM
          _.map(
            numericData,
            function (value, nodeName) {
              if (value || value === 0) {
                //If this value is the same as the default value, but it wasn't previously serialized,
                if (
                  value == this.defaults()[nodeName] &&
                  (!$(originalDOM).children(nodeName).length ||
                    $(originalDOM).children(nodeName).text() !=
                      value + "-01-01T00:00:00Z")
                ) {
                  return;
                }

                var nodeSerialized =
                  objectDOM.ownerDocument.createElement(nodeName);
                $(nodeSerialized).text(value);
                $(objectDOM).append(nodeSerialized);
              }
            },
            this,
          );

          //Remove filterOptions for collection definition filters
          if (!this.get("isUIFilterType")) {
            $(objectDOM).children("filterOptions").remove();
          } else {
            //Make sure the filterOptions are listed last
            //Get the filterOptions element
            var filterOptions = $(objectDOM).children("filterOptions");
            //If the filterOptions exist
            if (filterOptions.length) {
              //Detach from their current position and append to the end
              filterOptions.detach();
              $(objectDOM).append(filterOptions);
            }
          }

          // If there is a min or max or both, there must not be a value
          if (
            numericData.min ||
            numericData.min === 0 ||
            numericData.max ||
            numericData.max === 0
          ) {
            $(objectDOM).children("value").remove();
          }

          return objectDOM;
        } catch (e) {
          return "";
        }
      },

      /**
       * Creates a human-readable string that represents the value set on this model
       * @return {string}
       */
      getReadableValue: function () {
        var readableValue = "";

        var min = this.get("min"),
          max = this.get("max"),
          value = this.get("values")[0];

        if (!value && value !== 0) {
          //If there is a min and max
          if ((min || min === 0) && (max || max === 0)) {
            readableValue = min + " to " + max;
          }
          //If there is only a max
          else if (max || max === 0) {
            readableValue = "No more than " + max;
          } else {
            readableValue = "At least " + min;
          }
        } else {
          readableValue = value;
        }

        return readableValue;
      },

      /**
       * @inheritdoc
       */
      hasChangedValues: function () {
        return (
          this.get("values").length > 0 ||
          this.get("min") != this.defaults().min ||
          this.get("max") != this.defaults().max
        );
      },

      /**
       * Checks if the values set on this model are valid and expected
       * @return {object} - Returns a literal object with the invalid attributes and their corresponding error message
       */
      validate: function () {
        //Validate most of the NumericFilter attributes using the parent validate function
        var errors = Filter.prototype.validate.call(this);

        //If everything is valid so far, then we have to create a new object to store errors
        if (typeof errors != "object") {
          errors = {};
        }

        //Delete error messages for the attributes that are going to be validated specially for the NumericFilter
        delete errors.values;
        delete errors.min;
        delete errors.max;
        delete errors.rangeMin;
        delete errors.rangeMax;

        //If there is an exact number set as the search term
        if (Array.isArray(this.get("values")) && this.get("values").length) {
          //Check that all the values are numbers
          if (
            _.find(this.get("values"), function (n) {
              return typeof n != "number";
            })
          ) {
            errors.values =
              "All of the search terms for this filter need to be numbers.";
          }
        }
        //If there is a search term set on the model that is not an array, or number,
        // or undefined, or null, then it is some other invalid value like a string or date.
        else if (
          !Array.isArray(this.get("values")) &&
          typeof values != "number" &&
          typeof values != "undefined" &&
          values !== null
        ) {
          errors.values = "The search term for this filter needs to a number.";
        }
        //Check that the min and max values are in order, if the minimum is not the default value of 0
        else if (
          typeof this.get("min") == "number" &&
          typeof this.get("max") == "number"
        ) {
          if (this.get("min") > this.get("max") && this.get("min") != 0) {
            errors.min =
              "The minimum is after the maximum. The minimum must be a number less than the maximum, which is " +
              this.get("max");
          }
        }
        //If there is only a minimum number specified, check that it is a number
        else if (this.get("min") && typeof this.get("min") != "number") {
          errors.min = "The minimum needs to be a number.";
          if (this.get("max") && typeof this.get("max") != "number") {
            errors.max = "The maximum needs to be a number.";
          }
        }
        //Check if the maximum is a value other than a number
        else if (this.get("max") && typeof this.get("max") != "number") {
          errors.max = "The maximum needs to be a number.";
        }
        //If there is no min, max, or value, then return an errors
        else if (
          !this.get("max") &&
          this.get("max") !== 0 &&
          !this.get("min") &&
          this.get("min") !== 0 &&
          ((!this.get("values") && this.get("values") !== 0) ||
            (Array.isArray(this.get("values")) && !this.get("values").length))
        ) {
          errors.values =
            "This search filter needs an exact number or a number range to use in the search query.";
        }

        //Return the error messages
        if (Object.keys(errors).length) {
          return errors;
        } else {
          return;
        }
      },
    },
  );

  return NumericFilter;
});
