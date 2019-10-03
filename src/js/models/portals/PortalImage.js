/* global define */
define(["jquery",
        "underscore",
        "backbone"
    ],
    function($, _, Backbone) {

      /**
       * A Portal Image model represents a single image used in a Portal
       */
      var PortalImageModel = Backbone.Model.extend({
        defaults: function(){
          return {
            identifier: "",
            imageURL: "",
            label: "",
            associatedURL: "",
            objectDOM: null,
            nodeName: "image"
          }
        },

        /**
         * Parses an ImageType XML element from a portal document
         *
         *  @param {XMLElement} objectDOM - An ImageType XML element from a portal document
         *  @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
        */
        parse: function(objectDOM){

          if(!objectDOM){
            objectDOM = this.get("objectDOM");

            if(!objectDOM){
              return {};
            }
          }

          var $objectDOM = $(objectDOM),
              modelJSON = {};

          modelJSON.nodeName = objectDOM.nodeName;

          //Parse all the simple string elements
          modelJSON.label = $objectDOM.children("label").text();
          modelJSON.associatedURL = $objectDOM.children("associatedURL").text();

          //Parse the image URL or identifier
          modelJSON.identifier = $objectDOM.children("identifier").text();
          if( modelJSON.identifier ){
            if( modelJSON.identifier.substring(0, 4) !== "http" ){
              modelJSON.imageURL = MetacatUI.appModel.get("objectServiceUrl") + modelJSON.identifier;
            }
            else{
              modelJSON.imageURL = modelJSON.identifier;
            }
          }

          return modelJSON;

        },

        /**
    		 * Makes a copy of the original XML DOM and updates it with the new values from the model
         *
         *  @return {XMLElement} An updated ImageType XML element from a portal document
    		 */
        updateDOM: function() {

          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
            $(objectDOM).empty();
          } else {
            // create an XML image element from scratch
            var xmlText = "<" + this.get("nodeName") + "></" + this.get("nodeName") + ">",
                objectDOM = new DOMParser().parseFromString(xmlText, "text/xml"),
                objectDOM = $(objectDOM).children()[0];
         }

          // get new image data
          var imageData = {
            identifier: this.get("identifier"),
            label: this.get("label"),
            associatedURL: this.get("associatedURL")
          };

          _.map(imageData, function(value, nodeName){

            // Don't serialize falsey values
            if(value){
              // Make new sub-node
              var imageSubnodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
              $(imageSubnodeSerialized).text(value);
              // Append new sub-node to objectDOM
              $(objectDOM).append(imageSubnodeSerialized);

            }

          });

          return objectDOM;
        },

        /**
         * Overrides the default Backbone.Model.validate.function() to
         * check if this PortalImage model has all the required values necessary
         * to save to the server.
         *
         * @return {Object} If there are errors, an object comprising error
         *                   messages. If no errors, returns nothing.
        */
        validate: function(){
          try {

            var errors = {};

            if( // If there's an associateURL or a non-generic label but no identifier
              ( this.get("associatedURL") || (this.get("label") && !this.get("label") == "logo") )  &&
              (!this.get("identifier") || !typeof this.get("identifier") == "string")
            ){
              errors.identifier = "Images require an identifier"
            }

            //Return the errors object
            if( Object.keys(errors).length )
              return errors;
            else{
              return;
            }

          }
          catch(e){
            console.error("Error validating a portal image. Error message:" + e);
            return;
          }
        }

      });

      return PortalImageModel;
});
