/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "gmaps",
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
    function($, _, Backbone, gmaps, Filters, SolrResults, ProjectSectionModel, ProjectImage,
        EMLParty, EMLText, CollectionModel, SearchModel, FilterGroup, MapModel) {

        /**
         * A ProjectModel is a specialized collection that represents a project,
         * including the associated data, people, project descriptions, results and
         * visualizations.  It also includes settings for customized filtering of the
         * associated data, and properties used to customized the map display and the
         * overall branding of the project.
         */
        var ProjectModel = CollectionModel.extend({

            //@type {string} - The name of this type of model
            type: "Project",

            defaults: function() {
                return _.extend(CollectionModel.prototype.defaults(), {
                    logo: null,
                    sections: [],
                    associatedParties: [],
                    acknowledgments: null,
                    acknowledgmentsLogos: [],
                    awards: [],
                    literatureCited: [],
                    filterGroups: [],
                    //@type {Search} - A Search model with a Filters collection
                    // that contains the filters associated with this project
                    searchModel: null,
                    //@type {SolrResults} - A SolrResults collection that contains the
                    // filtered search results of datasets in this project
                    searchResults: new SolrResults(),
                    //@type {SolrResults} - A SolrResults collection that contains the
                    // unfiltered search results of all datasets in this project
                    allSearchResults: null,
                    //The project document options may specify section to hide
                    hideMetrics: false,
                    hideData: false,
                    hidePeople: false,
                    hideMap: false,
                    //Map options, as specified in the project document options
                    mapZoomLevel: 3,
                    mapCenterLatitude: null,
                    mapCenterLongitude: null,
                    mapShapeHue: 200,
                    //The MapModel
                    mapModel: gmaps ? new MapModel() : null,
                    //Project view colors, as specified in the project document options
                    primaryColor: "",
                    secondaryColor: "",
                    accentColor: "",
                    primaryColorRGB: null,
                    secondaryColorRGB: null,
                    accentColorRGB: null,
                    primaryColorTransparent: null,
                    secondaryColorTransparent: null,
                    accentColorTransparent: null
                });
            },

            initialize: function(options) {
              this.listenToOnce(this.get("searchResults"), "sync", this.cacheSearchResults);
            },

            /*
             * Return the project URL
             */
            url: function() {
                return MetacatUI.appModel.get("objectServiceUrl") +
                    encodeURIComponent(this.get("id"));
            },

            /*
             * Overrides the default Backbone.Model.fetch() function to provide some custom
             * fetch options
             */
            fetch: function() {

                var requestSettings = {
                    dataType: "xml",
                    error: function(model, response) {
                        model.trigger("error");

                        if( response.status == 404 ){
                          model.trigger("notFound");
                        }
                    }
                }

                //Add the user settings to the fetch settings
                requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());

                //Call Backbone.Model.fetch()
                return Backbone.Model.prototype.fetch.call(this, requestSettings);

            },

            /*
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

                //Iterate over each root XML node to find the project node
                $(response).children().each(function(i, el) {
                    if (el.tagName.indexOf("project") > -1) {
                        projectNode = el;
                        return false;
                    }
                });

                //If a project XML node wasn't found, return an empty JSON object
                if (typeof projectNode == "undefined" || !projectNode) {
                    return {};
                }

                //Parse the collection elements
                modelJSON = this.parseCollectionXML(projectNode);

                //Parse the simple text nodes
                var projLogo = this.parseTextNode(projectNode, "logo");
                if( projLogo ){
                  modelJSON.logo = MetacatUI.appModel.get("objectServiceUrl") + projLogo;
                }

                //Parse acknowledgement logos into urls
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

                //Parse the project content sections
                modelJSON.sections = [];
                $(projectNode).children("section").each(function(i, section){
                  //Create a new ProjectSectionModel
                  modelJSON.sections.push( new ProjectSectionModel({
                    objectDOM: section,
                    literatureCited: modelJSON.literatureCited
                  }) );
                  //Parse the ProjectSectionModel
                  modelJSON.sections[i].set( modelJSON.sections[i].parse(section) );
                });

                //Parse the EMLText elements
                modelJSON.acknowledgments = this.parseEMLTextNode(projectNode, "acknowledgments");

                //Parse the awards
                modelJSON.awards = [];
                var parse_it = this.parseTextNode;
                $(projectNode).children("award").each(function(i, award) {
                    var award_parsed = {};
                    $(award).children().each(function(i, award_attr) {
                        award_parsed[award_attr.nodeName] = parse_it(award, award_attr.nodeName);
                    });
                    modelJSON.awards.push(award_parsed);
                });

                //Parse the associatedParties
                modelJSON.associatedParties = [];
                $(projectNode).children("associatedParty").each(function(i, associatedParty) {

                    modelJSON.associatedParties.push(new EMLParty({
                        objectDOM: associatedParty
                    }));

                });

                //Parse the options
                $(projectNode).find("option").each(function(i, option) {

                    var optionName = $(option).find("optionName")[0].textContent,
                        optionValue = $(option).find("optionValue")[0].textContent;

                    if (optionValue === "true") {
                        optionValue = true;
                    } else if (optionValue === "false") {
                        optionValue = false;
                    }

                    modelJSON[optionName] = optionValue;

                });

                //Convert all the hex colors to rgb
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
                    //Create a MapModel with all the map options
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

                //Parse the FilterGroups
                modelJSON.filterGroups = [];
                var allFilters = modelJSON.searchModel.get("filters");
                $(projectNode).find("filterGroup").each(function(i, filterGroup) {

                  //Create a FilterGroup model
                  var filterGroupModel = new FilterGroup({
                      objectDOM: filterGroup
                  });
                  modelJSON.filterGroups.push(filterGroupModel);

                  //Add the Filters from this FilterGroup to the project's Search model
                  allFilters.add(filterGroupModel.get("filters").models);

                });

                return modelJSON;
            },

            /*
             * Parses the XML nodes that are of type EMLText
             *
             * @param {Element} parentNode - The XML Element that contains all the EMLText nodes
             * @param {string} nodeName - The name of the XML node to parse
             * @param {boolean} isMultiple - If true, parses the nodes into an array
             * @return {(string|Array)} - Returns a string or array of strings of the text content
             */
            parseEMLTextNode: function(parentNode, nodeName, isMultiple) {

                var node = $(parentNode).children(nodeName);

                //If no matching nodes were found, return falsey values
                if (!node || !node.length) {

                    //Return an empty array if the isMultiple flag is true
                    if (isMultiple)
                        return [];
                    //Return null if the isMultiple flag is false
                    else
                        return null;
                }
                //If exactly one node is found and we are only expecting one, return the text content
                else if (node.length == 1 && !isMultiple) {
                    return new EMLText({
                        objectDOM: node[0]
                    });
                } else {
                //If more than one node is found, parse into an array
                    return _.map(node, function(node) {
                        return new EMLText({
                            objectDOM: node
                        });
                    });

                }

            },

            /*
            * Creates a copy of the SolrResults collection and saves it in this
            * model so that there is always access to the unfiltered list of datasets
            *
            * @param {SolrResults} - The SolrResults collection to cache
            */
            cacheSearchResults: function(searchResults){

              //Save a copy of the SolrResults so that we always have a copy of
              // the unfiltered list of datasets
              this.set("allSearchResults", searchResults.clone());

              //Make a copy of the facetCounts object
              var allSearchResults = this.get("allSearchResults");
              allSearchResults.facetCounts = Object.assign({}, searchResults.facetCounts);

            },

            hexToRGB: function(hex){
              var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
              } : null;
            }

        });

        return ProjectModel;
    });
