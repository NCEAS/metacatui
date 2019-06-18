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

        /*
        * Parses an ImageType XML element from a project document
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

        }
      });

      return ProjectImageModel;
});
