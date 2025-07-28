define(["jquery", "underscore", "backbone"], ($, _, Backbone) => {
  /**
   * @class SolrResult
   * @classdesc A single result from the Solr search service
   * @classcategory Models
   * @augments Backbone.Model
   */
  const SolrResult = Backbone.Model.extend(
    /** @lends SolrResult.prototype */ {
      /**
       * @property {object} defaults - The default attributes for this model
       * This model contains all of the attributes found in the SOLR 'docs'
       * field inside of the SOLR response element
       */
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
        // @type {string} - The system metadata XML as a string
        systemMetadata: null,
        provSources: [],
        provDerivations: [],
        // Provenance index fields
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

      /** @inheritdoc */
      initialize() {
        this.setURL();
        this.on("change:id", this.setURL);

        this.set("type", this.getType());
        this.on("change:read_count_i", function setReads() {
          this.set("reads", this.get("read_count_i"));
        });
      },

      /** @type {string} The type of this model */
      type: "SolrResult",

      /** Toggle the `selected` state of the result */
      toggle() {
        this.selected = !this.get("selected");
      },

      /**
       * Returns a plain-english version of the general format - either image,
       * program, metadata, PDF, annotation or data
       * @returns {string} The type of this object, such as "image", "program",
       * "metadata", "PDF", "annotation" or "data"
       */
      getType() {
        // The list of formatIds that are images
        const imageIds = [
          "image/gif",
          "image/jp2",
          "image/jpeg",
          "image/png",
          "image/svg xml",
          "image/svg+xml",
          "image/bmp",
        ];
        // The list of formatIds that are images
        const pdfIds = ["application/pdf"];
        const annotationIds = [
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html",
        ];
        const collectionIds = [
          "https://purl.dataone.org/collections-1.0.0",
          "https://purl.dataone.org/collections-1.1.0",
        ];
        const portalIds = [
          "https://purl.dataone.org/portals-1.0.0",
          "https://purl.dataone.org/portals-1.1.0",
        ];

        // Determine the type via provONE
        const instanceOfClass = this.get("prov_instanceOfClass");
        if (typeof instanceOfClass !== "undefined") {
          const programClass = _.filter(
            instanceOfClass,
            (className) => className.indexOf("#Program") > -1,
          );
          if (typeof programClass !== "undefined" && programClass.length)
            return "program";
        } else if (this.get("prov_generated") || this.get("prov_used"))
          return "program";

        // Determine the type via file format
        if (_.contains(collectionIds, this.get("formatId")))
          return "collection";
        if (_.contains(portalIds, this.get("formatId"))) return "portal";
        if (this.get("formatType") === "METADATA") return "metadata";
        if (_.contains(imageIds, this.get("formatId"))) return "image";
        if (_.contains(pdfIds, this.get("formatId"))) return "PDF";
        if (_.contains(annotationIds, this.get("formatId")))
          return "annotation";
        return "data";
      },

      /**
       * Get a plain-english version of the specific format ID (for selected
       * ids)
       * @returns {string} The specific format of this object
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
       * Sets the URL for this object based on the id and seriesId
       */
      setURL() {
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
       * @param {string} customString - Optional. An identifier string to check
       * instead of the id and seriesId attributes on the model
       * @returns {boolean} True if it is a DOI
       */
      isDOI(customString) {
        return (
          MetacatUI.appModel.isDOI(customString) ||
          MetacatUI.appModel.isDOI(this.get("id")) ||
          MetacatUI.appModel.isDOI(this.get("seriesId"))
        );
      },

      /**
       * Checks if the currently-logged-in user is authorized to change
       * permissions (or other action if set as parameter) on this doc
       * @param {string} [action] - The action (read, write, or
       * changePermission) to check if the current user has authorization to
       * perform. By default checks for the highest level of permission.
       * @returns {boolean|null} True if the user is authorized, false if not,
       * or null if the authServiceUrl is not set
       */
      checkAuthority(action = "changePermission") {
        const authServiceUrl = MetacatUI.appModel.get("authServiceUrl");
        if (!authServiceUrl) return false;

        const model = this;

        const requestSettings = {
          url: `${
            authServiceUrl + encodeURIComponent(this.get("id"))
          }?action=${action}`,
          type: "GET",
          success(_data, _textStatus, _xhr) {
            model.set(`isAuthorized_${action}`, true);
            model.set("isAuthorized", true);
            model.trigger("change:isAuthorized");
          },
          error(_xhr, _textStatus, _errorThrown) {
            model.set(`isAuthorized_${action}`, false);
            model.set("isAuthorized", false);
          },
        };
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
        return null;
      },

      /**
       * Download this object while sending the user's auth token in the
       * request.
       * @returns {Promise} A promise that resolves to the response object
       * @since 2.32.0
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
       * @since 2.32.0
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
       * @since 2.32.0
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
       * @since 2.32.0
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
       * @since 2.32.0
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

      /**
       * Get the information for this object from the Solr index
       * @param {string} [queryFields] - Optional. A string of fields to
       * retrieve from the Solr index. If not specified, a default set of fields
       * will be used.
       */
      getInfo(queryFields) {
        const model = this;

        const fields =
          queryFields ||
          "abstract,id,seriesId,fileName,resourceMap,formatType,formatId," +
            "obsoletedBy,isDocumentedBy,documents,title,origin,keywords," +
            "attributeName,pubDate,eastBoundCoord,westBoundCoord," +
            "northBoundCoord,southBoundCoord,beginDate,endDate,dateUploaded," +
            "archived,datasource,replicaMN,isAuthorized,isPublic,size," +
            "read_count_i,isService,serviceTitle,serviceEndpoint," +
            "serviceOutput,serviceDescription,serviceType,project,dateModified";

        const { escapeSpecialChar } = MetacatUI.appSearchModel;

        let query = "q=";

        // If there is no seriesId set, then search for pid or sid
        if (!this.get("seriesId"))
          query += `(id:"${escapeSpecialChar(
            encodeURIComponent(this.get("id")),
          )}" OR seriesId:"${escapeSpecialChar(
            encodeURIComponent(this.get("id")),
          )}")`;
        // If a seriesId is specified, then search for that
        else if (this.get("seriesId") && this.get("id").length > 0)
          query += `(seriesId:"${escapeSpecialChar(
            encodeURIComponent(this.get("seriesId")),
          )}" AND id:"${escapeSpecialChar(
            encodeURIComponent(this.get("id")),
          )}")`;
        // If only a seriesId is specified, then just search for the most recent
        // version
        else if (this.get("seriesId") && !this.get("id"))
          query += `seriesId:"${escapeSpecialChar(
            encodeURIComponent(this.get("id")),
          )}" -obsoletedBy:*`;

        query +=
          `&fl=${
            fields // Specify the fields to return
          }&wt=json&rows=1000` + // Get the results in JSON format and get 1000 rows
          `&archived=archived:*`; // Get archived or unarchived content

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          type: "GET",
          success(data, _response, _xhr) {
            // If the Solr response was not as expected, trigger and error and
            // exit
            if (!data || typeof data.response === "undefined") {
              model.set("indexed", false);
              model.trigger("getInfoError");
              return;
            }

            const { docs } = data.response;

            if (docs.length === 1) {
              docs[0].resourceMap = model.parseResourceMapField(docs[0]);
              model.set(docs[0]);
              model.trigger("sync");
            }
            // If we searched by seriesId, then let's find the most recent
            // version in the series
            else if (docs.length > 1) {
              // Filter out docs that are obsoleted
              const mostRecent = _.reject(
                docs,
                (doc) => typeof doc.obsoletedBy !== "undefined",
              );

              // If there is only one doc that is not obsoleted (the most
              // recent), then set this doc's values on this model
              if (mostRecent.length === 1) {
                mostRecent[0].resourceMap = model.parseResourceMapField(
                  mostRecent[0],
                );
                model.set(mostRecent[0]);
                model.trigger("sync");
              } else {
                // If there are multiple docs without an obsoletedBy statement,
                // then retreive the head of the series via the system metadata
                const sysMetaRequestSettings = {
                  url:
                    MetacatUI.appModel.get("metaServiceUrl") +
                    encodeURIComponent(docs[0].seriesId),
                  type: "GET",
                  success(sysMetaData) {
                    // Get the identifier node from the system metadata
                    const seriesHeadID = $(sysMetaData)
                      .find("identifier")
                      .text();
                    // Get the doc from the Solr results with that identifier
                    const seriesHead = _.findWhere(docs, { id: seriesHeadID });

                    // If there is a doc in the Solr results list that matches
                    // the series head id
                    if (seriesHead) {
                      seriesHead.resourceMap =
                        model.parseResourceMapField(seriesHead);
                      // Set those values on this model
                      model.set(seriesHead);
                    }
                    // Otherwise, just fall back on the first doc in the list
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
                  error(__xhr, _textStatus, _errorThrown) {
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
              // Try getting the system metadata as a backup
              model.getSysMeta();
            }
          },
          error(_xhr, _textStatus, _errorThrown) {
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

      /** Get the citation information for this object from the Solr index */
      getCitationInfo() {
        this.getInfo(
          "id,seriesId,origin,pubDate,dateUploaded,title,datasource,project",
        );
      },

      /** Get the system metadata for this object */
      getSysMeta() {
        const url =
          MetacatUI.appModel.get("metaServiceUrl") +
          encodeURIComponent(this.get("id"));
        const model = this;

        const requestSettings = {
          url,
          type: "GET",
          dataType: "text",
          success(data, _response, _xhr) {
            if (data && data.length) {
              model.set("systemMetadata", data);
            }

            // Check if this is archvied
            const archived = $(data).find("archived").text() === "true";
            model.set("archived", archived);

            // Get the file size
            model.set("size", $(data).find("size").text() || "");

            // Get the entity name
            model.set("fileName", $(data).find("filename").text() || "");

            // Check if this is a metadata doc
            const formatId = $(data).find("formatid").text() || "";
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

            // Trigger the sync event so the app knows we found the model info
            model.trigger("sync");
          },
          error(response) {
            // When the user is unauthorized to access this object, trigger a
            // 401 error
            if (response.status === 401) {
              model.set("notFound", true);
              model.trigger("401");
            }
            // When the object doesn't exist, trigger a 404 error
            else if (response.status === 404) {
              model.set("notFound", true);
              model.trigger("404");
            }
            // Other error codes trigger a generic error
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

      /**
       * Transgresses the obsolence chain until it finds the newest version that
       * this user is authorized to read
       * @param {string} [newest] - The id of the newest version to start with.
       * If not supplied, this model's id will be used.
       * @param {string} [newer] - The id of a possibly newer version.
       */
      findLatestVersion(newest, newer) {
        // Make sure we have the /meta service configured
        if (!MetacatUI.appModel.get("metaServiceUrl")) return;

        let newestVersion = newest;
        let possiblyNewer = newer;

        // If no pid was supplied, use this model's id
        if (!newestVersion) {
          newestVersion = this.get("id");
          possiblyNewer = this.get("obsoletedBy");
        }

        // If this isn't obsoleted by anything, then there is no newer version
        if (!possiblyNewer) {
          this.set("newestVersion", newestVersion);
          return;
        }

        const model = this;

        // Get the system metadata for the possibly newer version
        const requestSettings = {
          url:
            MetacatUI.appModel.get("metaServiceUrl") +
            encodeURIComponent(possiblyNewer),
          type: "GET",
          success(data) {
            // the response may have an obsoletedBy element
            const obsoletedBy = $(data).find("obsoletedBy").text();

            // If there is an even newer version, then get it and rerun this
            // function
            if (obsoletedBy)
              model.findLatestVersion(possiblyNewer, obsoletedBy);
            // If there isn't a newer version, then this is it
            else model.set("newestVersion", possiblyNewer);
          },
          error(xhr) {
            // If this newer version isn't found or accessible, then save the
            // last accessible id as the newest version
            if (
              xhr.status === 401 ||
              xhr.status === 404 ||
              xhr.status === "401" ||
              xhr.status === "404"
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

      // ================ Provenance-related functions ================/

      /**
       * Returns true if this provenance field points to a source of this data
       * or metadata object
       * @param {string} field - The provenance field to check
       * @returns {boolean} True if this field is a source field, false
       * otherwise
       */
      isSourceField(field) {
        if (typeof field === "undefined" || !field) return false;
        if (!_.contains(MetacatUI.appSearchModel.getProvFields(), field))
          return false;

        if (
          field === "prov_generatedByExecution" ||
          field === "prov_generatedByProgram" ||
          field === "prov_used" ||
          field === "prov_wasDerivedFrom" ||
          field === "prov_wasInformedBy"
        )
          return true;
        return false;
      },

      /**
       * Returns true if this provenance field points to a derivation of this
       * data or metadata object
       * @param {string} field - The provenance field to check
       * @returns {boolean} True if this field is a derivation field, false
       * otherwise
       */
      isDerivationField(field) {
        if (typeof field === "undefined" || !field) return false;
        if (!_.contains(MetacatUI.appSearchModel.getProvFields(), field))
          return false;

        if (
          field === "prov_usedByExecution" ||
          field === "prov_usedByProgram" ||
          field === "prov_hasDerivations" ||
          field === "prov_generated"
        )
          return true;
        return false;
      },

      /**
       * Returns true if this SolrResult has a provenance trace (i.e. has either
       * sources or derivations)
       * @returns {boolean} True if this object has a provenance trace, false
       * otherwise
       */
      hasProvTrace() {
        if (this.get("formatType") === "METADATA") {
          if (this.get("prov_hasSources") || this.get("prov_hasDerivations"))
            return true;
        }

        const fieldNames = MetacatUI.appSearchModel.getProvFields();
        let currentField = "";

        for (let i = 0; i < fieldNames.length; i += 1) {
          currentField = fieldNames[i];
          if (this.has(currentField)) return true;
        }

        return false;
      },

      /**
       * Returns an array of all the IDs of objects that are sources of this
       * object
       * @returns {string[]} An array of source IDs
       */
      getSources() {
        const sources = [];
        const model = this;
        // Get the prov fields but leave out references to executions which are
        // not used in the UI yet
        const fields = _.reject(
          MetacatUI.appSearchModel.getProvFields(),
          (f) => f.indexOf("xecution") > -1,
        ); // Leave out the first e in execution so we don't have to worry about case sensitivity

        _.each(fields, (provField, _i) => {
          if (model.isSourceField(provField) && model.has(provField))
            sources.push(model.get(provField));
        });

        return _.uniq(_.flatten(sources));
      },

      /**
       * Returns an array of all the IDs of objects that are derivations of this
       * object
       * @returns {string[]} An array of derivation IDs
       */
      getDerivations() {
        const derivations = [];
        const model = this;
        // Get the prov fields but leave out references to executions which are
        // not used in the UI yet
        const fields = _.reject(
          MetacatUI.appSearchModel.getProvFields(),
          (f) => f.indexOf("xecution") > -1,
        ); // Leave out the first e in execution so we don't have to worry about case sensitivity

        _.each(fields, (provField, _i) => {
          if (model.isDerivationField(provField) && model.has(provField))
            derivations.push(model.get(provField));
        });

        return _.uniq(_.flatten(derivations));
      },

      /** @returns {string[]} IDs of all objs that are used by this obj */
      getInputs() {
        return this.get("prov_used");
      },

      /** @returns {string[]} IDs of all objs that are generated by this obj */
      getOutputs() {
        return this.get("prov_generated");
      },

      /**
       * Uses the app configuration to check if this model's metrics should be
       * hidden in the display
       * @returns {boolean} True if the metrics should be hidden, false
       * otherwise
       */
      hideMetrics() {
        // If the AppModel is configured with cases of where to hide metrics,
        if (
          typeof MetacatUI.appModel.get("hideMetricsWhen") === "object" &&
          MetacatUI.appModel.get("hideMetricsWhen")
        ) {
          // Check for at least one match
          return _.some(
            MetacatUI.appModel.get("hideMetricsWhen"),
            function hideWhen(value, modelProperty) {
              // Get the value of this property from this model
              const modelValue = this.get(modelProperty);

              // Check for the presence of this model's value in the AppModel
              // value
              if (Array.isArray(value) && typeof modelValue === "string") {
                return _.contains(value, modelValue);
              }
              // Check for the presence of the AppModel's value in this model's
              // value
              if (typeof value === "string" && Array.isArray(modelValue)) {
                return _.contains(modelValue, value);
              }
              // Check for overlap of two arrays
              if (Array.isArray(value) && Array.isArray(modelValue)) {
                return _.intersection(value, modelValue).length > 0;
              }
              // If the AppModel value is a function, execute it
              if (typeof value === "function") {
                return value(modelValue);
              }
              // Otherwise, just check for equality

              return value === modelValue;
            },
            this,
          );
        }
        return false;
      },

      /**
       * Creates a URL for viewing more information about this metadata
       * @returns {string} The URL to view this metadata
       */
      createViewURL() {
        return this.getType() === "portal" || this.getType() === "collection"
          ? `${MetacatUI.root}/${MetacatUI.appModel.get(
              "portalTermPlural",
            )}/${encodeURIComponent(
              this.get("label") || this.get("seriesId") || this.get("id"),
            )}`
          : `${MetacatUI.root}/view/${encodeURIComponent(
              this.get("seriesId") || this.get("id"),
            )}`;
      },

      /**
       * Parses the resourceMap field from the Solr response JSON.
       * @param {object} json - The JSON object from the Solr response
       * @returns {string|string[]} The resourceMap parsed. If it is a string,
       * it returns the trimmed string. If it is an array, it returns an array
       * of trimmed strings. If it is neither, it returns an empty array.
       */
      parseResourceMapField(json) {
        if (typeof json.resourceMap === "string") {
          return json.resourceMap.trim();
        }
        if (Array.isArray(json.resourceMap)) {
          const newResourceMapIds = [];
          _.each(json.resourceMap, (rMapId) => {
            if (typeof rMapId === "string") {
              newResourceMapIds.push(rMapId.trim());
            }
          });
          return newResourceMapIds;
        }

        // If nothing works so far, return an empty array
        return [];
      },
    },
  );
  return SolrResult;
});
