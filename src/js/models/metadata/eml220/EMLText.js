/* global define */
define(['jquery', 'underscore', 'backbone', 'models/metadata/eml211/EMLText'],
    function($, _, Backbone, EMLText211) {

  var EMLText = EMLText211.extend({

    defaults: function(){
      return _.extend(EMLText211.prototype.defaults(), {
        markdown: null
      });
    },

    /*
    * Parses the XML objectDOM into a JSON object to be set on the model.
    * If this EMLText element contains markdown, then parse it. Otherwise, use
    * the EMLText 211 parse() method.
    *
    * @param {Element} objectDOM - XML Element to parse
    * @return {JSON} The literal object to be set on the model later
    */
    parse: function(objectDOM){
      if(!objectDOM)
        var objectDOM = this.get("objectDOM").cloneNode(true);

      // Get the markdown elements inside this EMLText element
      var markdownElements = $(objectDOM).children("markdown"),
          modelJSON = {};

      //Grab the contents of each markdown element and add it to the JSON
      if( markdownElements.length ){

        modelJSON.markdown = "";

        //Get the text content of the markdown element
        _.each(markdownElements, function(markdownElement){
          modelJSON.markdown += " " + markdownElement.textContent;
        });

        //Return the JSON
        return modelJSON;
      }
      //If there is no markdown, parse as the same as EML 2.1.1
      else{
        return EMLText211.prototype.parse(objectDOM);
      }

    }

  });

  return EMLText;

});
