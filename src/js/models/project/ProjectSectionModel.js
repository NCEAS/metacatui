/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "models/metadata/eml220/EMLText"
    ],
    function($, _, Backbone, EMLText) {

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
          modelJSON.image = $objectDOM.children("image").text();
          if( modelJSON.image ){
            if( modelJSON.image.substring(0, 4) !== "http" ){
              modelJSON.imageURL = MetacatUI.appModel.get("objectServiceUrl") + modelJSON.image;
            }
            else{
              modelJSON.imageURL = modelJSON.image;
            }
          }

          //Create an EMLText model for the section content
          modelJSON.content = new EMLText();
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
            image: this.get("image"),
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

          // Get markdown which is a child of content
          var markdown = this.get("content").get("markdown");

          if(markdown){

            // Create markdown element
            var markdownSerialized = objectDOM.ownerDocument.createElement("markdown");
            var cdataMarkdown = objectDOM.ownerDocument.createCDATASection(markdown);
            $(markdownSerialized).append(cdataMarkdown);

            // Make content element and append markdown
            var contentSerialized = objectDOM.ownerDocument.createElement("content");
            $(contentSerialized).append(markdownSerialized);

            // Add content to objectDOM
            $(objectDOM).append(contentSerialized);

          };

          return objectDOM

        }


      });

      return ProjectSectionModel;
});
