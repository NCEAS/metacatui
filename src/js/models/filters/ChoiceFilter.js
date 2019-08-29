/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @constructs ChoiceFilter
  * @extends Filter
  */
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

      var modelJSON = Filter.prototype.parse.call(this, xml);

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
    },

    /**
     * Updates the XML DOM with the new values from the model
     *  @inheritdoc
     *  @return {XMLElement} An updated choiceFilter XML element from a portal document
    */
    updateDOM:function(options){

      try{

        var objectDOM = Filter.prototype.updateDOM.call(this);

        if(typeof options != "object"){
          var options = {};
        }

        if( !options.forCollection ){
          // Serialize <choice> elements
          var choices = this.get("choices");

          if(choices){
            _.each(choices, function(choice){
              // Make new <choice> node
              choiceSerialized = objectDOM.ownerDocument.createElement("choice");
              // Make choice subnodes <label> and <value>
              _.map(choice, function(value, nodeName){

                if(value || value === false){
                  var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
                  $(nodeSerialized).text(value);
                  $(choiceSerialized).append(nodeSerialized);
                }

              });
            // append subnodes
            $(objectDOM).append(choiceSerialized);

            });

          }

          // Serialize the <chooseMultiple> element
          var chooseMultiple = this.get("chooseMultiple");
          if(chooseMultiple === true || chooseMultiple === false){
            chooseMultipleSerialized = objectDOM.ownerDocument.createElement("chooseMultiple");
            $(chooseMultipleSerialized).text(chooseMultiple);
            $(objectDOM).append(chooseMultipleSerialized);
          };
        }
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
        return this.get("objectDOM") || "";
      }

    }

  });

  return ChoiceFilter;
});
