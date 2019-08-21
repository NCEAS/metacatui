/**
 * @exports ProjectModel
 */
/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "gmaps",
        "uuid",
        "collections/Filters",
        "collections/SolrResults",
        "models/project/ProjectSectionModel",
        "models/project/ProjectImage",
        "models/metadata/eml211/EMLParty",
        "models/metadata/eml220/EMLText",
        "models/CollectionModel",
        "models/Search",
        "models/filters/FilterGroup",
        "models/Map"
    ],
    /** @lends ProjectModel.prototype */
    function($, _, Backbone, gmaps, uuid, Filters, SolrResults, ProjectSectionModel, ProjectImage,
        EMLParty, EMLText, CollectionModel, SearchModel, FilterGroup, MapModel) {
        /**
         * A ProjectModel is a specialized collection that represents a project,
         * including the associated data, people, project descriptions, results and
         * visualizations.  It also includes settings for customized filtering of the
         * associated data, and properties used to customized the map display and the
         * overall branding of the project.
         *
         * @class ProjectModel
         * @module models/ProjectModel
         * @name ProjectModel
         * @constructor
         * @return
        */
        var ProjectModel = CollectionModel.extend({

            /** @type {string} - The name of this type of model */
            type: "Project",

            /**
             * Overrides the default Backbone.Model.defaults() function to
             * specify default attributes for the project model
            */
            defaults: function() {
                return _.extend(CollectionModel.prototype.defaults(), {
                    objectXML: null,
                    formatId: "http://ecoinformatics.org/project-beta1",
                    formatType: "DATA",
                    logo: null,
                    sections: [],
                    associatedParties: [],
                    acknowledgments: null,
                    acknowledgmentsLogos: [],
                    awards: [],
                    literatureCited: [],
                    filterGroups: [],
                    // The project document options may specify section to hide
                    hideMetrics: false,
                    hideData: false,
                    hidePeople: false,
                    hideMap: false,
                    // Map options, as specified in the project document options
                    mapZoomLevel: 3,
                    mapCenterLatitude: null,
                    mapCenterLongitude: null,
                    mapShapeHue: 200,
                    // The MapModel
                    mapModel: gmaps ? new MapModel() : null,
                    // Project view colors, as specified in the project document options
                    primaryColor: "#999999",
                    secondaryColor: "#666666",
                    accentColor: "#497ba7",
                    primaryColorRGB: null,
                    secondaryColorRGB: null,
                    accentColorRGB: null,
                    primaryColorTransparent: null,
                    secondaryColorTransparent: null,
                    accentColorTransparent: null
                });
            },

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
                //Create an isPartOf filter for this new Project
                this.addIsPartOfFilter();
              }

              // Cache this model for later use
              this.cacheProject();

            },

            /**
             * Returns the project URL
             *
             * @return {string} The project URL
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
            * Get the project seriesId by searching for the project by its name in Solr
            */
            getSeriesIdByName: function(){

              //Exit if there is no project name set
              if( !this.get("label") )
                return;

              var model = this;

              var requestSettings = {
                  url: MetacatUI.appModel.get("queryServiceUrl") +
                       "q=label:\"" + this.get("label") + "\"" +
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
                      else{
                        //Save the id
                        model.set("id", response.response.docs[0].id);

                        //Find the latest version in this version chain
                        model.findLatestVersion(response.response.docs[0].id);
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
             * project XML document
             *
             * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
             * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
            */
            parse: function(response) {

                //Start the empty JSON object
                var modelJSON = {},
                    projectNode;

                // Iterate over each root XML node to find the project node
                $(response).children().each(function(i, el) {
                    if (el.tagName.indexOf("portal") > -1) {
                        projectNode = el;
                        return false;
                    }
                });

                // If a project XML node wasn't found, return an empty JSON object
                if (typeof projectNode == "undefined" || !projectNode) {
                    return {};
                }

                // Parse the collection elements
                modelJSON = this.parseCollectionXML(projectNode);

                // Save the xml for serialize
                modelJSON.objectXML = response;

                // Parse the project logo
                var projLogo = $(projectNode).children("logo")[0];
                if (projLogo) {
                  var projImageModel = new ProjectImage({ objectDOM: projLogo });
                  projImageModel.set(projImageModel.parse());
                  modelJSON.logo = projImageModel
                };

                // Parse acknowledgement logos into urls
                var logos = $(projectNode).children("acknowledgmentsLogo");
                modelJSON.acknowledgmentsLogos = [];
                _.each(logos, function(logo, i) {
                    if ( !logo ) return;

                    var imageModel = new ProjectImage({ objectDOM: logo });
                    imageModel.set(imageModel.parse());

                    if( imageModel.get("imageURL") ){
                      modelJSON.acknowledgmentsLogos.push( imageModel );
                    }
                });

                // Parse the literature cited
                // This will only work for bibtex at the moment
                var bibtex = $(projectNode).children("literatureCited").children("bibtex");
                if (bibtex.length > 0) {
                    modelJSON.literatureCited = this.parseTextNode(projectNode, "literatureCited");
                }

                // Parse the project content sections
                modelJSON.sections = [];
                $(projectNode).children("section").each(function(i, section){
                  // Create a new ProjectSectionModel
                  modelJSON.sections.push( new ProjectSectionModel({
                    objectDOM: section,
                    literatureCited: modelJSON.literatureCited
                  }) );
                  //Parse the ProjectSectionModel
                  modelJSON.sections[i].set( modelJSON.sections[i].parse(section) );
                });

                // Parse the EMLText elements
                modelJSON.acknowledgments = this.parseEMLTextNode(projectNode, "acknowledgments");

                // Parse the awards
                modelJSON.awards = [];
                var parse_it = this.parseTextNode;
                $(projectNode).children("award").each(function(i, award) {
                    var award_parsed = {};
                    $(award).children().each(function(i, award_attr) {
                        if(award_attr.nodeName != "funderLogo"){
                          // parse the text nodes
                          award_parsed[award_attr.nodeName] = parse_it(award, award_attr.nodeName);
                        } else {
                          // parse funderLogo which is type ImageType
                          var imageModel = new ProjectImage({ objectDOM: award_attr });
                          imageModel.set(imageModel.parse());
                          award_parsed[award_attr.nodeName] = imageModel;
                        }
                    });
                    modelJSON.awards.push(award_parsed);
                });

                // Parse the associatedParties
                modelJSON.associatedParties = [];
                $(projectNode).children("associatedParty").each(function(i, associatedParty) {

                    modelJSON.associatedParties.push(new EMLParty({
                        objectDOM: associatedParty
                    }));

                });

                // Parse the options
                $(projectNode).find("option").each(function(i, option) {

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

                    modelJSON[optionName] = optionValue;

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
                $(projectNode).find("filterGroup").each(function(i, filterGroup) {

                  // Create a FilterGroup model
                  var filterGroupModel = new FilterGroup({
                      objectDOM: filterGroup
                  });
                  modelJSON.filterGroups.push(filterGroupModel);

                  // Add the Filters from this FilterGroup to the project's Search model
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
            * Sets the fileName attribute on this model using the project label
            * @override
            */
            setMissingFileName: function(){

              var fileName = this.get("label");

              if( !fileName ){
                fileName = "project.xml";
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
             * Finds the node in the given project XML document afterwhich the
             * given node type should be inserted
             *
             * @param {Element} projectNode - The project element of an XML document
             * @param {string} nodeName - The name of the node to be inserted
             *                             into xml
             * @return {(jQuery\|boolean)} A jQuery object indicating a position,
             *                            or false when nodeName is not in the
             *                            project schema
            */
            getXMLPosition: function(projectNode, nodeName){

              var nodeOrder = [ "name", "label", "description", "definition",
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
              if($(projectNode).children(nodeName).length > 0){
                // ...insert it after the last occurence
                return $(projectNode).children(nodeName).last();
              } else {
                // Go through each node in the node list and find the position
                // after which this node will be inserted
                for (var i = position - 1; i >= 0; i--) {
                  if ( $(projectNode).children(nodeOrder[i]).length ) {
                    return $(projectNode).children(nodeOrder[i]).last();
                  }
                }
              }

              return false;
            },

            /**
             * Retrieves the model attributes and serializes into project XML,
             * to produce the new or modified project document.
             *
             * @return {string} - Returns the project XML as a string.
            */
            serialize: function(){

              // So we can call getXMLPosition() from within if{}
              var model = this;

              var xmlDoc,
                  projectNode,
                  xmlString;

              xmlDoc = this.get("objectXML");

              // Check if there is a project doc already
              if (xmlDoc == null){
                // If not create one
                xmlDoc = this.createXML();
              } else {
                // If yes, clone it
                xmlDoc = xmlDoc.cloneNode(true);
              };

              // Iterate over each root XML node to find the project node
              $(xmlDoc).children().each(function(i, el) {
                  if (el.tagName.indexOf("project") > -1) {
                      projectNode = el;
                  }
              });

              // Serialize the collection elements
              // ("name", "label", "description", "definition")
              projectNode = this.serializeCollectionXML(projectNode);

              /* ==== Serialize project logo ==== */

              // Remove node if it exists already
              $(xmlDoc).find("logo").remove();

              // Get new values
              var logo = this.get("logo");

              // Don't serialize falsey values
              if(logo){

                // Make new node
                var logoSerialized = logo.updateDOM("logo");

                // Insert new node at correct position
                var insertAfter = this.getXMLPosition(projectNode, "logo");
                if(insertAfter){
                  insertAfter.after(logoSerialized);
                }
                else{
                  projectNode.append(logoSerialized);
                }

              };

              /* ==== Serialize acknowledgment logos ==== */

              // Remove element if it exists already
              $(xmlDoc).find("acknowledgmentsLogo").remove();

              var acknowledgmentsLogos = this.get("acknowledgmentsLogos");

              // Don't serialize falsey values
              if(acknowledgmentsLogos){

                _.each(acknowledgmentsLogos, function(imageModel) {

                  var ackLogosSerialized = imageModel.updateDOM("acknowledgmentsLogos");

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(projectNode, "acknowledgmentsLogo");
                  if(insertAfter){
                    insertAfter.after(ackLogosSerialized);
                  }
                  else {
                    projectNode.append(ackLogosSerialized);
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
              if(litCit){

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
                var insertAfter = this.getXMLPosition(projectNode, "literatureCited");
                if(insertAfter){
                  insertAfter.after(litCitSerialized);
                }
                else{
                  projectNode.append(litCitSerialized);
                }
              }

              /* ==== Serialize project content sections ==== */

              // Remove node if it exists already
              $(xmlDoc).find("section").remove();

              var sections = this.get("sections");

              // Don't serialize falsey values
              if(sections){

                _.each(sections, function(sectionModel) {

                  var sectionSerialized = sectionModel.updateDOM();

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(projectNode, "section");
                  if(insertAfter){
                    insertAfter.after(sectionSerialized);
                  }
                  else {
                    projectNode.append(sectionSerialized);
                  }
                })
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
                    this.getXMLPosition(projectNode, fieldName).after(node);

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
                      var funderLogoSerialized = value.updateDOM("funderLogo");
                      $(awardSerialized).append(funderLogoSerialized);
                    }

                  });

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(projectNode, "award");
                  if(insertAfter){
                    insertAfter.after(awardSerialized);
                  }
                  else{
                    projectNode.append(awardSerialized);
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
                    insertAfter = model.getXMLPosition(projectNode, "associatedParty");
                  }

                  // Make sure we don't insert empty EMLParty nodes into the EML
                  if( $(partySerialized).children().length ){
                    //Insert the party DOM at the insert position
                    if ( insertAfter && insertAfter.length ){
                      insertAfter.after(partySerialized);
                    } else {
                      projectNode.append(partySerialized);
                    }
                  }
                });
              }

              /* ====  Serialize options (including map options) ==== */
              // This will only serialize the options named in `optNames` (below)
              // Functionality needed in order to serialize new or custom options

              // Remove node if it exists already
              $(xmlDoc).find("option").remove();

              // The standard list of options used in projects
              var optNames = ["primaryColor", "secondaryColor", "accentColor",
                      "mapZoomLevel", "mapCenterLatitude", "mapCenterLongitude",
                      "mapShapeHue", "hideMetrics"];

              _.each(optNames, function(optName){
                var optValue = model.get(optName);

                  // Don't serialize falsey values
                  if(optValue){

                    // Make new node
                    // <optionName> and <optionValue> are subelements of <option>
                    var optionSerialized   = xmlDoc.createElement("option"),
                        optNameSerialized  = xmlDoc.createElement("optionName"),
                        optValueSerialized = xmlDoc.createElement("optionValue");

                    $(optNameSerialized).text(optName);
                    $(optValueSerialized).text(optValue);

                    $(optionSerialized).append(optNameSerialized);
                    $(optionSerialized).append(optValueSerialized);

                    // Insert new node at correct position
                    var insertAfter = model.getXMLPosition(projectNode, "option");

                    if(insertAfter){
                      insertAfter.after(optionSerialized);
                    }
                    else{
                      projectNode.append(optionSerialized);
                    }

                  }
              });

              /* ====  Serialize FilterGroups ==== */

              // Get new filter group values
              var filterGroups = this.get("filterGroups");

              // Remove any filter groups in the current objectDOM
              $(xmlDoc).find("filterGroup").remove();

              // Make a new node for each filter group in the model
              _.each(filterGroups, function(filterGroup){

                filterGroupSerialized = filterGroup.updateDOM();

                // Insert new node at correct position
                var insertAfter = model.getXMLPosition(projectNode, "filterGroup");

                if(insertAfter){
                  insertAfter.after(filterGroupSerialized);
                }
                else{
                  projectNode.append(filterGroupSerialized);
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
              xmlString = new XMLSerializer().serializeToString(projectNode);
              return (xmlString)
            },

            /**
             * Initialize the object XML for a brand spankin' new project
             *
            */
            createXML: function() {

              // TODO: which attributes should a new XML project doc should have?
              var xmlString = "<proj:project xmlns:proj=\"http://ecoinformatics.org/datasetproject-beta1\"></proj:project>",
                  xmlNew = $.parseXML(xmlString),
                  projectNode = xmlNew.getElementsByTagName("proj:project")[0];

              // set attributes
              projectNode.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
              projectNode.setAttribute("xsi:schemaLocation", "http://ecoinformatics.org/datasetproject-beta1");

              return(xmlNew);
            },

            /**
             * Overrides the default Backbone.Model.validate.function() to
             * check if this project model has all the required values necessary
             * to save to the server
             *
             * @return {Object} If there are errors, an object comprising error
             *                   messages. If no errors, returns nothing.
            */
            validate: function() {
              var errors = {};

              // ---- Validate label----

              this.once("labelBlank", function(){
                errors.label = "The URL label is blank. Please choose a label."
              });

              this.once("labelRestricted", function(){
                errors.label = "The URL label entered is not allowed. " +
                               "Please choose a different URL."
              });

              this.once("labelIncludesIllegalCharacters", function(){
                errors.label = "The URL label contains illegal characters. " +
                               "Only letters, numbers, dashes, and underscores are allowed."
              });

              this.once("labelTaken", function(){
                errors.label = "The URL label selected is already in use. " +
                               "Please choose a different URL."
              });

              // TODO: Which strings should we resctict users from selecting for
              // a portal label (and URL component)?
              this.validateLabel(label = this.get("label"), blacklist = ["new"]);

              // TODO: For the portal to be valid, we should wait for the event
              // "labelAvailable". This takes time since it's a solr query.

              // TODO: validate all the project elements here

              if( Object.keys(errors).length )
                return errors;
              else{
                return;
              }

            },

            /**
             * Queries solr to check whether a portal label is already in use.
             * Also checks that a label does not equal a restricted value
             * (e.g. new project temporary name), and that it's encoded properly
             * for use as part of a url
             *
             * @param {string} label - The portal label to be validated
             * @param {Array} blacklist - A list of restricted strings that are not allowed as project labels
            */
            validateLabel: function(label, blacklist){

              // If no label is given or set
              if(!label && !this.get("label")){
                // trigger warning and exit
                this.trigger("labelBlank");
                return
              // If there's at least a label set on the model
              } else if(!label){
                // use the label that's set on the model
                var label = this.get("label");
              }

              // If the label hasn't changed from original label set
              if(label == this.get("originalLabel")){
                // trigger warning and exit
                this.trigger("labelUnchanged");
                return
              }

              // If the label is a restricted string
              if(blacklist){
                if(blacklist.includes(label)){
                  // trigger warning and exit
                  this.trigger("labelRestricted");
                  return
                }
              }

              // If the label includes illegal characers
              // (Only allow letters, numbers, underscores and dashes)
              if(label.match(/[^A-Za-z0-9_-]/g)){
                // trigger warning and exit
                this.trigger("labelIncludesIllegalCharacters");
                return
              }

              var model = this;

              // Query solr to see if other projects already use this label
              var requestSettings = {
                  url: MetacatUI.appModel.get("queryServiceUrl") +
                       "q=projectName:\"" + label + "\"" +
                       "&fl=projectName" +
                       "&wt=json",
                  error: function(response) {
                    console.log(response);
                  },
                  success: function(response){
                    if( response.response.numFound > 0 ){
                      model.trigger("labelTaken");
                    } else {
                      model.trigger("labelAvailable");
                    }
                  }
              }

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
             * Saves the project XML document to the server using the DataONE API
            */
            save: function(){

              //Check if the checksum has been calculated yet.
              if( !this.get("checksum") ){
                // Serialize the XML
                var xml = this.serialize();
                var xmlBlob = new Blob([xml], {type : 'application/xml'});

                //Set the Blob as the upload file
                this.set("uploadFile", xmlBlob);

                //When it is calculated, restart this function
                this.on("checksumCalculated", this.save);
                //Calculate the checksum for this file
                this.calculateChecksum();

                //Exit this function until the checksum is done
                return;
              }

              this.constructor.__super__.save.call(this);
            },

            /**
            * Saves a reference to this Project on the MetacatUI global object
            */
            cacheProject: function(){

              if( this.get("id") ){
                MetacatUI.projects = MetacatUI.projects || {};
                MetacatUI.projects[this.get("id")] = this;
              }

              this.on("change:id", this.cacheProject);
            }

        });

        return ProjectModel;
    });
