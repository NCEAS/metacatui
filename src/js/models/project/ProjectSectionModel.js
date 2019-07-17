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
          // label: "",
          // image: "",
          // title: "",
          // introduction: "",
          // content: null,

          // Namespace for the project XML (required for document.createElementNS())
          var namespace = "http://ecoinformatics.org/datasetproject-beta";

          if (this.get("objectDOM")) {
            objectDOM = this.get("objectDOM").cloneNode(true);
            $(objectDOM).empty();
          } else {
            objectDOM = $(
              document.createElementNS(namespace, "acknowledgmentsLogo")
            )
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
              var sectionSubnodeSerialized = document.createElementNS(namespace, nodeName);
              $(sectionSubnodeSerialized).text(value);
              // Append new sub-node to objectDOM
              $(objectDOM).append(sectionSubnodeSerialized);
            }

          });

          // Get markdown which is a child of content
          var markdown = this.get("content").get("markdown");

          if(markdown){

            // Create markdown element
            var markdownSerialized = document.createElementNS(namespace, "markdown");
            // TODO: this gets escaped, use .createCDATASection() instead
            $(markdownSerialized).text("<![CDATA[\n" + markdown + "\n]]>");

            // Make content element and append markdown
            var contentSerialized = document.createElementNS(namespace, "content");
            $(contentSerialized).append(markdownSerialized);

            // Add content to objectDOM
            $(objectDOM).append(contentSerialized);

          };

          return objectDOM

        }


      });

      return ProjectSectionModel;
});
