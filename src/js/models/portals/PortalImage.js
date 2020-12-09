/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "models/DataONEObject"
    ],
    function($, _, Backbone, DataONEObject) {

      /**
       * @class PortalImage
       * @classdesc A Portal Image model represents a single image used in a Portal
       * @classcategory Models/Portals
       * @extends Backbone.Model
       */
      var PortalImageModel = DataONEObject.extend(
        /** @lends PortalImage.prototype */{
        defaults: function(){
          return _.extend(DataONEObject.prototype.defaults(), {
            identifier: "",
            imageURL: "",
            label: "",
            associatedURL: "",
            objectDOM: null,
            nodeName: "image",
            portalModel: null
          });
        },

        initialize: function(attrs){

          // Call the super class initialize function
          DataONEObject.prototype.initialize.call(this, attrs);

          // If the image model is initialized with an identifier but no image URL,
          // create the full image URL
          if(this.get("identifier") && !this.get("imageURL")){

            var baseURL = this.getBaseURL(),
                imageURL = baseURL + this.get("identifier");
                this.set("imageURL", imageURL);
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

          var portalModel = this.get("portalModel"),
              $objectDOM = $(objectDOM),
              modelJSON = {};

          if( portalModel ){
            modelJSON.datasource = portalModel.get("datasource");
            modelJSON.submitter  = portalModel.get("submitter");
            modelJSON.rightsHolder = portalModel.get("rightsHolder");
            modelJSON.originMemberNode = portalModel.get("originMemberNode");
            modelJSON.authoritativeMemberNode = portalModel.get("authoritativeMemberNode");
          }

          modelJSON.nodeName = objectDOM.nodeName;

          //Parse all the simple string elements
          modelJSON.label = $objectDOM.children("label").text();
          modelJSON.associatedURL = $objectDOM.children("associatedURL").text();

          // Parse the image URL or identifier
          modelJSON.identifier = $objectDOM.children("identifier").text();
          if( modelJSON.identifier ){
            if( modelJSON.identifier.substring(0, 4) !== "http" ){

              var baseURL = this.getBaseURL();
              modelJSON.imageURL = baseURL + modelJSON.identifier;

            }
            else{
              modelJSON.imageURL = modelJSON.identifier;
            }
          }

          return modelJSON;

        },

        /**
         * imageExists - Check if an image exists with the given
         * url, or if no url provided, with the baseURL + identifier
         *
         * @param  {string} imageURL  The image URL to check
         * @return {boolean}          Returns true if an HTTP request returns anything but 404
         */
        imageExists: function (imageURL){

          if(!imageURL){
            this.get("imageURL")
          }

          if(!imageURL && this.get("identifier")){
            var baseURL = this.getBaseURL(),
                imageURL = baseURL + this.get("identifier");
          }

          if(!imageURL){
            return false
          }

          var http = new XMLHttpRequest();
          http.open('HEAD', imageURL, false);
          http.send();

          return http.status != 404;

        },

        /**
         * getBaseURL - Get the base URL to use with an image identifier
         *
         * @return {string}  The image base URL, or an empty string if not found
         */
        getBaseURL: function(){

          var url = "",
              portalModel = this.get("portalModel"),
              // datasource = portalModel ? portalModel.get("datasource") : false;
              datasource = this.get("datasource"),
              datasource = (portalModel && !datasource) ? portalModel.get("datasource") : datasource;

          if( MetacatUI.appModel.get("isCN") ){
            var sourceRepo;

            //Use the object service URL from the origin MN/datasource
            if( datasource ){
              sourceRepo = MetacatUI.nodeModel.getMember(datasource);
            }
            // Use the object service URL from the alt repo
            if( !sourceRepo ){
              sourceRepo = MetacatUI.appModel.getActiveAltRepo();
            }
            if( sourceRepo ){
              url = sourceRepo.objectServiceUrl;
            }
          }

          if(!url && datasource){
            var imageMN = _.findWhere(MetacatUI.appModel.get("alternateRepositories"), { identifier: datasource });
            if(imageMN){
              url = imageMN.objectServiceUrl;
            }
          }

          //If this MetacatUI deployment is pointing to a MN, use the meta service URL from the AppModel
          if( !url ){
            url = MetacatUI.appModel.get("objectServiceUrl") || MetacatUI.appModel.get("resolveServiceUrl");
          }
          return url;
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
        },

        /**
        * Returns true if this PortalImage hasn't been saved to a Portal yet, so it is a new object.
        * For now, all PortalImages will be considered new objects since we will not be performing updates on them.
        * @return {boolean}
        */
        isNew: function(){
          if( this.get("identifier") ){
            return false;
          }
          else{
            return true;
          }
        }

      });

      return PortalImageModel;
});
