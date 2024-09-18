define(["jquery", "underscore", "backbone", "models/filters/Filter"], function (
  $,
  _,
  Backbone,
  Filter,
) {
  /**
   * @class ChoiceFilter
   * @classdesc A Filter whose search term is one or more choices from a defined list
   * @classcategory Models/Filters
   * @name ChoiceFilter
   * @constructs ChoiceFilter
   * @extends Filter
   */
  var ChoiceFilter = Filter.extend(
    /** @lends ChoiceFilter.prototype */ {
      /**
       * @inheritdoc
       * @type {string}
       */
      type: "ChoiceFilter",

      /**
       * The Backbone Model attributes set on this ChoiceFilter
       * @type {object}
       * @extends Filter#defaultts
       * @property {boolean} chooseMultiple - If true, this ChoiceFilter can have multiple choices set as the search term
       * @property {string[]} choices - The list of search terms that can possibly be set on this Filter
       * @property {string} nodeName - The XML node name to use when serializing this model into XML
       */
      defaults: function () {
        return _.extend(Filter.prototype.defaults(), {
          chooseMultiple: true,
          //@type {object} - A literal JS object with a "label" and "value" attribute
          choices: [],
          nodeName: "choiceFilter",
        });
      },

      /**
       * Parses the choiceFilter XML node into JSON
       *
       * @param {Element} xml - The XML Element that contains all the ChoiceFilter elements
       * @return {JSON} - The JSON object literal to be set on the model
       */
      parse: function (xml) {
        var modelJSON = Filter.prototype.parse.call(this, xml);

        //Parse the chooseMultiple boolean field
        modelJSON.chooseMultiple =
          this.parseTextNode(xml, "chooseMultiple") === "true" ? true : false;

        //Start an array for the choices
        modelJSON.choices = [];

        //Iterate over each choice and parse it
        var self = this;
        $(xml)
          .find("choice")
          .each(function (i, choiceNode) {
            //Parse the label and value nodes into a literal object
            var choiceObject = {
              label: self.parseTextNode(choiceNode, "label"),
              value: self.parseTextNode(choiceNode, "value"),
            };

            //Check that there is a label and value (value can be boolean false or 0, so just check for null or undefined)
            if (
              choiceObject.label &&
              choiceObject.value !== null &&
              typeof choiceObject.value !== "undefined"
            ) {
              modelJSON.choices.push(choiceObject);
            }
          });

        return modelJSON;
      },

      /**
       * Updates the XML DOM with the new values from the model
       *  @inheritdoc
       *  @return {XMLElement} An updated choiceFilter XML element from a portal document
       */
      updateDOM: function (options) {
        try {
          var objectDOM = Filter.prototype.updateDOM.call(this);

          if (typeof options != "object") {
            var options = {};
          }

          if (this.get("isUIFilterType")) {
            // Serialize <choice> elements
            var choices = this.get("choices");

            if (choices) {
              //Remove all the choice elements
              $(objectDOM).children("choice").remove();

              //Make a new choice element for each choice in the model
              _.each(choices, function (choice) {
                // Make new <choice> node
                choiceSerialized =
                  objectDOM.ownerDocument.createElement("choice");
                // Make choice subnodes <label> and <value>
                _.map(choice, function (value, nodeName) {
                  if (value || value === false) {
                    var nodeSerialized =
                      objectDOM.ownerDocument.createElement(nodeName);
                    $(nodeSerialized).text(value);
                    $(choiceSerialized).append(nodeSerialized);
                  }
                });
                // append subnodes
                $(objectDOM).append(choiceSerialized);
              });
            }

            //Get the chooseMultiple value from the model
            var chooseMultiple = this.get("chooseMultiple");
            //Remove the chooseMultiple element
            $(objectDOM).children("chooseMultiple").remove();
            //If the model value is a boolean, create a chooseMultiple element and add it to the DOM
            if (chooseMultiple === true || chooseMultiple === false) {
              chooseMultipleSerialized =
                objectDOM.ownerDocument.createElement("chooseMultiple");
              $(chooseMultipleSerialized).text(chooseMultiple);
              $(objectDOM).append(chooseMultipleSerialized);
            }
          } else {
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
          // Validate most of the ChoiceFilter attributes using the parent validate
          // function
          var errors = Filter.prototype.validate.call(this);

          // If everything is valid so far, then we have to create a new object to store
          // errors
          if (typeof errors != "object") {
            errors = {};
          }

          // Delete error messages for the attributes that are going to be validated
          // specially for the ChoiceFilter
          delete errors.choices;

          // Save a reference to the choices
          var choices = this.get("choices");

          // Ensure that there is at least one choice
          if (!choices || choices.length === 0) {
            errors.choices = "At least one search term option is required.";
          } else {
            // Remove any empty choices
            choices = choices.filter(function (choice) {
              return choice.value || choice.label;
            });
            // If there is no value but there is a label, then set the search value to the
            // label. If there is a value but no label, set the label to the value.
            choices.forEach(function (choice) {
              if (!choice.value) {
                choice.value = choice.label;
              }
              if (!choice.label) {
                choice.label = choice.value;
              }
            });
          }

          // Return the errors, if there are any
          if (Object.keys(errors).length) return errors;
          else {
            return;
          }
        } catch (error) {
          console.log(
            "There was an error validating a ChoiceFilter" +
              ". Error details: " +
              error,
          );
        }
      },
    },
  );

  return ChoiceFilter;
});
