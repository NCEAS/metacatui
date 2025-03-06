define([
  "jquery",
  "underscore",
  "backbone",
  "uuid",
  "he",
  "collections/AccessPolicy",
  "collections/ObjectFormats",
  "common/Utilities",
  "md5",
], ($, _, Backbone, uuid, he, AccessPolicy, ObjectFormats, Utilities, md5) => {
  /**
   * @class DataONEObject
   * @classdesc A DataONEObject represents a DataONE object, such as a data file,
        a science metadata object, or a resource map. It stores the system
         metadata attributes for the object, performs updates to the system metadata,
         and other basic DataONE API functions. This model can be extended to provide
         specific functionality for different object types, such as the {@link ScienceMetadata}
         model and the {@link EML211} model.
   * @classcategory Models
   * @augments Backbone.Model
   */
  var DataONEObject = Backbone.Model.extend(
    /** @lends DataONEObject.prototype */ {
      type: "DataONEObject",
      selectedInEditor: false, // Has this package member been selected and displayed in the provenance editor?
      PROV: "http://www.w3.org/ns/prov#",
      PROVONE: "http://purl.dataone.org/provone/2015/01/15/ontology#",

      defaults() {
        return {
          // System Metadata attributes
          serialVersion: null,
          identifier: null,
          formatId: null,
          size: null,
          checksum: null,
          originalChecksum: null,
          checksumAlgorithm: "MD5",
          submitter: null,
          rightsHolder: null,
          accessPolicy: [], // An array of accessPolicy literal JS objects
          replicationAllowed: null,
          replicationPolicy: [],
          obsoletes: null,
          obsoletedBy: null,
          archived: null,
          dateUploaded: null,
          dateSysMetadataModified: null,
          originMemberNode: null,
          authoritativeMemberNode: null,
          replica: [],
          seriesId: null, // uuid.v4(), (decide if we want to auto-set this)
          mediaType: null,
          fileName: null,
          // Non-system metadata attributes:
          isNew: null,
          datasource: null,
          insert_count_i: null,
          read_count_i: null,
          changePermission: null,
          writePermission: null,
          readPermission: null,
          isPublic: null,
          dateModified: null,
          id: `urn:uuid:${uuid.v4()}`,
          sizeStr: null,
          type: "", // Data, Metadata, or DataPackage
          formatType: "",
          metadataEntity: null, // A model that represents the metadata for this file, e.g. an EMLEntity model
          latestVersion: null,
          isDocumentedBy: null,
          documents: [],
          members: [],
          resourceMap: [],
          nodeLevel: 0, // Indicates hierarchy level in the view for indentation
          sortOrder: 2, // Metadata: 1, Data: 2, DataPackage: 3
          synced: false, // True if the full model has been synced
          uploadStatus: null, // c=complete, p=in progress, q=queued, e=error, w=warning, no upload status=not in queue
          uploadProgress: null,
          sysMetaUploadStatus: null, // c=complete, p=in progress, q=queued, e=error, l=loading, no upload status=not in queue
          percentLoaded: 0, // Percent the file is read before caclculating the md5 sum
          uploadFile: null, // The file reference to be uploaded (JS object: File)
          errorMessage: null,
          sysMetaErrorCode: null, // The status code given when there is an error updating the system metadata
          numSaveAttempts: 0,
          notFound: false, // Whether or not this object was found in the system
          originalAttrs: [], // An array of original attributes in a DataONEObject
          changed: false, // If any attributes have been changed, including attrs in nested objects
          hasContentChanges: false, // If attributes outside of originalAttrs have been changed
          sysMetaXML: null, // A cached original version of the fetched system metadata document
          objectXML: null, // A cached version of the object fetched from the server
          isAuthorized: null, // If the stated permission is authorized by the user
          isAuthorized_read: null, // If the user has permission to read
          isAuthorized_write: null, // If the user has permission to write
          isAuthorized_changePermission: null, // If the user has permission to changePermission
          createSeriesId: false, // If true, a seriesId will be created when this object is saved.
          collections: [], // References to collections that this model is in
          possibleAuthMNs: [], // A list of possible authoritative MNs of this object
          useAltRepo: false,
          isLoadingFiles: false, // Only relevant to Resource Map objects. Is true if there is at least one file still loading into the package.
          numLoadingFiles: 0, // Only relevant to Resource Map objects. The number of files still loading into the package.
          provSources: [],
          provDerivations: [],
          prov_generated: [],
          prov_generatedByExecution: [],
          prov_generatedByProgram: [],
          prov_generatedByUser: [],
          prov_hasDerivations: [],
          prov_hasSources: [],
          prov_instanceOfClass: [],
          prov_used: [],
          prov_usedByExecution: [],
          prov_usedByProgram: [],
          prov_usedByUser: [],
          prov_wasDerivedFrom: [],
          prov_wasExecutedByExecution: [],
          prov_wasExecutedByUser: [],
          prov_wasInformedBy: [],
        };
      },

      initialize(attrs, options) {
        if (typeof attrs === "undefined") var attrs = {};

        this.set("accessPolicy", this.createAccessPolicy());

        const model = this;
        this.on("change:size", () => {
          const size = Utilities.bytesToSize(model.get("size"));
          model.set("sizeStr", size);
        });
        if (attrs.size) {
          const size = Utilities.bytesToSize(model.get("size"));
          model.set("sizeStr", size);
        }

        // Cache an array of original attribute names to help in handleChange()
        if (this.type == "DataONEObject")
          this.set("originalAttrs", Object.keys(this.attributes));
        else
          this.set(
            "originalAttrs",
            Object.keys(DataONEObject.prototype.defaults()),
          );

        this.on("successSaving", this.updateRelationships);

        // Save a reference to this DataONEObject model in the metadataEntity model
        // whenever the metadataEntity is set
        this.on("change:metadataEntity", function () {
          const entityMetadataModel = this.get("metadataEntity");

          if (entityMetadataModel)
            entityMetadataModel.set("dataONEObject", this);
        });

        this.on("sync", function () {
          this.set("synced", true);
        });

        // Find Member Node object that might be the authoritative MN
        // This is helpful when MetacatUI may be displaying content from multiple MNs
        this.setPossibleAuthMNs();
      },

      /**
       * Maps the lower-case sys meta node names (valid in HTML DOM) to the
       * camel-cased sys meta node names (valid in DataONE).
       * Used during parse() and serialize()
       */
      nodeNameMap() {
        return {
          accesspolicy: "accessPolicy",
          accessrule: "accessRule",
          authoritativemembernode: "authoritativeMemberNode",
          checksumalgorithm: "checksumAlgorithm",
          dateuploaded: "dateUploaded",
          datesysmetadatamodified: "dateSysMetadataModified",
          formatid: "formatId",
          filename: "fileName",
          nodereference: "nodeReference",
          numberreplicas: "numberReplicas",
          obsoletedby: "obsoletedBy",
          originmembernode: "originMemberNode",
          replicamembernode: "replicaMemberNode",
          replicationallowed: "replicationAllowed",
          replicationpolicy: "replicationPolicy",
          replicationstatus: "replicationStatus",
          replicaverified: "replicaVerified",
          rightsholder: "rightsHolder",
          serialversion: "serialVersion",
          seriesid: "seriesId",
        };
      },

      /**
       * Returns the URL string where this DataONEObject can be fetched from or saved to
       * @returns {string}
       */
      url() {
        // With no id, we can't do anything
        if (!this.get("id") && !this.get("seriesid")) return "";

        // Get the active alternative repository, if one is configured
        const activeAltRepo = MetacatUI.appModel.getActiveAltRepo();

        // Start the base URL string
        let baseUrl = "";

        // Determine if we're updating a new/existing object,
        // or just its system metadata
        // New uploads use the object service URL
        if (this.isNew()) {
          // Use the object service URL from the alt repo
          if (this.get("useAltRepo") && activeAltRepo) {
            baseUrl = activeAltRepo.objectServiceUrl;
          }
          // If this MetacatUI deployment is pointing to a MN, use the object service URL from the AppModel
          else {
            baseUrl = MetacatUI.appModel.get("objectServiceUrl");
          }

          // Return the full URL
          return baseUrl;
        }
        if (this.hasUpdates()) {
          if (this.get("hasContentChanges")) {
            // Use the object service URL from the alt repo
            if (this.get("useAltRepo") && activeAltRepo) {
              baseUrl = activeAltRepo.objectServiceUrl;
            } else {
              baseUrl = MetacatUI.appModel.get("objectServiceUrl");
            }

            // Exists on the server, use MN.update()
            return baseUrl + encodeURIComponent(this.get("oldPid"));
          }
          // Use the meta service URL from the alt repo
          if (this.get("useAltRepo") && activeAltRepo) {
            baseUrl = activeAltRepo.metaServiceUrl;
          } else {
            baseUrl = MetacatUI.appModel.get("metaServiceUrl");
          }

          // Exists on the server, use MN.updateSystemMetadata()
          return baseUrl + encodeURIComponent(this.get("id"));
        }
        // Use the meta service URL from the alt repo
        if (this.get("useAltRepo") && activeAltRepo) {
          baseUrl = activeAltRepo.metaServiceUrl;
        } else {
          baseUrl = MetacatUI.appModel.get("metaServiceUrl");
        }

        // Use MN.getSystemMetadata()
        return (
          baseUrl +
          (encodeURIComponent(this.get("id")) ||
            encodeURIComponent(this.get("seriesid")))
        );
      },

      /**
       * Create the URL string that is used to download this package
       * @returns PackageURL string for this DataONE Object
       * @since 2.28.0
       */
      getPackageURL() {
        let url = null;

        // With no id, we can't do anything
        if (!this.get("id") && !this.get("seriesid")) return url;

        // If we haven't set a packageServiceURL upon app initialization and we are querying a CN, then the packageServiceURL is dependent on the MN this package is from
        if (
          MetacatUI.appModel.get("d1Service").toLowerCase().indexOf("cn/") >
            -1 &&
          MetacatUI.nodeModel.get("members").length
        ) {
          const source = this.get("datasource");
          const node = _.find(MetacatUI.nodeModel.get("members"), {
            identifier: source,
          });

          // If this node has MNRead v2 services...
          if (node && node.readv2)
            url = `${
              node.baseURL
            }/v2/packages/application%2Fbagit-097/${encodeURIComponent(
              this.get("id"),
            )}`;
        } else if (MetacatUI.appModel.get("packageServiceUrl"))
          url =
            MetacatUI.appModel.get("packageServiceUrl") +
            encodeURIComponent(this.get("id"));

        return url;
      },

      /**
       * Overload Backbone.Model.fetch, so that we can set custom options for each fetch() request
       * @param options
       */
      fetch(options) {
        if (!options) var options = {};
        else var options = _.clone(options);

        options.url = this.url();

        // If we are using the Solr service to retrieve info about this object, then construct a query
        if (typeof options !== "undefined" && options.solrService) {
          // Get basic information
          let query = "";

          // Do not search for seriesId when it is not configured in this model/app
          if (typeof this.get("seriesid") === "undefined")
            query += `id:"${encodeURIComponent(this.get("id"))}"`;
          // If there is no seriesid set, then search for pid or sid
          else if (!this.get("seriesid"))
            query += `(id:"${encodeURIComponent(
              this.get("id"),
            )}" OR seriesId:"${encodeURIComponent(this.get("id"))}")`;
          // If a seriesId is specified, then search for that
          else if (this.get("seriesid") && this.get("id").length > 0)
            query += `(seriesId:"${encodeURIComponent(
              this.get("seriesid"),
            )}" AND id:"${encodeURIComponent(this.get("id"))}")`;
          // If only a seriesId is specified, then just search for the most recent version
          else if (this.get("seriesid") && !this.get("id"))
            query += `seriesId:"${encodeURIComponent(
              this.get("id"),
            )}" -obsoletedBy:*`;

          // The fields to return
          const fl = "formatId,formatType,documents,isDocumentedBy,id,seriesId";

          // Use the Solr query URL
          const solrOptions = {
            url: `${MetacatUI.appModel.get(
              "queryServiceUrl",
            )}q=${query}&fl=${fl}&wt=json`,
          };

          // Merge with the options passed to this function
          var fetchOptions = _.extend(options, solrOptions);
        } else if (typeof options !== "undefined") {
          // Use custom options for retreiving XML
          // Merge with the options passed to this function
          var fetchOptions = _.extend(
            {
              dataType: "text",
            },
            options,
          );
        } else {
          // Use custom options for retreiving XML
          var fetchOptions = _.extend({
            dataType: "text",
          });
        }

        // Add the authorization options
        fetchOptions = _.extend(
          fetchOptions,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        // Call Backbone.Model.fetch to retrieve the info
        return Backbone.Model.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * This function is called by Backbone.Model.fetch.
       * It deserializes the incoming XML from the /meta REST endpoint and converts it into JSON.
       * @param response
       */
      parse(response) {
        // If the response is XML
        if (typeof response === "string" && response.indexOf("<") == 0) {
          const responseDoc = $.parseHTML(response);
          let systemMetadata;

          // Save the raw XML in case it needs to be used later
          this.set("sysMetaXML", response);

          // Find the XML node for the system metadata
          for (let i = 0; i < responseDoc.length; i++) {
            if (
              responseDoc[i].nodeType == 1 &&
              responseDoc[i].localName.indexOf("systemmetadata") > -1
            ) {
              systemMetadata = responseDoc[i];
              break;
            }
          }

          // Parse the XML to JSON
          const sysMetaValues = this.toJson(systemMetadata);

          // Convert the JSON to a camel-cased version, which matches Solr and is easier to work with in code
          _.each(
            Object.keys(sysMetaValues),
            function (key) {
              const camelCasedKey = this.nodeNameMap()[key];
              if (camelCasedKey) {
                sysMetaValues[camelCasedKey] = sysMetaValues[key];
                delete sysMetaValues[key];
              }
            },
            this,
          );

          // Save the checksum from the system metadata in a separate attribute on the model
          sysMetaValues.originalChecksum = sysMetaValues.checksum;
          sysMetaValues.checksum = this.defaults().checksum;

          // Save the identifier as the id attribute
          sysMetaValues.id = sysMetaValues.identifier;

          // Parse the Access Policy
          if (
            this.get("accessPolicy") &&
            AccessPolicy.prototype.isPrototypeOf(this.get("accessPolicy"))
          ) {
            this.get("accessPolicy").parse(
              $(systemMetadata).find("accesspolicy"),
            );
            sysMetaValues.accessPolicy = this.get("accessPolicy");
          } else {
            // Create a new AccessPolicy collection, if there isn't one already.
            sysMetaValues.accessPolicy = this.createAccessPolicy(
              $(systemMetadata).find("accesspolicy"),
            );
          }

          return sysMetaValues;

          // If the response is a list of Solr docs
        }
        if (
          typeof response === "object" &&
          response.response &&
          response.response.docs
        ) {
          // If no objects were found in the index, mark as notFound and exit
          if (!response.response.docs.length) {
            this.set("notFound", true);
            this.trigger("notFound");
            return;
          }

          // Get the Solr document (there should be only one)
          const doc = response.response.docs[0];

          // Take out any empty values
          _.each(Object.keys(doc), (field) => {
            if (!doc[field] && doc[field] !== 0) delete doc[field];
          });

          // Remove any erroneous white space from fields
          this.removeWhiteSpaceFromSolrFields(doc);

          return doc;
        }
        // Default to returning the raw response
        return response;
      },

      /**
       * A utility function for converting XML to JSON
       * @param xml
       */
      toJson(xml) {
        // Create the return object
        let obj = {};

        // do children
        if (xml.hasChildNodes()) {
          for (let i = 0; i < xml.childNodes.length; i++) {
            const item = xml.childNodes.item(i);

            // If it's an empty text node, skip it
            if (item.nodeType == 3 && !item.nodeValue.trim()) continue;

            // Get the node name
            const nodeName = item.localName;

            // If it's a new container node, convert it to JSON and add as a new object attribute
            if (typeof obj[nodeName] === "undefined" && item.nodeType == 1) {
              obj[nodeName] = this.toJson(item);
            }
            // If it's a new text node, just store the text value and add as a new object attribute
            else if (
              typeof obj[nodeName] === "undefined" &&
              item.nodeType == 3
            ) {
              obj =
                item.nodeValue == "false"
                  ? false
                  : item.nodeValue == "true"
                    ? true
                    : item.nodeValue;
            }
            // If this node name is already stored as an object attribute...
            else if (typeof obj[nodeName] !== "undefined") {
              // Cache what we have now
              let old = obj[nodeName];
              if (!Array.isArray(old)) old = [old];

              // Create a new object to store this node info
              var newNode = {};

              // Add the new node info to the existing array we have now
              if (item.nodeType == 1) {
                newNode = this.toJson(item);
                var newArray = old.concat(newNode);
              } else if (item.nodeType == 3) {
                newNode = item.nodeValue;
                var newArray = old.concat(newNode);
              }

              // Store the attributes for this node
              _.each(item.attributes, (attr) => {
                newNode[attr.localName] = attr.nodeValue;
              });

              // Replace the old array with the updated one
              obj[nodeName] = newArray;

              // Exit
              continue;
            }

            // Store the attributes for this node
            /* _.each(item.attributes, function(attr){
                    obj[nodeName][attr.localName] = attr.nodeValue;
                  }); */
          }
        }
        return obj;
      },

      /**
          Serialize the DataONE object JSON to XML
          @param {object} json - the JSON object to convert to XML
          @param {Element} containerNode - an HTML element to insertt the resulting XML into
          @returns {Element} The updated HTML Element
       */
      toXML(json, containerNode) {
        if (typeof json === "string") {
          containerNode.textContent = json;
          return containerNode;
        }

        for (let i = 0; i < Object.keys(json).length; i++) {
          const key = Object.keys(json)[i];
          const contents = json[key] || json[key];

          let node = document.createElement(key);

          // Skip this attribute if it is not populated
          if (!contents || (Array.isArray(contents) && !contents.length))
            continue;

          // If it's a simple text node
          if (typeof contents === "string") {
            containerNode.textContent = contents;
            return containerNode;
          }
          if (Array.isArray(contents)) {
            const allNewNodes = [];

            for (let ii = 0; ii < contents.length; ii++) {
              allNewNodes.push(this.toXML(contents[ii], $(node).clone()[0]));
            }

            if (allNewNodes.length) node = allNewNodes;
          } else if (typeof contents === "object") {
            $(node).append(this.toXML(contents, node));
            const attributeNames = _.without(Object.keys(json[key]), "content");
          }

          $(containerNode).append(node);
        }

        return containerNode;
      },

      /**
       * Saves the DataONEObject System Metadata to the server
       * @param attributes
       * @param options
       */
      save(attributes, options) {
        // Set missing file names before saving
        if (!this.get("fileName")) {
          this.setMissingFileName();
        } else {
          // Replace all non-alphanumeric characters with underscores
          const fileNameWithoutExt = this.get("fileName").substring(
            0,
            this.get("fileName").lastIndexOf("."),
          );
          const extension = this.get("fileName").substring(
            this.get("fileName").lastIndexOf("."),
            this.get("fileName").length,
          );
          this.set(
            "fileName",
            fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_") + extension,
          );
        }

        if (!this.hasUpdates()) {
          this.set("uploadStatus", null);
          return;
        }

        // Set the upload transfer as in progress
        this.set("uploadProgress", 2);
        this.set("uploadStatus", "p");

        // Check if the checksum has been calculated yet.
        if (!this.get("checksum")) {
          // When it is calculated, restart this function
          this.on("checksumCalculated", this.save);
          // Calculate the checksum for this file
          this.calculateChecksum();
          // Exit this function until the checksum is done
          return;
        }

        // Create a FormData object to send data with our XHR
        const formData = new FormData();

        // If this is not a new object, update the id. New DataONEObjects will have an id
        // created during initialize.
        if (!this.isNew()) {
          this.updateID();
          formData.append("pid", this.get("oldPid"));
          formData.append("newPid", this.get("id"));
        } else {
          // Create an ID if there isn't one
          if (!this.get("id")) {
            this.set("id", `urn:uuid:${uuid.v4()}`);
          }

          // Add the identifier to the XHR data
          formData.append("pid", this.get("id"));
        }

        // Create the system metadata XML
        const sysMetaXML = this.serializeSysMeta();

        // Send the system metadata as a Blob
        const xmlBlob = new Blob([sysMetaXML], { type: "application/xml" });
        // Add the system metadata XML to the XHR data
        formData.append("sysmeta", xmlBlob, "sysmeta.xml");

        // Create the new object (MN.create())
        formData.append("object", this.get("uploadFile"), this.get("fileName"));

        const model = this;

        // On create(), add to the package and the metadata
        // Note: This should be added to the parent collection
        // but for now we are using the root collection
        _.each(
          this.get("collections"),
          function (collection) {
            if (collection.type == "DataPackage") {
              this.off("successSaving", collection.addNewModel);
              this.once("successSaving", collection.addNewModel, collection);
            }
          },
          this,
        );

        // Put together the AJAX and Backbone.save() options
        let requestSettings = {
          url: this.url(),
          cache: false,
          contentType: false,
          dataType: "text",
          processData: false,
          data: formData,
          parse: false,
          xhr() {
            const xhr = new window.XMLHttpRequest();

            // Upload progress
            xhr.upload.addEventListener(
              "progress",
              (evt) => {
                if (evt.lengthComputable) {
                  const percentComplete = (evt.loaded / evt.total) * 100;

                  model.set("uploadProgress", percentComplete);
                }
              },
              false,
            );

            return xhr;
          },
          success: this.onSuccessfulSave,
          error(model, response, xhr) {
            // Reset the identifier changes
            model.resetID();
            // Reset the checksum, if this is a model that needs to be serialized with each save.
            if (model.serialize) {
              model.set("checksum", model.defaults().checksum);
            }

            model.set("numSaveAttempts", model.get("numSaveAttempts") + 1);
            const numSaveAttempts = model.get("numSaveAttempts");

            if (
              numSaveAttempts < 3 &&
              (response.status == 408 || response.status == 0)
            ) {
              // Try saving again in 10, 40, and 90 seconds
              setTimeout(
                () => {
                  model.save.call(model);
                },
                numSaveAttempts * numSaveAttempts * 10000,
              );
            } else {
              model.set("numSaveAttempts", 0);

              let parsedResponse = $(response.responseText)
                .not("style, title")
                .text();

              // When there is no network connection (status == 0), there will be no response text
              if (!parsedResponse)
                parsedResponse =
                  "There was a network issue that prevented this file from uploading. " +
                  "Make sure you are connected to a reliable internet connection.";

              model.set("errorMessage", parsedResponse);

              // Set the model status as e for error
              model.set("uploadStatus", "e");

              // Trigger a custom event for the model save error
              model.trigger("errorSaving", parsedResponse);

              // Track this error in our analytics
              MetacatUI.analytics?.trackException(
                `DataONEObject save error: ${parsedResponse}`,
                model.get("id"),
                true,
              );
            }
          },
        };

        // Add the user settings
        requestSettings = _.extend(
          requestSettings,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        // Send the Save request
        Backbone.Model.prototype.save.call(this, null, requestSettings);
      },

      /**
       * This function is executed when the XHR that saves this DataONEObject has
       * successfully completed. It can be called directly if a DataONEObject is saved
       * without directly using the DataONEObject.save() function.
       * @param {DataONEObject} [model] A reference to this DataONEObject model
       * @param {XMLHttpRequest.response} [response] The XHR response object
       * @param {XMLHttpRequest} [xhr] The XHR that was just completed successfully
       */
      onSuccessfulSave(model, response, xhr) {
        if (typeof model === "undefined") {
          var model = this;
        }

        model.set("numSaveAttempts", 0);
        model.set("uploadStatus", "c");
        model.set("isNew", false);
        model.trigger("successSaving", model);

        // Get the newest sysmeta set by the MN
        model.fetch({
          merge: true,
          systemMetadataOnly: true,
        });

        // Reset the content changes status
        model.set("hasContentChanges", false);

        // Reset the model isNew attribute
        model.set("isNew", false);

        // Reset oldPid so we can replace again
        model.set("oldPid", null);

        // Set the last-calculated checksum as the original checksum
        model.set("originalChecksum", model.get("checksum"));
        model.set("checksum", model.defaults().checksum);
      },

      /**
       * Updates the DataONEObject System Metadata to the server
       */
      updateSysMeta() {
        // Update the upload status to "p" for "in progress"
        this.set("uploadStatus", "p");
        // Update the system metadata upload status to "p" as well, so the app
        // knows that the system metadata, specifically, is being updated.
        this.set("sysMetaUploadStatus", "p");

        const formData = new FormData();

        // Add the identifier to the XHR data
        formData.append("pid", this.get("id"));

        const sysMetaXML = this.serializeSysMeta();

        // Send the system metadata as a Blob
        const xmlBlob = new Blob([sysMetaXML], { type: "application/xml" });
        // Add the system metadata XML to the XHR data
        formData.append("sysmeta", xmlBlob, "sysmeta.xml");

        const model = this;

        let baseUrl = "";
        const activeAltRepo = MetacatUI.appModel.getActiveAltRepo();
        // Use the meta service URL from the alt repo
        if (activeAltRepo) {
          baseUrl = activeAltRepo.metaServiceUrl;
        }
        // If this MetacatUI deployment is pointing to a MN, use the meta service URL from the AppModel
        else {
          baseUrl = MetacatUI.appModel.get("metaServiceUrl");
        }

        let requestSettings = {
          url: baseUrl + encodeURIComponent(this.get("id")),
          cache: false,
          contentType: false,
          dataType: "text",
          type: "PUT",
          processData: false,
          data: formData,
          parse: false,
          success() {
            model.set("numSaveAttempts", 0);

            // Fetch the system metadata from the server so we have a fresh copy of the newest sys meta.
            model.fetch({ systemMetadataOnly: true });

            model.set("sysMetaErrorCode", null);

            // Update the upload status to "c" for "complete"
            model.set("uploadStatus", "c");
            model.set("sysMetaUploadStatus", "c");

            // Trigger a custom event that the sys meta was updated
            model.trigger("sysMetaUpdated");
          },
          error(xhr, status, statusCode) {
            model.set("numSaveAttempts", model.get("numSaveAttempts") + 1);
            const numSaveAttempts = model.get("numSaveAttempts");

            if (numSaveAttempts < 3 && (statusCode == 408 || statusCode == 0)) {
              // Try saving again in 10, 40, and 90 seconds
              setTimeout(
                () => {
                  model.updateSysMeta.call(model);
                },
                numSaveAttempts * numSaveAttempts * 10000,
              );
            } else {
              model.set("numSaveAttempts", 0);

              let parsedResponse = $(xhr.responseText)
                .not("style, title")
                .text();

              // When there is no network connection (status == 0), there will be no response text
              if (!parsedResponse)
                parsedResponse =
                  "There was a network issue that prevented this file from updating. " +
                  "Make sure you are connected to a reliable internet connection.";

              model.set("errorMessage", parsedResponse);

              model.set("sysMetaErrorCode", statusCode);

              model.set("uploadStatus", "e");
              model.set("sysMetaUploadStatus", "e");

              // Trigger a custom event for the sysmeta update that
              // errored
              model.trigger("sysMetaUpdateError");

              // Track this error in our analytics
              MetacatUI.analytics?.trackException(
                `DataONEObject update system metadata ` +
                  `error: ${parsedResponse}`,
                model.get("id"),
                true,
              );
            }
          },
        };

        // Add the user settings
        requestSettings = _.extend(
          requestSettings,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        // Send the XHR
        $.ajax(requestSettings);
      },

      /**
       * Check if the current user is authorized to perform an action on this object. This function doesn't return
       * the result of the check, but it sends an XHR, updates this model, and triggers a change event.
       * @param {string} [action] - The action (read, write, or changePermission) to check
       * if the current user has authorization to perform. By default checks for the highest level of permission.
       * @param {object} [options] Additional options for this function. See the properties below.
       * @property {Function} options.onSuccess - A function to execute when the checkAuthority API is successfully completed
       * @property {Function} options.onError - A function to execute when the checkAuthority API returns an error, or when no PID or SID can be found for this object.
       * @returns {boolean}
       */
      checkAuthority(action = "changePermission", options) {
        try {
          // return false - if neither PID nor SID is present to check the authority
          if (this.get("id") == null && this.get("seriesId") == null) {
            return false;
          }

          if (typeof options === "undefined") {
            var options = {};
          }

          // If onError or onSuccess options were provided by the user,
          // check that they are functions first, so we don't try to use
          // some other type of variable as a function later on.
          ["onError", "onSuccess"].forEach((userFunction) => {
            if (typeof options[userFunction] !== "function") {
              options[userFunction] = null;
            }
          });

          // If PID is not present - check authority with seriesId
          let identifier = this.get("id");
          if (identifier == null) {
            identifier = this.get("seriesId");
          }

          // If there are alt repositories configured, find the possible authoritative
          // Member Node for this DataONEObject.
          if (MetacatUI.appModel.get("alternateRepositories").length) {
            // Get the array of possible authoritative MNs
            const possibleAuthMNs = this.get("possibleAuthMNs");

            // If there are no possible authoritative MNs, use the auth service URL from the AppModel
            if (!possibleAuthMNs.length) {
              baseUrl = MetacatUI.appModel.get("authServiceUrl");
            } else {
              // Use the auth service URL from the top possible auth MN
              baseUrl = possibleAuthMNs[0].authServiceUrl;
            }
          } else {
            // Get the auth service URL from the AppModel
            baseUrl = MetacatUI.appModel.get("authServiceUrl");
          }

          if (!baseUrl) {
            return false;
          }

          const onSuccess =
            options.onSuccess ||
            function (data, textStatus, xhr) {
              model.set(`isAuthorized_${action}`, true);
              model.set("isAuthorized", true);
              model.trigger("change:isAuthorized");
            };
          const onError =
            options.onError ||
            function (xhr, textStatus, errorThrown) {
              if (errorThrown == 404) {
                const possibleAuthMNs = model.get("possibleAuthMNs");
                if (possibleAuthMNs.length) {
                  // Remove the first MN from the array, since it didn't contain the object, so it's not the auth MN
                  possibleAuthMNs.shift();
                }

                // If there are no other possible auth MNs to check, trigger this model as Not Found.
                if (possibleAuthMNs.length == 0 || !possibleAuthMNs) {
                  model.set("notFound", true);
                  model.trigger("notFound");
                }
                // If there's more MNs to check, try again
                else {
                  model.checkAuthority(action, options);
                }
              } else {
                model.set(`isAuthorized_${action}`, false);
                model.set("isAuthorized", false);
              }
            };

          var model = this;
          const requestSettings = {
            url: `${baseUrl + encodeURIComponent(identifier)}?action=${action}`,
            type: "GET",
            success: onSuccess,
            error: onError,
          };
          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
        } catch (e) {
          // Log an error to the console
          console.error("Couldn't check the authority for this user: ", e);

          // Track this error in our analytics
          const name = MetacatUI.appModel.get("username");
          MetacatUI.analytics?.trackException(
            `Couldn't check the authority for the user ${name}: ${e}`,
            this.get("id"),
            true,
          );

          // Set the user as unauthorized
          model.set(`isAuthorized_${action}`, false);
          model.set("isAuthorized", false);
          return false;
        }
      },

      /**
       * Using the attributes set on this DataONEObject model, serializes the system metadata XML
       * @returns {string}
       */
      serializeSysMeta() {
        // Get the system metadata XML that currently exists in the system
        const sysMetaXML = this.get("sysMetaXML"); // sysmeta as string
        let xml; // sysmeta as DOM object
        let accessPolicyXML; // The generated access policy XML
        let previousSiblingNode; // A DOM node indicating any previous sibling
        let rightsHolderNode; // A DOM node for the rights holder field
        let accessPolicyNode; // A DOM node for the access policy
        let replicationPolicyNode; // A DOM node for the replication policy
        let obsoletesNode; // A DOM node for the obsoletes field
        let obsoletedByNode; // A DOM node for the obsoletedBy field
        let fileNameNode; // A DOM node for the file name
        let xmlString; // The system metadata document as a string
        let nodeNameMap; // The map of camelCase to lowercase attributes
        let extension; // the file name extension for this object

        if (typeof sysMetaXML === "undefined" || sysMetaXML === null) {
          xml = this.createSysMeta();
        } else {
          xml = $($.parseHTML(sysMetaXML));
        }

        // Update the system metadata values
        xml.find("serialversion").text(this.get("serialVersion") || "0");
        xml.find("identifier").text(this.get("newPid") || this.get("id"));
        xml
          .find("submitter")
          .text(
            this.get("submitter") || MetacatUI.appUserModel.get("username"),
          );
        xml.find("formatid").text(this.get("formatId") || this.getFormatId());

        // If there is a seriesId, add it
        if (this.get("seriesId")) {
          // Get the seriesId XML node
          let seriesIdNode = xml.find("seriesId");

          // If it doesn't exist, create one
          if (!seriesIdNode.length) {
            seriesIdNode = $(document.createElement("seriesid"));
            xml.find("identifier").before(seriesIdNode);
          }

          // Add the seriesId string to the XML node
          seriesIdNode.text(this.get("seriesId"));
        }

        // If there is no size, get it
        if (!this.get("size") && this.get("uploadFile")) {
          this.set("size", this.get("uploadFile").size);
        }

        // Get the size of the file, if there is one
        if (this.get("uploadFile")) {
          xml.find("size").text(this.get("uploadFile").size);
        }
        // Otherwise, use the last known size
        else {
          xml.find("size").text(this.get("size"));
        }

        // Save the original checksum
        if (!this.get("checksum") && this.get("originalChecksum")) {
          xml.find("checksum").text(this.get("originalChecksum"));
        }
        // Update the checksum and checksum algorithm
        else {
          xml.find("checksum").text(this.get("checksum"));
          xml.find("checksum").attr("algorithm", this.get("checksumAlgorithm"));
        }

        // Update the rightsholder
        xml
          .find("rightsholder")
          .text(
            this.get("rightsHolder") || MetacatUI.appUserModel.get("username"),
          );

        // Write the access policy
        accessPolicyXML = this.get("accessPolicy").serialize();

        // Get the access policy node, if it exists
        accessPolicyNode = xml.find("accesspolicy");

        previousSiblingNode = xml.find("rightsholder");

        // Create an access policy node if needed
        if (!accessPolicyNode.length && accessPolicyXML) {
          accessPolicyNode = $(document.createElement("accesspolicy"));
          previousSiblingNode.after(accessPolicyNode);
        }

        // Replace the old access policy with the new one if it exists
        if (accessPolicyXML) {
          accessPolicyNode.replaceWith(accessPolicyXML);
        } else {
          // Remove the node if it is empty
          accessPolicyNode.remove();
        }

        // Set the obsoletes node after replPolicy or accessPolicy, or rightsHolder
        replicationPolicyNode = xml.find("replicationpolicy");
        accessPolicyNode = xml.find("accesspolicy");
        rightsHolderNode = xml.find("rightsholder");

        if (replicationPolicyNode.length) {
          previousSiblingNode = replicationPolicyNode;
        } else if (accessPolicyNode.length) {
          previousSiblingNode = accessPolicyNode;
        } else {
          previousSiblingNode = rightsHolderNode;
        }

        obsoletesNode = xml.find("obsoletes");

        if (this.get("obsoletes")) {
          if (obsoletesNode.length) {
            obsoletesNode.text(this.get("obsoletes"));
          } else {
            obsoletesNode = $(document.createElement("obsoletes")).text(
              this.get("obsoletes"),
            );
            previousSiblingNode.after(obsoletesNode);
          }
        } else if (obsoletesNode) {
          obsoletesNode.remove();
        }

        if (obsoletesNode) {
          previousSiblingNode = obsoletesNode;
        }

        obsoletedByNode = xml.find("obsoletedby");

        // remove the obsoletedBy node if it exists
        // TODO: Verify this is what we want to do
        if (obsoletedByNode) {
          obsoletedByNode.remove();
        }

        xml.find("archived").text(this.get("archived") || "false");
        xml
          .find("dateuploaded")
          .text(this.get("dateUploaded") || new Date().toISOString());

        // Get the filename node
        fileNameNode = xml.find("filename");

        // If the filename node doesn't exist, then create one
        if (!fileNameNode.length) {
          fileNameNode = $(document.createElement("filename"));
          xml.find("dateuploaded").after(fileNameNode);
        }

        // Set the object file name
        $(fileNameNode).text(this.get("fileName"));

        xmlString = $(document.createElement("div")).append(xml.clone()).html();

        // Now camel case the nodes
        nodeNameMap = this.nodeNameMap();

        _.each(
          Object.keys(nodeNameMap),
          (name, i) => {
            const originalXMLString = xmlString;

            // Camel case node names
            var regEx = new RegExp(`<${name}`, "g");
            xmlString = xmlString.replace(regEx, `<${nodeNameMap[name]}`);
            var regEx = new RegExp(`${name}>`, "g");
            xmlString = xmlString.replace(regEx, `${nodeNameMap[name]}>`);

            // If node names haven't been changed, then find an attribute
            if (xmlString == originalXMLString) {
              var regEx = new RegExp(` ${name}=`, "g");
              xmlString = xmlString.replace(regEx, ` ${nodeNameMap[name]}=`);
            }
          },
          this,
        );

        xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");

        return xmlString;
      },

      /**
       * Get the object format identifier for this object
       */
      getFormatId() {
        let formatId = "application/octet-stream"; // default to untyped data
        const objectFormats = {
          mediaTypes: [], // The list of potential formatIds based on mediaType matches
          extensions: [], // The list of possible formatIds based onextension matches
        };
        const fileName = this.get("fileName"); // the fileName for this object
        let ext; // The extension of the filename for this object

        objectFormats.mediaTypes = MetacatUI.objectFormats.where({
          formatId: this.get("mediaType"),
        });
        if (
          typeof fileName !== "undefined" &&
          fileName !== null &&
          fileName.length > 1
        ) {
          ext = fileName.substring(
            fileName.lastIndexOf(".") + 1,
            fileName.length,
          );
          objectFormats.extensions = MetacatUI.objectFormats.where({
            extension: ext,
          });
        }

        if (
          objectFormats.mediaTypes.length > 0 &&
          objectFormats.extensions.length > 0
        ) {
          const firstMediaType = objectFormats.mediaTypes[0].get("formatId");
          const firstExtension = objectFormats.extensions[0].get("formatId");
          // Check if they're equal
          if (firstMediaType === firstExtension) {
            formatId = firstMediaType;
            return formatId;
          }
          // Handle mismatched mediaType and extension cases - additional cases can be added below
          if (
            firstMediaType === "application/vnd.ms-excel" &&
            firstExtension === "text/csv"
          ) {
            formatId = firstExtension;
            return formatId;
          }
        }

        if (objectFormats.mediaTypes.length > 0) {
          formatId = objectFormats.mediaTypes[0].get("formatId");
          console.log("returning default mediaType");
          console.log(formatId);
          return formatId;
        }

        if (objectFormats.extensions.length > 0) {
          // If this is a "nc" file, assume it is a netCDF-3 file.
          if (ext == "nc") {
            formatId = "netCDF-3";
          } else {
            formatId = objectFormats.extensions[0].get("formatId");
          }
          return formatId;
        }

        return formatId;
      },

      /**
       * Looks up human readable format of the DataONE Object
       * @returns format String
       * @since 2.28.0
       */
      getFormat() {
        const formatMap = {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            "Microsoft Excel OpenXML",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            "Microsoft Word OpenXML",
          "application/vnd.ms-excel.sheet.binary.macroEnabled.12":
            "Microsoft Office Excel 2007 binary workbooks",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            "Microsoft Office OpenXML Presentation",
          "application/vnd.ms-excel": "Microsoft Excel",
          "application/msword": "Microsoft Word",
          "application/vnd.ms-powerpoint": "Microsoft Powerpoint",
          "text/html": "HTML",
          "text/plain": "plain text (.txt)",
          "video/avi": "Microsoft AVI file",
          "video/x-ms-wmv": "Windows Media Video (.wmv)",
          "audio/x-ms-wma": "Windows Media Audio (.wma)",
          "application/vnd.google-earth.kml xml":
            "Google Earth Keyhole Markup Language (KML)",
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html":
            "annotation",
          "application/mathematica": "Mathematica Notebook",
          "application/postscript": "Postscript",
          "application/rtf": "Rich Text Format (RTF)",
          "application/xml": "XML Application",
          "text/xml": "XML",
          "application/x-fasta": "FASTA sequence file",
          "nexus/1997": "NEXUS File Format for Systematic Information",
          "anvl/erc-v02":
            "Kernel Metadata and Electronic Resource Citations (ERCs), 2010.05.13",
          "http://purl.org/dryad/terms/":
            "Dryad Metadata Application Profile Version 3.0",
          "http://datadryad.org/profile/v3.1":
            "Dryad Metadata Application Profile Version 3.1",
          "application/pdf": "PDF",
          "application/zip": "ZIP file",
          "http://www.w3.org/TR/rdf-syntax-grammar": "RDF/XML",
          "http://www.w3.org/TR/rdfa-syntax": "RDFa",
          "application/rdf xml": "RDF",
          "text/turtle": "TURTLE",
          "text/n3": "N3",
          "application/x-gzip": "GZIP Format",
          "application/x-python": "Python script",
          "http://www.w3.org/2005/Atom": "ATOM-1.0",
          "application/octet-stream": "octet stream (application file)",
          "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd":
            "Darwin Core, v2.0",
          "http://rs.tdwg.org/dwc/xsd/simpledarwincore/": "Simple Darwin Core",
          "eml://ecoinformatics.org/eml-2.1.0": "EML v2.1.0",
          "eml://ecoinformatics.org/eml-2.1.1": "EML v2.1.1",
          "eml://ecoinformatics.org/eml-2.0.1": "EML v2.0.1",
          "eml://ecoinformatics.org/eml-2.0.0": "EML v2.0.0",
          "https://eml.ecoinformatics.org/eml-2.2.0": "EML v2.2.0",
        };

        return formatMap[this.get("formatId")] || this.get("formatId");
      },

      /**
       * Build a fresh system metadata document for this object when it is new
       * Return it as a DOM object
       */
      createSysMeta() {
        let sysmetaDOM; // The DOM
        const sysmetaXML = []; // The document as a string array

        sysmetaXML.push(
          // '<?xml version="1.0" encoding="UTF-8"?>',
          "<d1_v2.0:systemmetadata",
          '    xmlns:d1_v2.0="http://ns.dataone.org/service/types/v2.0"',
          '    xmlns:d1="http://ns.dataone.org/service/types/v1">',
          "    <serialversion />",
          "    <identifier />",
          "    <formatid />",
          "    <size />",
          "    <checksum />",
          "    <submitter />",
          "    <rightsholder />",
          "    <filename />",
          "</d1_v2.0:systemmetadata>",
        );

        sysmetaDOM = $($.parseHTML(sysmetaXML.join("")));
        return sysmetaDOM;
      },

      /**
       * Create an access policy for this DataONEObject using the default access
       * policy set in the AppModel.
       * @param {Element} [accessPolicyXML] - An <accessPolicy> XML node
       *   that contains a list of access rules.
       * @returns {AccessPolicy} - an AccessPolicy collection that represents the
       *   given XML or the default policy set in the AppModel.
       */
      createAccessPolicy(accessPolicyXML) {
        // Create a new AccessPolicy collection
        const accessPolicy = new AccessPolicy();

        accessPolicy.dataONEObject = this;

        // If there is no access policy XML sent,
        if (this.isNew() && !accessPolicyXML) {
          try {
            // If the app is configured to inherit the access policy from the parent metadata,
            // then get the parent metadata and copy it's AccessPolicy
            const scienceMetadata = this.get("isDocumentedByModels");
            if (
              MetacatUI.appModel.get("inheritAccessPolicy") &&
              scienceMetadata &&
              scienceMetadata.length
            ) {
              const sciMetaAccessPolicy =
                scienceMetadata[0].get("accessPolicy");

              if (sciMetaAccessPolicy) {
                accessPolicy.copyAccessPolicy(sciMetaAccessPolicy);
              } else {
                accessPolicy.createDefaultPolicy();
              }
            }
            // Otherwise, set the default access policy using the AppModel configuration
            else {
              accessPolicy.createDefaultPolicy();
            }
          } catch (e) {
            console.error(
              "Could create access policy, so defaulting to default",
              e,
            );
            accessPolicy.createDefaultPolicy();
          }
        } else {
          // Parse the access policy XML to create AccessRule models from the XML
          accessPolicy.parse(accessPolicyXML);
        }

        // Listen to changes on the collection and trigger a change on this model
        const self = this;
        this.listenTo(accessPolicy, "change update", function () {
          self.trigger("change");
          this.addToUploadQueue();
        });

        return accessPolicy;
      },

      /**
       * Update identifiers for this object
       * @param {string} id - Optional identifier to update with. Generated
       * automatically when not given.
       *
       * Note that this method caches the objects attributes prior to
       * updating so this.resetID() can be called in case of a failure
       * state.
       *
       * Also note that this method won't run if theh oldPid attribute is
       * set. This enables knowing before this.save is called what the next
       * PID will be such as the case where we want to update a matching
       * EML entity when replacing files.
       */
      updateID(id) {
        // Only run once until oldPid is reset
        if (this.get("oldPid")) {
          return;
        }

        // Save the attributes so we can reset the ID later
        this.attributeCache = this.toJSON();

        // Set the old identifier
        const oldPid = this.get("id");
        let selfDocuments;
        let selfDocumentedBy;
        let documentedModels;
        let documentedModel;
        let index;

        // Save the current id as the old pid
        this.set("oldPid", oldPid);

        // Create a new seriesId, if there isn't one, and if this model specifies that one is required
        if (!this.get("seriesId") && this.get("createSeriesId")) {
          this.set("seriesId", `urn:uuid:${uuid.v4()}`);
        }

        // Check to see if the old pid documents or is documented by itself
        selfDocuments = _.contains(this.get("documents"), oldPid);
        selfDocumentedBy = _.contains(this.get("isDocumentedBy"), oldPid);

        // Set the new identifier
        if (id) {
          this.set("id", id);
        } else if (this.get("type") == "DataPackage") {
          this.set("id", `resource_map_urn:uuid:${uuid.v4()}`);
        } else {
          this.set("id", `urn:uuid:${uuid.v4()}`);
        }

        // Remove the old pid from the documents list if present
        if (selfDocuments) {
          index = this.get("documents").indexOf(oldPid);
          if (index > -1) {
            this.get("documents").splice(index, 1);
          }
          // And add the new pid in
          this.get("documents").push(this.get("id"));
        }

        // Remove the old pid from the isDocumentedBy list if present
        if (selfDocumentedBy) {
          index = this.get("isDocumentedBy").indexOf(oldPid);
          if (index > -1) {
            this.get("isDocumentedBy").splice(index, 1);
          }
          // And add the new pid in
          this.get("isDocumentedBy").push(this.get("id"));
        }

        // Update all models documented by this pid with the new id
        _.each(
          this.get("documents"),
          function (id) {
            (documentedModels = MetacatUI.rootDataPackage.where({ id })),
              documentedModel;

            if (documentedModels.length > 0) {
              documentedModel = documentedModels[0];
            }
            if (typeof documentedModel !== "undefined") {
              // Find the oldPid in the array
              if (Array.isArray(documentedModel.get("isDocumentedBy"))) {
                index = documentedModel.get("isDocumentedBy").indexOf("oldPid");

                if (index > -1) {
                  // Remove it
                  documentedModel.get("isDocumentedBy").splice(index, 1);
                }
                // And add the new pid in
                documentedModel.get("isDocumentedBy").push(this.get("id"));
              }
            }
          },
          this,
        );

        this.trigger("change:id");

        // Update the obsoletes and obsoletedBy
        this.set("obsoletes", oldPid);
        this.set("obsoletedBy", null);

        // Update the latest version of this object
        this.set("latestVersion", this.get("id"));

        // Set the archived option to false
        this.set("archived", false);
      },

      /**
       * Resets the identifier for this model. This undos all of the changes made in {DataONEObject#updateID}
       */
      resetID() {
        if (!this.attributeCache) return false;

        this.set("oldPid", this.attributeCache.oldPid, { silent: true });
        this.set("id", this.attributeCache.id, { silent: true });
        this.set("obsoletes", this.attributeCache.obsoletes, { silent: true });
        this.set("obsoletedBy", this.attributeCache.obsoletedBy, {
          silent: true,
        });
        this.set("archived", this.attributeCache.archived, { silent: true });
        this.set("latestVersion", this.attributeCache.latestVersion, {
          silent: true,
        });

        // Reset the attribute cache
        this.attributeCache = {};
      },

      /**
       * Checks if this system metadata XML has updates that need to be synced with the server.
       * @returns {boolean}
       */
      hasUpdates() {
        if (this.isNew()) return true;

        // Compare the new system metadata XML to the old system metadata XML

        // Check if there is system metadata first
        if (!this.get("sysMetaXML")) {
          return false;
        }

        const D1ObjectClone = this.clone();
        // Make sure we are using the parse function in the DataONEObject model.
        // Sometimes hasUpdates is called from extensions of the D1Object model,
        // (e.g. from the portal model), and the parse function is overwritten
        const oldSysMetaAttrs = new DataONEObject().parse(
          D1ObjectClone.get("sysMetaXML"),
        );

        D1ObjectClone.set(oldSysMetaAttrs);

        const oldSysMeta = D1ObjectClone.serializeSysMeta();
        const newSysMeta = this.serializeSysMeta();

        if (oldSysMeta === "") return false;

        return !(newSysMeta == oldSysMeta);
      },

      /**
             Set the changed flag on any system metadata or content attribute changes,
             and set the hasContentChanges flag on content changes only
             @param {DataONEObject} [model]
             @param {object} options Furhter options for this function
             @property {boolean} options.force If true, a change will be handled regardless if the attribute actually changed
       */
      handleChange(model, options) {
        if (!model) var model = this;

        const sysMetaAttrs = [
          "serialVersion",
          "identifier",
          "formatId",
          "formatType",
          "size",
          "checksum",
          "checksumAlgorithm",
          "submitter",
          "rightsHolder",
          "accessPolicy",
          "replicationAllowed",
          "replicationPolicy",
          "obsoletes",
          "obsoletedBy",
          "archived",
          "dateUploaded",
          "dateSysMetadataModified",
          "originMemberNode",
          "authoritativeMemberNode",
          "replica",
          "seriesId",
          "mediaType",
          "fileName",
        ];
        const nonSysMetaNonContentAttrs = _.difference(
          model.get("originalAttrs"),
          sysMetaAttrs,
        );
        const allChangedAttrs = Object.keys(model.changedAttributes());
        let changedSysMetaOrContentAttrs = []; // sysmeta or content attributes that have changed
        let changedContentAttrs = []; // attributes from sub classes like ScienceMetadata or EML211 ...

        // Get a list of all changed sysmeta and content attributes
        changedSysMetaOrContentAttrs = _.difference(
          allChangedAttrs,
          nonSysMetaNonContentAttrs,
        );
        if (changedSysMetaOrContentAttrs.length > 0) {
          // For any sysmeta or content change, set the package dirty flag
          if (
            MetacatUI.rootDataPackage &&
            MetacatUI.rootDataPackage.packageModel &&
            !MetacatUI.rootDataPackage.packageModel.get("changed") &&
            model.get("synced")
          ) {
            MetacatUI.rootDataPackage.packageModel.set("changed", true);
          }
        }

        // And get a list of all changed content attributes
        changedContentAttrs = _.difference(
          changedSysMetaOrContentAttrs,
          sysMetaAttrs,
        );

        if (
          (changedContentAttrs.length > 0 &&
            !this.get("hasContentChanges") &&
            model.get("synced")) ||
          (options && options.force)
        ) {
          this.set("hasContentChanges", true);
          this.addToUploadQueue();
        }
      },

      /**
       * Returns true if this DataONE object is new. A DataONE object is new
       * if there is no upload date and it's been synced (i.e. been fetched)
       * @returns {boolean}
       */
      isNew() {
        // If the model is explicitly marked as not new, return false
        if (this.get("isNew") === false) {
          return false;
        }
        // If the model is explicitly marked as new, return true
        if (this.get("isNew") === true) {
          return true;
        }

        // Check if there is an upload date that was retrieved from the server
        return (
          this.get("dateUploaded") === this.defaults().dateUploaded &&
          this.get("synced")
        );
      },

      /**
       * Updates the upload status attribute on this model and marks the collection as changed
       */
      addToUploadQueue() {
        if (!this.get("synced")) {
          return;
        }

        // Add this item to the queue
        if (
          this.get("uploadStatus") == "c" ||
          this.get("uploadStatus") == "e" ||
          !this.get("uploadStatus")
        ) {
          this.set("uploadStatus", "q");

          // Mark each DataPackage collection this model is in as changed
          _.each(
            this.get("collections"),
            (collection) => {
              if (collection.packageModel)
                collection.packageModel.set("changed", true);
            },
            this,
          );
        }
      },

      /**
       * Updates the progress percentage when the model is getting uploaded
       * @param {ProgressEvent} e - The ProgressEvent when this file is being uploaded
       */
      updateProgress(e) {
        if (e.lengthComputable) {
          const max = e.total;
          const current = e.loaded;

          const Percentage = (current * 100) / max;

          if (Percentage >= 100) {
            // process completed
          }
        }
      },

      /**
       * Updates the relationships with other models when this model has been updated
       */
      updateRelationships() {
        _.each(
          this.get("collections"),
          function (collection) {
            // Get the old id for this model
            const oldId = this.get("oldPid");

            if (!oldId) return;

            // Find references to the old id in the documents relationship
            const outdatedModels = collection.filter((m) =>
              _.contains(m.get("documents"), oldId),
            );

            // Update the documents array in each model
            _.each(
              outdatedModels,
              function (model) {
                const updatedDocuments = _.without(
                  model.get("documents"),
                  oldId,
                );
                updatedDocuments.push(this.get("id"));

                model.set("documents", updatedDocuments);
              },
              this,
            );
          },
          this,
        );
      },

      /**
       * Finds the latest version of this object by travesing the obsolescence chain
       * @param {string} [latestVersion] - The identifier of the latest known object in the version chain.
             If not supplied, this model's `id` will be used.
       * @param {string} [possiblyNewer] - The identifier of the object that obsoletes the latestVersion. It's "possibly" newer, because it may be private/inaccessible
       */
      findLatestVersion(latestVersion, possiblyNewer) {
        let baseUrl = "";
        const activeAltRepo = MetacatUI.appModel.getActiveAltRepo();
        // Use the meta service URL from the alt repo
        if (activeAltRepo) {
          baseUrl = activeAltRepo.metaServiceUrl;
        }
        // If this MetacatUI deployment is pointing to a MN, use the meta service URL from the AppModel
        else {
          baseUrl = MetacatUI.appModel.get("metaServiceUrl");
        }

        if (!baseUrl) {
          return;
        }

        // If there is no system metadata, then retrieve it first
        if (!this.get("sysMetaXML")) {
          this.once("sync", this.findLatestVersion);
          this.once("systemMetadataSync", this.findLatestVersion);
          this.fetch({
            url: baseUrl + encodeURIComponent(this.get("id")),
            dataType: "text",
            systemMetadataOnly: true,
          });
          return;
        }

        // If no pid was supplied, use this model's id
        if (!latestVersion || typeof latestVersion !== "string") {
          var latestVersion = this.get("id");
          var possiblyNewer = this.get("obsoletedBy");
        }

        // If this isn't obsoleted by anything, then there is no newer version
        if (!possiblyNewer || typeof latestVersion !== "string") {
          this.set("latestVersion", latestVersion);

          // Trigger an event that will fire whether or not the latestVersion
          // attribute was actually changed
          this.trigger("latestVersionFound", this);

          // Remove the listeners now that we found the latest version
          this.stopListening("sync", this.findLatestVersion);
          this.stopListening("systemMetadataSync", this.findLatestVersion);

          return;
        }

        const model = this;

        // Get the system metadata for the possibly newer version
        const requestSettings = {
          url: baseUrl + encodeURIComponent(possiblyNewer),
          type: "GET",
          success(data) {
            // the response may have an obsoletedBy element
            const obsoletedBy = $(data).find("obsoletedBy").text();

            // If there is an even newer version, then get it and rerun this function
            if (obsoletedBy) {
              model.findLatestVersion(possiblyNewer, obsoletedBy);
            }
            // If there isn't a newer version, then this is it
            else {
              model.set("latestVersion", possiblyNewer);
              model.trigger("latestVersionFound", model);

              // Remove the listeners now that we found the latest version
              model.stopListening("sync", model.findLatestVersion);
              model.stopListening(
                "systemMetadataSync",
                model.findLatestVersion,
              );
            }
          },
          error(xhr) {
            // If this newer version isn't accessible, link to the latest version that is
            if (xhr.status == "401") {
              model.set("latestVersion", latestVersion);
              model.trigger("latestVersionFound", model);
            }
          },
        };

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * A utility function that will format an XML string or XML nodes by camel-casing the node names, as necessary
       * @param {string|Element} xml - The XML to format
       * @returns {string} The formatted XML string
       */
      formatXML(xml) {
        const nodeNameMap = this.nodeNameMap();
        let xmlString = "";

        // XML must be provided for this function
        if (!xml) return "";
        // Support XML strings
        if (typeof xml === "string") xmlString = xml;
        // Support DOMs
        else if (typeof xml === "object" && xml.nodeType) {
          // XML comments should be formatted with start and end carets
          if (xml.nodeType == 8) xmlString = `<${xml.nodeValue}>`;
          // XML nodes have the entire XML string available in the outerHTML attribute
          else if (xml.nodeType == 1) xmlString = xml.outerHTML;
          // Text node types are left as-is
          else if (xml.nodeType == 3) return xml.nodeValue;
        }

        // Return empty strings if something went wrong
        if (!xmlString) return "";

        _.each(
          Object.keys(nodeNameMap),
          (name, i) => {
            const originalXMLString = xmlString;

            // Check for this node name whe it's an opening XML node, e.g. `<name>`
            let regEx = new RegExp(`<${name}>`, "g");
            xmlString = xmlString.replace(regEx, `<${nodeNameMap[name]}>`);

            // Check for this node name when it's an opening XML node, e.g. `<name `
            regEx = new RegExp(`<${name} `, "g");
            xmlString = xmlString.replace(regEx, `<${nodeNameMap[name]} `);

            // Check for this node name when it's preceeded by a namespace, e.g. `:name `
            regEx = new RegExp(`:${name} `, "g");
            xmlString = xmlString.replace(regEx, `:${nodeNameMap[name]} `);

            // Check for this node name when it's a closing tag preceeded by a namespace, e.g. `:name>`
            regEx = new RegExp(`:${name}>`, "g");
            xmlString = xmlString.replace(regEx, `:${nodeNameMap[name]}>`);

            // Check for this node name when it's a closing XML tag, e.g. `</name>`
            regEx = new RegExp(`</${name}>`, "g");
            xmlString = xmlString.replace(regEx, `</${nodeNameMap[name]}>`);

            // If node names haven't been changed, then find an attribute, e.g. ` name=`
            if (xmlString == originalXMLString) {
              regEx = new RegExp(` ${name}=`, "g");
              xmlString = xmlString.replace(regEx, ` ${nodeNameMap[name]}=`);
            }
          },
          this,
        );

        // Take each XML node text value and decode any XML entities
        const regEx = new RegExp("&[0-9a-zA-Z]+;", "g");
        xmlString = xmlString.replace(regEx, (match) =>
          he.encode(he.decode(match)),
        );

        return xmlString;
      },

      /**
       * This method will download this object while
       * sending the user's auth token in the request.
       * @returns None
       * @since: 2.28.0
       */
      downloadWithCredentials() {
        // if(this.get("isPublic")) return;

        // Get info about this object
        const url = this.get("url");
        const model = this;

        // Create an XHR
        const xhr = new XMLHttpRequest();

        // Open and send the request with the user's auth token
        xhr.open("GET", url);

        // if (MetacatUI.appUserModel.get("loggedIn")) xhr.withCredentials = true;

        // When the XHR is ready, create a link with the raw data (Blob) and click the link to download
        xhr.onload = function () {
          if (this.status == 404) {
            this.onerror.call(this);
            return;
          }

          // Get the file name to save this file as
          let filename = xhr.getResponseHeader("Content-Disposition");

          if (!filename) {
            filename =
              model.get("fileName") ||
              model.get("title") ||
              model.get("id") ||
              "download";
          } else
            filename = filename
              .substring(filename.indexOf("filename=") + 9)
              .replace(/"/g, "");

          // Replace any whitespaces
          filename = filename.trim().replace(/ /g, "_");

          // For IE, we need to use the navigator API
          if (navigator && navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(xhr.response, filename);
          }
          // Other browsers can download it via a link
          else {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(xhr.response); // xhr.response is a blob

            // Set the file name.
            a.download = filename;

            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            a.remove();
          }

          model.trigger("downloadComplete");

          // Track this event
          MetacatUI.analytics?.trackEvent(
            "download",
            "Download DataONEObject",
            model.get("id"),
          );
        };

        xhr.onerror = function (e) {
          model.trigger("downloadError");

          // Track the error
          MetacatUI.analytics?.trackException(
            `Download DataONEObject error: ${e || ""}`,
            model.get("id"),
            true,
          );
        };

        xhr.onprogress = function (e) {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            model.set("downloadPercent", percent);
          }
        };

        xhr.responseType = "blob";

        if (MetacatUI.appUserModel.get("loggedIn"))
          xhr.setRequestHeader(
            "Authorization",
            `Bearer ${MetacatUI.appUserModel.get("token")}`,
          );

        xhr.send();
      },

      /**
       * Creates a file name for this DataONEObject and updates the `fileName` attribute
       */
      setMissingFileName() {
        let objectFormats;
        let filename;
        let extension;

        objectFormats = MetacatUI.objectFormats.where({
          formatId: this.get("formatId"),
        });
        if (objectFormats.length > 0) {
          extension = objectFormats[0].get("extension");
        }

        // Science metadata file names will use the title
        if (this.get("type") == "Metadata") {
          filename =
            Array.isArray(this.get("title")) && this.get("title").length
              ? this.get("title")[0]
              : this.get("id");
        }
        // Resource maps will use a "resource_map_" prefix
        else if (this.get("type") == "DataPackage") {
          filename = `resource_map_${this.get("id")}`;
          extension = ".rdf.xml";
        }
        // All other object types will just use the id
        else {
          filename = this.get("id");
        }

        // Replace all non-alphanumeric characters with underscores
        filename = filename.replace(/[^a-zA-Z0-9]/g, "_");

        if (typeof extension !== "undefined") {
          filename = `${filename}.${extension}`;
        }

        this.set("fileName", filename);
      },

      /**
       * Creates a URL for viewing more information about this object
       * @returns {string}
       */
      createViewURL() {
        return `${MetacatUI.root}/view/${encodeURIComponent(
          this.get("seriesId") || this.get("id"),
        )}`;
      },

      /**
       * Check if the seriesID or PID matches a DOI regex, and if so, return
       * a canonical IRI for the DOI.
       * @returns {string|null} - The canonical IRI for the DOI, or null if
       * neither the seriesId nor the PID match a DOI regex.
       * @since 2.26.0
       */
      getCanonicalDOIIRI() {
        const id = this.get("id");
        const seriesId = this.get("seriesId");
        let DOI = null;
        if (this.isDOI(seriesId)) DOI = seriesId;
        else if (this.isDOI(id)) DOI = id;
        return MetacatUI.appModel.DOItoURL(DOI);
      },

      /**
       * Converts the identifier string to a string safe to use in an XML id attribute
       * @param {string} [id] - The ID string
       * @returns {string} - The XML-safe string
       */
      getXMLSafeID(id) {
        if (typeof id === "undefined") {
          var id = this.get("id");
        }

        // Replace XML id attribute invalid characters and patterns in the identifier
        id = id
          .replace(/</g, "-")
          .replace(/:/g, "-")
          .replace(/&[a-zA-Z0-9]+;/g);

        return id;
      },

      /** ** Provenance-related functions */
      /**
       * Returns true if this provenance field points to a source of this data or metadata object
       * @param {string} field
       * @returns {boolean}
       */
      isSourceField(field) {
        if (typeof field === "undefined" || !field) return false;
        // Is the field we are checking a prov field?
        if (!_.contains(MetacatUI.appSearchModel.getProvFields(), field))
          return false;

        if (
          field == "prov_generatedByExecution" ||
          field == "prov_generatedByProgram" ||
          field == "prov_used" ||
          field == "prov_wasDerivedFrom" ||
          field == "prov_wasInformedBy"
        )
          return true;
        return false;
      },

      /**
       * Returns true if this provenance field points to a derivation of this data or metadata object
       * @param {string} field
       * @returns {boolean}
       */
      isDerivationField(field) {
        if (typeof field === "undefined" || !field) return false;
        if (!_.contains(MetacatUI.appSearchModel.getProvFields(), field))
          return false;

        if (
          field == "prov_usedByExecution" ||
          field == "prov_usedByProgram" ||
          field == "prov_hasDerivations" ||
          field == "prov_generated"
        )
          return true;
        return false;
      },

      /**
       * Returns a plain-english version of the general format - either image, program, metadata, PDF, annotation or data
       */
      getType() {
        // The list of formatIds that are images

        // The list of formatIds that are images
        const pdfIds = ["application/pdf"];
        const annotationIds = [
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html",
        ];

        // Type has already been set, use that.
        if (this.get("type").toLowerCase() == "metadata") return "metadata";

        // Determine the type via provONE
        const instanceOfClass = this.get("prov_instanceOfClass");
        if (
          typeof instanceOfClass !== "undefined" &&
          Array.isArray(instanceOfClass) &&
          instanceOfClass.length
        ) {
          const programClass = _.filter(
            instanceOfClass,
            (className) => className.indexOf("#Program") > -1,
          );
          if (typeof programClass !== "undefined" && programClass.length)
            return "program";
        } else if (
          this.get("prov_generated").length ||
          this.get("prov_used").length
        )
          return "program";

        // Determine the type via file format
        if (this.isSoftware()) return "program";
        if (this.isData()) return "data";

        if (this.get("type").toLowerCase() == "metadata") return "metadata";
        if (this.isImage()) return "image";
        if (_.contains(pdfIds, this.get("formatId"))) return "PDF";
        if (_.contains(annotationIds, this.get("formatId")))
          return "annotation";
        return "data";
      },

      /**
       * Checks the formatId of this model and determines if it is an image.
       * @returns {boolean} true if this data object is an image, false if it is other
       */
      isImage() {
        // The list of formatIds that are images
        const imageIds = ["image/gif", "image/jp2", "image/jpeg", "image/png"];

        // Does this data object match one of these IDs?
        if (_.indexOf(imageIds, this.get("formatId")) == -1) return false;
        return true;
      },

      /**
       * Checks the formatId of this model and determines if it is a data file.
       * This determination is mostly used for display and the provenance editor. In the
       * DataONE API, many formatIds are considered `DATA` formatTypes, but they are categorized
       * as images {@link DataONEObject#isImage} or software {@link DataONEObject#isSoftware}.
       * @returns {boolean} true if this data object is a data file, false if it is other
       */
      isData() {
        const dataIds = [
          "application/atom+xml",
          "application/mathematica",
          "application/msword",
          "application/netcdf",
          "application/octet-stream",
          "application/pdf",
          "application/postscript",
          "application/rdf+xml",
          "application/rtf",
          "application/vnd.google-earth.kml+xml",
          "application/vnd.ms-excel",
          "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/x-bzip2",
          "application/x-fasta",
          "application/x-gzip",
          "application/x-rar-compressed",
          "application/x-tar",
          "application/xhtml+xml",
          "application/xml",
          "application/zip",
          "audio/mpeg",
          "audio/x-ms-wma",
          "audio/x-wav",
          "image/svg xml",
          "image/svg+xml",
          "image/bmp",
          "image/tiff",
          "text/anvl",
          "text/csv",
          "text/html",
          "text/n3",
          "text/plain",
          "text/tab-separated-values",
          "text/turtle",
          "text/xml",
          "video/avi",
          "video/mp4",
          "video/mpeg",
          "video/quicktime",
          "video/x-ms-wmv",
        ];

        // Does this data object match one of these IDs?
        if (_.indexOf(dataIds, this.get("formatId")) == -1) return false;
        return true;
      },

      /**
       * Checks the formatId of this model and determines if it is a software file.
       * This determination is mostly used for display and the provenance editor. In the
       * DataONE API, many formatIds are considered `DATA` formatTypes, but they are categorized
       * as images {@link DataONEObject#isImage} for display purposes.
       * @returns {boolean} true if this data object is a software file, false if it is other
       */
      isSoftware() {
        // The list of formatIds that are programs
        const softwareIds = [
          "text/x-python",
          "text/x-rsrc",
          "text/x-matlab",
          "text/x-sas",
          "application/R",
          "application/x-ipynb+json",
        ];
        // Does this data object match one of these IDs?
        if (_.indexOf(softwareIds, this.get("formatId")) == -1) return false;
        return true;
      },

      /**
       * Checks the formatId of this model and determines if it a PDF.
       * @returns {boolean} true if this data object is a pdf, false if it is other
       */
      isPDF() {
        // The list of formatIds that are images
        const ids = ["application/pdf"];

        // Does this data object match one of these IDs?
        if (_.indexOf(ids, this.get("formatId")) == -1) return false;
        return true;
      },

      /**
       * Set the DataONE ProvONE provenance class
       * param className - the shortened form of the actual classname value. The
       * shortname will be appened to the ProvONE namespace, for example,
       * the className "program" will result in the final class name
       * "http://purl.dataone.org/provone/2015/01/15/ontology#Program"
       * see https://github.com/DataONEorg/sem-prov-ontologies/blob/master/provenance/ProvONE/v1/provone.html
       * @param {string} className
       */
      setProvClass(className) {
        className = className.toLowerCase();
        className = className.charAt(0).toUpperCase() + className.slice(1);

        /* This function is intended to be used for the ProvONE classes that are
         * typically represented in DataONEObjects: "Data", "Program", and hopefully
         * someday "Execution", as we don't allow the user to set the namespace
         * e.g. to "PROV", so therefor we check for the currently known ProvONE classes.
         */
        if (
          _.contains(
            [
              "Program",
              "Data",
              "Visualization",
              "Document",
              "Execution",
              "User",
            ],
            className,
          )
        ) {
          this.set("prov_instanceOfClass", [this.PROVONE + className]);
        } else if (
          _.contains(
            ["Entity", "Usage", "Generation", "Association"],
            className,
          )
        ) {
          this.set("prov_instanceOfClass", [this.PROV + className]);
        } else {
          message = `The given class name: ${className} is not in the known ProvONE or PROV classes.`;
          throw new Error(message);
        }
      },

      /**
       *  Calculate a checksum for the object
       *  @param {string} [algorithm]  The algorithm to use, defaults to MD5
       *  @returns {string} A checksum plain JS object with value and algorithm attributes
       */
      calculateChecksum(algorithm) {
        var algorithm = algorithm || "MD5";
        const checksum = { algorithm: undefined, value: undefined };
        let hash; // The checksum hash
        let file; // The file to be read by slicing
        let reader; // The FileReader used to read each slice
        let offset = 0; // Byte offset for reading slices
        const sliceSize = 2 ** 20; // 1MB slices
        const model = this;

        // Do we have a file?
        if (this.get("uploadFile") instanceof Blob) {
          file = this.get("uploadFile");
          reader = new FileReader();
          /* Handle load errors */
          reader.onerror = function (event) {
            console.log(`Error reading: ${event}`);
          };
          /* Show progress */
          reader.onprogress = function (event) {};
          /* Handle load finish */
          reader.onloadend = function (event) {
            if (event.target.readyState == FileReader.DONE) {
              hash.update(event.target.result);
            }
            offset += sliceSize;
            if (_seek()) {
              model.set("checksum", hash.hex());
              model.set("checksumAlgorithm", checksum.algorithm);
              model.trigger("checksumCalculated", model.attributes);
            }
          };
        } else {
          message = "The given object is not a blob or a file object.";
          throw new Error(message);
        }

        switch (algorithm) {
          case "MD5":
            checksum.algorithm = algorithm;
            hash = md5.create();
            _seek();
            break;
          case "SHA-1":
          // TODO: Support SHA-1
          // break;
          default:
            message = `The given algorithm: ${algorithm} is not supported.`;
            throw new Error(message);
        }

        /*
         *  A helper function internal to calculateChecksum() used to slice
         *  the file at the next offset by slice size
         */
        /**
         *
         */
        function _seek() {
          let calculated = false;
          let slice;
          // Digest the checksum when we're done calculating
          if (offset >= file.size) {
            hash.digest();
            calculated = true;
            return calculated;
          }
          // slice the file and read the slice
          slice = file.slice(offset, offset + sliceSize);
          reader.readAsArrayBuffer(slice);
          return calculated;
        }
      },

      /**
       * Checks if the pid or sid or given string is a DOI
       * @param {string} customString - Optional. An identifier string to check instead of the id and seriesId attributes on the model
       * @returns {boolean} True if it is a DOI
       */
      isDOI(customString) {
        return (
          isDOI(customString) ||
          isDOI(this.get("id")) ||
          isDOI(this.get("seriesId"))
        );
      },

      /**
       * Creates an array of objects that represent Member Nodes that could possibly be this
       * object's authoritative MN. This function updates the `possibleAuthMNs` attribute on this model.
       */
      setPossibleAuthMNs() {
        // Only do this for Coordinating Node MetacatUIs.
        if (MetacatUI.appModel.get("alternateRepositories").length) {
          // Set the possibleAuthMNs attribute
          const possibleAuthMNs = [];

          // If a datasource is already found for this Portal, move that to the top of the list of auth MNs
          const datasource = this.get("datasource") || "";
          if (datasource) {
            // Find the MN object that matches the datasource node ID
            const datasourceMN = _.findWhere(
              MetacatUI.appModel.get("alternateRepositories"),
              { identifier: datasource },
            );
            if (datasourceMN) {
              // Clone the MN object and add it to the array
              const clonedDatasourceMN = { ...datasourceMN };
              possibleAuthMNs.push(clonedDatasourceMN);
            }
          }

          // If there is an active alternate repo, move that to the top of the list of auth MNs
          const activeAltRepo =
            MetacatUI.appModel.get("activeAlternateRepositoryId") || "";
          if (activeAltRepo) {
            const activeAltRepoMN = _.findWhere(
              MetacatUI.appModel.get("alternateRepositories"),
              { identifier: activeAltRepo },
            );
            if (activeAltRepoMN) {
              // Clone the MN object and add it to the array
              const clonedActiveAltRepoMN = { ...activeAltRepoMN };
              possibleAuthMNs.push(clonedActiveAltRepoMN);
            }
          }

          // Add all the other alternate repositories to the list of auth MNs
          const otherPossibleAuthMNs = _.reject(
            MetacatUI.appModel.get("alternateRepositories"),
            (mn) =>
              mn.identifier == datasource || mn.identifier == activeAltRepo,
          );
          // Clone each MN object and add to the array
          _.each(otherPossibleAuthMNs, (mn) => {
            const clonedMN = { ...mn };
            possibleAuthMNs.push(clonedMN);
          });

          // Update this model
          this.set("possibleAuthMNs", possibleAuthMNs);
        }
      },

      /**
       * Removes white space from string values returned by Solr when the white space causes issues.
       * For now this only effects the `resourceMap` field, which will index new line characters and spaces
       * when the RDF XML has those in the `identifier` XML element content. This was causing bugs where DataONEObject
       * models were created with `id`s with new line and white space characters (e.g. `\n urn:uuid:1234...`)
       * @param {object} json - The Solr document as a JS Object, which will be directly altered
       */
      removeWhiteSpaceFromSolrFields(json) {
        if (typeof json.resourceMap === "string") {
          json.resourceMap = json.resourceMap.trim();
        } else if (Array.isArray(json.resourceMap)) {
          const newResourceMapIds = [];
          _.each(json.resourceMap, (rMapId) => {
            if (typeof rMapId === "string") {
              newResourceMapIds.push(rMapId.trim());
            }
          });
          json.resourceMap = newResourceMapIds;
        }
      },
    },

    /** @lends DataONEObject.prototype */
    {
      /**
       * Generate a unique identifier to be used as an XML id attribute
       * @returns {string} The identifier string that was generated
       */
      generateId() {
        let idStr = ""; // the id to return
        const length = 30; // the length of the generated string
        const chars =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".split(
            "",
          );

        for (let i = 0; i < length; i++) {
          idStr += chars[Math.floor(Math.random() * chars.length)];
        }
        return idStr;
      },
    },
  );

  return DataONEObject;
});
