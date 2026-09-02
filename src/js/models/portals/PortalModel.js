/**
 * @exports PortalModel
 */
define([
  "jquery",
  "underscore",
  "backbone",
  "gmaps",
  "uuid",
  "models/filters/Filter",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "models/portals/PortalImage",
  "models/metadata/eml211/EMLParty",
  "models/metadata/eml220/EMLText",
  "models/CollectionModel",
  "models/filters/FilterGroup",
  "models/Map",
  "common/QueryService",
], (
  $,
  _,
  Backbone,
  gmaps,
  uuid,
  FilterModel,
  PortalSectionModel,
  PortalVizSectionModel,
  PortalImage,
  EMLParty,
  EMLText,
  CollectionModel,
  FilterGroup,
  MapModel,
  QueryService,
) => {
  /**
   * @classdesc A PortalModel is a specialized collection that represents a
   * portal, including the associated data, people, portal descriptions, results
   * and visualizations.  It also includes settings for customized filtering of
   * the associated data, and properties used to customized the map display and
   * the overall branding of the portal.
   * @class PortalModel
   * @classcategory Models/Portals
   * @augments CollectionModel
   * @module models/PortalModel
   * @name PortalModel
   * @class
   */
  const PortalModel = CollectionModel.extend(
    /** @lends PortalModel.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "Portal",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the portal model
       * @type {object}
       */
      defaults() {
        return _.extend(CollectionModel.prototype.defaults(), {
          id: null,
          objectXML: null,
          formatId: MetacatUI.appModel.get("portalEditorSerializationFormat"),
          formatType: "METADATA",
          type: "portal",
          // Is true if the last fetch was sent with user credentials. False if
          // not.
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
          createSeriesId: true, // If true, a seriesId will be created when this object is saved.
          // The portal document options may specify section to hide
          edit: false, // Set to true if this model is being used in a portal editor view
          hideMetrics: null,
          hideData: null,
          hideMembers: null,
          hideMap: null,
          // List of section labels indicating the order in which to display the
          // sections. Labels must exactly match the labels set on sections, or
          // the values set on the metricsLabel, dataLabel, and membersLabel
          // options.
          pageOrder: null,
          // Options for the custom section labels NOTE: This are not fully
          // supported yet.
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
       * Overrides the default Backbone.Model.initialize() function to provide
       * some custom initialize options
       * @param {} options -
       * @param attrs
       */
      initialize(attrs) {
        // Call the super class initialize function
        CollectionModel.prototype.initialize.call(this, attrs);

        // Generate transparent colours from the primary, secondary, and accent
        // colors TODO

        if (attrs.isNew) {
          this.set("synced", true);
          // Create an isPartOf filter for this new Portal
          this.addIsPartOfFilter();

          const model = this;

          // Insert new sections if any are set in the appModel

          const portalDefaults = MetacatUI.appModel.get("portalDefaults");
          const defaultSections = portalDefaults ? portalDefaults.sections : [];

          if (
            defaultSections &&
            defaultSections.length &&
            Array.isArray(defaultSections)
          ) {
            defaultSections.forEach(function (section, index) {
              // If there is at least one section default set...
              if (section.title || section.label) {
                const newDefaultSection = new PortalSectionModel({
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

          // Fetch the user subscription info
          MetacatUI.appUserModel.fetchSubscription();
        }

        // Cache this model for later use
        this.cachePortal();
      },

      /**
       * getRandomSectionImage - Using the list of image identifiers set in the
       * app config, select an image to use for a portal section. The function
       * will not return the same image until all the images have been returned
       * at least once. If an image would return a 404 error, it is skipped. If
       * all images give 404s, an empty string is returned.
       * @returns {PortalImage}  A portal image model to use in a section model
       */
      getRandomSectionImage() {
        // This variable will hold the section image to return, if any
        var newSectionImage = "";
        // The default portal values set in the config
        const portalDefaults = MetacatUI.appModel.get("portalDefaults");
        // Check if default images are set on the model already
        let defaultImageIds = this.get("defaultSectionImageIds");
        // Keep track of where we are in the list of default images, so there's
        // not too much repetition
        let runningNumber = this.get("defaultImageRunningNumber") || 0;

        // If none are set, get the configured default image IDs, shuffle them,
        // and set them on the model.
        if (!defaultImageIds || !defaultImageIds.length) {
          // Get the list of default section image IDs from the appModel
          defaultImageIds = portalDefaults
            ? portalDefaults.sectionImageIdentifiers
            : false;

          // If some are configured...
          if (defaultImageIds && defaultImageIds.length) {
            // ...Shuffle the images...
            for (let i = defaultImageIds.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
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

            // Skip adding an image if it doesn't exist given the identifer and
            // baseUrl found in the image model
            if (newSectionImage.imageExists()) {
              break;
              // If the image doesn't exist, mark it so we don't have to check
              // again next time
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
       * @returns {string} The portal URL
       */
      url() {
        // Start the base URL string use the resolve service if there is no
        // object service url (e.g. in DataONE theme)
        let urlBase =
          MetacatUI.appModel.get("objectServiceUrl") ||
          MetacatUI.appModel.get("resolveServiceUrl");

        // Get the active alternative repository, if one is configured
        const activeAltRepo = MetacatUI.appModel.getActiveAltRepo();

        if (activeAltRepo) {
          urlBase = activeAltRepo.objectServiceUrl;
        }

        // If this object is being updated, use the old pid in the URL
        if (!this.isNew() && this.get("oldPid")) {
          return urlBase + encodeURIComponent(this.get("oldPid"));
        }
        // If this object is new, use the new pid in the URL

        return (
          urlBase + encodeURIComponent(this.get("seriesId") || this.get("id"))
        );
      },

      /**
       * Overrides the default Backbone.Model.fetch() function to provide some
       * custom fetch options
       * @param [options] {object} - Options for this fetch
       * @property [options.objectOnly] {Boolean} - If true, only the object
       * will be retrieved and not the system metadata
       * @property [options.systemMetadataOnly] {Boolean} - If true, only the
       * system metadata will be retrieved
       * @returns {XMLDocument} The XMLDocument returned from the fetch() AJAX
       * call
       */
      fetch(options) {
        if (!options) var options = {};
        else var options = _.clone(options);

        // If the seriesId has not been found yet, get it from Solr
        if (!this.get("id") && !this.get("seriesId") && this.get("label")) {
          this.once("change:seriesId", function () {
            this.fetch(options);
          });
          this.once("latestVersionFound", function () {
            this.fetch(options);
          });

          // Get the series ID of this object
          this.getSeriesIdByLabel();

          return;
        }
        // If we found the latest version in this pid version chain,
        if (this.get("id") && this.get("latestVersion")) {
          // Set it as the id of this model
          this.set("id", this.get("latestVersion"));

          // Stop listening to the change of seriesId and the latest version
          // found
          this.stopListening("change:seriesId", this.fetch);
          this.stopListening("latestVersionFound", this.fetch);
        }

        // If this MetacatUI instance is pointing to a CN, use the origin MN to
        // fetch the Portal, if available as an alt repo.
        if (MetacatUI.appModel.get("isCN") && this.get("datasource")) {
          // Check if the origin MN (datasource) is an alt repo option
          const altRepo = _.findWhere(
            MetacatUI.appModel.get("alternateRepositories"),
            { identifier: this.get("datasource") },
          );

          if (altRepo) {
            // Set the origin MN (datasource) as the active alt repo
            MetacatUI.appModel.set(
              "activeAlternateRepositoryId",
              this.get("datasource"),
            );
          }
        }

        // Fetch the system metadata
        if (!options.objectOnly || options.systemMetadataOnly) {
          this.fetchSystemMetadata();

          if (options.systemMetadataOnly) {
            return;
          }
        }

        let requestSettings = {
          dataType: "xml",
          error(model, response) {
            model.trigger("error", model, response);

            if (response && response.status == 404) {
              model.trigger("notFound");
            }
          },
        };

        // Save a boolean flag for whether or not this fetch was done with user
        // authentication. This is helpful when the app is dealing with
        // potentially private data
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
       * Get the portal seriesId by searching for the portal by its label in
       * Solr
       */
      getSeriesIdByLabel() {
        const model = this;
        const label = this.get("label");
        if (!label) return;

        // Save a boolean flag for whether or not this fetch was done with user
        // authentication.
        this.set("fetchedWithAuth", MetacatUI.appUserModel.get("loggedIn"));

        // Build candidate query service URLs to try
        let candidates = [];
        try {
          const possibleAuthMNs = this.get("possibleAuthMNs") || [];
          if (
            MetacatUI.appModel.get("alternateRepositories").length &&
            possibleAuthMNs.length
          ) {
            candidates = possibleAuthMNs
              .map((mn) => mn && mn.queryServiceUrl)
              .filter(Boolean);
          } else {
            candidates = [MetacatUI.appModel.get("queryServiceUrl")];
          }
        } catch (e) {
          console.error(
            "Error determining queryServiceUrl candidates; falling back to AppModel setting.",
            e,
          );
        }
        if (!candidates.length && MetacatUI.appModel.get("queryServiceUrl")) {
          candidates = [MetacatUI.appModel.get("queryServiceUrl")];
        }
        candidates = _.uniq(candidates.filter(Boolean));
        if (!candidates.length) {
          this.trigger("notFound");
          return;
        }

        const tryIndex = function (i) {
          if (i >= candidates.length) {
            model.trigger("notFound");
            return;
          }
          QueryService.queryWithFetch({
            q: `label:"${label}" OR seriesId:"${label}"`,
            fields: ["seriesId", "id", "label", "datasource"],
            sort: "dateUploaded asc",
            rows: 1,
            urlBase: candidates[i],
            useAuth: true,
          })
            .then((response) => QueryService.parseResponse(response))
            .then((docs) => {
              if (!docs.length) {
                tryIndex(i + 1);
                return;
              }
              const doc = docs[0];
              model.set("label", doc.label);
              model.set("datasource", doc.datasource);
              if (doc.seriesId) {
                model.set("seriesId", doc.seriesId);
              } else if (doc.id) {
                model.set("id", doc.id);
                model.findLatestVersion(doc.id);
              } else {
                model.trigger("notFound");
              }
            })
            .catch((e) => {
              console.error(e);
              tryIndex(i + 1);
            });
        };

        tryIndex(0);
      },

      /**
       * This function has been renamed `getSeriesIdByLabel` and may be removed
       * in future releases.
       * @deprecated This function has been renamed `getSeriesIdByLabel` and may
       * be removed in future releases.
       * @see PortalModel#getSeriesIdByLabel
       */
      getSeriesIdByName() {
        this.getSeriesIdByLabel();
      },

      /**
       * Overrides the default Backbone.Model.parse() function to parse the
       * custom portal XML document
       * @param {XMLDocument} response - The XMLDocument returned from the
       * fetch() AJAX call
       * @returns {JSON} The result of the parsed XML, in JSON. To be set
       * directly on the model.
       */
      parse(response) {
        // Start the empty JSON object
        let modelJSON = {};
        const modelRef = this;
        let portalNode;

        // Iterate over each root XML node to find the portal node
        $(response)
          .children()
          .each((i, el) => {
            if (el.tagName.indexOf("portal") > -1) {
              portalNode = el;
              return false;
            }
          });

        // If a portal XML node wasn't found, return an empty JSON object
        if (typeof portalNode === "undefined" || !portalNode) {
          return {};
        }

        // Parse the collection elements
        modelJSON = this.parseCollectionXML(portalNode);

        // Save the xml for serialize
        modelJSON.objectXML = response;

        // Parse the portal logo
        const portLogo = $(portalNode).children("logo")[0];
        if (portLogo) {
          const portImageModel = new PortalImage({
            objectDOM: portLogo,
            portalModel: this,
          });
          portImageModel.set(portImageModel.parse());
          modelJSON.logo = portImageModel;
        }

        // Parse acknowledgement logos into urls
        const logos = $(portalNode).children("acknowledgmentsLogo");
        modelJSON.acknowledgmentsLogos = [];
        _.each(
          logos,
          function (logo, i) {
            if (!logo) return;

            const imageModel = new PortalImage({
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

        // Parse the literature cited This will only work for bibtex at the
        // moment
        const bibtex = $(portalNode)
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
          .each((i, section) => {
            // Get the section type, if there is one
            const sectionTypeNode = $(section).find(
              "optionName:contains(sectionType)",
            );
            let sectionType = "";

            if (sectionTypeNode.length) {
              const optionValueNode = sectionTypeNode
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

            // Parse the PortalSectionModel
            modelJSON.sections[i].set(modelJSON.sections[i].parse(section));
          });

        // Parse the EMLText elements
        modelJSON.acknowledgments = this.parseEMLTextNode(
          portalNode,
          "acknowledgments",
        );

        // Parse the awards
        modelJSON.awards = [];
        const parse_it = this.parseTextNode;
        $(portalNode)
          .children("award")
          .each((i, award) => {
            const award_parsed = {};
            $(award)
              .children()
              .each((i, award_attr) => {
                if (award_attr.nodeName != "funderLogo") {
                  // parse the text nodes
                  award_parsed[award_attr.nodeName] = parse_it(
                    award,
                    award_attr.nodeName,
                  );
                } else {
                  // parse funderLogo which is type ImageType
                  const imageModel = new PortalImage({ objectDOM: award_attr });
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
          .each((i, associatedParty) => {
            modelJSON.associatedParties.push(
              new EMLParty({
                objectDOM: associatedParty,
              }),
            );
          });

        // Parse the options. Use children() and not find() because we only want
        // option nodes that are direct children of the portal node. Option
        // nodes can also be found within section nodes.
        $(portalNode)
          .children("option")
          .each((i, option) => {
            const optionName = $(option).find("optionName")[0].textContent;
            let optionValue = $(option).find("optionValue")[0].textContent;

            if (optionValue === "true") {
              optionValue = true;
            } else if (optionValue === "false") {
              optionValue = false;
            }

            // TODO: keep a list of optionNames so that in the case of custom
            // options, we can serialize them in serialize() otherwise it's not
            // saved in the model which attributes are <option></option>s

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
          modelJSON.primaryColorTransparent = `rgba(${modelJSON.primaryColorRGB.r},${modelJSON.primaryColorRGB.g},${modelJSON.primaryColorRGB.b}, .7)`;
        }
        if (modelJSON.secondaryColor) {
          modelJSON.secondaryColorRGB = this.hexToRGB(modelJSON.secondaryColor);
          modelJSON.secondaryColorTransparent = `rgba(${modelJSON.secondaryColorRGB.r},${modelJSON.secondaryColorRGB.g},${modelJSON.secondaryColorRGB.b}, .5)`;
        }
        if (modelJSON.accentColor) {
          modelJSON.accentColorRGB = this.hexToRGB(modelJSON.accentColor);
          modelJSON.accentColorTransparent = `rgba(${modelJSON.accentColorRGB.r},${modelJSON.accentColorRGB.g},${modelJSON.accentColorRGB.b}, .5)`;
        }

        if (gmaps) {
          // Create a MapModel with all the map options
          modelJSON.mapModel = new MapModel();
          const mapOptions = modelJSON.mapModel.get("mapOptions");

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
        const allFilters = modelJSON.searchModel.get("filters");
        $(portalNode)
          .children("filterGroup")
          .each((i, filterGroup) => {
            // Create a FilterGroup model
            const filterGroupModel = new FilterGroup({
              objectDOM: filterGroup,
              isUIFilterType: true,
            });
            modelJSON.filterGroups.push(filterGroupModel);

            // Add the Filters from this FilterGroup to the portal's Search
            // model, unless this portal model is being edited. Then we only
            // want the definition filters to be included in the search model.
            if (!modelRef.get("edit")) {
              allFilters.add(filterGroupModel.get("filters").models);
            }
          });

        return modelJSON;
      },

      /**
       * Parses the XML nodes that are of type EMLText
       * @param {Element} parentNode - The XML Element that contains all the
       * EMLText nodes
       * @param {string} nodeName - The name of the XML node to parse
       * @param {boolean} isMultiple - If true, parses the nodes into an array
       * @returns {(string|Array)} A string or array of strings comprising the
       * text content
       */
      parseEMLTextNode(parentNode, nodeName, isMultiple) {
        const node = $(parentNode).children(nodeName);

        // If no matching nodes were found, return falsey values
        if (!node || !node.length) {
          // Return an empty array if the isMultiple flag is true
          if (isMultiple) return [];
          // Return null if the isMultiple flag is false
          return null;
        }
        // If exactly one node is found and we are only expecting one, return
        // the text content
        if (node.length == 1 && !isMultiple) {
          return new EMLText({
            objectDOM: node[0],
          });
        }
        // If more than one node is found, parse into an array
        return _.map(
          node,
          (node) =>
            new EMLText({
              objectDOM: node,
            }),
        );
      },

      /**
       * Sets the fileName attribute on this model using the portal label
       * @override
       */
      setMissingFileName() {
        let fileName = this.get("label");

        if (!fileName) {
          fileName = "portal.xml";
        } else {
          fileName = `${fileName.replace(/[^a-zA-Z0-9]/g, "_")}.xml`;
        }

        this.set("fileName", fileName);
      },

      /**
       * @typedef {object} PortalModel#rgb - An RGB color value
       * @property {number} r - A value between 0 and 255 defining the intensity
       * of red
       * @property {number} g - A value between 0 and 255 defining the intensity
       * of green
       * @property {number} b - A value between 0 and 255 defining the intensity
       * of blue
       */

      /**
       * Converts hex color values to RGB
       * @param {string} hex - a color in hexadecimal format
       * @returns {rgb} a color in RGB format
       */
      hexToRGB(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      },

      /**
       * Finds the node in the given portal XML document afterwhich the given
       * node type should be inserted
       * @param {Element} portalNode - The portal element of an XML document
       * @param {string} nodeName - The name of the node to be inserted into xml
       * @returns {(jQuery|boolean)} A jQuery object indicating a position, or
       *                            false when nodeName is not in the portal
       *                            schema
       */
      getXMLPosition(portalNode, nodeName) {
        const nodeOrder = [
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

        const position = _.indexOf(nodeOrder, nodeName);

        // First check that nodeName is in the list of nodes
        if (position == -1) {
          return false;
        }

        // If there's already an occurence of nodeName...
        if ($(portalNode).children(nodeName).length > 0) {
          // ...insert it after the last occurence
          return $(portalNode).children(nodeName).last();
        }
        // Go through each node in the node list and find the position after
        // which this node will be inserted
        for (let i = position - 1; i >= 0; i--) {
          if ($(portalNode).children(nodeOrder[i]).length) {
            return $(portalNode).children(nodeOrder[i]).last();
          }
        }

        return false;
      },

      /**
       * Retrieves the model attributes and serializes into portal XML, to
       * produce the new or modified portal document.
       * @returns {string} - Returns the portal XML as a string.
       */
      serialize() {
        try {
          // So we can call getXMLPosition() from within if{}
          const model = this;

          let xmlDoc;
          let portalNode;
          let xmlString;

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
            .each((i, el) => {
              if (el.tagName.indexOf("portal") > -1) {
                portalNode = el;
              }
            });

          // Serialize the collection elements ("name", "label", "description",
          // "definition")
          portalNode = this.updateCollectionDOM(portalNode);
          xmlDoc = portalNode.getRootNode();
          const $portalNode = $(portalNode);

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
          const logo = this.get("logo");

          // Don't serialize falsey values or empty logos
          if (logo && logo.get("identifier")) {
            // Make new node
            const logoSerialized = logo.updateDOM("logo");

            // Add the logo node to the XMLDocument
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

          const acknowledgmentsLogos = this.get("acknowledgmentsLogos");

          // Don't serialize falsey values
          if (acknowledgmentsLogos) {
            _.each(acknowledgmentsLogos, (imageModel) => {
              // Don't serialize empty imageModels
              if (
                imageModel.get("identifier") ||
                imageModel.get("label") ||
                imageModel.get("associatedURL")
              ) {
                const ackLogosSerialized = imageModel.updateDOM();

                // Add the logo node to the XMLDocument
                xmlDoc.adoptNode(ackLogosSerialized);

                // Insert new node at correct position
                const insertAfter = model.getXMLPosition(
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
          let litCit = this.get("literatureCited");

          // Don't serialize falsey values
          if (litCit.length) {
            // If there's only one element in litCited, it will be a string turn
            // it into an array so that we can use _.each
            if (typeof litCit === "string") {
              litCit = [litCit];
            }

            // Make new <literatureCited> element
            const litCitSerialized = xmlDoc.createElement("literatureCited");

            _.each(litCit, (bibtex) => {
              // Wrap in literature cited in cdata tags
              const cdataLitCit = xmlDoc.createCDATASection(bibtex);
              const bibtexSerialized = xmlDoc.createElement("bibtex");
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

          const sections = this.get("sections");

          // Don't serialize falsey values
          if (sections) {
            _.each(
              sections,
              function (sectionModel) {
                // Don't serialize sections with default values
                if (!this.sectionIsDefault(sectionModel)) {
                  const sectionSerialized = sectionModel.updateDOM();

                  // If there was an error serializing this section, or if
                  // nothing was returned, don't do anythiing further
                  if (!sectionSerialized) {
                    return;
                  }

                  // Add the section node to the XMLDocument
                  xmlDoc.adoptNode(sectionSerialized);

                  // Remove sections entirely if the content is blank
                  const newMD = $(sectionSerialized).find("markdown")[0];
                  if (!newMD || newMD.textContent == "") {
                    $(sectionSerialized).find("markdown").remove();
                  }

                  // Remove the <content> element if it's empty. This will
                  // trigger a validation error, prompting user to enter
                  // content.
                  if ($(sectionSerialized).find("content").is(":empty")) {
                    $(sectionSerialized).find("content").remove();
                  }

                  // Insert new node at correct position
                  const insertAfter = model.getXMLPosition(
                    portalNode,
                    "section",
                  );
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

          const textFields = ["acknowledgments"];

          _.each(
            textFields,
            function (field) {
              const fieldName = field;

              // Get the EMLText model
              const emlTextModels = Array.isArray(this.get(field))
                ? this.get(field)
                : [this.get(field)];
              if (!emlTextModels.length) return;

              // Get the node from the XML doc
              const nodes = $portalNode.children(fieldName);

              // Update the DOMs for each model
              _.each(
                emlTextModels,
                function (thisTextModel, i) {
                  // Don't serialize falsey values
                  if (!thisTextModel) return;

                  let node;

                  // Get the existing node or create a new one
                  if (nodes.length < i + 1) {
                    node = xmlDoc.createElement(fieldName);
                    this.getXMLPosition(portalNode, fieldName).after(node);
                  } else {
                    node = nodes[i];
                  }

                  const textModelSerialized = thisTextModel.updateDOM();

                  // If the text model wasn't serialized correctly or resulted
                  // in nothing
                  if (
                    typeof textModelSerialized === "undefined" ||
                    !textModelSerialized
                  ) {
                    // Remove the existing node
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
          const awards = this.get("awards");

          // Don't serialize falsey values
          if (awards && awards.length > 0) {
            _.each(awards, (award) => {
              // Make new node
              const awardSerialized = xmlDoc.createElement("award");

              // create the <award> subnodes
              _.map(award, (value, nodeName) => {
                // serialize the simple text nodes
                if (nodeName != "funderLogo") {
                  // Don't serialize falsey values
                  if (value) {
                    // Make new sub-nodes
                    const awardSubnodeSerialized =
                      xmlDoc.createElement(nodeName);
                    $(awardSubnodeSerialized).text(value);
                    $(awardSerialized).append(awardSubnodeSerialized);
                  }
                } else {
                  // serialize "funderLogo" which is ImageType
                  const funderLogoSerialized = value.updateDOM();
                  xmlDoc.adoptNode(funderLogoSerialized);
                  $(awardSerialized).append(funderLogoSerialized);
                }
              });

              // Insert new node at correct position
              const insertAfter = model.getXMLPosition(portalNode, "award");
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
          const parties = this.get("associatedParties");

          // Don't serialize falsey values
          if (parties) {
            // Serialize each associatedParty
            _.each(parties, (party) => {
              // Update the DOM of the EMLParty
              const partyEl = party.updateDOM();
              partyDoc = $.parseXML(party.formatXML($(partyEl)[0]));

              // Make sure we don't insert empty EMLParty nodes into the EML
              if (partyDoc.childNodes.length) {
                // Save a reference to the associated party element in the
                // NodeList
                const assocPartyEl = partyDoc.childNodes[0];
                // Add the associated part element to the portal XML doc
                xmlDoc.adoptNode(assocPartyEl);

                // Get the last node of this type to insert after
                let insertAfter = $portalNode
                  .children("associatedParty")
                  .last();

                // If there isn't a node found, find the EML position to insert
                // after
                if (!insertAfter.length) {
                  insertAfter = model.getXMLPosition(
                    portalNode,
                    "associatedParty",
                  );
                }

                // Insert the party DOM at the insert position
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
            const optNames = this.get("optionNames");

            _.each(optNames, (optName) => {
              // Get the value on the model
              const optValue = model.get(optName);
              let existingValue;

              // Get the existing optionName element
              let matchingOption = $portalNode
                .children("option")
                .find(`optionName:contains('${optName}')`);

              //
              if (
                !matchingOption.length ||
                matchingOption.first().text() != optName
              ) {
                matchingOption = false;
              } else {
                // Get the value for this option from the Portal doc
                existingValue = matchingOption.siblings("optionValue").text();
              }

              // Don't serialize null or undefined values. Also don't serialize
              // values that match the default model value
              if (
                (optValue || optValue === 0 || optValue === false) &&
                optValue != model.defaults()[optName]
              ) {
                // Replace the existing option, if it exists
                if (matchingOption) {
                  matchingOption.siblings("optionValue").text(optValue);
                } else {
                  // Make new node <optionName> and <optionValue> are
                  // subelements of <option>
                  const optionSerialized = xmlDoc.createElement("option");
                  const optNameSerialized = xmlDoc.createElement("optionName");
                  const optValueSerialized =
                    xmlDoc.createElement("optionValue");

                  $(optNameSerialized).text(optName);
                  $(optValueSerialized).text(optValue);

                  $(optionSerialized).append(
                    optNameSerialized,
                    optValueSerialized,
                  );

                  // Insert new node at correct position
                  const insertAfter = model.getXMLPosition(
                    portalNode,
                    "option",
                  );

                  if (insertAfter) {
                    insertAfter.after(optionSerialized);
                  }
                }
              } else {
                // Remove the elements from the portal XML when the value is
                // invalid
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
          const filterGroups = this.get("filterGroups");

          // Remove filter groups in the current objectDOM that are at the
          // portal level. (don't use .find("filterGroup") as that would remove
          // filterGroups that are nested in the definition
          $portalNode.children("filterGroup").remove();

          // Make a new node for each filter group in the model
          _.each(filterGroups, (filterGroup) => {
            filterGroupSerialized = filterGroup.updateDOM();

            if (filterGroupSerialized) {
              // Add the new element to the XMLDocument
              xmlDoc.adoptNode(filterGroupSerialized);

              // Insert new node at correct position
              const insertAfter = model.getXMLPosition(
                portalNode,
                "filterGroup",
              );

              if (insertAfter) {
                insertAfter.after(filterGroupSerialized);
              } else {
                portalNode.appendChild(filterGroupSerialized);
              }
            }
          });

          /* ====  Remove duplicates ==== */

          // Do a final check to make sure there are no duplicate ids in the XML
          const elementsWithIDs = $(xmlDoc).find("[id]");
          // Get an array of all the ids in this EML doc
          const allIDs = _.map(elementsWithIDs, (el) => $(el).attr("id"));

          // If there is at least one id in the EML...
          if (allIDs && allIDs.length) {
            // Boil the array down to just the unique values
            const uniqueIDs = _.uniq(allIDs);

            // If the unique array is shorter than the array of all ids, then
            // there is a duplicate somewhere
            if (uniqueIDs.length < allIDs.length) {
              // For each element in the EML that has an id,
              _.each(elementsWithIDs, (el) => {
                // Get the id for this element
                const id = $(el).attr("id");

                // If there is more than one element in the EML with this id,
                if ($(xmlDoc).find(`[id='${id}']`).length > 1) {
                  // And if it is not a unit node, which we don't want to
                  // change,
                  if (!$(el).is("unit"))
                    // Then change the id attribute to a random uuid
                    $(el).attr("id", `urn-uuid-${uuid.v4()}`);
                }
              });
            }
          }

          // Convert xml to xmlString and return xmlString
          xmlString = new XMLSerializer().serializeToString(xmlDoc);

          // If there isn't an XML declaration, add one
          if (xmlString.indexOf("<?xml") == -1) {
            xmlString = `<?xml version="1.0" encoding="UTF-8"?>${xmlString}`;
          }

          return xmlString;
        } catch (e) {
          console.error("Error while serializing the Portal XML document: ", e);
          this.set("errorMessage", e.stack);
          this.trigger(
            "errorSaving",
            MetacatUI.appModel.get("portalEditSaveErrorMsg"),
          );
        }
      },

      /**
       * Checks whether the given sectionModel has been updated by the user, or
       * whether all attributes match their default values. For a section's
       * markdown, the default value is either an empty string or null. For a
       * section's label, the default value is either an empty string or a
       * string that begins with the value set to PortalModel.newSectionLabel.
       * For all other attributes, the defaults are set in
       * PortalSectionModel.defaults.
       * @param {PortalSectionModel} sectionModel - The model to check against a
       * default model
       * @returns {boolean} returns true if the sectionModel matches a default
       * model, and false when at least one attribute differs
       */
      sectionIsDefault(sectionModel) {
        try {
          const defaults = sectionModel.defaults();
          const currentMarkdown = sectionModel.get("content").get("markdown");
          const labelRegex = new RegExp(`^${this.newSectionLabel}`, "i");

          // For each attribute, check whether it matches the default
          if (
            // Check whether markdown matches the content that's auto-filled or
            // whether it's empty currentMarkdown === this.markdownExample ||
            (currentMarkdown == "" || currentMarkdown == null) &&
            sectionModel.get("image") === defaults.image &&
            sectionModel.get("introduction") === defaults.introduction &&
            // Check whether label starts with the default new page name, or
            // whether it's empty
            (labelRegex.test(sectionModel.get("label")) ||
              sectionModel.get("label") == "" ||
              sectionModel.get("label") == null) &&
            sectionModel.get("literatureCited") === defaults.literatureCited &&
            sectionModel.get("title") === defaults.title
          ) {
            // All elements of the section match the default
            return true;
          }
          // At least one attribute of the section has been updated
          return false;
        } catch (e) {
          // If there's a problem with this function for some reason, return
          // false so that the section is serialized to avoid losing information
          console.log(
            `Failed to check whether section model is default. Serializing it anyway. Error message:${e}`,
          );
          return false;
        }
      },

      /**
       * Initialize the object XML for a brand spankin' new portal
       * @inheritdoc
       */
      createXML() {
        const format =
          MetacatUI.appModel.get("portalEditorSerializationFormat") ||
          "https://purl.dataone.org/portals-1.1.0";
        const xmlString = `<por:portal xmlns:por="${format}"></por:portal>`;
        const xmlNew = $.parseXML(xmlString);
        const portalNode = xmlNew.getElementsByTagName("por:portal")[0];

        this.set("ownerDocument", portalNode.ownerDocument);
        return xmlNew;
      },

      /**
       * Overrides the default Backbone.Model.validate.function() to check if
       * this portal model has all the required values necessary to save to the
       * server.
       * @param {object} [attrs] - A literal object of model attributes to
       * validate.
       * @param {object} [options] - A literal object of options for this
       * validation process
       * @returns {object} If there are errors, an object comprising error
       *                   messages. If no errors, returns nothing.
       */
      validate(attrs, options) {
        try {
          let errors = {};
          const requiredFields =
            MetacatUI.appModel.get("portalEditorRequiredFields") || {};

          // Execute the superclass validate() function
          const collectionErrors =
            this.constructor.__super__.validate.call(this);
          if (
            typeof collectionErrors === "object" &&
            Object.keys(collectionErrors).length
          ) {
            // Use the errors messages from the CollectionModel for this
            // PortalModel
            errors = collectionErrors;
          }

          // ---- Validate the description and name ---- Map the model
          // attributes to the user-facing attribute name
          const textFields = {
            description: "description",
            name: "title",
          };
          // Iterate over each text field
          _.each(
            Object.keys(textFields),
            function (field) {
              // If this field is required, and it is a string
              if (
                requiredFields[field] &&
                typeof this.get(field) === "string"
              ) {
                // If this is an empty string, set an error message
                if (!this.get(field).trim().length) {
                  errors[field] = `A ${textFields[field]} is required.`;
                }
              }
              // If this field is required, and it's not a string at all, set an
              // error message
              else if (requiredFields[field]) {
                errors[field] = `A ${textFields[field]} is required.`;
              }
            },
            this,
          );

          // ---Validate the sections--- Iterate over each section model
          _.each(
            this.get("sections"),
            (section) => {
              // Validate the section model
              const sectionErrors = section.validate();

              // If there is at least one error, then add an error to the
              // PortalModel error list
              if (sectionErrors && Object.keys(sectionErrors).length) {
                errors.sections = "At least one section has an error";
              }
            },
            this,
          );

          // ----Validate the logo----
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

          // ---Validate the acknowledgmentsLogo---

          const nonEmptyAckLogos = this.get("acknowledgmentsLogos").filter(
            (portalImage) => !portalImage.isEmpty(),
          );

          if (requiredFields.acknowledgmentsLogos && !nonEmptyAckLogos.length) {
            errors.acknowledgmentsLogos =
              "At least one partner logo image is required.";
          } else if (nonEmptyAckLogos && nonEmptyAckLogos.length) {
            _.each(
              nonEmptyAckLogos,
              (ackLogo) => {
                // Validate the portal image model
                const ackLogoErrors = ackLogo.validate();

                // If there is at least one error, then add an error to the
                // PortalModel error list
                if (ackLogoErrors && Object.keys(ackLogoErrors).length) {
                  errors.acknowledgmentsLogosImages =
                    "At least one acknowledgment logo has an error";
                }
              },
              this,
            );
          }

          // TODO: Validate these other elements, listed below, as they are
          // added to the portal editor

          // ---Validate the associatedParties---

          // ---Validate the acknowledgments---

          // ---Validate the award---

          // ---Validate the literatureCited---

          // ---Validate the filterGroups---

          // Return the errors object
          if (Object.keys(errors).length) return errors;
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * Queries the Solr discovery index for other Portal objects with this
       * same label. Also, checks for the existing block list for repository
       * labels If at least one other Portal has the same label, then it is not
       * available.
       * @param {string} l - The label to query for
       */
      checkLabelAvailability(l) {
        // Validate the label set on the model if one isn't given
        const label = typeof l === "string" ? l.trim() : this.get("label");
        if (typeof label !== "string") {
          this.errorValidatingLabel();
          return;
        }
        // Check that we have a node blockList
        if (!this.get("checkedNodeLabels")) {
          // query CN to fetch the latest node data
          this.updateNodeBlockList();
          this.listenToOnce(this, "change:checkedNodeLabels", () =>
            this.checkLabelAvailability(label),
          );
          return;
        }
        // Check existing blockList before making a Solr call (case insensitive)
        const blockList = this.get("labelBlockList") || [];
        if (blockList.find((b) => b.toLowerCase() === label.toLowerCase())) {
          this.labelAvailable();
          return;
        }

        // Query Solr for this label
        this.queryForLabel(label);
      },

      labelAvailable() {
        this.trigger("labelAvailable");
      },

      labelTaken(label) {
        const blockList = this.get("labelBlockList");
        if (Array.isArray(blockList)) blockList.push(label);
        this.trigger("labelTaken");
      },

      errorValidatingLabel(e) {
        const msg = e || "There was an error validating the portal label.";
        console.error(msg);
        this.trigger("errorValidatingLabel");
      },

      queryForLabel(label, urlBase, tryAltRepo = true) {
        const q = `label:"${label}" AND formatId:"${this.get("formatId")}"`;
        const opts = { q, rows: 0, useAuth: true };
        if (urlBase) opts.urlBase = urlBase;
        QueryService.queryWithFetch(opts)
          .then((response) => {
            if (response?.response?.numFound > 0) {
              this.labelTaken(label);
            } else if (
              tryAltRepo &&
              MetacatUI.appModel.get("alternateRepositories").length
            ) {
              MetacatUI.appModel.setActiveAltRepo();
              const activeAltRepo = MetacatUI.appModel.getActiveAltRepo();
              if (!activeAltRepo) {
                this.labelAvailable();
              } else {
                this.queryForLabel(label, activeAltRepo.queryServiceUrl, false);
              }
            } else {
              this.labelAvailable();
            }
          })
          .catch((e) => this.errorValidatingLabel(e));
      },

      /**
       * Queries the CN Solr to retrieve the updated BlockList
       */
      updateNodeBlockList() {
        const model = this;

        $.ajax({
          url: MetacatUI.appModel.get("nodeServiceUrl"),
          dataType: "text",
          error(data, textStatus, xhr) {
            // if there is an error in retrieving the node list; proceed with
            // the existing node list to perform the checks
            this.set("checkedNodeLabels", "true");
          },
          success(data, textStatus, xhr) {
            const xmlResponse = $.parseXML(data) || null;
            if (!xmlResponse) return;

            // update the node block list on success
            model.saveNodeBlockList(xmlResponse);
          },
        });
      },

      /**
       * Parses the retrieved XML document and saves the node information to the
       * BlockList
       * @param {XMLDocument} The XMLDocument returned from the fetch() AJAX
       * call
       * @param xml
       */
      saveNodeBlockList(xml) {
        const model = this;
        const children = xml.children || xml.childNodes;

        // Traverse the XML response to get the MN info
        _.each(children, (d1NodeList) => {
          const d1NodeListChildren =
            d1NodeList.children || d1NodeList.childNodes;

          // The first (and only) child should be the d1NodeList
          _.each(d1NodeListChildren, (thisNode) => {
            // Ignore parts of the XML that is not MN info
            if (!thisNode.attributes) return;

            // 'node' will be a single node
            const node = {};
            const nodeProperties = thisNode.children || thisNode.childNodes;

            // Grab information about this node from XML nodes
            _.each(nodeProperties, (nodeProperty) => {
              if (nodeProperty.nodeName == "property")
                node[$(nodeProperty).attr("key")] = nodeProperty.textContent;
              else node[nodeProperty.nodeName] = nodeProperty.textContent;

              // Check if this member node has v2 read capabilities - important
              // for the Package service
              if (
                nodeProperty.nodeName == "services" &&
                nodeProperty.childNodes.length
              ) {
                const v2 = $(nodeProperty).find(
                  "service[name='MNRead'][version='v2'][available='true']",
                ).length;
                node.readv2 = v2;
              }
            });

            // Grab information about this node from XLM attributes
            _.each(thisNode.attributes, (attribute) => {
              node[attribute.nodeName] = attribute.nodeValue;
            });

            // Append Node name, node identifier and node short identifier to
            // the array. node identifier
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
       * Removes nodes from the XML that do not have an accompanying model (i.e.
       * nodes which were probably removed by the user during editing)
       * @param {jQuery} nodes - The nodes to potentially remove
       * @param {Model[]} models - The model to compare to
       */
      removeExtraNodes(nodes, models) {
        // Remove the extra nodes
        const extraNodes = nodes.length - models.length;
        if (extraNodes > 0) {
          for (let i = models.length; i < nodes.length; i++) {
            $(nodes[i]).remove();
          }
        }
      },

      /**
       * Saves the portal XML document to the server using the DataONE API
       */
      save() {
        const model = this;

        // Remove empty filters from the custom portal search filters.
        this.get("filterGroups").forEach((filterGroupModel) => {
          filterGroupModel.get("filters").removeEmptyFilters();
        }, this);

        // Ensure empty filters (rule groups) are removed, including from within
        // any nested filter groups
        this.get("definitionFilters").removeEmptyFilters(true);

        // Validate before we try anything else
        if (!this.isValid()) {
          // Trigger the invalid and cancelSave events
          this.trigger("invalid");
          this.trigger("cancelSave");
          // Don't save the model since it's invalid
          return false;
        }
        // Double-check that the label is available, if it was changed
        if (
          (this.isNew() || this.get("originalLabel") != this.get("label")) &&
          !this.get("labelDoubleChecked")
        ) {
          // If the label is taken
          this.once("labelTaken", function () {
            // Stop listening to the label availability
            this.stopListening("labelAvailable");

            // Set that the label has been double-checked
            this.set("labelDoubleChecked", true);

            // If this portal is in a free trial of DataONE Plus, generate a new
            // random label and start the save process again
            if (MetacatUI.appModel.get("enableBookkeeperServices")) {
              const subscription = MetacatUI.appUserModel.get(
                "dataoneSubscription",
              );
              if (subscription && subscription.isTrialing()) {
                this.setRandomLabel();

                this.set("labelDoubleChecked", true);

                // Start the save process again
                this.save();
              }
            } else {
              // If the label is taken, trigger an invalid event
              this.trigger("invalid");
              // Trigger a cancellation of the save event
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

          // Don't proceed with the rest of the save
          return;
        }
        this.trigger("valid");

        // Check if the checksum has been calculated yet.
        if (!this.get("checksum")) {
          // Serialize the XML
          const xml = this.serialize();

          // If there is no xml returned from the serialize() function, then
          // there was an error, so don't save.
          if (typeof xml === "undefined" || !xml) {
            // If no error message is set on the model, trigger an error now. If
            // there is an error message already, it means the error has already
            // been triggered inside the serialize() function.
            if (!this.get("errorMessage")) {
              this.trigger(
                "errorSaving",
                MetacatUI.appModel.get("portalEditSaveErrorMsg"),
              );
            }

            return;
          }

          const xmlBlob = new Blob([xml], { type: "application/xml" });

          // Set the Blob as the upload file
          this.set("uploadFile", xmlBlob);

          // When it is calculated, restart this function
          this.off("checksumCalculated", this.save);
          this.on("checksumCalculated", this.save);
          // Calculate the checksum for this file
          this.calculateChecksum();

          // Exit this function until the checksum is done
          return;
        }

        this.constructor.__super__.save.call(this);
      },

      /**
       * Removes or hides the given section from this Portal
       * @param {PortalSectionModel|string} section - Either the
       * PortalSectionModel to remove, or the name of the section to remove.
       * Some sections in the portals are not tied to PortalSectionModels,
       * because they are created from other parts of the Portal document. For
       * example, the Data, Metrics, and Members sections.
       */
      removeSection(section) {
        try {
          // If this section is a string, remove it by adding custom options
          if (typeof section === "string") {
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
          // If this section is a section model, delete it from this Portal
          else if (PortalSectionModel.prototype.isPrototypeOf(section)) {
            // Remove the section from the model's sections array object. Use
            // clone() to create new array reference and ensure change event is
            // tirggered.
            const sectionModels = _.clone(this.get("sections"));
            sectionModels.splice($.inArray(section, sectionModels), 1);
            this.set({ sections: sectionModels });
          } else {
          }
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * Adds the given section to this Portal
       * @param {PortalSectionModel|string} section - Either the
       * PortalSectionModel to add, or the name of the section to add. Some
       * sections in the portals are not tied to PortalSectionModels, because
       * they are created from other parts of the Portal document. For example,
       * the Data, Metrics, and Members sections.
       */
      addSection(section) {
        try {
          // If this section is a string, add it by adding custom options
          if (typeof section === "string") {
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
                var sectionModels = _.clone(this.get("sections"));
                var newSection = new PortalSectionModel({
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
          }
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * removePortalImage - remove a PortalImage model from either the logo,
       * sections, or acknowledgmentsLogos node of the portal model.
       * @param  {Image} portalImage the portalImage model to remove
       */
      removePortalImage(portalImage) {
        try {
          // find the portalImage to remove
          switch (portalImage.get("nodeName")) {
            case "logo":
              if (portalImage === this.get("logo")) {
                this.set("logo", this.defaults().logo);
              }
              break;
            case "image":
              _.each(this.get("sections"), (section, i) => {
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
            `Failed to remove a portalImage model, error message: ${e}`,
          );
        }
      },

      /**
       * Saves a reference to this Portal on the MetacatUI global object
       */
      cachePortal() {
        if (this.get("id")) {
          MetacatUI.portals = MetacatUI.portals || {};
          MetacatUI.portals[this.get("id")] = this;
        }

        this.on("change:id", this.cachePortal);
      },

      /**
       * Creates a URL for viewing more information about this object
       * @returns {string}
       */
      createViewURL() {
        return `${MetacatUI.root}/${MetacatUI.appModel.get(
          "portalTermPlural",
        )}/${encodeURIComponent(
          this.get("label") || this.get("seriesId") || this.get("id"),
        )}`;
      },

      /**
       * Sets attributes on this Portal using the given Member Node data
       * @param {object} nodeInfoObject - A literal object taken from the
       * NodeModel 'members' array
       */
      createNodeAttributes(nodeInfoObject) {
        const nodePortalModel = {};

        if (nodeInfoObject === undefined) {
          nodeInfoObject = {};
        }

        // TODO - check for undefined for each of the nodeInfo properties

        // Setting basic properties from the node info object
        this.set("name", nodeInfoObject.name);
        this.set("logo", nodeInfoObject.logo);
        this.set("description", nodeInfoObject.description);

        // Creating repo specific Filters
        const nodeFilterModel = new FilterModel({
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
       * Cleans up the given text so that it is XML-valid by escaping reserved
       * characters, trimming white space, etc.
       * @param {string} textString - The string to clean up
       * @returns {string} - The cleaned up string
       */
      cleanXMLText(textString) {
        if (typeof textString !== "string") return;

        textString = textString.trim();

        // Check for XML/HTML elements
        _.each(textString.match(/<\s*[^>]*>/g), (xmlNode) => {
          // Encode <, >, and </ substrings
          let tagName = xmlNode.replace(/>/g, "&gt;");
          tagName = tagName.replace(/</g, "&lt;");

          // Replace the xmlNode in the full text string
          textString = textString.replace(xmlNode, tagName);
        });

        // Remove Unicode characters that are not valid XML characters Create a
        // regular expression that matches any character that is not a valid XML
        // character (see https://www.w3.org/TR/xml/#charsets)
        const invalidCharsRegEx =
          /[^\u0009\u000a\u000d\u0020-\uD7FF\uE000-\uFFFD]/g;
        textString = textString.replace(invalidCharsRegEx, "");

        return textString;
      },

      /**
       * Generates a random portal label for free trial portals
       * @fires PortalModel#change:label
       * @since 2.14.0
       */
      setRandomLabel() {
        if (this.isNew()) {
          const labelLength = MetacatUI.appModel.get(
            "randomLabelNumericLength",
          );
          let randomGeneratedLabel = Math.floor(
            10 ** (labelLength - 1) +
              Math.random() * (9 * 10 ** (labelLength - 1)),
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
