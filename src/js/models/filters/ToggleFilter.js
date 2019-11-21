/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @constructs ToggleFilter
  * @extends Filter
  */
	var ToggleFilter = Filter.extend({

    type: "ToggleFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        trueLabel: "On",
        trueValue: null,
        falseLabel: "Off",
        falseValue: null,
        nodeName: "toggleFilter"
      });
    },

    /*
    * Parses the ToggleFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the ToggleFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse.call(this, xml);

      //Parse the trueLabel and falseLabels
      modelJSON.trueLabel = this.parseTextNode(xml, "trueLabel");
      modelJSON.trueValue = this.parseTextNode(xml, "trueValue");
      modelJSON.falseLabel = this.parseTextNode(xml, "falseLabel");
      modelJSON.falseValue = this.parseTextNode(xml, "falseValue");

      //Delete any attributes from the JSON that don't exist in the XML
      if( !modelJSON.trueLabel ){
        delete modelJSON.trueLabel;
      }
      if( !modelJSON.falseLabel ){
        delete modelJSON.falseLabel;
      }
      if( !modelJSON.trueValue && modelJSON.trueValue !== false ){
        delete modelJSON.trueValue;
      }
      if( !modelJSON.falseValue && modelJSON.falseValue !== false ){
        delete modelJSON.falseValue;
      }

      return modelJSON;
    },

    /**
     * Updates the XML DOM with the new values from the model
     *  @inheritdoc
     *  @return {XMLElement} An updated toggleFilter XML element from a portal document
    */
    updateDOM: function(options){

      try{
        var objectDOM = Filter.prototype.updateDOM.call(this, options);

        if( (typeof options == "undefined") || (typeof options == "object" && !options.forCollection) ){

          var toggleData = {
            trueValue: this.get("trueValue"),
            trueLabel: this.get("trueLabel"),
            falseValue: this.get("falseValue"),
            falseLabel: this.get("falseLabel")
          }

          // Make and append new subnodes
          _.map(toggleData, function(value, nodeName){

            // Remove the node if it exists in the DOM already
            $(objectDOM).find(nodeName).remove();

            // Don't serialize falsey or default values
            if((value || value === false) && value != this.defaults()[nodeName]){

              var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
              $(nodeSerialized).text(value);
              $(objectDOM).append(nodeSerialized);
            }

          }, this);

          //Move the filterOptions node to the end of the filter node
        /*  var filterOptionsNode = $(objectDOM).find("filterOptions");
          filterOptionsNode.detach();
          $(objectDOM).append(filterOptionsNode);*/

        }
        //For collection definitions, serialize the filter differently
        else{
          //Remove the filterOptions
          $(objectDOM).find("filterOptions").remove();

          //Change the root element into a <filter> element
          var newFilterEl = objectDOM.ownerDocument.createElement("filter");
          $(newFilterEl).html( $(objectDOM).children() );

          //Return this node
          return newFilterEl;
        }

        return objectDOM;
      }
      //If there's an error, return the original DOM or an empty string
      catch(e){
        console.log("error updating the toggle filter object DOM, returning un-updated object DOM instead. Error message: " + e);
        return this.get("objectDOM") || "";
      }
    }

  });

  return ToggleFilter;
});
