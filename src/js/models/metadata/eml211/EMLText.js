/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'],
    function($, _, Backbone, DataONEObject) {

  /**
  * @class EMLText211
  * @classdesc A model that represents the EML 2.1.1 Text module
  * @classcategory Models/Metadata/EML211
  * @extends Backbone.Model
  */
  var EMLText = Backbone.Model.extend(
    /** @lends EMLText211.prototype */{

    type: "EMLText",

    defaults: function(){
      return {
        objectXML: null,
        objectDOM: null,
        parentModel: null,
        originalText: [],
        text: [] //The text content
      }
    },

    initialize: function(attributes){
      var attributes = attributes || {}

      if(attributes.objectDOM)
        this.set(this.parse(attributes.objectDOM));

      if(attributes.text) {
        if (_.isArray(attributes.text)) {
          this.text = attributes.text
        } else {
          this.text = [attributes.text]
        }
      }

      this.on("change:text", this.trickleUpChange);
    },

    /**
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
         * Used during parse() and serialize()
         */
    nodeNameMap: function(){
      return{

      }
    },

    /**
    * function setText
    *
    * @param text {string} - The text, usually taken directly from an HTML textarea
    * value, to parse and set on this model
    */
    setText: function(text){

      if( typeof text !== "string" )
        return "";

      let model = this;

      require(["models/metadata/eml211/EML211"], function(EMLModel){
        //Get the EML model and use the cleanXMLText function to clean up the text
        text = EMLModel.prototype.cleanXMLText(text);

        //Get the list of paragraphs - checking for carriage returns and line feeds
        var paragraphsCR = text.split(String.fromCharCode(13));
        var paragraphsLF = text.split(String.fromCharCode(10));

        //Use the paragraph list that has the most
        var paragraphs = (paragraphsCR > paragraphsLF)? paragraphsCR : paragraphsLF;

        paragraphs = _.map(paragraphs, function(p){ return p.trim() });

        model.set("text", paragraphs);
      });

    },

    parse: function(objectDOM){
      if(!objectDOM)
        var objectDOM = this.get("objectDOM").cloneNode(true);

      //Start a list of paragraphs
      var paragraphs = [];

      //Get all the child nodes of this text element
      var $objectDOM = $(objectDOM);

      // Save all the contained nodes as paragraphs
      // ignore any nested formatting elements for now
      //TODO: Support more detailed text formatting
      if( $objectDOM.children().length ){

        paragraphs = this.parseNestedElements($objectDOM);

      }
      else if( objectDOM.textContent ){
        paragraphs[0] = objectDOM.textContent;
      }

      return {
        text: paragraphs,
        originalText: paragraphs.slice(0) //The slice function will effectively clone the array
      }
    },

    parseNestedElements: function(nodeEl){

      let children = $(nodeEl).children(),
          paragraphs = [];

      children.each((i, childNode) => {
        if( $(childNode).children().length ){
          paragraphs = paragraphs.concat(this.parseNestedElements(childNode));
        }
        else{
          paragraphs = paragraphs.concat(this.parseParagraphs(childNode));
        }
      })

      return paragraphs;
    },

    parseParagraphs: function(nodeEl){
      if( nodeEl.textContent ){

        //Get the list of paragraphs - checking for carriage returns and line feeds
        var paragraphsCR = nodeEl.textContent.split(String.fromCharCode(13));
        var paragraphsLF = nodeEl.textContent.split(String.fromCharCode(10));

        //Use the paragraph list that has the most
        var paragraphs = (paragraphsCR > paragraphsLF)? paragraphsCR : paragraphsLF;

        //Trim extra whitespace off each paragraph to get rid of the line break characters
        paragraphs = _.map(paragraphs, function(text){
          if(typeof text == "string")
            return text.trim();
          else
            return text;
        });

        //Remove all falsey values - primarily empty strings
        paragraphs = _.compact(paragraphs);

        return paragraphs;

      }
    },

    serialize: function(){
      var objectDOM = this.updateDOM(),
        xmlString = objectDOM.outerHTML;

      //Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
    },

    /**
     * Makes a copy of the original XML DOM and updates it with the new values from the model.
     */
    updateDOM: function(){
      var type = this.get("type") || this.get("parentAttribute") || 'text',
          objectDOM = this.get("objectDOM") ? this.get("objectDOM").cloneNode(true) : document.createElement(type);

      //FIrst check if any of the text in this model has changed since it was originally parsed
      if( _.intersection(this.get("text"), this.get("originalText")).length == this.get("text").length
       && this.get("objectDOM")){
        return objectDOM;
      }

      //If there is no text, return an empty string
      if( this.isEmpty() ){
        return "";
      }

      //Empty the DOM
      $(objectDOM).empty();

      //Format the text
      var paragraphs = this.get("text");
      _.each(paragraphs, function(p){

        //If this paragraph text is a string, add a <para> node with that text
        if( typeof p == "string" && p.trim().length )
          $(objectDOM).append("<para>" + p + "</para>");

      });

      return objectDOM;
    },

    /**
    * Climbs up the model heirarchy until it finds the EML model
    *
    * @return {EML211|false} - Returns the EML 211 Model or false if not found
    */
    getParentEML: function(){
      var emlModel = this.get("parentModel"),
          tries = 0;

      while (emlModel.type !== "EML" && tries < 6){
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if( emlModel && emlModel.type == "EML")
        return emlModel;
      else
        return false;

    },

    trickleUpChange: function(){
      if( MetacatUI.rootDataPackage && MetacatUI.rootDataPackage.packageModel ){
        MetacatUI.rootDataPackage.packageModel.set("changed", true);
      }
    },

    formatXML: function(xmlString){
      return DataONEObject.prototype.formatXML.call(this, xmlString);
    },

    isEmpty: function() {

      //If the text is an empty array, this is empty
      if( Array.isArray(this.get("text")) && this.get("text").length == 0 ){
        return true;
      }
      //If the text is a falsey value, it is empty
      else if( !this.get("text") ){
        return true;
      }

      //Iterate over each paragraph in the text array and check if it's an empty string
      for (var i = 0; i < this.get('text').length; i++) {
        if (this.get('text')[i].trim().length > 0)
          return false;
      }

      return true;
    },

    /**
    * Returns the EML Text paragraphs as a string, with each paragraph on a new line.
    * @returns {string}
    */
    toString: function() {
      var value = [];

      if (_.isArray(this.get('text'))) {
        value = this.get('text');
      }

      return value.join('\n\n');
    }
  });

  return EMLText;
});
