/**
 * @exports PortalModel
 */
define([
  "jquery",
  "underscore",
  "backbone",
  "gmaps",
  "uuid",
  "collections/Filters",
  "collections/SolrResults",
  "models/filters/Filter",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "models/portals/PortalImage",
  "models/metadata/eml211/EMLParty",
  "models/metadata/eml220/EMLText",
  "models/CollectionModel",
  "models/Search",
  "models/filters/FilterGroup",
  "models/Map",
], function (
  $,
  _,
  Backbone,
  gmaps,
  uuid,
  Filters,
  SolrResults,
  FilterModel,
  PortalSectionModel,
  PortalVizSectionModel,
  PortalImage,
  EMLParty,
  EMLText,
  CollectionModel,
  SearchModel,
  FilterGroup,
  MapModel,
) {
  /**
   * @classdesc A PortalModel is a specialized collection that represents a portal,
   * including the associated data, people, portal descriptions, results and
   * visualizations.  It also includes settings for customized filtering of the
   * associated data, and properties used to customized the map display and the
   * overall branding of the portal.
   *
   * @class PortalModel
   * @classcategory Models/Portals
   * @extends CollectionModel
   * @module models/PortalModel
   * @name PortalModel
   * @constructor
   */
  var PortalModel = CollectionModel.extend(
    /** @lends PortalModel.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "Portal",

      /**
       * Overrides the default Backbone.Model.defaults() function to
       * specify default attributes for the portal model
       * @type {object}
       */
      defaults: function () {
        return _.extend(CollectionModel.prototype.defaults(), {
          id: null,
          objectXML: null,
          formatId: MetacatUI.appModel.get("portalEditorSerializationFormat"),
          formatType: "METADATA",
          type: "portal",
          //Is true if the last fetch was sent with user credentials. False if not.
          fetchedWithAuth: null,
          logo: null,
          sections: [],
          associatedParties: [],
          acknowledgments: null,
          acknowledgmentsLogos: [],
          awards: [],
          checkedNodeLabels: false,
          labelDoubleChecked: false,
          literatureCited: [],
          filterGroups: [],
          createSeriesId: true, //If true, a seriesId will be created when this object is saved.
          // The portal document options may specify section to hide
          edit: false, // Set to true if this model is being used in a portal editor view
          hideMetrics: null,
          hideData: null,
          hideMembers: null,
          hideMap: null,
          // List of section labels indicating the order in which to display the sections.
          // Labels must exactly match the labels set on sections, or the values set on the
          // metricsLabel, dataLabel, and membersLabel options.
          pageOrder: null,
          //Options for the custom section labels
          //NOTE: This are not fully supported yet.
          metricsLabel: "Metrics",
          dataLabel: "Data",
          membersLabel: "Members",
          // Map options, as specified in the portal document options
          mapZoomLevel: 3,
          mapCenterLatitude: null,
          mapCenterLongitude: null,
          mapShapeHue: 200,
          // The MapModel
          mapModel: gmaps ? new MapModel() : null,
          optionNames: [
            "primaryColor",
            "secondaryColor",
            "accentColor",
            "mapZoomLevel",
            "mapCenterLatitude",
            "mapCenterLongitude",
            "mapShapeHue",
            "hideData",
            "hideMetrics",
            "hideMembers",
            "pageOrder",
            "layout",
            "theme",
          ],
          // Portal view colors, as specified in the portal document options
          primaryColor:
            MetacatUI.appModel.get("portalDefaults").primaryColor || "#006699",
          secondaryColor:
            MetacatUI.appModel.get("portalDefaults").secondaryColor ||
            "#009299",
          accentColor:
            MetacatUI.appModel.get("portalDefaults").accentColor || "#f89406",
          primaryColorRGB: null,
          secondaryColorRGB: null,
          accentColorRGB: null,
          primaryColorTransparent:
            MetacatUI.appModel.get("portalDefaults").primaryColorTransparent ||
            "rgba(0, 102, 153, .7)",
          secondaryColorTransparent:
            MetacatUI.appModel.get("portalDefaults")
              .secondaryColorTransparent || "rgba(0, 146, 153, .7)",
          accentColorTransparent:
            MetacatUI.appModel.get("portalDefaults").accentColorTransparent ||
            "rgba(248, 148, 6, .7)",
          theme: null,
          layout: null,
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
      initialize: function (attrs) {
        //Call the super class initialize function
        CollectionModel.prototype.initialize.call(this, attrs);

        // Generate transparent colours from the primary, secondary, and accent colors
        // TODO

        if (attrs.isNew) {
          this.set("synced", true);
          //Create an isPartOf filter for this new Portal
          this.addIsPartOfFilter();

          var model = this;

          // Insert new sections if any are set in the appModel

          var portalDefaults = MetacatUI.appModel.get("portalDefaults"),
            defaultSections = portalDefaults ? portalDefaults.sections : [];

          if (
            defaultSections &&
            defaultSections.length &&
            Array.isArray(defaultSections)
          ) {
            defaultSections.forEach(function (section, index) {
              // If there is at least one section default set...
              if (section.title || section.label) {
                var newDefaultSection = new PortalSectionModel({
                  title: section.title || "",
                  label: section.label || this.newSectionLabel,
                  // Set a default image on new markdown sections
                  image: model.getRandomSectionImage(),
                  portalModel: model,
                });
                model.addSection(newDefaultSection);
              }
            });
          }
        }

        // check for info received from Bookkeeper
        if (MetacatUI.appModel.get("enableBookkeeperServices")) {
          this.listenTo(
            MetacatUI.appUserModel,
            "change:dataoneSubscription",
            function () {
              if (
                MetacatUI.appUserModel.get("dataoneSubscription").isTrialing()
              ) {
                this.setRandomLabel();
              }
            },
          );

          //Fetch the user subscription info
          MetacatUI.appUserModel.fetchSubscription();
        }

        // Cache this model for later use
        this.cachePortal();
      },

      /**
       * getRandomSectionImage - Using the list of image identifiers set
       * in the app config, select an image to use for a portal section.
       * The function will not return the same image until all the images
       * have been returned at least once. If an image would return a 404
       * error, it is skipped. If all images give 404s, an empty string
       * is returned.
       *
       * @return {PortalImage}  A portal image model to use in a section model
       */
      getRandomSectionImage: function () {
        // This variable will hold the section image to return, if any
        var newSectionImage = "",
          // The default portal values set in the config
          portalDefaults = MetacatUI.appModel.get("portalDefaults"),
          // Check if default images are set on the model already
          defaultImageIds = this.get("defaultSectionImageIds"),
          // Keep track of where we are in the list of default images,
          // so there's not too much repetition
          runningNumber = this.get("defaultImageRunningNumber") || 0;

        // If none are set, get the configured default image IDs,
        // shuffle them, and set them on the model.
        if (!defaultImageIds || !defaultImageIds.length) {
          // Get the list of default section image IDs from the appModel
          defaultImageIds = portalDefaults
            ? portalDefaults.sectionImageIdentifiers
            : false;

          // If some are configured...
          if (defaultImageIds && defaultImageIds.length) {
            // ...Shuffle the images...
            for (let i = defaultImageIds.length - 1; i > 0; i--) {
              let j = Math.floor(Math.random() * (i + 1));
              [defaultImageIds[i], defaultImageIds[j]] = [
                defaultImageIds[j],
                defaultImageIds[i],
              ];
            }
            // ... and save the shuffled list to the portal model
            this.set("defaultSectionImageIds", defaultImageIds);
          }
        }

        // Can't get a random image if none are configured
        if (!defaultImageIds) {
          console.log(
            "Can't set a default image on new markdown sections because there are no default image IDs set. Check portalDefaults.sectionImageIdentifiers in the config file.",
          );
          return;
        }

        // Select one of the image IDs
        if (defaultImageIds && defaultImageIds.length > 0) {
          if (runningNumber >= defaultImageIds.length) {
            runningNumber = 0;
          }

          // Go through the shuffled array of image IDs in order
          for (i = runningNumber; i < defaultImageIds.length; i++) {
            // Skip images that have already returned 404 errors
            if (defaultImageIds[i] == "NOT FOUND") {
              continue;
            }

            // Section images are PortalImage models
            var newSectionImage = new PortalImage({
              identifier: defaultImageIds[i],
              portalModel: this.get("portalModel"),
            });

            // Skip adding an image if it doesn't exist given the identifer and baseUrl found in the image model
            if (newSectionImage.imageExists()) {
              break;
              // If the image doesn't exist, mark it so we don't have to
              // check again next time
            } else {
              defaultImageIds[i] = "NOT FOUND";
              newSectionImage = "";
            }
          }
        }

        this.set("defaultImageRunningNumber", i + 1);
        this.set("defaultSectionImageIds", defaultImageIds);

        return newSectionImage;
      },

      /**
       * Returns the portal URL
       *
       * @return {string} The portal URL
       */
      url: function () {
        //Start the base URL string
        // use the resolve service if there is no object service url
        // (e.g. in DataONE theme)
        var urlBase =
          MetacatUI.appModel.get("objectServiceUrl") ||
          MetacatUI.appModel.get("resolveServiceUrl");

        //Get the active alternative repository, if one is configured
        var activeAltRepo = MetacatUI.appModel.getActiveAltRepo();

        if (activeAltRepo) {
          urlBase = activeAltRepo.objectServiceUrl;
        }

        //If this object is being updated, use the old pid in the URL
        if (!this.isNew() && this.get("oldPid")) {
          return urlBase + encodeURIComponent(this.get("oldPid"));
        }
        //If this object is new, use the new pid in the URL
        else {
          return (
            urlBase + encodeURIComponent(this.get("seriesId") || this.get("id"))
          );
        }
      },

      /**
       * Overrides the default Backbone.Model.fetch() function to provide some custom
       * fetch options
       * @param [options] {object} - Options for this fetch
       * @property [options.objectOnly] {Boolean} - If true, only the object will be retrieved and not the system metadata
       * @property [options.systemMetadataOnly] {Boolean} - If true, only the system metadata will be retrieved
       * @return {XMLDocument} The XMLDocument returned from the fetch() AJAX call
       */
      fetch: function (options) {
        if (!options) var options = {};
        else var options = _.clone(options);

        //If the seriesId has not been found yet, get it from Solr
        if (!this.get("id") && !this.get("seriesId") && this.get("label")) {
          this.once("change:seriesId", function () {
            this.fetch(options);
          });
          this.once("latestVersionFound", function () {
            this.fetch(options);
          });

          //Get the series ID of this object
          this.getSeriesIdByLabel();

          return;
        }
        //If we found the latest version in this pid version chain,
        else if (this.get("id") && this.get("latestVersion")) {
          //Set it as the id of this model
          this.set("id", this.get("latestVersion"));

          //Stop listening to the change of seriesId and the latest version found
          this.stopListening("change:seriesId", this.fetch);
          this.stopListening("latestVersionFound", this.fetch);
        }

        //If this MetacatUI instance is pointing to a CN, use the origin MN
        // to fetch the Portal, if available as an alt repo.
        if (MetacatUI.appModel.get("isCN") && this.get("datasource")) {
          //Check if the origin MN (datasource) is an alt repo option
          var altRepo = _.findWhere(
            MetacatUI.appModel.get("alternateRepositories"),
            { identifier: this.get("datasource") },
          );

          if (altRepo) {
            //Set the origin MN (datasource) as the active alt repo
            MetacatUI.appModel.set(
              "activeAlternateRepositoryId",
              this.get("datasource"),
            );
          }
        }

        //Fetch the system metadata
        if (!options.objectOnly || options.systemMetadataOnly) {
          this.fetchSystemMetadata();

          if (options.systemMetadataOnly) {
            return;
          }
        }

        var requestSettings = {
          dataType: "xml",
          error: function (model, response) {
            model.trigger("error", model, response);

            if (response && response.status == 404) {
              model.trigger("notFound");
            }
          },
        };

        //Save a boolean flag for whether or not this fetch was done with user authentication.
        //This is helpful when the app is dealing with potentially private data
        this.set("fetchedWithAuth", MetacatUI.appUserModel.get("loggedIn"));

        // Add the user settings to the fetch settings
        requestSettings = _.extend(
          requestSettings,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        // Call Backbone.Model.fetch()
        return Backbone.Model.prototype.fetch.call(this, requestSettings);
      },

      /**
       * Get the portal seriesId by searching for the portal by its label in Solr
       */
      getSeriesIdByLabel: function () {
        //Exit if there is no portal name set
        if (!this.get("label")) return;

        var model = this;

        //Start the base URL for the query service
        var baseUrl = "";

        try {
          //If this app instance is pointing to the CN, find the Portal series ID on the MN
          if (MetacatUI.appModel.get("alternateRepositories").length) {
            //Get the array of possible authoritative MNs
            var possibleAuthMNs = this.get("possibleAuthMNs");

            //If there are no possible authoritative MNs, use the CN query service
            if (!possibleAuthMNs.length) {
              baseUrl = MetacatUI.appModel.get("queryServiceUrl");
            } else {
              baseUrl = possibleAuthMNs[0].queryServiceUrl;
            }
          } else {
            //Get the query service URL
            baseUrl = MetacatUI.appModel.get("queryServiceUrl");
          }
        } catch (e) {
          console.error(
            "Error in trying to determine the query service URL. Going to try to use the AppModel setting. ",
            e,
          );
        } finally {
          //Default to the query service URL configured in the AppModel, if one wasn't set earlier
          if (!baseUrl) {
            baseUrl = MetacatUI.appModel.get("queryServiceUrl");
            //If there isn't a query service URL, trigger a "not found" error and exit
            if (!baseUrl) {
              this.trigger("notFound");
              return;
            }
          }
        }

        var requestSettings = {
          url:
            baseUrl +
            'q=label:"' +
            this.get("label") +
            '" OR ' +
            'seriesId:"' +
            this.get("label") +
            '"' +
            "&fl=seriesId,id,label,datasource" +
            "&sort=dateUploaded%20asc" +
            "&rows=1" +
            "&wt=json",
          dataType: "json",
          error: function (response) {
            model.trigger("error", model, response);

            if (response.status == 404) {
              model.trigger("notFound");
            }
          },
          success: function (response) {
            if (response.response.numFound > 0) {
              //Set the label and datasource
              model.set("label", response.response.docs[0].label);
              model.set("datasource", response.response.docs[0].datasource);

              //Save the seriesId, if one is found
              if (response.response.docs[0].seriesId) {
                model.set("seriesId", response.response.docs[0].seriesId);
              }
              //If this portal doesn't have a seriesId,
              //but id has been found
              else if (response.response.docs[0].id) {
                //Save the id
                model.set("id", response.response.docs[0].id);

                //Find the latest version in this version chain
                model.findLatestVersion(response.response.docs[0].id);
              }
              // if we don't have Id or SeriesId
              else {
                model.trigger("notFound");
              }
            } else {
              var possibleAuthMNs = model.get("possibleAuthMNs");
              if (possibleAuthMNs.length) {
                //Remove the first MN from the array, since it didn't contain the Portal, so it's not the auth MN
                possibleAuthMNs.shift();
              }

              //If there are no other possible auth MNs to check, trigger this Portal as Not Found.
              if (possibleAuthMNs.length == 0 || !possibleAuthMNs) {
                model.trigger("notFound");
              }
              //If there's more MNs to check, try again
              else {
                model.getSeriesIdByLabel();
              }
            }
          },
        };

        //Save a boolean flag for whether or not this fetch was done with user authentication.
        //This is helpful when the app is dealing with potentially private data
        this.set("fetchedWithAuth", MetacatUI.appUserModel.get("loggedIn"));

        requestSettings = _.extend(
          requestSettings,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        $.ajax(requestSettings);
      },

      /**
       * This function has been renamed `getSeriesIdByLabel` and may be removed in future releases.
       * @deprecated This function has been renamed `getSeriesIdByLabel` and may be removed in future releases.
       * @see PortalModel#getSeriesIdByLabel
       */
      getSeriesIdByName: function () {
        this.getSeriesIdByLabel();
      },

      /**
       * Overrides the default Backbone.Model.parse() function to parse the custom
       * portal XML document
       *
       * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
       * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
       */
      parse: function (response) {
        //Start the empty JSON object
        var modelJSON = {},
          modelRef = this,
          portalNode;

        // Iterate over each root XML node to find the portal node
        $(response)
          .children()
          .each(function (i, el) {
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
          var portImageModel = new PortalImage({
            objectDOM: portLogo,
            portalModel: this,
          });
          portImageModel.set(portImageModel.parse());
          modelJSON.logo = portImageModel;
        }

        // Parse acknowledgement logos into urls
        var logos = $(portalNode).children("acknowledgmentsLogo");
        modelJSON.acknowledgmentsLogos = [];
        _.each(
          logos,
          function (logo, i) {
            if (!logo) return;

            var imageModel = new PortalImage({
              objectDOM: logo,
              portalModel: this,
            });
            imageModel.set(imageModel.parse());

            if (imageModel.get("imageURL")) {
              modelJSON.acknowledgmentsLogos.push(imageModel);
            }
          },
          this,
        );

        // Parse the literature cited
        // This will only work for bibtex at the moment
        var bibtex = $(portalNode)
          .children("literatureCited")
          .children("bibtex");
        if (bibtex.length > 0) {
          modelJSON.literatureCited = this.parseTextNode(
            portalNode,
            "literatureCited",
          );
        }

        // Parse the portal content sections
        modelJSON.sections = [];
        $(portalNode)
          .children("section")
          .each(function (i, section) {
            //Get the section type, if there is one
            var sectionTypeNode = $(section).find(
                "optionName:contains(sectionType)",
              ),
              sectionType = "";

            if (sectionTypeNode.length) {
              var optionValueNode = sectionTypeNode
                .first()
                .siblings("optionValue");
              if (optionValueNode.length) {
                sectionType = optionValueNode[0].textContent;
              }
            }

            if (sectionType == "visualization") {
              // Create a new PortalVizSectionModel
              modelJSON.sections.push(
                new PortalVizSectionModel({
                  objectDOM: section,
                  literatureCited: modelJSON.literatureCited,
                }),
              );
            } else {
              // Create a new PortalSectionModel
              modelJSON.sections.push(
                new PortalSectionModel({
                  objectDOM: section,
                  literatureCited: modelJSON.literatureCited,
                  portalModel: modelRef,
                }),
              );
            }

            //Parse the PortalSectionModel
            modelJSON.sections[i].set(modelJSON.sections[i].parse(section));
          });

        // Parse the EMLText elements
        modelJSON.acknowledgments = this.parseEMLTextNode(
          portalNode,
          "acknowledgments",
        );

        // Parse the awards
        modelJSON.awards = [];
        var parse_it = this.parseTextNode;
        $(portalNode)
          .children("award")
          .each(function (i, award) {
            var award_parsed = {};
            $(award)
              .children()
              .each(function (i, award_attr) {
                if (award_attr.nodeName != "funderLogo") {
                  // parse the text nodes
                  award_parsed[award_attr.nodeName] = parse_it(
                    award,
                    award_attr.nodeName,
                  );
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
        $(portalNode)
          .children("associatedParty")
          .each(function (i, associatedParty) {
            modelJSON.associatedParties.push(
              new EMLParty({
                objectDOM: associatedParty,
              }),
            );
          });

        // Parse the options. Use children() and not find() because we only want
        // option nodes that are direct children of the portal node. Option nodes
        // can also be found within section nodes.
        $(portalNode)
          .children("option")
          .each(function (i, option) {
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

            // Convert the comma separated list of pages into an array
            if (
              optionName === "pageOrder" &&
              optionValue &&
              optionValue.length
            ) {
              optionValue = optionValue.split(",");
            }

            if (!_.has(modelJSON, optionName)) {
              modelJSON[optionName] = optionValue;
            }
          });

        // Convert all the hex colors to rgb
        if (modelJSON.primaryColor) {
          modelJSON.primaryColorRGB = this.hexToRGB(modelJSON.primaryColor);
          modelJSON.primaryColorTransparent =
            "rgba(" +
            modelJSON.primaryColorRGB.r +
            "," +
            modelJSON.primaryColorRGB.g +
            "," +
            modelJSON.primaryColorRGB.b +
            ", .7)";
        }
        if (modelJSON.secondaryColor) {
          modelJSON.secondaryColorRGB = this.hexToRGB(modelJSON.secondaryColor);
          modelJSON.secondaryColorTransparent =
            "rgba(" +
            modelJSON.secondaryColorRGB.r +
            "," +
            modelJSON.secondaryColorRGB.g +
            "," +
            modelJSON.secondaryColorRGB.b +
            ", .5)";
        }
        if (modelJSON.accentColor) {
          modelJSON.accentColorRGB = this.hexToRGB(modelJSON.accentColor);
          modelJSON.accentColorTransparent =
            "rgba(" +
            modelJSON.accentColorRGB.r +
            "," +
            modelJSON.accentColorRGB.g +
            "," +
            modelJSON.accentColorRGB.b +
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
          if (
            (modelJSON.mapCenterLatitude ||
              modelJSON.mapCenterLatitude === 0) &&
            (modelJSON.mapCenterLongitude || modelJSON.mapCenterLongitude === 0)
          ) {
            mapOptions.center = modelJSON.mapModel.createLatLng(
              modelJSON.mapCenterLatitude,
              modelJSON.mapCenterLongitude,
            );
          }
          if (modelJSON.mapShapeHue) {
            modelJSON.mapModel.set("tileHue", modelJSON.mapShapeHue);
          }
        }

        // Parse the UIFilterGroups
        modelJSON.filterGroups = [];
        var allFilters = modelJSON.searchModel.get("filters");
        $(portalNode)
          .children("filterGroup")
          .each(function (i, filterGroup) {
            // Create a FilterGroup model
            var filterGroupModel = new FilterGroup({
              objectDOM: filterGroup,
              isUIFilterType: true,
            });
            modelJSON.filterGroups.push(filterGroupModel);

            // Add the Filters from this FilterGroup to the portal's Search model,
            // unless this portal model is being edited. Then we only want the
            // definition filters to be included in the search model.
            if (!modelRef.get("edit")) {
              allFilters.add(filterGroupModel.get("filters").models);
            }
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
      parseEMLTextNode: function (parentNode, nodeName, isMultiple) {
        var node = $(parentNode).children(nodeName);

        // If no matching nodes were found, return falsey values
        if (!node || !node.length) {
          // Return an empty array if the isMultiple flag is true
          if (isMultiple) return [];
          // Return null if the isMultiple flag is false
          else return null;
        }
        // If exactly one node is found and we are only expecting one, return the text content
        else if (node.length == 1 && !isMultiple) {
          return new EMLText({
            objectDOM: node[0],
          });
        } else {
          // If more than one node is found, parse into an array
          return _.map(node, function (node) {
            return new EMLText({
              objectDOM: node,
            });
          });
        }
      },

      /**
       * Sets the fileName attribute on this model using the portal label
       * @override
       */
      setMissingFileName: function () {
        var fileName = this.get("label");

        if (!fileName) {
          fileName = "portal.xml";
        } else {
          fileName = fileName.replace(/[^a-zA-Z0-9]/g, "_") + ".xml";
        }

        this.set("fileName", fileName);
      },

      /**
       * @typedef {Object} PortalModel#rgb - An RGB color value
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
      hexToRGB: function (hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      },

      /**
       * Finds the node in the given portal XML document afterwhich the
       * given node type should be inserted
       *
       * @param {Element} portalNode - The portal element of an XML document
       * @param {string} nodeName - The name of the node to be inserted
       *                             into xml
       * @return {(jQuery|boolean)} A jQuery object indicating a position,
       *                            or false when nodeName is not in the
       *                            portal schema
       */
      getXMLPosition: function (portalNode, nodeName) {
        var nodeOrder = [
          "label",
          "name",
          "description",
          "definition",
          "logo",
          "section",
          "associatedParty",
          "acknowledgments",
          "acknowledgmentsLogo",
          "award",
          "literatureCited",
          "filterGroup",
          "option",
        ];

        var position = _.indexOf(nodeOrder, nodeName);

        // First check that nodeName is in the list of nodes
        if (position == -1) {
          return false;
        }

        // If there's already an occurence of nodeName...
        if ($(portalNode).children(nodeName).length > 0) {
          // ...insert it after the last occurence
          return $(portalNode).children(nodeName).last();
        } else {
          // Go through each node in the node list and find the position
          // after which this node will be inserted
          for (var i = position - 1; i >= 0; i--) {
            if ($(portalNode).children(nodeOrder[i]).length) {
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
      serialize: function () {
        try {
          // So we can call getXMLPosition() from within if{}
          var model = this;

          var xmlDoc, portalNode, xmlString;

          xmlDoc = this.get("objectXML");

          // Check if there is a portal doc already
          if (xmlDoc == null) {
            // If not create one
            xmlDoc = this.createXML();
          } else {
            // If yes, clone it
            xmlDoc = xmlDoc.cloneNode(true);
          }

          // Iterate over each root XML node to find the portal node
          $(xmlDoc)
            .children()
            .each(function (i, el) {
              if (el.tagName.indexOf("portal") > -1) {
                portalNode = el;
              }
            });

          // Serialize the collection elements
          // ("name", "label", "description", "definition")
          portalNode = this.updateCollectionDOM(portalNode);
          xmlDoc = portalNode.getRootNode();
          var $portalNode = $(portalNode);

          // Set formatID
          this.set(
            "formatId",
            MetacatUI.appModel.get("portalEditorSerializationFormat") ||
              "https://purl.dataone.org/portals-1.1.0",
          );

          /* ==== Serialize portal logo ==== */

          // Remove node if it exists already
          $(xmlDoc).find("logo").remove();

          // Get new values
          var logo = this.get("logo");

          // Don't serialize falsey values or empty logos
          if (logo && logo.get("identifier")) {
            // Make new node
            var logoSerialized = logo.updateDOM("logo");

            //Add the logo node to the XMLDocument
            xmlDoc.adoptNode(logoSerialized);

            // Insert new node at correct position
            var insertAfter = this.getXMLPosition(portalNode, "logo");
            if (insertAfter) {
              insertAfter.after(logoSerialized);
            } else {
              portalNode.appendChild(logoSerialized);
            }
          }

          /* ==== Serialize acknowledgment logos ==== */

          // Remove element if it exists already
          $(xmlDoc).find("acknowledgmentsLogo").remove();

          var acknowledgmentsLogos = this.get("acknowledgmentsLogos");

          // Don't serialize falsey values
          if (acknowledgmentsLogos) {
            _.each(acknowledgmentsLogos, function (imageModel) {
              // Don't serialize empty imageModels
              if (
                imageModel.get("identifier") ||
                imageModel.get("label") ||
                imageModel.get("associatedURL")
              ) {
                var ackLogosSerialized = imageModel.updateDOM();

                //Add the logo node to the XMLDocument
                xmlDoc.adoptNode(ackLogosSerialized);

                // Insert new node at correct position
                var insertAfter = model.getXMLPosition(
                  portalNode,
                  "acknowledgmentsLogo",
                );
                if (insertAfter) {
                  insertAfter.after(ackLogosSerialized);
                } else {
                  portalNode.appendChild(ackLogosSerialized);
                }
              }
            });
          }

          /* ==== Serialize literature cited ==== */
          // Assumes the value of literatureCited is a block of bibtex text

          // Remove node if it exists already
          $(xmlDoc).find("literatureCited").remove();

          // Get new values
          var litCit = this.get("literatureCited");

          // Don't serialize falsey values
          if (litCit.length) {
            // If there's only one element in litCited, it will be a string
            // turn it into an array so that we can use _.each
            if (typeof litCit == "string") {
              litCit = [litCit];
            }

            // Make new <literatureCited> element
            var litCitSerialized = xmlDoc.createElement("literatureCited");

            _.each(litCit, function (bibtex) {
              // Wrap in literature cited in cdata tags
              var cdataLitCit = xmlDoc.createCDATASection(bibtex);
              var bibtexSerialized = xmlDoc.createElement("bibtex");
              // wrap in CDATA tags so that bibtex characters aren't escaped
              bibtexSerialized.appendChild(cdataLitCit);
              // <bibxtex> is a subelement of <literatureCited>
              litCitSerialized.appendChild(bibtexSerialized);
            });

            // Insert new element at correct position
            var insertAfter = this.getXMLPosition(
              portalNode,
              "literatureCited",
            );
            if (insertAfter) {
              insertAfter.after(litCitSerialized);
            } else {
              portalNode.appendChild(litCitSerialized);
            }
          }

          /* ==== Serialize portal content sections ==== */

          // Remove node if it exists already
          $portalNode.children("section").remove();

          var sections = this.get("sections");

          // Don't serialize falsey values
          if (sections) {
            _.each(
              sections,
              function (sectionModel) {
                // Don't serialize sections with default values
                if (!this.sectionIsDefault(sectionModel)) {
                  var sectionSerialized = sectionModel.updateDOM();

                  //If there was an error serializing this section, or if
                  // nothing was returned, don't do anythiing further
                  if (!sectionSerialized) {
                    return;
                  }

                  //Add the section node to the XMLDocument
                  xmlDoc.adoptNode(sectionSerialized);

                  // Remove sections entirely if the content is blank
                  var newMD = $(sectionSerialized).find("markdown")[0];
                  if (!newMD || newMD.textContent == "") {
                    $(sectionSerialized).find("markdown").remove();
                  }

                  // Remove the <content> element if it's empty.
                  // This will trigger a validation error, prompting user to
                  // enter content.
                  if ($(sectionSerialized).find("content").is(":empty")) {
                    $(sectionSerialized).find("content").remove();
                  }

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(portalNode, "section");
                  if (insertAfter) {
                    insertAfter.after(sectionSerialized);
                  } else {
                    portalNode.appendChild(sectionSerialized);
                  }
                }
              },
              this,
            );
          }

          /* ====  Serialize the EMLText elements ("acknowledgments") ==== */

          var textFields = ["acknowledgments"];

          _.each(
            textFields,
            function (field) {
              var fieldName = field;

              // Get the EMLText model
              var emlTextModels = Array.isArray(this.get(field))
                ? this.get(field)
                : [this.get(field)];
              if (!emlTextModels.length) return;

              // Get the node from the XML doc
              var nodes = $portalNode.children(fieldName);

              // Update the DOMs for each model
              _.each(
                emlTextModels,
                function (thisTextModel, i) {
                  //Don't serialize falsey values
                  if (!thisTextModel) return;

                  var node;

                  //Get the existing node or create a new one
                  if (nodes.length < i + 1) {
                    node = xmlDoc.createElement(fieldName);
                    this.getXMLPosition(portalNode, fieldName).after(node);
                  } else {
                    node = nodes[i];
                  }

                  var textModelSerialized = thisTextModel.updateDOM();

                  //If the text model wasn't serialized correctly or resulted in nothing
                  if (
                    typeof textModelSerialized == "undefined" ||
                    !textModelSerialized
                  ) {
                    //Remove the existing node
                    $(node).remove();
                  } else {
                    xmlDoc.adoptNode(textModelSerialized);
                    $(node).replaceWith(textModelSerialized);
                  }
                },
                this,
              );

              // Remove the extra nodes
              this.removeExtraNodes(nodes, emlTextModels);
            },
            this,
          );

          /* ====  Serialize awards ==== */

          // Remove award node if it exists already
          $portalNode.children("award").remove();

          // Get new values
          var awards = this.get("awards");

          // Don't serialize falsey values
          if (awards && awards.length > 0) {
            _.each(awards, function (award) {
              // Make new node
              var awardSerialized = xmlDoc.createElement("award");

              // create the <award> subnodes
              _.map(award, function (value, nodeName) {
                // serialize the simple text nodes
                if (nodeName != "funderLogo") {
                  // Don't serialize falsey values
                  if (value) {
                    // Make new sub-nodes
                    var awardSubnodeSerialized = xmlDoc.createElement(nodeName);
                    $(awardSubnodeSerialized).text(value);
                    $(awardSerialized).append(awardSubnodeSerialized);
                  }
                } else {
                  // serialize "funderLogo" which is ImageType
                  var funderLogoSerialized = value.updateDOM();
                  xmlDoc.adoptNode(funderLogoSerialized);
                  $(awardSerialized).append(funderLogoSerialized);
                }
              });

              // Insert new node at correct position
              var insertAfter = model.getXMLPosition(portalNode, "award");
              if (insertAfter) {
                insertAfter.after(awardSerialized);
              } else {
                portalNode.appendChild(awardSerialized);
              }
            });
          }

          /* ====  Serialize associatedParties ==== */

          // Remove element if it exists already
          $portalNode.children("associatedParty").remove();

          // Get new values
          var parties = this.get("associatedParties");

          // Don't serialize falsey values
          if (parties) {
            // Serialize each associatedParty
            _.each(parties, function (party) {
              // Update the DOM of the EMLParty
              var partyEl = party.updateDOM();
              partyDoc = $.parseXML(party.formatXML($(partyEl)[0]));

              // Make sure we don't insert empty EMLParty nodes into the EML
              if (partyDoc.childNodes.length) {
                //Save a reference to the associated party element in the NodeList
                var assocPartyEl = partyDoc.childNodes[0];
                //Add the associated part element to the portal XML doc
                xmlDoc.adoptNode(assocPartyEl);

                // Get the last node of this type to insert after
                var insertAfter = $portalNode
                  .children("associatedParty")
                  .last();

                // If there isn't a node found, find the EML position to insert after
                if (!insertAfter.length) {
                  insertAfter = model.getXMLPosition(
                    portalNode,
                    "associatedParty",
                  );
                }

                //Insert the party DOM at the insert position
                if (insertAfter && insertAfter.length) {
                  insertAfter.after(assocPartyEl);
                } else {
                  portalNode.appendChild(assocPartyEl);
                }
              }
            });
          }

          try {
            /* ====  Serialize options (including map options) ==== */
            // This will only serialize the options named in `optNames` (below)
            // Functionality needed in order to serialize new or custom options

            // The standard list of options used in portals
            var optNames = this.get("optionNames");

            _.each(optNames, function (optName) {
              //Get the value on the model
              var optValue = model.get(optName),
                existingValue;

              //Get the existing optionName element
              var matchingOption = $portalNode
                .children("option")
                .find("optionName:contains('" + optName + "')");

              //
              if (
                !matchingOption.length ||
                matchingOption.first().text() != optName
              ) {
                matchingOption = false;
              } else {
                //Get the value for this option from the Portal doc
                existingValue = matchingOption.siblings("optionValue").text();
              }

              // Don't serialize null or undefined values. Also don't serialize values that match the default model value
              if (
                (optValue || optValue === 0 || optValue === false) &&
                optValue != model.defaults()[optName]
              ) {
                //Replace the existing option, if it exists
                if (matchingOption) {
                  matchingOption.siblings("optionValue").text(optValue);
                } else {
                  // Make new node
                  // <optionName> and <optionValue> are subelements of <option>
                  var optionSerialized = xmlDoc.createElement("option"),
                    optNameSerialized = xmlDoc.createElement("optionName"),
                    optValueSerialized = xmlDoc.createElement("optionValue");

                  $(optNameSerialized).text(optName);
                  $(optValueSerialized).text(optValue);

                  $(optionSerialized).append(
                    optNameSerialized,
                    optValueSerialized,
                  );

                  // Insert new node at correct position
                  var insertAfter = model.getXMLPosition(portalNode, "option");

                  if (insertAfter) {
                    insertAfter.after(optionSerialized);
                  }
                }
              } else {
                //Remove the elements from the portal XML when the value is invalid
                if (matchingOption) {
                  matchingOption.parent("option").remove();
                }
              }
            });
          } catch (e) {
            console.error(e);
          }

          /* ====  Serialize UI FilterGroups (aka custom search filters) ==== */

          // Get new filter group values
          var filterGroups = this.get("filterGroups");

          // Remove filter groups in the current objectDOM that are at the portal
          // level. (don't use .find("filterGroup") as that would remove
          // filterGroups that are nested in the definition
          $portalNode.children("filterGroup").remove();

          // Make a new node for each filter group in the model
          _.each(filterGroups, function (filterGroup) {
            filterGroupSerialized = filterGroup.updateDOM();

            if (filterGroupSerialized) {
              //Add the new element to the XMLDocument
              xmlDoc.adoptNode(filterGroupSerialized);

              // Insert new node at correct position
              var insertAfter = model.getXMLPosition(portalNode, "filterGroup");

              if (insertAfter) {
                insertAfter.after(filterGroupSerialized);
              } else {
                portalNode.appendChild(filterGroupSerialized);
              }
            }
          });

          /* ====  Remove duplicates ==== */

          //Do a final check to make sure there are no duplicate ids in the XML
          var elementsWithIDs = $(xmlDoc).find("[id]"),
            //Get an array of all the ids in this EML doc
            allIDs = _.map(elementsWithIDs, function (el) {
              return $(el).attr("id");
            });

          //If there is at least one id in the EML...
          if (allIDs && allIDs.length) {
            //Boil the array down to just the unique values
            var uniqueIDs = _.uniq(allIDs);

            //If the unique array is shorter than the array of all ids,
            // then there is a duplicate somewhere
            if (uniqueIDs.length < allIDs.length) {
              //For each element in the EML that has an id,
              _.each(elementsWithIDs, function (el) {
                //Get the id for this element
                var id = $(el).attr("id");

                //If there is more than one element in the EML with this id,
                if ($(xmlDoc).find("[id='" + id + "']").length > 1) {
                  //And if it is not a unit node, which we don't want to change,
                  if (!$(el).is("unit"))
                    //Then change the id attribute to a random uuid
                    $(el).attr("id", "urn-uuid-" + uuid.v4());
                }
              });
            }
          }

          // Convert xml to xmlString and return xmlString
          xmlString = new XMLSerializer().serializeToString(xmlDoc);

          //If there isn't an XML declaration, add one
          if (xmlString.indexOf("<?xml") == -1) {
            xmlString = '<?xml version="1.0" encoding="UTF-8"?>' + xmlString;
          }

          return xmlString;
        } catch (e) {
          console.error("Error while serializing the Portal XML document: ", e);
          this.set("errorMessage", e.stack);
          this.trigger(
            "errorSaving",
            MetacatUI.appModel.get("portalEditSaveErrorMsg"),
          );
          return;
        }
      },

      /**
       * Checks whether the given sectionModel has been updated by the
       * user, or whether all attributes match their default values.
       * For a section's markdown, the default value is either an empty
       * string or null. For a section's label, the default
       * value is either an empty string or a string that begins with the
       * value set to PortalModel.newSectionLabel. For all other attributes,
       * the defaults are set in PortalSectionModel.defaults.
       * @param {PortalSectionModel} sectionModel - The model to check against a default model
       * @return {boolean} returns true if the sectionModel matches a default model, and false when at least one attribute differs
       */
      sectionIsDefault: function (sectionModel) {
        try {
          var defaults = sectionModel.defaults(),
            currentMarkdown = sectionModel.get("content").get("markdown"),
            labelRegex = new RegExp("^" + this.newSectionLabel, "i");

          // For each attribute, check whether it matches the default
          if (
            // Check whether markdown matches the content that's
            // auto-filled or whether it's empty
            //currentMarkdown === this.markdownExample ||
            (currentMarkdown == "" || currentMarkdown == null) &&
            sectionModel.get("image") === defaults.image &&
            sectionModel.get("introduction") === defaults.introduction &&
            // Check whether label starts with the default new page name,
            // or whether it's empty
            (labelRegex.test(sectionModel.get("label")) ||
              sectionModel.get("label") == "" ||
              sectionModel.get("label") == null) &&
            sectionModel.get("literatureCited") === defaults.literatureCited &&
            sectionModel.get("title") === defaults.title
          ) {
            // All elements of the section match the default
            return true;
          } else {
            // At least one attribute of the section has been updated
            return false;
          }
        } catch (e) {
          // If there's a problem with this function for some reason,
          // return false so that the section is serialized to avoid
          // losing information
          console.log(
            "Failed to check whether section model is default. Serializing it anyway. Error message:" +
              e,
          );
          return false;
        }
      },

      /**
       * Initialize the object XML for a brand spankin' new portal
       * @inheritdoc
       *
       */
      createXML: function () {
        var format =
          MetacatUI.appModel.get("portalEditorSerializationFormat") ||
          "https://purl.dataone.org/portals-1.1.0";
        var xmlString = '<por:portal xmlns:por="' + format + '"></por:portal>';
        var xmlNew = $.parseXML(xmlString);
        var portalNode = xmlNew.getElementsByTagName("por:portal")[0];

        this.set("ownerDocument", portalNode.ownerDocument);
        return xmlNew;
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
      validate: function (attrs, options) {
        try {
          var errors = {},
            requiredFields =
              MetacatUI.appModel.get("portalEditorRequiredFields") || {};

          //Execute the superclass validate() function
          var collectionErrors = this.constructor.__super__.validate.call(this);
          if (
            typeof collectionErrors == "object" &&
            Object.keys(collectionErrors).length
          ) {
            //Use the errors messages from the CollectionModel for this PortalModel
            errors = collectionErrors;
          }

          // ---- Validate the description and name ----
          //Map the model attributes to the user-facing attribute name
          var textFields = {
            description: "description",
            name: "title",
          };
          //Iterate over each text field
          _.each(
            Object.keys(textFields),
            function (field) {
              //If this field is required, and it is a string
              if (requiredFields[field] && typeof this.get(field) == "string") {
                //If this is an empty string, set an error message
                if (!this.get(field).trim().length) {
                  errors[field] = "A " + textFields[field] + " is required.";
                }
              }
              //If this field is required, and it's not a string at all, set an error message
              else if (requiredFields[field]) {
                errors[field] = "A " + textFields[field] + " is required.";
              }
            },
            this,
          );

          //---Validate the sections---
          //Iterate over each section model
          _.each(
            this.get("sections"),
            function (section) {
              //Validate the section model
              var sectionErrors = section.validate();

              //If there is at least one error, then add an error to the PortalModel error list
              if (sectionErrors && Object.keys(sectionErrors).length) {
                errors.sections = "At least one section has an error";
              }
            },
            this,
          );

          //----Validate the logo----
          if (
            requiredFields.logo &&
            (!this.get("logo") || !this.get("logo").get("identifier"))
          ) {
            errors.logo = "A logo image is required";
          } else if (this.get("logo")) {
            logoErrors = this.get("logo").validate();
            if (logoErrors && Object.keys(logoErrors).length) {
              errors.logo = "A logo image is required";
            }
          }

          //---Validate the acknowledgmentsLogo---

          var nonEmptyAckLogos = this.get("acknowledgmentsLogos").filter(
            function (portalImage) {
              return !portalImage.isEmpty();
            },
          );

          if (requiredFields.acknowledgmentsLogos && !nonEmptyAckLogos.length) {
            errors.acknowledgmentsLogos =
              "At least one partner logo image is required.";
          } else if (nonEmptyAckLogos && nonEmptyAckLogos.length) {
            _.each(
              nonEmptyAckLogos,
              function (ackLogo) {
                // Validate the portal image model
                var ackLogoErrors = ackLogo.validate();

                // If there is at least one error, then add an error to the PortalModel error list
                if (ackLogoErrors && Object.keys(ackLogoErrors).length) {
                  errors.acknowledgmentsLogosImages =
                    "At least one acknowledgment logo has an error";
                }
              },
              this,
            );
          }

          //TODO: Validate these other elements, listed below, as they are added to the portal editor

          //---Validate the associatedParties---

          //---Validate the acknowledgments---

          //---Validate the award---

          //---Validate the literatureCited---

          //---Validate the filterGroups---

          //Return the errors object
          if (Object.keys(errors).length) return errors;
          else {
            return;
          }
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * Checks for the existing block list for repository labels
       * If at least one other Portal has the same label, then it is not available.
       * @param {string} label - The label to query for
       */
      checkLabelAvailability: function (label) {
        //Validate the label set on the model if one isn't given
        if (!label || typeof label != "string") {
          var label = this.get("label");
          if (!label || typeof label != "string") {
            //Trigger an error event
            this.trigger("errorValidatingLabel");
            console.error("error validating label, no label provided");
            return;
          }
        }

        var model = this;

        if (!this.get("checkedNodeLabels")) {
          // query CN to fetch the latest node data
          model.updateNodeBlockList();

          this.listenTo(this, "change:checkedNodeLabels", function () {
            this.checkPortalLabelAvailability(label);
          });
        } else {
          this.checkPortalLabelAvailability(label);
        }
      },

      /**
       * Queries the Solr discovery index for other Portal objects with this same label.
       * Also, checks for the existing block list for repository labels
       * If at least one other Portal has the same label, then it is not available.
       * @param {string} label - The label to query for
       */
      checkPortalLabelAvailability: function (label) {
        var model = this;

        // Stop Listening to the node model. We only need to retrieve this node label once.
        this.stopListening(this, "change:checkedNodeLabels", function () {
          this.checkPortalLabelAvailability(label);
        });

        // Convert the block list to lower case for case insensitive match
        var lowerCaseBlockList = this.get("labelBlockList").map(
          function (value) {
            return value.toLowerCase();
          },
        );

        // Check the existing blockList before making a Solr call
        if (lowerCaseBlockList.indexOf(label.toLowerCase()) > -1) {
          model.trigger("labelTaken");
          return;
        }

        // Query solr to see if other portals already use this label
        var requestSettings = {
          url:
            MetacatUI.appModel.get("queryServiceUrl") +
            'q=label:"' +
            label +
            '"' +
            ' AND formatId:"' +
            this.get("formatId") +
            '"' +
            "&rows=0" +
            "&wt=json",
          error: function (response) {
            model.trigger("errorValidatingLabel");
          },
          success: function (response) {
            if (response.response.numFound > 0) {
              //Add this label to the blockList so we don't have to query for it later
              var blockList = model.get("labelBlockList");
              if (Array.isArray(blockList)) {
                blockList.push(label);
              }

              model.trigger("labelTaken");
            } else {
              if (MetacatUI.appModel.get("alternateRepositories").length) {
                MetacatUI.appModel.setActiveAltRepo();
                var activeAltRepo = MetacatUI.appModel.getActiveAltRepo();
                if (activeAltRepo) {
                  var requestSettings = {
                    url:
                      activeAltRepo.queryServiceUrl +
                      'q=label:"' +
                      label +
                      '"' +
                      ' AND formatId:"' +
                      model.get("formatId") +
                      '"' +
                      "&rows=0" +
                      "&wt=json",
                    error: function (response) {
                      model.trigger("errorValidatingLabel");
                    },
                    success: function (response) {
                      if (response.response.numFound > 0) {
                        //Add this label to the blockList so we don't have to query for it later
                        var blockList = model.get("labelBlockList");
                        if (Array.isArray(blockList)) {
                          blockList.push(label);
                        }

                        model.trigger("labelTaken");
                      } else {
                        model.trigger("labelAvailable");
                      }
                    },
                  };
                  //Attach the User auth info and send the request
                  requestSettings = _.extend(
                    requestSettings,
                    MetacatUI.appUserModel.createAjaxSettings(),
                  );
                  $.ajax(requestSettings);
                }
              } else {
                model.trigger("labelAvailable");
              }
            }
          },
        };
        //Attach the User auth info and send the request
        requestSettings = _.extend(
          requestSettings,
          MetacatUI.appUserModel.createAjaxSettings(),
        );
        $.ajax(requestSettings);
      },

      /**
       * Queries the CN Solr to retrieve the updated BlockList
       */
      updateNodeBlockList: function () {
        var model = this;

        $.ajax({
          url: MetacatUI.appModel.get("nodeServiceUrl"),
          dataType: "text",
          error: function (data, textStatus, xhr) {
            // if there is an error in retrieving the node list;
            // proceed with the existing node list to perform the checks
            model.checkPortalLabelAvailability();
          },
          success: function (data, textStatus, xhr) {
            var xmlResponse = $.parseXML(data) || null;
            if (!xmlResponse) return;

            // update the node block list on success
            model.saveNodeBlockList(xmlResponse);
          },
        });
      },

      /**
       * Parses the retrieved XML document and saves the node information to the BlockList
       *
       * @param {XMLDocument} The XMLDocument returned from the fetch() AJAX call
       */
      saveNodeBlockList: function (xml) {
        var model = this,
          children = xml.children || xml.childNodes;

        //Traverse the XML response to get the MN info
        _.each(children, function (d1NodeList) {
          var d1NodeListChildren = d1NodeList.children || d1NodeList.childNodes;

          //The first (and only) child should be the d1NodeList
          _.each(d1NodeListChildren, function (thisNode) {
            //Ignore parts of the XML that is not MN info
            if (!thisNode.attributes) return;

            //'node' will be a single node
            var node = {},
              nodeProperties = thisNode.children || thisNode.childNodes;

            //Grab information about this node from XML nodes
            _.each(nodeProperties, function (nodeProperty) {
              if (nodeProperty.nodeName == "property")
                node[$(nodeProperty).attr("key")] = nodeProperty.textContent;
              else node[nodeProperty.nodeName] = nodeProperty.textContent;

              //Check if this member node has v2 read capabilities - important for the Package service
              if (
                nodeProperty.nodeName == "services" &&
                nodeProperty.childNodes.length
              ) {
                var v2 = $(nodeProperty).find(
                  "service[name='MNRead'][version='v2'][available='true']",
                ).length;
                node["readv2"] = v2;
              }
            });

            //Grab information about this node from XLM attributes
            _.each(thisNode.attributes, function (attribute) {
              node[attribute.nodeName] = attribute.nodeValue;
            });

            // Append Node name, node identifier and node short identifier to the array.
            // node identifier
            if (
              Array.isArray(model.get("labelBlockList")) &&
              model.get("labelBlockList").indexOf(node.identifier) < 0
            ) {
              model.get("labelBlockList").push(node.identifier);
            }

            // node name
            if (node.CN_node_name) {
              node.name = node.CN_node_name;
              if (
                Array.isArray(model.get("labelBlockList")) &&
                model.get("labelBlockList").indexOf(node.name) < 0
              ) {
                model.get("labelBlockList").push(node.name);
              }
            }

            // node short identifier
            node.shortIdentifier = node.identifier.substring(
              node.identifier.lastIndexOf(":") + 1,
            );
            if (
              Array.isArray(model.get("labelBlockList")) &&
              model.get("labelBlockList").indexOf(node.shortIdentifier) < 0
            ) {
              model.get("labelBlockList").push(node.shortIdentifier);
            }
          });
        });

        this.set("checkedNodeLabels", "true");
      },

      /**
       * Removes nodes from the XML that do not have an accompanying model
       * (i.e. nodes which were probably removed by the user during editing)
       *
       * @param {jQuery} nodes - The nodes to potentially remove
       * @param {Model[]} models - The model to compare to
       */
      removeExtraNodes: function (nodes, models) {
        // Remove the extra nodes
        var extraNodes = nodes.length - models.length;
        if (extraNodes > 0) {
          for (var i = models.length; i < nodes.length; i++) {
            $(nodes[i]).remove();
          }
        }
      },

      /**
       * Saves the portal XML document to the server using the DataONE API
       */
      save: function () {
        var model = this;

        // Remove empty filters from the custom portal search filters.
        this.get("filterGroups").forEach(function (filterGroupModel) {
          filterGroupModel.get("filters").removeEmptyFilters();
        }, this);

        // Ensure empty filters (rule groups) are removed, including from
        // within any nested filter groups
        this.get("definitionFilters").removeEmptyFilters(true);

        // Validate before we try anything else
        if (!this.isValid()) {
          //Trigger the invalid and cancelSave events
          this.trigger("invalid");
          this.trigger("cancelSave");
          //Don't save the model since it's invalid
          return false;
        } else {
          //Double-check that the label is available, if it was changed
          if (
            (this.isNew() || this.get("originalLabel") != this.get("label")) &&
            !this.get("labelDoubleChecked")
          ) {
            //If the label is taken
            this.once("labelTaken", function () {
              //Stop listening to the label availability
              this.stopListening("labelAvailable");

              //Set that the label has been double-checked
              this.set("labelDoubleChecked", true);

              //If this portal is in a free trial of DataONE Plus, generate a new random label
              // and start the save process again
              if (MetacatUI.appModel.get("enableBookkeeperServices")) {
                var subscription = MetacatUI.appUserModel.get(
                  "dataoneSubscription",
                );
                if (subscription && subscription.isTrialing()) {
                  this.setRandomLabel();

                  this.set("labelDoubleChecked", true);

                  // Start the save process again
                  this.save();

                  return;
                }
              } else {
                //If the label is taken, trigger an invalid event
                this.trigger("invalid");
                //Trigger a cancellation of the save event
                this.trigger("cancelSave");
              }
            });

            this.once("labelAvailable", function () {
              this.stopListening("labelTaken");
              this.set("labelDoubleChecked", true);
              this.save();
            });

            // Check label availability
            this.checkLabelAvailability(this.get("label"));

            // console.log("Double checking label");

            //Don't proceed with the rest of the save
            return;
          } else {
            this.trigger("valid");
          }
        }

        //Check if the checksum has been calculated yet.
        if (!this.get("checksum")) {
          // Serialize the XML
          var xml = this.serialize();

          //If there is no xml returned from the serialize() function, then there
          // was an error, so don't save.
          if (typeof xml === "undefined" || !xml) {
            //If no error message is set on the model, trigger an error now.
            // If there is an error message already, it means the error has already
            // been triggered inside the serialize() function.
            if (!this.get("errorMessage")) {
              this.trigger(
                "errorSaving",
                MetacatUI.appModel.get("portalEditSaveErrorMsg"),
              );
            }

            return;
          }

          var xmlBlob = new Blob([xml], { type: "application/xml" });

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
      removeSection: function (section) {
        try {
          //If this section is a string, remove it by adding custom options
          if (typeof section == "string") {
            switch (section.toLowerCase()) {
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
          else if (PortalSectionModel.prototype.isPrototypeOf(section)) {
            // Remove the section from the model's sections array object.
            // Use clone() to create new array reference and ensure change
            // event is tirggered.
            var sectionModels = _.clone(this.get("sections"));
            sectionModels.splice($.inArray(section, sectionModels), 1);
            this.set({ sections: sectionModels });
          } else {
            return;
          }
        } catch (e) {
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
      addSection: function (section) {
        try {
          //If this section is a string, add it by adding custom options
          if (typeof section == "string") {
            switch (section.toLowerCase()) {
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
                // Add a new, blank markdown section with a default image
                var sectionModels = _.clone(this.get("sections")),
                  newSection = new PortalSectionModel({
                    portalModel: this,
                    // Include a default image if some are configured.
                    image: this.getRandomSectionImage(),
                  });

                sectionModels.push(newSection);
                this.set("sections", sectionModels);
                // Trigger event manually so we can just pass newSection
                this.trigger("addSection", newSection);
                break;
            }
          }
          // If this section is a section model, add it to this Portal
          else if (PortalSectionModel.prototype.isPrototypeOf(section)) {
            var sectionModels = _.clone(this.get("sections"));
            sectionModels.push(section);
            this.set({ sections: sectionModels });
            // trigger event manually so we can just pass newSection
            this.trigger("addSection", section);
          } else {
            return;
          }
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * removePortalImage - remove a PortalImage model from either the
       * logo, sections, or acknowledgmentsLogos node of the portal model.
       *
       * @param  {Image} portalImage the portalImage model to remove
       */
      removePortalImage: function (portalImage) {
        try {
          // find the portalImage to remove
          switch (portalImage.get("nodeName")) {
            case "logo":
              if (portalImage === this.get("logo")) {
                this.set("logo", this.defaults().logo);
              }
              break;
            case "image":
              _.each(this.get("sections"), function (section, i) {
                if (portalImage === section.get("image")) {
                  section.set("image", section.defaults().image);
                }
              });
              break;
            case "acknowledgmentsLogo":
              var ackLogos = _.clone(this.get("acknowledgmentsLogos"));
              ackLogos.splice($.inArray(portalImage, ackLogos), 1);
              this.set({ acknowledgmentsLogos: ackLogos });
              break;
          }
        } catch (e) {
          console.log(
            "Failed to remove a portalImage model, error message: " + e,
          );
        }
      },

      /**
       * Saves a reference to this Portal on the MetacatUI global object
       */
      cachePortal: function () {
        if (this.get("id")) {
          MetacatUI.portals = MetacatUI.portals || {};
          MetacatUI.portals[this.get("id")] = this;
        }

        this.on("change:id", this.cachePortal);
      },

      /**
       * Creates a URL for viewing more information about this object
       * @return {string}
       */
      createViewURL: function () {
        return (
          MetacatUI.root +
          "/" +
          MetacatUI.appModel.get("portalTermPlural") +
          "/" +
          encodeURIComponent(
            this.get("label") || this.get("seriesId") || this.get("id"),
          )
        );
      },

      /**
       * Sets attributes on this Portal using the given Member Node data
       * @param {object} nodeInfoObject - A literal object taken from the NodeModel 'members' array
       */
      createNodeAttributes: function (nodeInfoObject) {
        var nodePortalModel = {};

        if (nodeInfoObject === undefined) {
          nodeInfoObject = {};
        }

        //TODO - check for undefined for each of the nodeInfo properties

        // Setting basic properties from the node info object
        this.set("name", nodeInfoObject.name);
        this.set("logo", nodeInfoObject.logo);
        this.set("description", nodeInfoObject.description);

        // Creating repo specific Filters
        var nodeFilterModel = new FilterModel({
          fields: ["datasource"],
          values: [nodeInfoObject.identifier],
          label: "Datasets for a repository",
          matchSubstring: false,
          operator: "OR",
        });

        // adding the filter in the node model
        this.get("definitionFilters").add(nodeFilterModel);

        // Set up the search model
        this.get("searchModel").get("filters").add(nodeFilterModel);
      },

      /**
       * Cleans up the given text so that it is XML-valid by escaping reserved characters, trimming white space, etc.
       *
       * @param {string} textString - The string to clean up
       * @return {string} - The cleaned up string
       */
      cleanXMLText: function (textString) {
        if (typeof textString != "string") return;

        textString = textString.trim();

        //Check for XML/HTML elements
        _.each(textString.match(/<\s*[^>]*>/g), function (xmlNode) {
          //Encode <, >, and </ substrings
          var tagName = xmlNode.replace(/>/g, "&gt;");
          tagName = tagName.replace(/</g, "&lt;");

          //Replace the xmlNode in the full text string
          textString = textString.replace(xmlNode, tagName);
        });

        //Remove Unicode characters that are not valid XML characters
        //Create a regular expression that matches any character that is not a valid XML character
        // (see https://www.w3.org/TR/xml/#charsets)
        var invalidCharsRegEx =
          /[^\u0009\u000a\u000d\u0020-\uD7FF\uE000-\uFFFD]/g;
        textString = textString.replace(invalidCharsRegEx, "");

        return textString;
      },

      /**
       * Generates a random portal label for free trial portals
       * @fires PortalModel#change:label
       * @since 2.14.0
       */
      setRandomLabel: function () {
        if (this.isNew()) {
          var labelLength = MetacatUI.appModel.get("randomLabelNumericLength");
          var randomGeneratedLabel = Math.floor(
            Math.pow(10, labelLength - 1) +
              Math.random() * (9 * Math.pow(10, labelLength - 1)),
          );
          randomGeneratedLabel = randomGeneratedLabel.toString();
          this.set("label", randomGeneratedLabel);
        }
      },

      reportSectionChange(model) {
        this.get("sections").forEach((section) => {
          section.reportSectionChange(model === section);
        });
      },
    },
  );

  return PortalModel;
});
