/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "models/portals/PortalSectionModel"
    ],
    function($, _, Backbone, PortalSectionModel) {

      /**
       * @class PortalVizSectionModel
       * @classdesc A Portal Section for Data Visualizations. This is still an experimental feature and not recommended for general use.
       * @classcategory Models/Portals
       * @extends PortalSectionModel
       * @private
       */
      var PortalVizSectionModel = PortalSectionModel.extend(
        /** @lends PortalVizSectionModel.prototype */{

        type: "PortalVizSection",

        defaults: function(){
          return _.extend(PortalSectionModel.prototype.defaults(), {
            sectionType: "visualization",
            visualizationType: "",
            supportedVisualizationTypes: ["fever", "cesium"]
          });
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

          //Create a jQuery object of the XML DOM
          var $objectDOM = $(objectDOM),
          //Parse the XML using the parent class, PortalSectionModel.parse()
              modelJSON  = this.constructor.__super__.parse(objectDOM);

          //Parse the visualization type
          var allOptions = $objectDOM.children("option"),
              vizType = "";

          var vizTypeNode = allOptions.find("optionName:contains(visualizationType)");
          if( vizTypeNode.length ){
            vizType = vizTypeNode.first().siblings("optionValue").text();

            //Right now, only support "fever" as a visualization type, until this feature is expanded.
            if(vizType == "fever"){
            //  modelJSON.visualizationType = "fever";
            }

            var vizTypes = this.get("supportedVisualizationTypes");
            if( Array.isArray(vizTypes) && vizTypes.includes(vizType) ){
              modelJSON.visualizationType = vizType;
            }

          }

          return modelJSON;

        },

        /**
         *  Makes a copy of the original XML DOM and updates it with the new values from the model.
         *  For now, this function only updates the label. All other parts of Viz sections are not editable
         * in MetacatUI, since this is still an experimental feature.
         *
         *  @return {XMLElement} An updated ContentSectionType XML element from a portal document
         */
        updateDOM: function(){

          var objectDOM = this.get("objectDOM");

          //Clone the DOM if it exists already
          if (objectDOM) {
            objectDOM = objectDOM.cloneNode(true);
          //Or create a new DOM
          } else {
            // create an XML section element from scratch
            var xmlText = "<section>  <content>FEVer visualization</content><option><optionName>sectionType</optionName><optionValue>visualization</optionValue>" +
                          "</option><option><optionName>visualizationType</optionName><optionValue>fever</optionValue></option></section>",
                objectDOM = new DOMParser().parseFromString(xmlText, "text/xml"),
                objectDOM = $(objectDOM).children()[0];
          };

          // Get and update the simple text strings (everything but content)
          var sectionTextData = {
            label: this.get("label")
          };

          _.map(sectionTextData, function(value, nodeName){

            // Don't serialize default values, except for default label strings, since labels are required
            if(value && (value != this.defaults()[nodeName] || (nodeName == "label" && typeof value == "string")) ){
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

          //If nothing was serialized, return an empty string
          if( !$(objectDOM).children().length ){
            return "";
          }

          return objectDOM;

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

            //---Validate the section content---
            //Content is always required, but for visualizations, we can just input dummy content
            if( !this.get("content") ){
              this.set("content", "visualization");
            }

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

      return PortalVizSectionModel;
});
