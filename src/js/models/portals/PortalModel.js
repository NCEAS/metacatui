/**
 * @exports PortalModel
 */
/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "gmaps",
        "uuid",
        "collections/Filters",
        "collections/SolrResults",
        "models/portals/PortalSectionModel",
        "models/portals/PortalImage",
        "models/metadata/eml211/EMLParty",
        "models/metadata/eml220/EMLText",
        "models/CollectionModel",
        "models/Search",
        "models/filters/FilterGroup",
        "models/Map"
    ],
    /** @lends PortalModel.prototype */
    function($, _, Backbone, gmaps, uuid, Filters, SolrResults, PortalSectionModel, PortalImage,
        EMLParty, EMLText, CollectionModel, SearchModel, FilterGroup, MapModel) {
        /**
         * A PortalModel is a specialized collection that represents a portal,
         * including the associated data, people, portal descriptions, results and
         * visualizations.  It also includes settings for customized filtering of the
         * associated data, and properties used to customized the map display and the
         * overall branding of the portal.
         *
         * @class PortalModel
         * @module models/PortalModel
         * @name PortalModel
         * @constructor
         * @return
        */
        var PortalModel = CollectionModel.extend({

            /** @type {string} - The name of this type of model */
            type: "Portal",

            /**
             * Overrides the default Backbone.Model.defaults() function to
             * specify default attributes for the portal model
            */
            defaults: function() {
                return _.extend(CollectionModel.prototype.defaults(), {
                    objectXML: null,
                    formatId: "https://purl.dataone.org/portals-1.0.0",
                    formatType: "METADATA",
                    type: "portal",
                    logo: null,
                    sections: [],
                    associatedParties: [],
                    acknowledgments: null,
                    acknowledgmentsLogos: [],
                    awards: [],
                    literatureCited: [],
                    filterGroups: [],
                    // The portal document options may specify section to hide
                    hideMetrics: null,
                    hideData: null,
                    hideMembers: null,
                    hideMap: null,
                    // Map options, as specified in the portal document options
                    mapZoomLevel: 3,
                    mapCenterLatitude: null,
                    mapCenterLongitude: null,
                    mapShapeHue: 200,
                    // The MapModel
                    mapModel: gmaps ? new MapModel() : null,
                    optionNames: ["primaryColor", "secondaryColor", "accentColor",
                            "mapZoomLevel", "mapCenterLatitude", "mapCenterLongitude",
                            "mapShapeHue", "hideData", "hideMetrics", "hideMembers"],
                    // Portal view colors, as specified in the portal document options
                    primaryColor: "#999999",
                    secondaryColor: "#666666",
                    accentColor: "#497ba7",
                    primaryColorRGB: null,
                    secondaryColorRGB: null,
                    accentColorRGB: null,
                    primaryColorTransparent: "rgba(153, 153, 153, .7)",
                    secondaryColorTransparent: "rgba(102, 102, 102, .7)",
                    accentColorTransparent: "rgba(73, 123, 167, .7)"
                });
            },

            /**
             * The default text to use for a new section label added by the user
             * @type {string}
            */
            newSectionLabel: "Untitled",

            /**
             * Overrides the default Backbone.Model.initialize() function to
             * provide some custom initialize options
             *
             * @param {} options -
            */
            initialize: function(attrs) {

              //Call the super class initialize function
              CollectionModel.prototype.initialize.call(this, attrs);

              if( attrs.isNew ){
                this.set("synced", true);
                //Create an isPartOf filter for this new Portal
                this.addIsPartOfFilter();
              }

              // Cache this model for later use
              this.cachePortal();

            },

            /**
             * Returns the portal URL
             *
             * @return {string} The portal URL
            */
            url: function() {
                return MetacatUI.appModel.get("objectServiceUrl") +
                    encodeURIComponent(this.get("seriesId") || this.get("id"));
            },

            /**
             * Overrides the default Backbone.Model.fetch() function to provide some custom
             * fetch options
             * @param [options] {object} - Options for this fetch
             * @property [options.objectOnly] {Boolean} - If true, only the object will be retrieved and not the system metadata
             * @property [options.systemMetadataOnly] {Boolean} - If true, only the system metadata will be retrieved
             * @return {XMLDocument} The XMLDocument returned from the fetch() AJAX call
            */
            fetch: function(options) {

              if ( ! options ) var options = {};
              else var options = _.clone(options);

              //If the seriesId has not been found yet, get it from Solr
              if( !this.get("id") && !this.get("seriesId") && this.get("label") ){
                this.once("change:seriesId", this.fetch);
                this.once("latestVersionFound", this.fetch);
                this.getSeriesIdByName();
                return;
              }
              //If we found the latest version in this pid version chain,
              else if( this.get("id") && this.get("latestVersion") ){
                //Set it as the id of this model
                this.set("id", this.get("latestVersion"));

                //Stop listening to the change of seriesId and the latest version found
                this.stopListening("change:seriesId", this.fetch);
                this.stopListening("latestVersionFound", this.fetch);
              }

              //Fetch the system metadata
              if( !options.objectOnly || options.systemMetadataOnly ){
                this.fetchSystemMetadata();

                if( options.systemMetadataOnly ){
                  return;
                }
              }

              var requestSettings = {
                  dataType: "xml",
                  error: function(model, response) {
                      model.trigger("error");

                      if( response.status == 404 ){
                        model.trigger("notFound");
                      }
                  }
              };

              // Add the user settings to the fetch settings
              requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());

              // Call Backbone.Model.fetch()
              return Backbone.Model.prototype.fetch.call(this, requestSettings);

            },

            /**
            * Get the portal seriesId by searching for the portal by its name in Solr
            */
            getSeriesIdByName: function(){

              //Exit if there is no portal name set
              if( !this.get("label") )
                return;

              var model = this;

              var requestSettings = {
                  url: MetacatUI.appModel.get("queryServiceUrl") +
                       "q=label:\"" + this.get("label") + "\" OR " +
                       "seriesId:\"" + this.get("label") + "\"" +
                       "&fl=seriesId,id,label" +
                       "&sort=dateUploaded%20asc" +
                       "&rows=1" +
                       "&wt=json",
                  error: function(response) {
                      model.trigger("error", model, response);

                      if( response.status == 404 ){
                        model.trigger("notFound");
                      }
                  },
                  success: function(response){
                    if( response.response.numFound > 0 ){

                      model.set("label", response.response.docs[0].label);

                      //Save the seriesId, if one is found
                      if( response.response.docs[0].seriesId ){
                        model.set("seriesId", response.response.docs[0].seriesId);
                      }
                      //If this portal doesn't have a seriesId,
                      //but id has been found
                      else if ( response.response.docs[0].id ){
                        //Save the id
                        model.set("id", response.response.docs[0].id);

                        //Find the latest version in this version chain
                        model.findLatestVersion(response.response.docs[0].id);
                      }
                      // if we don't have Id or SeriesId
                      else {
                        model.trigger("notFound");
                      }

                    }
                    else{
                      model.trigger("notFound");
                    }
                  }
              }

              requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());

              $.ajax(requestSettings);

            },

            /**
             * Overrides the default Backbone.Model.parse() function to parse the custom
             * portal XML document
             *
             * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
             * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
            */
            parse: function(response) {

                //Start the empty JSON object
                var modelJSON = {},
                    portalNode;

                // Iterate over each root XML node to find the portal node
                $(response).children().each(function(i, el) {
                    if (el.tagName.indexOf("portal") > -1) {
                        portalNode = el;
                        return false;
                    }
                });

                // If a portal XML node wasn't found, return an empty JSON object
                if (typeof portalNode == "undefined" || !portalNode) {
                    return {};
                }

                // Parse the collection elements
                modelJSON = this.parseCollectionXML(portalNode);

                // Save the xml for serialize
                modelJSON.objectXML = response;

                // Parse the portal logo
                var portLogo = $(portalNode).children("logo")[0];
                if (portLogo) {
                  var portImageModel = new PortalImage({ objectDOM: portLogo });
                  portImageModel.set(portImageModel.parse());
                  modelJSON.logo = portImageModel
                };

                // Parse acknowledgement logos into urls
                var logos = $(portalNode).children("acknowledgmentsLogo");
                modelJSON.acknowledgmentsLogos = [];
                _.each(logos, function(logo, i) {
                    if ( !logo ) return;

                    var imageModel = new PortalImage({ objectDOM: logo });
                    imageModel.set(imageModel.parse());

                    if( imageModel.get("imageURL") ){
                      modelJSON.acknowledgmentsLogos.push( imageModel );
                    }
                });

                // Parse the literature cited
                // This will only work for bibtex at the moment
                var bibtex = $(portalNode).children("literatureCited").children("bibtex");
                if (bibtex.length > 0) {
                    modelJSON.literatureCited = this.parseTextNode(portalNode, "literatureCited");
                }

                // Parse the portal content sections
                modelJSON.sections = [];
                $(portalNode).children("section").each(function(i, section){
                  // Create a new PortalSectionModel
                  modelJSON.sections.push( new PortalSectionModel({
                    objectDOM: section,
                    literatureCited: modelJSON.literatureCited
                  }) );
                  //Parse the PortalSectionModel
                  modelJSON.sections[i].set( modelJSON.sections[i].parse(section) );
                });

                // Parse the EMLText elements
                modelJSON.acknowledgments = this.parseEMLTextNode(portalNode, "acknowledgments");

                // Parse the awards
                modelJSON.awards = [];
                var parse_it = this.parseTextNode;
                $(portalNode).children("award").each(function(i, award) {
                    var award_parsed = {};
                    $(award).children().each(function(i, award_attr) {
                        if(award_attr.nodeName != "funderLogo"){
                          // parse the text nodes
                          award_parsed[award_attr.nodeName] = parse_it(award, award_attr.nodeName);
                        } else {
                          // parse funderLogo which is type ImageType
                          var imageModel = new PortalImage({ objectDOM: award_attr });
                          imageModel.set(imageModel.parse());
                          award_parsed[award_attr.nodeName] = imageModel;
                        }
                    });
                    modelJSON.awards.push(award_parsed);
                });

                // Parse the associatedParties
                modelJSON.associatedParties = [];
                $(portalNode).children("associatedParty").each(function(i, associatedParty) {

                    modelJSON.associatedParties.push(new EMLParty({
                        objectDOM: associatedParty
                    }));

                });

                // Parse the options
                $(portalNode).find("option").each(function(i, option) {

                    var optionName = $(option).find("optionName")[0].textContent,
                        optionValue = $(option).find("optionValue")[0].textContent;

                    if (optionValue === "true") {
                        optionValue = true;
                    } else if (optionValue === "false") {
                        optionValue = false;
                    }

                    // TODO: keep a list of optionNames so that in the case of
                    // custom options, we can serialize them in serialize()
                    // otherwise it's not saved in the model which attributes
                    // are <option></option>s

                    if( !_.has(modelJSON, optionName) ){
                      modelJSON[optionName] = optionValue;
                    }

                });

                // Convert all the hex colors to rgb
                if(modelJSON.primaryColor){
                  modelJSON.primaryColorRGB = this.hexToRGB(modelJSON.primaryColor);
                  modelJSON.primaryColorTransparent = "rgba(" +  modelJSON.primaryColorRGB.r +
                    "," + modelJSON.primaryColorRGB.g + "," + modelJSON.primaryColorRGB.b +
                    ", .7)";
                }
                if(modelJSON.secondaryColor){
                  modelJSON.secondaryColorRGB = this.hexToRGB(modelJSON.secondaryColor);
                  modelJSON.secondaryColorTransparent = "rgba(" +  modelJSON.secondaryColorRGB.r +
                    "," + modelJSON.secondaryColorRGB.g + "," + modelJSON.secondaryColorRGB.b +
                    ", .5)";
                }
                if(modelJSON.accentColor){
                  modelJSON.accentColorRGB = this.hexToRGB(modelJSON.accentColor);
                  modelJSON.accentColorTransparent = "rgba(" +  modelJSON.accentColorRGB.r +
                    "," + modelJSON.accentColorRGB.g + "," + modelJSON.accentColorRGB.b +
                    ", .5)";
                }

                if (gmaps) {
                    // Create a MapModel with all the map options
                    modelJSON.mapModel = new MapModel();
                    var mapOptions = modelJSON.mapModel.get("mapOptions");

                    if (modelJSON.mapZoomLevel) {
                        mapOptions.zoom = parseInt(modelJSON.mapZoomLevel);
                        mapOptions.minZoom = parseInt(modelJSON.mapZoomLevel);
                    }
                    if ((modelJSON.mapCenterLatitude || modelJSON.mapCenterLatitude === 0) &&
                        (modelJSON.mapCenterLongitude || modelJSON.mapCenterLongitude === 0)) {
                        mapOptions.center = modelJSON.mapModel.createLatLng(modelJSON.mapCenterLatitude, modelJSON.mapCenterLongitude);
                    }
                    if (modelJSON.mapShapeHue) {
                        modelJSON.mapModel.set("tileHue", modelJSON.mapShapeHue);
                    }
                }

                // Parse the FilterGroups
                modelJSON.filterGroups = [];
                var allFilters = modelJSON.searchModel.get("filters");
                $(portalNode).find("filterGroup").each(function(i, filterGroup) {

                  // Create a FilterGroup model
                  var filterGroupModel = new FilterGroup({
                      objectDOM: filterGroup
                  });
                  modelJSON.filterGroups.push(filterGroupModel);

                  // Add the Filters from this FilterGroup to the portal's Search model
                  allFilters.add(filterGroupModel.get("filters").models);

                });
                return modelJSON;
            },

            /**
             * Parses the XML nodes that are of type EMLText
             *
             * @param {Element} parentNode - The XML Element that contains all the EMLText nodes
             * @param {string} nodeName - The name of the XML node to parse
             * @param {boolean} isMultiple - If true, parses the nodes into an array
             * @return {(string|Array)} A string or array of strings comprising the text content
            */
            parseEMLTextNode: function(parentNode, nodeName, isMultiple) {

                var node = $(parentNode).children(nodeName);

                // If no matching nodes were found, return falsey values
                if (!node || !node.length) {

                    // Return an empty array if the isMultiple flag is true
                    if (isMultiple)
                        return [];
                    // Return null if the isMultiple flag is false
                    else
                        return null;
                }
                // If exactly one node is found and we are only expecting one, return the text content
                else if (node.length == 1 && !isMultiple) {
                    return new EMLText({
                        objectDOM: node[0]
                    });
                } else {
                // If more than one node is found, parse into an array
                    return _.map(node, function(node) {
                        return new EMLText({
                            objectDOM: node
                        });
                    });

                }

            },

            /**
            * Sets the fileName attribute on this model using the portal label
            * @override
            */
            setMissingFileName: function(){

              var fileName = this.get("label");

              if( !fileName ){
                fileName = "portal.xml";
              }
              else{
                fileName = fileName.replace(/[^a-zA-Z0-9]/g, "_") + ".xml";
              }

              this.set("fileName", fileName);

            },

            /**
             * @typedef {Object} rgb - An RGB color value
             * @property {number} r - A value between 0 and 255 defining the intensity of red
             * @property {number} g - A value between 0 and 255 defining the intensity of green
             * @property {number} b - A value between 0 and 255 defining the intensity of blue
            */

            /**
             * Converts hex color values to RGB
             *
             * @param {string} hex - a color in hexadecimal format
             * @return {rgb} a color in RGB format
            */
            hexToRGB: function(hex){
              var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
              } : null;
              },

            /**
             * Finds the node in the given portal XML document afterwhich the
             * given node type should be inserted
             *
             * @param {Element} portalNode - The portal element of an XML document
             * @param {string} nodeName - The name of the node to be inserted
             *                             into xml
             * @return {(jQuery\|boolean)} A jQuery object indicating a position,
             *                            or false when nodeName is not in the
             *                            portal schema
            */
            getXMLPosition: function(portalNode, nodeName){

              var nodeOrder = [ "label", "name", "description", "definition",
                                "logo", "section", "associatedParty",
                                "acknowledgments", "acknowledgmentsLogo",
                                "award", "literatureCited", "filterGroup",
                                "option"];

              var position = _.indexOf(nodeOrder, nodeName);

              // First check that nodeName is in the list of nodes
              if ( position == -1 ) {
                  return false;
              };

              // If there's already an occurence of nodeName...
              if($(portalNode).children(nodeName).length > 0){
                // ...insert it after the last occurence
                return $(portalNode).children(nodeName).last();
              } else {
                // Go through each node in the node list and find the position
                // after which this node will be inserted
                for (var i = position - 1; i >= 0; i--) {
                  if ( $(portalNode).children(nodeOrder[i]).length ) {
                    return $(portalNode).children(nodeOrder[i]).last();
                  }
                }
              }

              return false;
            },

            /**
             * Retrieves the model attributes and serializes into portal XML,
             * to produce the new or modified portal document.
             *
             * @return {string} - Returns the portal XML as a string.
            */
            serialize: function(){

              // So we can call getXMLPosition() from within if{}
              var model = this;

              var xmlDoc,
                  portalNode,
                  xmlString;

              xmlDoc = this.get("objectXML");

              // Check if there is a portal doc already
              if (xmlDoc == null){
                // If not create one
                xmlDoc = this.createXML();
              } else {
                // If yes, clone it
                xmlDoc = xmlDoc.cloneNode(true);
              };

              // Iterate over each root XML node to find the portal node
              $(xmlDoc).children().each(function(i, el) {
                  if (el.tagName.indexOf("portal") > -1) {
                      portalNode = el;
                  }
              });

              // Serialize the collection elements
              // ("name", "label", "description", "definition")
              portalNode = this.updateCollectionDOM(portalNode);

              /* ==== Serialize portal logo ==== */

              // Remove node if it exists already
              $(xmlDoc).find("logo").remove();

              // Get new values
              var logo = this.get("logo");

              // Don't serialize falsey values or empty logos
              if(logo && logo.get("identifier")){

                // Make new node
                var logoSerialized = logo.updateDOM("logo");

                // Insert new node at correct position
                var insertAfter = this.getXMLPosition(portalNode, "logo");
                if(insertAfter){
                  insertAfter.after(logoSerialized);
                }
                else{
                  portalNode.append(logoSerialized);
                }

              };

              /* ==== Serialize acknowledgment logos ==== */

              // Remove element if it exists already
              $(xmlDoc).find("acknowledgmentsLogo").remove();

              var acknowledgmentsLogos = this.get("acknowledgmentsLogos");

              // Don't serialize falsey values
              if(acknowledgmentsLogos){

                _.each(acknowledgmentsLogos, function(imageModel) {

                  var ackLogosSerialized = imageModel.updateDOM();

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(portalNode, "acknowledgmentsLogo");
                  if(insertAfter){
                    insertAfter.after(ackLogosSerialized);
                  }
                  else {
                    portalNode.append(ackLogosSerialized);
                  }
                })
              };

              /* ==== Serialize literature cited ==== */
              // Assumes the value of literatureCited is a block of bibtex text

              // Remove node if it exists already
              $(xmlDoc).find("literatureCited").remove();

              // Get new values
              var litCit = this.get("literatureCited");

              // Don't serialize falsey values
              if( litCit.length ){

                // If there's only one element in litCited, it will be a string
                // turn it into an array so that we can use _.each
                if(typeof litCit == "string"){
                  litCit = [litCit]
                }

                // Make new <literatureCited> element
                var litCitSerialized = $(xmlDoc.createElement("literatureCited"));

                _.each(litCit, function(bibtex){

                  // Wrap in literature cited in cdata tags
                  var cdataLitCit = xmlDoc.createCDATASection(bibtex);
                  var bibtexSerialized = $(xmlDoc.createElement("bibtex"));
                  // wrap in CDATA tags so that bibtex characters aren't escaped
                  $(bibtexSerialized).append(cdataLitCit);
                  // <bibxtex> is a subelement of <literatureCited>
                  $(litCitSerialized).append(bibtexSerialized);

                });

                // Insert new element at correct position
                var insertAfter = this.getXMLPosition(portalNode, "literatureCited");
                if(insertAfter){
                  insertAfter.after(litCitSerialized);
                }
                else{
                  portalNode.append(litCitSerialized);
                }
              }

              /* ==== Serialize portal content sections ==== */

              // Remove node if it exists already
              $(xmlDoc).find("section").remove();

              var sections = this.get("sections");

              // Don't serialize falsey values
              if(sections){

                _.each(sections, function(sectionModel) {

                  // Don't serialize sections with default values
                  if(!this.sectionIsDefault(sectionModel)){

                    var sectionSerialized = sectionModel.updateDOM();

/*                    // Check that the <markdown> content isn't the example markdown
                    // and that it isn't blank
                    var newMD = $(sectionSerialized).find("markdown")[0];
                    if(newMD && (newMD.textContent == this.markdownExample || newMD.textContent == "") ){
                      // Remove it if it is.
                      $(sectionSerialized).find("markdown").remove();
                    };
*/
                    // Remove sections entirely if the content is blank
                    var newMD = $(sectionSerialized).find("markdown")[0];
                    if( !newMD || newMD.textContent == "" ){
                      $(sectionSerialized).find("markdown").remove();
                    }

                    // Remove the <content> element if it's empty.
                    // This will trigger a validation error, prompting user to
                    // enter content.
                    if($(sectionSerialized).find("content").is(':empty')){
                      $(sectionSerialized).find("content").remove();
                    }

                    // Insert new node at correct position
                    var insertAfter = model.getXMLPosition(portalNode, "section");
                    if(insertAfter){
                      insertAfter.after(sectionSerialized);
                    }
                    else {
                      portalNode.append(sectionSerialized);
                    }

                  }

                }, this)
              };

              /* ====  Serialize the EMLText elements ("acknowledgments") ==== */

              var textFields = ["acknowledgments"];

              _.each(textFields, function(field){

                var fieldName = field;

                // Get the EMLText model
                var emlTextModels = Array.isArray(this.get(field)) ? this.get(field) : [this.get(field)];
                if( ! emlTextModels.length ) return;

                // Get the node from the XML doc
                var nodes = $(xmlDoc).find(fieldName);

                // Update the DOMs for each model
                _.each(emlTextModels, function(thisTextModel, i){
                  //Don't serialize falsey values
                  if(!thisTextModel) return;

                  var node;

                  //Get the existing node or create a new one
                  if(nodes.length < i+1){
                    node = xmlDoc.createElement(fieldName);
                    this.getXMLPosition(portalNode, fieldName).after(node);

                  }
                  else {
                     node = nodes[i];
                  }

                  $(node).html( $(thisTextModel.updateDOM() ).html());

                }, this);

                // Remove the extra nodes
                this.removeExtraNodes(nodes, emlTextModels);

              }, this);

              /* ====  Serialize awards ==== */

              // Remove award node if it exists already
              $(xmlDoc).find("award").remove();

              // Get new values
              var awards = this.get("awards");

              // Don't serialize falsey values
              if(awards && awards.length>0){

                _.each(awards, function(award){

                  // Make new node
                  var awardSerialized = xmlDoc.createElement("award");

                  // create the <award> subnodes
                  _.map(award, function(value, nodeName){

                    // serialize the simple text nodes
                    if(nodeName != "funderLogo"){
                      // Don't serialize falsey values
                      if(value){
                        // Make new sub-nodes
                        var awardSubnodeSerialized = xmlDoc.createElement(nodeName);
                        $(awardSubnodeSerialized).text(value);
                        $(awardSerialized).append(awardSubnodeSerialized);
                      }
                    } else {
                      // serialize "funderLogo" which is ImageType
                      var funderLogoSerialized = value.updateDOM();
                      $(awardSerialized).append(funderLogoSerialized);
                    }

                  });

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(portalNode, "award");
                  if(insertAfter){
                    insertAfter.after(awardSerialized);
                  }
                  else{
                    portalNode.append(awardSerialized);
                  }

                });

              }

              /* ====  Serialize associatedParties ==== */

              // Remove element if it exists already
              $(xmlDoc).find("associatedParty").remove();

              // Get new values
              var parties = this.get("associatedParties");

              // Don't serialize falsey values
              if(parties){

                // Serialize each associatedParty
                _.each(parties, function(party){

                  // Update the DOM of the EMLParty
                  var partyDOM  = party.updateDOM(),
                      //re-Camel-case the XML
                      xmlString = partyDOM[0].outerHTML,
                      xmlString = party.formatXML(xmlString).replace(/associatedparty/g, "associatedParty");
                      partySerialized = $($.parseXML(xmlString)).find("associatedParty");

                  // Get the last node of this type to insert after
                  var insertAfter = $(xmlDoc).find("associatedParty").last();

                  // If there isn't a node found, find the EML position to insert after
                  if( !insertAfter.length ) {
                    insertAfter = model.getXMLPosition(portalNode, "associatedParty");
                  }

                  // Make sure we don't insert empty EMLParty nodes into the EML
                  if( $(partySerialized).children().length ){
                    //Insert the party DOM at the insert position
                    if ( insertAfter && insertAfter.length ){
                      insertAfter.after(partySerialized);
                    } else {
                      portalNode.append(partySerialized);
                    }
                  }
                });
              }

              try{
                /* ====  Serialize options (including map options) ==== */
                // This will only serialize the options named in `optNames` (below)
                // Functionality needed in order to serialize new or custom options

                // The standard list of options used in portals
                var optNames = this.get("optionNames");

                _.each(optNames, function(optName){

                  //Get the value on the model
                  var optValue = model.get(optName),
                      existingValue;

                  //Get the existing optionName element
                  var matchingOption = $(portalNode).children("option")
                                                    .find("optionName:contains('" + optName + "')");

                  //
                  if( !matchingOption.length || matchingOption.first().text() != optName ){
                    matchingOption = false;
                  }
                  else{
                    //Get the value for this option from the Portal doc
                    existingValue = matchingOption.siblings("optionValue").text();
                  }

                  // Don't serialize null or undefined values. Also don't serialize values that match the default model value
                  if( (optValue || optValue === 0 || optValue === false) &&
                      (optValue != model.defaults()[optName]) ){

                    //Replace the existing option, if it exists
                    if( matchingOption ){
                      matchingOption.siblings("optionValue").text(optValue);
                    }
                    else{
                      // Make new node
                      // <optionName> and <optionValue> are subelements of <option>
                      var optionSerialized   = xmlDoc.createElement("option"),
                          optNameSerialized  = xmlDoc.createElement("optionName"),
                          optValueSerialized = xmlDoc.createElement("optionValue");

                      $(optNameSerialized).text(optName);
                      $(optValueSerialized).text(optValue);

                      $(optionSerialized).append(optNameSerialized, optValueSerialized);

                      // Insert new node at correct position
                      var insertAfter = model.getXMLPosition(portalNode, "option");

                      if(insertAfter){
                        insertAfter.after(optionSerialized);
                      }

                    }

                  }
                  else{
                    //Remove the elements from the portal XML when the value is invalid
                    if( matchingOption ){
                      matchingOption.parent("option").remove();
                    }
                  }
                });
              }
              catch(e){
                console.error(e);
              }

              /* ====  Serialize FilterGroups ==== */

              // Get new filter group values
              var filterGroups = this.get("filterGroups");

              // Remove any filter groups in the current objectDOM
              $(xmlDoc).find("filterGroup").remove();

              // Make a new node for each filter group in the model
              _.each(filterGroups, function(filterGroup){

                filterGroupSerialized = filterGroup.updateDOM();

                // Insert new node at correct position
                var insertAfter = model.getXMLPosition(portalNode, "filterGroup");

                if(insertAfter){
                  insertAfter.after(filterGroupSerialized);
                }
                else{
                  portalNode.append(filterGroupSerialized);
                }
              });

              /* ====  Remove duplicates ==== */

              //Do a final check to make sure there are no duplicate ids in the XML
              var elementsWithIDs = $(xmlDoc).find("[id]"),
              //Get an array of all the ids in this EML doc
                  allIDs = _.map(elementsWithIDs, function(el){ return $(el).attr("id") });

              //If there is at least one id in the EML...
              if(allIDs && allIDs.length){
                //Boil the array down to just the unique values
                var uniqueIDs = _.uniq(allIDs);

                //If the unique array is shorter than the array of all ids,
                // then there is a duplicate somewhere
                if(uniqueIDs.length < allIDs.length){

                  //For each element in the EML that has an id,
                  _.each(elementsWithIDs, function(el){

                    //Get the id for this element
                    var id = $(el).attr("id");

                    //If there is more than one element in the EML with this id,
                    if( $(xmlDoc).find("[id='" + id + "']").length > 1 ){
                      //And if it is not a unit node, which we don't want to change,
                      if( !$(el).is("unit") )
                        //Then change the id attribute to a random uuid
                        $(el).attr("id", "urn-uuid-" + uuid.v4());
                    }

                  });

                }
              }

              // Convert xml to xmlString and return xmlString
              xmlString = new XMLSerializer().serializeToString(xmlDoc);

              //If there isn't an XML declaration, add one
              if( xmlString.indexOf("<?xml") == -1 ){
                xmlString = '<?xml version="1.0" encoding="UTF-8"?>' + xmlString;
              }

              return xmlString;
            },

            /**
             * Checks whether the given sectionModel has been updated by the
             * user, or whether all attributes match their default values.
             * For a section's markdown, the default value is either an empty
             * string, null, or the default pre-filled content (the value set to
             * PortalModel.markdownExample). For a section's label, the default
             * value is either an empty string or a string that begins with the
             * value set to PortalModel.newSectionLabel. For all other attributes,
             * the defaults are set in PortalSectionModel.defaults.
             * @param {PortalSectionModel} sectionModel - The model to check against a default model
             * @return {boolean} returns true if the sectionModel matches a default model, and false when at least one attribute differs
            */
            sectionIsDefault: function(sectionModel){

              try{

                var defaults = sectionModel.defaults(),
                    currentMarkdown = sectionModel.get("content").get("markdown"),
                    labelRegex = new RegExp("^" + this.newSectionLabel, "i");

                // For each attribute, check whether it matches the default
                if(
                  // Check whether markdown matches the content that's
                  // auto-filled or whether it's empty
                  ( currentMarkdown === this.markdownExample ||
                    currentMarkdown == "" ||
                    currentMarkdown == null
                  ) &&
                  ( sectionModel.get("image") === defaults.image ) &&
                  ( sectionModel.get("introduction") === defaults.introduction ) &&
                  // Check whether label starts with the default new page name,
                  // or whether it's empty
                  (
                    labelRegex.test( sectionModel.get("label") ) ||
                    sectionModel.get("label") == "" ||
                    sectionModel.get("label") == null
                  ) &&
                  ( sectionModel.get("literatureCited") === defaults.literatureCited ) &&
                  ( sectionModel.get("title") === defaults.title )
                ){
                  // All elements of the section match the default
                  return true
                } else {
                  // At least one attribute of the section has been updated
                  return false
                }

              }
              catch(e){
                // If there's a problem with this function for some reason,
                // return false so that the section is serialized to avoid
                // losing information
                console.log("Failed to check whether section model is default. Serializing it anyway. Error message:" + e);
                return false
              }

            },

            /**
             * Initialize the object XML for a brand spankin' new portal
             * @inheritdoc
             *
            */
            createXML: function() {

              // TODO: which attributes should a new XML portal doc should have?
              var xmlString = "<por:portal xmlns:por=\"https://purl.dataone.org/portals-1.0.0\"></por:portal>",
                  xmlNew = $.parseXML(xmlString),
                  portalNode = xmlNew.getElementsByTagName("por:portal")[0];

              return(xmlNew);
            },

            /**
             * Overrides the default Backbone.Model.validate.function() to
             * check if this portal model has all the required values necessary
             * to save to the server.
             *
             * @param {Object} [attrs] - A literal object of model attributes to validate.
             * @param {Object} [options] - A literal object of options for this validation process
             * @return {Object} If there are errors, an object comprising error
             *                   messages. If no errors, returns nothing.
            */
            validate: function(attrs, options) {

              try{

                var errors = {},
                    requiredFields = MetacatUI.appModel.get("portalEditorRequiredFields") || {};

                //Execute the superclass validate() function
                var collectionErrors = this.constructor.__super__.validate.call(this);
                if( typeof collectionErrors == "object" && Object.keys(collectionErrors).length ){
                  //Use the errors messages from the CollectionModel for this PortalModel
                  errors = collectionErrors;
                }

                // ---- Validate the description and name ----
                //Map the model attributes to the user-facing attribute name
                var textFields = {
                  description: "description",
                  name: "title"
                }
                //Iterate over each text field
                _.each( Object.keys(textFields), function(field){
                  //If this field is required, and it is a string
                  if( requiredFields[field] && typeof this.get(field) == "string" ){
                    //If this is an empty string, set an error message
                    if( !this.get(field).trim().length ){
                      errors[field] = "A " + textFields[field] + " is required.";
                    }
                  }
                  //If this field is required, and it's not a string at all, set an error message
                  else if( requiredFields[field] ){
                    errors[field] = "A " + textFields[field] + " is required.";
                  }
                }, this);

                //---Validate the sections---
                //Iterate over each section model
                _.each( this.get("sections"), function(section){

                  //Validate the section model
                  var sectionErrors = section.validate();

                  //If there is at least one error, then add an error to the PortalModel error list
                  if( sectionErrors && Object.keys(sectionErrors).length ){
                    errors.sections = "At least one section has an error";
                  }

                }, this);

                //----Validate the logo----
                if(requiredFields.logo && (!this.get("logo") ||
                    !this.get("logo").get("identifier")))
                {
                  errors.logo = "A logo image is required";
                } else if(this.get("logo")){
                  logoErrors = this.get("logo").validate();
                  if(logoErrors && Object.keys(logoErrors).length ){
                    errors.logo = "A logo image is required";
                  }
                }

                //TODO: Validate these other elements, listed below, as they are added to the portal editor

                //---Validate the associatedParties---

                //---Validate the acknowledgments---

                //---Validate the acknowledgmentsLogo---

                //---Validate the award---

                //---Validate the literatureCited---

                //---Validate the filterGroups---

                //Return the errors object
                if( Object.keys(errors).length )
                  return errors;
                else{
                  return;
                }

              }
              catch(e){
                console.error(e);
              }

            },

            /**
            * Queries the Solr discovery index for other Portal objects with this same label.
            * If at least one other Portal has the same label, then it is not available.
            * @param {string} label - The label to query for
            */
            checkLabelAvailability: function(label){

              if( typeof label != "string" ){
                var label = this.get("label");
                if( !label || typeof label != "string" ){
                  return;
                }
              }

              var model = this;

              // Query solr to see if other portals already use this label
              var requestSettings = {
                  url: MetacatUI.appModel.get("queryServiceUrl") +
                       "q=label:\"" + label + "\"" +
                       " AND formatId:\"" + this.get("formatId") + "\"" +
                       "&rows=0" +
                       "&wt=json",
                  error: function(response) {
                    model.trigger("errorValidatingLabel");
                  },
                  success: function(response){
                    if( response.response.numFound > 0 ){
                      //Add this label to the blacklist so we don't have to query for it later
                      var blacklist = model.get("labelBlacklist");
                      if( Array.isArray(blacklist) ){
                        blacklist.push(label);
                      }

                      model.trigger("labelTaken");
                    } else {
                      model.trigger("labelAvailable");
                    }
                  }
              }

              //Attach the User auth info and send the request
              requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
              $.ajax(requestSettings);
            },

            /**
             * Removes nodes from the XML that do not have an accompanying model
             * (i.e. nodes which were probably removed by the user during editing)
             *
             * @param {jQuery} nodes - The nodes to potentially remove
             * @param {Model[]} models - The model to compare to
            */
            removeExtraNodes: function(nodes, models){
              // Remove the extra nodes
               var extraNodes =  nodes.length - models.length;
               if(extraNodes > 0){
                 for(var i = models.length; i < nodes.length; i++){
                   $(nodes[i]).remove();
                 }
               }
            },

            /**
             * Saves the portal XML document to the server using the DataONE API
            */
            save: function(){

              //Validate before we try anything else
              if(!this.isValid()){

                //Check if there is a validation error on the definition filters
                var invalidAttr = Object.keys(this.validationError || {});
                if( invalidAttr.includes("definition") ){
                  _.each( this.getAllDefinitionFilters(), function(filter){

                    //Remove invalid filters from the Filters collection
                    if( !filter.isValid() ){
                      this.get("searchModel").get("filters").remove(filter);
                    }

                  }, this);
                }

                //Re-validate this model after possibly removing some invalid filters
                if( !this.isValid() ){
                  //Trigger the invalid and cancelSave events
                  this.trigger("invalid");
                  this.trigger("cancelSave");
                  //Don't save the model since it's invalid
                  return false;
                }
                else{
                  this.trigger("valid");
                }
              }
              else{
                this.trigger("valid");
              }

              //Check if the checksum has been calculated yet.
              if( !this.get("checksum") ){
                // Serialize the XML
                var xml = this.serialize();
                var xmlBlob = new Blob([xml], {type : 'application/xml'});

                //Set the Blob as the upload file
                this.set("uploadFile", xmlBlob);

                //When it is calculated, restart this function
                this.off("checksumCalculated", this.save);
                this.on("checksumCalculated", this.save);
                //Calculate the checksum for this file
                this.calculateChecksum();

                //Exit this function until the checksum is done
                return;
              }

              this.constructor.__super__.save.call(this);
            },

            /**
            * Removes or hides the given section from this Portal
            * @param {PortalSectionModel|string} section - Either the PortalSectionModel
            * to remove, or the name of the section to remove. Some sections in the portals
            * are not tied to PortalSectionModels, because they are created from other parts of the Portal
            * document. For example, the Data, Metrics, and Members sections.
            */
            removeSection: function(section){

              try{

                //If this section is a string, remove it by adding custom options
                if(typeof section == "string"){
                  switch( section.toLowerCase() ){
                    case "data":
                      this.set("hideData", true);
                      break;
                    case "metrics":
                      this.set("hideMetrics", true);
                      break;
                    case "members":
                      this.set("hideMembers", true);
                      break;
                  }
                }
                //If this section is a section model, delete it from this Portal
                else if( PortalSectionModel.prototype.isPrototypeOf(section) ){

                  // Remove the section from the model's sections array object.
                  // Use clone() to create new array reference and ensure change
                  // event is tirggered.
                  var sectionModels = _.clone(this.get("sections"));
                  sectionModels.splice( $.inArray(section, sectionModels), 1);
                  this.set({sections: sectionModels});
                }
                else{
                  return;
                }
              }
              catch(e){
                console.error(e);
              }

            },

            /**
            * Adds the given section to this Portal
            * @param {PortalSectionModel|string} section - Either the PortalSectionModel
            * to add, or the name of the section to add. Some sections in the portals
            * are not tied to PortalSectionModels, because they are created from other parts of the Portal
            * document. For example, the Data, Metrics, and Members sections.
            */
            addSection: function(section){
              try{
                //If this section is a string, add it by adding custom options
                if(typeof section == "string"){
                  switch( section.toLowerCase() ){
                    case "data":
                      this.set("hideData", null);
                      break;
                    case "metrics":
                      this.set("hideMetrics", null);
                      break;
                    case "members":
                      this.set("hideMembers", null);
                      break;
                    case "freeform":
                      // Add a new, blank markdown section
                      var sectionModels = _.clone(this.get("sections")),
                          newSection = new PortalSectionModel();

                      // Set default temp values on the new markdown section.
                      newSection.set({
                        content: new EMLText({
                                      type: "content",
                                      parentModel: newSection
                                  })
                      });
                      sectionModels.push( newSection );
                      this.set("sections", sectionModels);
                      // Trigger event manually so we can just pass newSection
                      this.trigger("addSection", newSection);
                      break;
                  }
                }
                // If this section is a section model, add it to this Portal
                else if( PortalSectionModel.prototype.isPrototypeOf(section) ){
                  var sectionModels = _.clone(this.get("sections"));
                  sectionModels.push( section );
                  this.set({sections: sectionModels});
                  // trigger event manually so we can just pass newSection
                  this.trigger("addSection", section);
                }
                else{
                  return;
                }
              }
              catch(e){
                console.error(e);
              }
            },

            /**
            * Saves a reference to this Portal on the MetacatUI global object
            */
            cachePortal: function(){

              if( this.get("id") ){
                MetacatUI.portals = MetacatUI.portals || {};
                MetacatUI.portals[this.get("id")] = this;
              }

              this.on("change:id", this.cachePortal);
            }

        });

        return PortalModel;
    });
