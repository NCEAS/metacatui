/* global define */
define(["jquery",
        "underscore",
        "backbone"
    ],
    function($, _, Backbone) {

      /**
       * @class PortalImage
       * A Portal Image model represents a single image used in a Portal
       */
      var PortalImageModel = Backbone.Model.extend(
        /** @lends PortalImage.prototype */{
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
              
              // use the resolve service if there is no object service url
              // (e.g. in DataONE theme)
              var urlBase = MetacatUI.appModel.get("objectServiceUrl") ||
                MetacatUI.appModel.get("resolveServiceUrl");
                
              modelJSON.imageURL = urlBase + modelJSON.identifier;
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

          //If there is no identifier, don't serialize anything
          if( !this.get("identifier") ){
            return "";
          }

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
          }

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
                requiredFields = MetacatUI.appModel.get("portalEditorRequiredFields"),
                label           = this.get("label"),
                url             = this.get("associatedURL"),
                id              = this.get("identifier"),
                genericLabels   = ["logo", "image"], // not set by the user
                hasLabel        = (label && typeof label == "string" && !genericLabels.includes(label)) ? true : false,
                hasURL          = (url && typeof url == "string") ? true : false,
                hasId           = (id && typeof id == "string") ? true : false,
                urlRegex        = new RegExp(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);

            // If it's a logo, check whether it's a required image
            if(this.get("nodeName") === "logo" && requiredFields.logo && !hasId){
              errors["identifier"] = "An image is required."
              return errors
            }
            // If it's a section image, check whether it's a required image
            else if(this.get("nodeName") === "image" && requiredFields.sectionImage && !hasId){
              errors["identifier"] = "An image is required."
              return errors
            }
            // If none of the fields have values, the portalImage won't be serialized
            else if(!hasId && !hasURL && !hasLabel){
              return
            }

            // If the URL isn't a valid format, add an error message
            if(hasURL && !urlRegex.test(url)){
              errors["associatedURL"] = "Enter a valid URL."
            }
            //If the URL is valid, check if there is an http or https protocol
            else if(hasURL && url.substring(0,4) != "http"){
              //If not, add the https protocol
              this.set("associatedURL", "https://" + url);
            }

            return errors;

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
