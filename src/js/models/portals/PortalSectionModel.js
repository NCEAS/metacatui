/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "models/portals/PortalImage",
        "models/metadata/eml220/EMLText"
    ],
    function($, _, Backbone, PortalImage, EMLText) {

      /**
       * A Portal Section model represents the ContentSectionType from the portal schema
       */
      var PortalSectionModel = Backbone.Model.extend({
        defaults: function(){
          return {
            label: "",
            image: "",
            title: "",
            introduction: "",
            content: null,
            literatureCited: null,
            objectDOM: null
          }
        },

        /**
         * Parses a <section> element from a portal document
         *
         *  @param {XMLElement} objectDOM - A ContentSectionType XML element from a portal document
         *  @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
        */
        parse: function(objectDOM){

          if(!objectDOM){
            return {};
          }

          var $objectDOM = $(objectDOM),
              modelJSON = {};

          //Parse all the simple string elements
          modelJSON.label = $objectDOM.children("label").text();
          modelJSON.title = $objectDOM.children("title").text();
          modelJSON.introduction = $objectDOM.children("introduction").text();

          //Parse the image URL or identifier
          var image = $objectDOM.children("image");
          if( image.length ){
            var portImageModel = new PortalImage({ objectDOM: image[0] });
            portImageModel.set(portImageModel.parse());
            modelJSON.image = portImageModel;
          }

          //Create an EMLText model for the section content
          modelJSON.content = new EMLText({
            objectDOM: $objectDOM.children("content")[0]
          });
          modelJSON.content.set(modelJSON.content.parse($objectDOM.children("content")));

          return modelJSON;

        },

        /**
         *  Makes a copy of the original XML DOM and updates it with the new values from the model.
         *
         *  @return {XMLElement} An updated ContentSectionType XML element from a portal document
        */
        updateDOM: function(){

          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
          } else {
            // create an XML section element from scratch
            var xmlText = "<section></section>",
                objectDOM = new DOMParser().parseFromString(xmlText, "text/xml"),
                objectDOM = $(objectDOM).children()[0];
          };

          // Get and update the simple text strings (everything but content)
          var sectionTextData = {
            label: this.get("label"),
            title: this.get("title"),
            introduction: this.get("introduction")
          };

          _.map(sectionTextData, function(value, nodeName){

            // Don't serialize default values
            if(value && value != this.defaults()[nodeName]){
              // Make new sub-node
              var sectionSubnodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
              $(sectionSubnodeSerialized).text(value);

              this.addUpdatedXMLNode(objectDOM, sectionSubnodeSerialized);
            }
            //If the value was removed from the model, then remove the element from the XML
            else{
              $(objectDOM).children(nodeName).remove();
            }

          }, this);
          //Update the image element
          if( this.get("image") && typeof this.get("image").updateDOM == "function" ){

            var imageSerialized = this.get("image").updateDOM();

            this.addUpdatedXMLNode(objectDOM, imageSerialized);
          }
          else{
            $(objectDOM).children("image").remove();
          }

          // Get markdown which is a child of content
          var content = this.get("content");

          if(content){
            var contentSerialized = content.updateDOM("content");

            this.addUpdatedXMLNode(objectDOM, contentSerialized);

          }
          else{
            $(objectDOM).children("content").remove();
          }

          //If nothing was serialized, return an empty string
          if( !$(objectDOM).children().length ){
            return "";
          }

          return objectDOM;

        },

        /**
        * Takes the updated XML node and inserts it into the given object DOM in
        * the correct position.
        * @param {Element} objectDOM - The full object DOM for this model
        * @param {Element} newElement - The updated element to insert into the object DOM
        */
        addUpdatedXMLNode: function(objectDOM, newElement){

          //If a parameter is missing, don't do anything
          if( !objectDOM || !newElement ){
            return;
          }

          try{
            //Get the node name of the new element
            var nodeName = $(newElement)[0].nodeName;

            if( nodeName ){

              //Only insert the new element if there is content in it
              if( $(newElement).children().length || $(newElement).text().length ){
                //Get the existing node
                var existingNodes = $(objectDOM).children(nodeName);

                //Get the position that the image should be
                var insertAfter = this.getXMLPosition(objectDOM, nodeName);

                if( insertAfter ){
                  //Insert it into that position
                  $(insertAfter).after(newElement);
                } else {
                  objectDOM.append(newElement);
                }

                existingNodes.remove();
              }
            }
          }
          catch(e){
            console.log(e);
            return;
          }

        },

        /**
         * Finds the node in the given portal XML document afterwhich the
         * given node type should be inserted
         *
         * @param {Element} parentNode - The parent XML element
         * @param {string} nodeName - The name of the node to be inserted
         *                             into xml
         * @return {(jQuery\|boolean)} A jQuery object indicating a position,
         *                            or false when nodeName is not in the
         *                            portal schema
        */
        getXMLPosition: function(parentNode, nodeName){

          var nodeOrder = [ "label", "title", "introduction", "image", "content", "option"];

          var position = _.indexOf(nodeOrder, nodeName);

          // First check that nodeName is in the list of nodes
          if ( position == -1 ) {
              return false;
          };

          // If there's already an occurence of nodeName...
          if($(parentNode).children(nodeName).length > 0){
            // ...insert it after the last occurence
            return $(parentNode).children(nodeName).last();
          } else {
            // Go through each node in the node list and find the position
            // after which this node will be inserted
            for (var i = position - 1; i >= 0; i--) {
              if ( $(parentNode).children(nodeOrder[i]).length ) {
                return $(parentNode).children(nodeOrder[i]).last();
              }
            }
          }

          return false;
        },

        /**
         * Overrides the default Backbone.Model.validate.function() to
         * check if this PortalSection model has all the required values necessary
         * to save to the server.
         *
         * @return {Object} If there are errors, an object comprising error
         *                   messages. If no errors, returns nothing.
        */
        validate: function(){

          try{

            var errors = {};

            //--Validate the label--
            //Labels are always required
            if( !this.get("label") ){
              errors.label = "Please provide a page name.";
            }

            //---Validate the title---
            //If section titles are required and there isn't one, set an error message
            if( MetacatUI.appModel.get("portalEditorRequiredFields").sectionTitle &&
                typeof this.get("title") == "string" &&
                !this.get("title").length ){
              errors.title = "Please provide a title for this page.";
            }

            //---Validate the introduction---
            //If section introductions are required and there isn't one, set an error message
            if( MetacatUI.appModel.get("portalEditorRequiredFields").sectionIntroduction &&
                typeof this.get("introduction") == "string" &&
                !this.get("introduction").length ){
              errors.introduction = "Please provide some a sub-title or some introductory text for this page.";
            }

            //---Validate the section content---
            //Content is always required
            if( !this.get("content") ){
              errors.content = "Please provide content for this page.";
            }
            //Check if there is either markdown or an array of strings in the text attribute
            else if( !this.get("content").get("markdown") && !this.get("content").get("text").length ){
              errors.content = "Please provide content for this page.";
            }
            //Check if the markdown hasn't been changed from the example markdown
            else if( this.get("content").get("markdown") == this.get("content").get("markdownExample") ){
              errors.content = "Please provide content for this page.";
            }

            //TODO:
            //---Validate the section image---


            //Return the errors object
            if( Object.keys(errors).length )
              return errors;
            else{
              return;
            }

          }
          catch(e){
            console.error(e);
            return;
          }

        }


      });

      return PortalSectionModel;
});
