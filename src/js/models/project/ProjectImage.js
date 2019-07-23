/* global define */
define(["jquery",
        "underscore",
        "backbone"
    ],
    function($, _, Backbone) {

      /**
       * A Project Image model represents a single image used in a Project
       */
      var ProjectImageModel = Backbone.Model.extend({
        defaults: function(){
          return {
            identifier: "",
            imageURL: "",
            label: "",
            associatedURL: "",
            objectDOM: null
          }
        },

        /**
         * Parses an ImageType XML element from a project document
         *
         *  @param {XMLElement} objectDOM - An ImageType XML element from a project document
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
         *  @return {XMLElement} An updated ImageType XML element from a project document
    		 */
        updateDOM: function() {

          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
            $(objectDOM).empty();
    			} else {
              // create an XML acknowledgmentsLogo element from scratch
              var xmlText = "<acknowledgmentsLogo></acknowledgmentsLogo>",
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
        }

      });

      return ProjectImageModel;
});
