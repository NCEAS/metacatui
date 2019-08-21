/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "models/project/ProjectImage",
        "models/metadata/eml220/EMLText"
    ],
    function($, _, Backbone, ProjectImage, EMLText) {

      /**
       * A Project Section model represents the ContentSectionType from the project schema
       */
      var ProjectSectionModel = Backbone.Model.extend({
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
         * Parses a <section> element from a project document
         *
         *  @param {XMLElement} objectDOM - A ContentSectionType XML element from a project document
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
            var projImageModel = new ProjectImage({ objectDOM: image[0] });
            projImageModel.set(projImageModel.parse());
            modelJSON.image = projImageModel;
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
         *  @return {XMLElement} An updated ContentSectionType XML element from a project document
        */
        updateDOM: function(){

          var objectDOM = this.get("objectDOM");

          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
            $(objectDOM).empty();
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

            // Don't serialize falsey values
            if(value){
              // Make new sub-node
              var sectionSubnodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
              $(sectionSubnodeSerialized).text(value);
              // Append new sub-node to objectDOM
              $(objectDOM).append(sectionSubnodeSerialized);
            }

          });

          //Update the image element
          if( this.get("image") && typeof this.get("image").updateDOM == "function" ){

            var imageSerialized = this.get("image").updateDOM();

            if(imageSerialized && $(imageSerialized).children().length){
              var insertAfter = this.getXMLPosition(objectDOM, "image");

              $(insertAfter).after(imageSerialized);
            }
          }

          // Get markdown which is a child of content
          var content = this.get("content");

          if(content){
            var contentSerialized = content.updateDOM("content");
            $(objectDOM).append(contentSerialized);
          }

          return objectDOM

        },

        /**
         * Finds the node in the given project XML document afterwhich the
         * given node type should be inserted
         *
         * @param {Element} parentNode - The parent XML element
         * @param {string} nodeName - The name of the node to be inserted
         *                             into xml
         * @return {(jQuery\|boolean)} A jQuery object indicating a position,
         *                            or false when nodeName is not in the
         *                            project schema
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


      });

      return ProjectSectionModel;
});
