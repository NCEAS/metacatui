define(["jquery", "underscore", "backbone"], ($, _, Backbone) => {
  /**
   * @class SolrResult
   * @classdesc A single result from the Solr search service
   * @classcategory Models
   * @extends Backbone.Model
   */
  const SolrResult = Backbone.Model.extend(
    /** @lends SolrResult.prototype */ {
      // This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
      defaults: {
        abstract: null,
        entityName: null,
        indexed: true,
        archived: false,
        origin: "",
        keywords: "",
        title: "",
        pubDate: "",
        eastBoundCoord: "",
        westBoundCoord: "",
        northBoundCoord: "",
        southBoundCoord: "",
        attributeName: "",
        beginDate: "",
        endDate: "",
        pubDate: "",
        id: "",
        seriesId: null,
        resourceMap: null,
        downloads: null,
        citations: 0,
        selected: false,
        formatId: null,
        formatType: null,
        fileName: null,
        datasource: null,
        rightsHolder: null,
        size: 0,
        type: "",
        url: null,
        obsoletedBy: null,
        geohash_9: null,
        read_count_i: 0,
        reads: 0,
        isDocumentedBy: null,
        isPublic: null,
        isService: false,
        serviceDescription: null,
        serviceTitle: null,
        serviceEndpoint: null,
        serviceOutput: null,
        notFound: false,
        newestVersion: null,
        //@type {string} - The system metadata XML as a string
        systemMetadata: null,
        provSources: [],
        provDerivations: [],
        //Provenance index fields
        prov_generated: null,
        prov_generatedByDataONEDN: null,
        prov_generatedByExecution: null,
        prov_generatedByFoafName: null,
        prov_generatedByOrcid: null,
        prov_generatedByProgram: null,
        prov_generatedByUser: null,
        prov_hasDerivations: null,
        prov_hasSources: null,
        prov_instanceOfClass: null,
        prov_used: null,
        prov_usedByDataONEDN: null,
        prov_usedByExecution: null,
        prov_usedByFoafName: null,
        prov_usedByOrcid: null,
        prov_usedByProgram: null,
        prov_usedByUser: null,
        prov_wasDerivedFrom: null,
        prov_wasExecutedByExecution: null,
        prov_wasExecutedByUser: null,
        prov_wasGeneratedBy: null,
        prov_wasInformedBy: null,
      },

      initialize: function () {
        this.setURL();
        this.on("change:id", this.setURL);

        this.set("type", this.getType());
        this.on("change:read_count_i", function () {
          this.set("reads", this.get("read_count_i"));
        });
      },

      type: "SolrResult",

      // Toggle the `selected` state of the result
      toggle: function () {
        this.selected = !this.get("selected");
      },

      /**
       * Returns a plain-english version of the general format - either image, program, metadata, PDF, annotation or data
       * @return {string}
       */
      getType: function () {
        //The list of formatIds that are images
        var imageIds = [
          "image/gif",
          "image/jp2",
          "image/jpeg",
          "image/png",
          "image/svg xml",
          "image/svg+xml",
          "image/bmp",
        ];
        //The list of formatIds that are images
        var pdfIds = ["application/pdf"];
        var annotationIds = [
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html",
        ];
        var collectionIds = [
          "https://purl.dataone.org/collections-1.0.0",
          "https://purl.dataone.org/collections-1.1.0",
        ];
        var portalIds = [
          "https://purl.dataone.org/portals-1.0.0",
          "https://purl.dataone.org/portals-1.1.0",
        ];

        //Determine the type via provONE
        var instanceOfClass = this.get("prov_instanceOfClass");
        if (typeof instanceOfClass !== "undefined") {
          var programClass = _.filter(instanceOfClass, function (className) {
            return className.indexOf("#Program") > -1;
          });
          if (typeof programClass !== "undefined" && programClass.length)
            return "program";
        } else {
          if (this.get("prov_generated") || this.get("prov_used"))
            return "program";
        }

        //Determine the type via file format
        if (_.contains(collectionIds, this.get("formatId")))
          return "collection";
        if (_.contains(portalIds, this.get("formatId"))) return "portal";
        if (this.get("formatType") == "METADATA") return "metadata";
        if (_.contains(imageIds, this.get("formatId"))) return "image";
        if (_.contains(pdfIds, this.get("formatId"))) return "PDF";
        if (_.contains(annotationIds, this.get("formatId")))
          return "annotation";
        else return "data";
      },

      //Returns a plain-english version of the specific format ID (for selected ids)
      getFormat: function () {
        var formatMap = {
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

      setURL: function () {
        if (MetacatUI.appModel.get("objectServiceUrl"))
          this.set(
            "url",
            MetacatUI.appModel.get("objectServiceUrl") +
              encodeURIComponent(this.get("id")),
          );
        else if (MetacatUI.appModel.get("resolveServiceUrl"))
          this.set(
            "url",
            MetacatUI.appModel.get("resolveServiceUrl") +
              encodeURIComponent(this.get("id")),
          );
      },

      /**
       * Checks if the pid or sid or given string is a DOI
       *
       * @param {string} customString - Optional. An identifier string to check instead of the id and seriesId attributes on the model
       * @returns {boolean} True if it is a DOI
       */
      isDOI: function (customString) {
        return (
          MetacatUI.appModel.isDOI(customString) ||
          MetacatUI.appModel.isDOI(this.get("id")) ||
          MetacatUI.appModel.isDOI(this.get("seriesId"))
        );
      },

      /*
       * Checks if the currently-logged-in user is authorized to change
       * permissions (or other action if set as parameter) on this doc
       * @param {string} [action=changePermission] - The action (read, write, or changePermission) to check
       * if the current user has authorization to perform. By default checks for the highest level of permission.
       */
      checkAuthority: function (action = "changePermission") {
        var authServiceUrl = MetacatUI.appModel.get("authServiceUrl");
        if (!authServiceUrl) return false;

        var model = this;

        var requestSettings = {
          url:
            authServiceUrl +
            encodeURIComponent(this.get("id")) +
            "?action=" +
            action,
          type: "GET",
          success: function (data, textStatus, xhr) {
            model.set("isAuthorized_" + action, true);
            model.set("isAuthorized", true);
            model.trigger("change:isAuthorized");
          },
          error: function (xhr, textStatus, errorThrown) {
            model.set("isAuthorized_" + action, false);
            model.set("isAuthorized", false);
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
       * Download this object while sending the user's auth token in the
       * request.
       * @returns {Promise} A promise that resolves to the response object
       * @since 0.0.0
       */
      async downloadWithCredentials() {
        // Call the new getBlob method and handle the response
        return this.fetchDataObjectWithCredentials()
          .then((response) => this.downloadFromResponse(response))
          .catch((error) => this.handleDownloadError(error));
      },

      /**
       * This method will fetch this object while sending the user's auth token
       * in the request. The data can then be downloaded or displayed in the
       * browser
       * @returns {Promise} A promise that resolves when the data is fetched
       * @since 0.0.0
       */
      fetchDataObjectWithCredentials() {
        const url = this.get("url");
        const token = MetacatUI.appUserModel.get("token") || "";
        const method = "GET";

        return new Promise((resolve, reject) => {
          const headers = {};
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          fetch(url, { method, headers })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
              }
              resolve(response);
            })
            .catch((error) => {
              reject(error);
            });
        });
      },

      /**
       * Get the filename from the response headers or default to the model's
       * title, id, or "download"
       * @param {Response} response - The response object from the fetch request
       * @returns {string} The filename to save the file as
       * @since 0.0.0
       */
      getFileNameFromResponse(response) {
        const model = this;
        let filename = response.headers.get("Content-Disposition");

        if (!filename) {
          filename =
            model.get("fileName") ||
            model.get("title") ||
            model.get("id") ||
            "download";
        } else {
          filename = filename
            .substring(filename.indexOf("filename=") + 9)
            .replace(/"/g, "");
        }
        filename = filename.trim().replace(/ /g, "_");
        return filename;
      },

      /**
       * Download data onto the user's computer from the response object
       * @param {Response} response - The response object from the fetch request
       * @returns {Response} The response object
       * @since 0.0.0
       */
      async downloadFromResponse(response) {
        const model = this;
        const blob = await response.blob();
        const filename = this.getFileNameFromResponse(response);

        // For IE, we need to use the navigator API
        if (navigator && navigator.msSaveOrOpenBlob) {
          navigator.msSaveOrOpenBlob(blob, filename);
        } else {
          // Other browsers can download it via a link
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = filename;
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }

        // Track this event
        model.trigger("downloadComplete");
        MetacatUI.analytics?.trackEvent(
          "download",
          "Download DataONEObject",
          model.get("id"),
        );

        return response;
      },

      /**
       * Handle an error that occurs when downloading the object
       * @param {Error} e - The error that occurred
       * @since 0.0.0
       */
      handleDownloadError(e) {
        const model = this;
        model.trigger("downloadError");
        // Track the error
        MetacatUI.analytics?.trackException(
          `Download DataONEObject error: ${e || ""}`,
          model.get("id"),
          true,
        );
      },

      getInfo: function (fields) {
        var model = this;

        if (!fields)
          var fields =
            "abstract,id,seriesId,fileName,resourceMap,formatType,formatId,obsoletedBy,isDocumentedBy,documents,title,origin,keywords,attributeName,pubDate,eastBoundCoord,westBoundCoord,northBoundCoord,southBoundCoord,beginDate,endDate,dateUploaded,archived,datasource,replicaMN,isAuthorized,isPublic,size,read_count_i,isService,serviceTitle,serviceEndpoint,serviceOutput,serviceDescription,serviceType,project,dateModified";

        var escapeSpecialChar = MetacatUI.appSearchModel.escapeSpecialChar;

        var query = "q=";

        //If there is no seriesId set, then search for pid or sid
        if (!this.get("seriesId"))
          query +=
            '(id:"' +
            escapeSpecialChar(encodeURIComponent(this.get("id"))) +
            '" OR seriesId:"' +
            escapeSpecialChar(encodeURIComponent(this.get("id"))) +
            '")';
        //If a seriesId is specified, then search for that
        else if (this.get("seriesId") && this.get("id").length > 0)
          query +=
            '(seriesId:"' +
            escapeSpecialChar(encodeURIComponent(this.get("seriesId"))) +
            '" AND id:"' +
            escapeSpecialChar(encodeURIComponent(this.get("id"))) +
            '")';
        //If only a seriesId is specified, then just search for the most recent version
        else if (this.get("seriesId") && !this.get("id"))
          query +=
            'seriesId:"' +
            escapeSpecialChar(encodeURIComponent(this.get("id"))) +
            '" -obsoletedBy:*';

        query +=
          "&fl=" +
          fields + //Specify the fields to return
          "&wt=json&rows=1000" + //Get the results in JSON format and get 1000 rows
          "&archived=archived:*"; //Get archived or unarchived content

        var requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          type: "GET",
          success: function (data, response, xhr) {
            //If the Solr response was not as expected, trigger and error and exit
            if (!data || typeof data.response == "undefined") {
              model.set("indexed", false);
              model.trigger("getInfoError");
              return;
            }

            var docs = data.response.docs;

            if (docs.length == 1) {
              docs[0].resourceMap = model.parseResourceMapField(docs[0]);
              model.set(docs[0]);
              model.trigger("sync");
            }
            //If we searched by seriesId, then let's find the most recent version in the series
            else if (docs.length > 1) {
              //Filter out docs that are obsoleted
              var mostRecent = _.reject(docs, function (doc) {
                return typeof doc.obsoletedBy !== "undefined";
              });

              //If there is only one doc that is not obsoleted (the most recent), then
              // set this doc's values on this model
              if (mostRecent.length == 1) {
                mostRecent[0].resourceMap = model.parseResourceMapField(
                  mostRecent[0],
                );
                model.set(mostRecent[0]);
                model.trigger("sync");
              } else {
                //If there are multiple docs without an obsoletedBy statement, then
                // retreive the head of the series via the system metadata
                var sysMetaRequestSettings = {
                  url:
                    MetacatUI.appModel.get("metaServiceUrl") +
                    encodeURIComponent(docs[0].seriesId),
                  type: "GET",
                  success: function (sysMetaData) {
                    //Get the identifier node from the system metadata
                    var seriesHeadID = $(sysMetaData).find("identifier").text();
                    //Get the doc from the Solr results with that identifier
                    var seriesHead = _.findWhere(docs, { id: seriesHeadID });

                    //If there is a doc in the Solr results list that matches the series head id
                    if (seriesHead) {
                      seriesHead.resourceMap =
                        model.parseResourceMapField(seriesHead);
                      //Set those values on this model
                      model.set(seriesHead);
                    }
                    //Otherwise, just fall back on the first doc in the list
                    else if (mostRecent.length) {
                      mostRecent[0].resourceMap = model.parseResourceMapField(
                        mostRecent[0],
                      );
                      model.set(mostRecent[0]);
                    } else {
                      docs[0].resourceMap = model.parseResourceMapField(
                        docs[0],
                      );
                      model.set(docs[0]);
                    }

                    model.trigger("sync");
                  },
                  error: function (xhr, textStatus, errorThrown) {
                    // Fall back on the first doc in the list
                    if (mostRecent.length) {
                      model.set(mostRecent[0]);
                    } else {
                      model.set(docs[0]);
                    }

                    model.trigger("sync");
                  },
                };

                $.ajax(
                  _.extend(
                    sysMetaRequestSettings,
                    MetacatUI.appUserModel.createAjaxSettings(),
                  ),
                );
              }
            } else {
              model.set("indexed", false);
              //Try getting the system metadata as a backup
              model.getSysMeta();
            }
          },
          error: function (xhr, textStatus, errorThrown) {
            model.set("indexed", false);
            model.trigger("getInfoError");
          },
        };

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      getCitationInfo: function () {
        this.getInfo(
          "id,seriesId,origin,pubDate,dateUploaded,title,datasource,project",
        );
      },

      /*
       * Get the system metadata for this object
       */
      getSysMeta: function () {
        var url =
            MetacatUI.appModel.get("metaServiceUrl") +
            encodeURIComponent(this.get("id")),
          model = this;

        var requestSettings = {
          url: url,
          type: "GET",
          dataType: "text",
          success: function (data, response, xhr) {
            if (data && data.length) {
              model.set("systemMetadata", data);
            }

            //Check if this is archvied
            var archived = $(data).find("archived").text() == "true";
            model.set("archived", archived);

            //Get the file size
            model.set("size", $(data).find("size").text() || "");

            //Get the entity name
            model.set("fileName", $(data).find("filename").text() || "");

            //Check if this is a metadata doc
            var formatId = $(data).find("formatid").text() || "",
              formatType;
            model.set("formatId", formatId);
            if (
              formatId.indexOf("ecoinformatics.org") > -1 ||
              formatId.indexOf("FGDC") > -1 ||
              formatId.indexOf("INCITS") > -1 ||
              formatId.indexOf("namespaces/netcdf") > -1 ||
              formatId.indexOf("waterML") > -1 ||
              formatId.indexOf("darwin") > -1 ||
              formatId.indexOf("dryad") > -1 ||
              formatId.indexOf("http://www.loc.gov/METS") > -1 ||
              formatId.indexOf("ddi:codebook:2_5") > -1 ||
              formatId.indexOf("http://www.icpsr.umich.edu/DDI") > -1 ||
              formatId.indexOf(
                "http://purl.org/ornl/schema/mercury/terms/v1.0",
              ) > -1 ||
              formatId.indexOf("datacite") > -1 ||
              formatId.indexOf("isotc211") > -1 ||
              formatId.indexOf("metadata") > -1
            )
              model.set("formatType", "METADATA");

            //Trigger the sync event so the app knows we found the model info
            model.trigger("sync");
          },
          error: function (response) {
            //When the user is unauthorized to access this object, trigger a 401 error
            if (response.status == 401) {
              model.set("notFound", true);
              model.trigger("401");
            }
            //When the object doesn't exist, trigger a 404 error
            else if (response.status == 404) {
              model.set("notFound", true);
              model.trigger("404");
            }
            //Other error codes trigger a generic error
            else {
              model.trigger("error");
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

      //Transgresses the obsolence chain until it finds the newest version that this user is authorized to read
      findLatestVersion: function (newestVersion, possiblyNewer) {
        // Make sure we have the /meta service configured
        if (!MetacatUI.appModel.get("metaServiceUrl")) return;

        //If no pid was supplied, use this model's id
        if (!newestVersion) {
          var newestVersion = this.get("id");
          var possiblyNewer = this.get("obsoletedBy");
        }

        //If this isn't obsoleted by anything, then there is no newer version
        if (!possiblyNewer) {
          this.set("newestVersion", newestVersion);
          return;
        }

        var model = this;

        //Get the system metadata for the possibly newer version
        var requestSettings = {
          url:
            MetacatUI.appModel.get("metaServiceUrl") +
            encodeURIComponent(possiblyNewer),
          type: "GET",
          success: function (data) {
            // the response may have an obsoletedBy element
            var obsoletedBy = $(data).find("obsoletedBy").text();

            //If there is an even newer version, then get it and rerun this function
            if (obsoletedBy)
              model.findLatestVersion(possiblyNewer, obsoletedBy);
            //If there isn't a newer version, then this is it
            else model.set("newestVersion", possiblyNewer);
          },
          error: function (xhr) {
            //If this newer version isn't found or accessible, then save the last
            // accessible id as the newest version
            if (
              xhr.status == 401 ||
              xhr.status == 404 ||
              xhr.status == "401" ||
              xhr.status == "404"
            ) {
              model.set("newestVersion", newestVersion);
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

      /**** Provenance-related functions ****/
      /*
       * Returns true if this provenance field points to a source of this data or metadata object
       */
      isSourceField: function (field) {
        if (typeof field == "undefined" || !field) return false;
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
        else return false;
      },

      /*
       * Returns true if this provenance field points to a derivation of this data or metadata object
       */
      isDerivationField: function (field) {
        if (typeof field == "undefined" || !field) return false;
        if (!_.contains(MetacatUI.appSearchModel.getProvFields(), field))
          return false;

        if (
          field == "prov_usedByExecution" ||
          field == "prov_usedByProgram" ||
          field == "prov_hasDerivations" ||
          field == "prov_generated"
        )
          return true;
        else return false;
      },

      /*
       * Returns true if this SolrResult has a provenance trace (i.e. has either sources or derivations)
       */
      hasProvTrace: function () {
        if (this.get("formatType") == "METADATA") {
          if (this.get("prov_hasSources") || this.get("prov_hasDerivations"))
            return true;
        }

        var fieldNames = MetacatUI.appSearchModel.getProvFields(),
          currentField = "";

        for (var i = 0; i < fieldNames.length; i++) {
          currentField = fieldNames[i];
          if (this.has(currentField)) return true;
        }

        return false;
      },

      /*
       * Returns an array of all the IDs of objects that are sources of this object
       */
      getSources: function () {
        var sources = new Array(),
          model = this,
          //Get the prov fields but leave out references to executions which are not used in the UI yet
          fields = _.reject(
            MetacatUI.appSearchModel.getProvFields(),
            function (f) {
              return f.indexOf("xecution") > -1;
            },
          ); //Leave out the first e in execution so we don't have to worry about case sensitivity

        _.each(fields, function (provField, i) {
          if (model.isSourceField(provField) && model.has(provField))
            sources.push(model.get(provField));
        });

        return _.uniq(_.flatten(sources));
      },

      /*
       * Returns an array of all the IDs of objects that are derivations of this object
       */
      getDerivations: function () {
        var derivations = new Array(),
          model = this,
          //Get the prov fields but leave out references to executions which are not used in the UI yet
          fields = _.reject(
            MetacatUI.appSearchModel.getProvFields(),
            function (f) {
              return f.indexOf("xecution") > -1;
            },
          ); //Leave out the first e in execution so we don't have to worry about case sensitivity

        _.each(fields, function (provField, i) {
          if (model.isDerivationField(provField) && model.has(provField))
            derivations.push(model.get(provField));
        });

        return _.uniq(_.flatten(derivations));
      },

      getInputs: function () {
        return this.get("prov_used");
      },

      getOutputs: function () {
        return this.get("prov_generated");
      },

      /*
       * Uses the app configuration to check if this model's metrics should be hidden in the display
       *
       * @return {boolean}
       */
      hideMetrics: function () {
        //If the AppModel is configured with cases of where to hide metrics,
        if (
          typeof MetacatUI.appModel.get("hideMetricsWhen") == "object" &&
          MetacatUI.appModel.get("hideMetricsWhen")
        ) {
          //Check for at least one match
          return _.some(
            MetacatUI.appModel.get("hideMetricsWhen"),
            function (value, modelProperty) {
              //Get the value of this property from this model
              var modelValue = this.get(modelProperty);

              //Check for the presence of this model's value in the AppModel value
              if (Array.isArray(value) && typeof modelValue == "string") {
                return _.contains(value, modelValue);
              }
              //Check for the presence of the AppModel's value in this model's value
              else if (typeof value == "string" && Array.isArray(modelValue)) {
                return _.contains(modelValue, value);
              }
              //Check for overlap of two arrays
              else if (Array.isArray(value) && Array.isArray(modelValue)) {
                return _.intersection(value, modelValue).length > 0;
              }
              //If the AppModel value is a function, execute it
              else if (typeof value == "function") {
                return value(modelValue);
              }
              //Otherwise, just check for equality
              else {
                return value === modelValue;
              }
            },
            this,
          );
        } else {
          return false;
        }
      },

      /**
       * Creates a URL for viewing more information about this metadata
       * @return {string}
       */
      createViewURL: function () {
        return this.getType() == "portal" || this.getType() == "collection"
          ? MetacatUI.root +
              "/" +
              MetacatUI.appModel.get("portalTermPlural") +
              "/" +
              encodeURIComponent(
                this.get("label") || this.get("seriesId") || this.get("id"),
              )
          : MetacatUI.root +
              "/view/" +
              encodeURIComponent(this.get("seriesId") || this.get("id"));
      },

      parseResourceMapField: function (json) {
        if (typeof json.resourceMap == "string") {
          return json.resourceMap.trim();
        } else if (Array.isArray(json.resourceMap)) {
          let newResourceMapIds = [];
          _.each(json.resourceMap, function (rMapId) {
            if (typeof rMapId == "string") {
              newResourceMapIds.push(rMapId.trim());
            }
          });
          return newResourceMapIds;
        }

        //If nothing works so far, return an empty array
        return [];
      },
    },
  );
  return SolrResult;
});
