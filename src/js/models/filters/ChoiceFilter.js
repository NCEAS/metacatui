/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var ChoiceFilter = Filter.extend({

    type: "ChoiceFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        chooseMultiple: true,
        //@type {object} - A literal JS object with a "label" and "value" attribute
        choices: []
      });
    },

    /*
    * Parses the choiceFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the ChoiceFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Parse the chooseMultiple boolean field
      modelJSON.chooseMultiple = (this.parseTextNode(xml, "chooseMultiple") === "true")? true : false;

      //Start an array for the choices
      modelJSON.choices = [];

      //Iterate over each choice and parse it
      var self = this;
      $(xml).find("choice").each(function(i, choiceNode){

        //Parse the label and value nodes into a literal object
        var choiceObject = {
          label: self.parseTextNode(choiceNode, "label"),
          value: self.parseTextNode(choiceNode, "value")
        }

        //Check that there is a label and value (value can be boolean false or 0, so just check for null or undefined)
        if(choiceObject.label && choiceObject.value !== null && typeof choiceObject.value !== "undefined"){
          modelJSON.choices.push(choiceObject);
        }

      });

      return modelJSON;
    }

  });

  return ChoiceFilter;
});
