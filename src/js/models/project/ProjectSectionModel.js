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

        /*
        * Parses a <section> element from a project document
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

        }
      });

      return ProjectSectionModel;
});
