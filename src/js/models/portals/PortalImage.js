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

            var errors          = {},
                label           = this.get("label"),
                url             = this.get("associatedURL"),
                id              = this.get("identifier"),
                genericLabels   = ["logo", "image"], // not set by the user
                hasLabel        = label && typeof label == "string" && !genericLabels.includes(label),
                hasURL          = url && typeof url == "string",
                hasId           = id && typeof id == "string";

            // If none of the fields have values, the portalImage won't be serialized
            if(!hasId && !hasURL && !hasLabel){
              return
            }
            // As long as an image model has an ID, it's valid.
            else if(hasId){
              return
            // If it has no ID, but a URL or Label, it's missing an image
            }
            else if (hasURL || hasLabel) {
              return errors.identifier = "An image is required"
            }

          }
          catch(e){
            console.error("Error validating a portal image. Error message:" + e);
            return;
          }
        },


        /**
         * isEmpty - Returns true if the PortalImage model has no label, no associatedURL, and no identifier
         *
         * @return {boolean}  true if the model is empty, false if it has at least a label, url, or id      
         */
        isEmpty: function(){
          return (
            !this.get("label")          &&
            !this.get("associatedURL")  &&
            !this.get("identifier")
          ) ;
        }

      });

      return PortalImageModel;
});
