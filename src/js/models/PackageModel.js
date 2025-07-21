define([
  "jquery",
  "underscore",
  "backbone",
  "uuid",
  "md5",
  "rdflib",
  "models/SolrResult",
], ($, _, Backbone, uuid, md5, rdf, SolrResult) => {
  /**
   * @class PackageModel
   * @classdesc A Backbone Model for representing a DataONE package or resource
   * map.
   * @classcategory Models
   * @deprecated Warning! This model will be removed in a future release in
   * favour of the DataPackage model. The PackageModel is still used in some
   * places but will eventually be replaced with the DataPackage model. New code
   * should use the DataPackage model.
   * @augments Backbone.Model
   */
  const PackageModel = Backbone.Model.extend(
    /** @lends PackageModel.prototype */ {
      defaults() {
        return {
          id: null, // The id of the resource map/package itself
          url: null, // the URL to retrieve this package
          memberId: null, // An id of a member of the data package
          indexDoc: null, // A SolrResult object representation of the resource map
          size: 0, // The number of items aggregated in this package
          totalSize: null,
          formattedSize: "",
          formatId: null,
          obsoletedBy: null,
          obsoletes: null,
          read_count_i: null,
          isPublic: true,
          members: [],
          memberIds: [],
          sources: [],
          derivations: [],
          provenanceFlag: null,
          sourcePackages: [],
          derivationPackages: [],
          sourceDocs: [],
          derivationDocs: [],
          relatedModels: [], // A condensed list of all SolrResult models related to this package in some way
          parentPackageMetadata: null,
          // If true, when the member objects are retrieved, archived content
          // will be included
          getArchivedMembers: false,
        };
      },

      // Define the namespaces
      namespaces: {
        RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        FOAF: "http://xmlns.com/foaf/0.1/",
        OWL: "http://www.w3.org/2002/07/owl#",
        DC: "http://purl.org/dc/elements/1.1/",
        ORE: "http://www.openarchives.org/ore/terms/",
        DCTERMS: "http://purl.org/dc/terms/",
        CITO: "http://purl.org/spar/cito/",
        XML: "http://www.w3.org/2001/XMLSchema#",
      },

      sysMetaNodeMap: {
        accesspolicy: "accessPolicy",
        accessrule: "accessRule",
        authoritativemembernode: "authoritativeMemberNode",
        dateuploaded: "dateUploaded",
        datesysmetadatamodified: "dateSysMetadataModified",
        formatid: "formatId",
        nodereference: "nodeReference",
        obsoletedby: "obsoletedBy",
        originmembernode: "originMemberNode",
        replicamembernode: "replicaMemberNode",
        replicapolicy: "replicaPolicy",
        replicationstatus: "replicationStatus",
        replicaverified: "replicaVerified",
        rightsholder: "rightsHolder",
        serialversion: "serialVersion",
      },

      complete: false,

      pending: false,

      type: "Package",

      // The RDF graph representing this data package
      dataPackageGraph: null,

      initialize() {
        this.setURL();

        // Create an initial RDF graph
        this.dataPackageGraph = rdf.graph();
      },

      setURL() {
        if (MetacatUI.appModel.get("packageServiceUrl"))
          this.set(
            "url",
            MetacatUI.appModel.get("packageServiceUrl") +
              encodeURIComponent(this.get("id")),
          );
      },

      /*
       * Set the URL for fetch
       */
      url() {
        return (
          MetacatUI.appModel.get("objectServiceUrl") +
          encodeURIComponent(this.get("id"))
        );
      },

      /**
       * Retrieve the id of the resource map/package that this id belongs to
       * @param {string} memberId - The id of the member to search for
       */
      getMembersByMemberID(memberId) {
        let id = memberId;
        this.pending = true;

        if (!id) id = this.memberId;

        const model = this;

        // Get the id of the resource map for this member
        const provFlList = `${MetacatUI.appSearchModel.getProvFlList()}prov_instanceOfClass,`;
        const query =
          `fl=resourceMap,fileName,read:read_count_i,obsoletedBy,size,formatType,formatId,id,datasource,title,origin,pubDate,dateUploaded,isPublic,isService,serviceTitle,serviceEndpoint,serviceOutput,serviceDescription,${provFlList}&rows=1` +
          `&q=id:%22${encodeURIComponent(id)}%22` +
          `&wt=json`;

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data) {
            // There should be only one response since we searched by id
            if (data.response.docs) {
              const doc = data.response.docs[0];

              // Is this document a resource map itself?
              if (doc.formatId === "http://www.openarchives.org/ore/terms") {
                model.set("id", doc.id); // this is the package model ID
                model.set("members", []); // Reset the member list
                model.getMembers();
              }
              // If there is no resource map, then this is the only document to
              // in this package
              else if (!doc.resourceMap) {
                model.set("id", null);
                model.set("memberIds", new Array(doc.id));
                model.set("members", [new SolrResult(doc)]);
                model.trigger("change:members");
                model.flagComplete();
              } else {
                model.set("id", doc.resourceMap[0]);
                model.getMembers();
              }
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

      /* Get all the members of a resource map/package based on the id attribute
       * of this model. Create a SolrResult model for each member and save it in
       * the members[] attribute of this model. */
      getMembers(options) {
        this.pending = true;

        const model = this;
        const members = [];
        const pids = []; // Keep track of each object pid

        // Find all the files that are a part of this resource map and the
        // resource map itself
        let query =
          `fl=resourceMap,fileName,obsoletes,obsoletedBy,size,formatType,formatId,id,datasource,` +
          `rightsHolder,dateUploaded,archived,title,origin,prov_instanceOfClass,isDocumentedBy,isPublic` +
          `&rows=1000` +
          `&q=%28resourceMap:%22${encodeURIComponent(
            this.id,
          )}%22%20OR%20id:%22${encodeURIComponent(this.id)}%22%29` +
          `&wt=json`;

        if (this.get("getArchivedMembers")) {
          query += "&archived=archived:*";
        }

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data) {
            // Separate the resource maps from the data/metadata objects
            _.each(data.response.docs, (doc) => {
              if (doc.id === model.get("id")) {
                model.set("indexDoc", doc);
                model.set(doc);
                if (
                  model.get("resourceMap") &&
                  options &&
                  options.getParentMetadata
                )
                  model.getParentMetadata();
              } else {
                pids.push(doc.id);

                if (doc.formatType === "RESOURCE") {
                  const newPckg = new PackageModel(doc);
                  newPckg.set("parentPackage", model);
                  members.push(newPckg);
                } else members.push(new SolrResult(doc));
              }
            });

            model.set("memberIds", _.uniq(pids));
            model.set("members", members);

            if (model.getNestedPackages().length > 0)
              model.createNestedPackages();
            else model.flagComplete();
          },
        };

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );

        return this;
      },

      /*
       * Send custom options to the Backbone.Model.fetch() function
       */
      fetch(options = {}) {
        let fetchOptions = _.extend({ dataType: "text" }, options);

        // Add the authorization options
        fetchOptions = _.extend(
          fetchOptions,
          MetacatUI.appUserModel.createAjaxSettings(),
        );

        return Backbone.Model.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * Fetch the resource map and return a promise that resolves when the
       * fetch is complete.
       * @param {Object} options - Options to pass to the fetch function
       * @param {number} [timeout] - Timeout in milliseconds for the fetch
       * operation.
       * @returns {Promise} - A promise that resolves to the fetched model or an
       * error response.
       */
      fetchPromise(options, timeout = Infinity) {
        const listenModel = new Backbone.Model();

        return new Promise((resolve, reject) => {
          listenModel.listenToOnce(this, "sync", () => {
            listenModel.stopListening();
            resolve({
              status: 200, // OK
              statusText: "OK",
              model: this,
            });
          });

          listenModel.listenToOnce(this, "error", (_model, response) => {
            listenModel.stopListening();
            reject(response);
          });

          if (timeout < Infinity) {
            setTimeout(() => {
              listenModel.stopListening();
              resolve({
                status: 408, // Request Timeout
                statusText: "Request Timeout",
              });
            }, timeout);
          }

          this.fetch(options);
        });
      },

      /*
       * Deserialize a Package from OAI-ORE RDF XML
       */
      parse(response) {
        // Save the raw XML in case it needs to be used later
        this.set("objectXML", $.parseHTML(response));

        // Define the namespaces
        const ORE = rdf.Namespace(this.namespaces.ORE);
        const CITO = rdf.Namespace(this.namespaces.CITO);
        // Namespaces not used:
        //  - const RDF = rdf.Namespace(this.namespaces.RDF);
        //  - const FOAF = rdf.Namespace(this.namespaces.FOAF);
        //  - const OWL = rdf.Namespace(this.namespaces.OWL);
        //  - const DC = rdf.Namespace(this.namespaces.DC);
        //  - const DCTERMS = rdf.Namespace(this.namespaces.DCTERMS);

        let memberStatements = [];
        let memberURIParts;
        let memberPIDStr;
        let memberPID;
        const models = []; // the models returned by parse()

        try {
          rdf.parse(
            response,
            this.dataPackageGraph,
            MetacatUI.appModel.get("objectServiceUrl") +
              (encodeURIComponent(this.id) ||
                encodeURIComponent(this.seriesid)),
            "application/rdf+xml",
          );

          // List the package members
          memberStatements = this.dataPackageGraph.statementsMatching(
            undefined,
            ORE("aggregates"),
            undefined,
            undefined,
          );

          const memberPIDs = [];
          const members = [];
          const currentMembers = this.get("members");

          // Get system metadata for each member to eval the formatId
          _.each(
            memberStatements,
            (memberStatement) => {
              memberURIParts = memberStatement.object.value.split("/");
              memberPIDStr = _.last(memberURIParts);
              memberPID = decodeURIComponent(memberPIDStr);

              if (memberPID) {
                memberPIDs.push(memberPID);

                // Get the current model from the member list, if it exists
                const existingModel = _.find(
                  currentMembers,
                  (m) => m.get("id") === decodeURIComponent(memberPID),
                );

                // Add the existing model to the new member list
                if (existingModel) {
                  members.push(existingModel);
                }
                // Or create a new SolrResult model
                else {
                  members.push(
                    new SolrResult({
                      id: decodeURIComponent(memberPID),
                    }),
                  );
                }
              }
            },
            this,
          );

          // Get the documents relationships
          const documentedByStatements =
            this.dataPackageGraph.statementsMatching(
              undefined,
              CITO("isDocumentedBy"),
              undefined,
              undefined,
            );
          const metadataPids = [];

          _.each(
            documentedByStatements,
            (statement) => {
              // Get the data object that is documentedBy metadata
              const dataPid = decodeURIComponent(
                _.last(statement.subject.value.split("/")),
              );
              const dataObj = _.find(members, (m) => m.get("id") === dataPid);
              const metadataPid = _.last(statement.object.value.split("/"));

              // Save this as a metadata model
              metadataPids.push(metadataPid);

              // Set the isDocumentedBy field
              let isDocBy = dataObj.get("isDocumentedBy");
              if (isDocBy && Array.isArray(isDocBy)) isDocBy.push(metadataPid);
              else if (isDocBy && !Array.isArray(isDocBy))
                isDocBy = [isDocBy, metadataPid];
              else isDocBy = [metadataPid];

              dataObj.set("isDocumentedBy", isDocBy);
            },
            this,
          );

          // Get the metadata models and mark them as metadata
          const metadataModels = _.filter(members, (m) =>
            _.contains(metadataPids, m.get("id")),
          );
          _.invoke(metadataModels, "set", "formatType", "METADATA");

          // Keep the pids in the collection for easy access later
          this.set("memberIds", memberPIDs);
          this.set("members", members);
        } catch (error) {
          console.log(error);
        }
        return models;
      },

      /*
       * Overwrite the Backbone.Model.save() function to set custom options
       */
      save(_attrs, options = {}) {
        // Get the system metadata first
        if (!this.get("hasSystemMetadata")) {
          const model = this;
          const requestSettings = {
            url:
              MetacatUI.appModel.get("metaServiceUrl") +
              encodeURIComponent(this.get("id")),
            success(response) {
              model.parseSysMeta(response);

              model.set("hasSystemMetadata", true);
              model.save.call(model, null, options);
            },
            dataType: "text",
          };
          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
          return;
        }

        const oldPid = this.get("id");
        // Create a new pid if we are updating the object
        if (!options.sysMetaOnly) {
          // Set a new id
          this.set("oldPid", oldPid);
          this.set("id", `urn:uuid:${uuid.v4()}`);
          this.set("obsoletes", oldPid);
          this.set("obsoletedBy", null);
          this.set("archived", false);
        }

        // Create the system metadata
        const sysMetaXML = this.serializeSysMeta();

        // Send the new pid, old pid, and system metadata
        const xmlBlob = new Blob([sysMetaXML], { type: "application/xml" });
        const formData = new FormData();
        formData.append("sysmeta", xmlBlob, "sysmeta");

        // Let's try updating the system metadata for now
        if (options.sysMetaOnly) {
          formData.append("pid", this.get("id"));

          const requestSettings = {
            url: MetacatUI.appModel.get("metaServiceUrl"),
            type: "PUT",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            success(_response) {},
            error(_data) {
              console.log("error updating system metadata");
            },
          };
          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
        } else {
          // Add the ids to the form data
          formData.append("newPid", this.get("id"));
          formData.append("pid", oldPid);

          // Create the resource map XML
          const mapXML = this.serialize();
          const mapBlob = new Blob([mapXML], { type: "application/xml" });
          formData.append("object", mapBlob);

          // Get the size of the new resource map
          this.set("size", mapBlob.size);

          // Get the new checksum of the resource map
          const checksum = md5(mapXML);
          this.set("checksum", checksum);

          const requestSettings = {
            url: MetacatUI.appModel.get("objectServiceUrl"),
            type: "PUT",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            success() {},
            error() {
              console.log("error udpating object");
            },
          };
          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
        }
      },

      parseSysMeta(response) {
        this.set("sysMetaXML", $.parseHTML(response));

        const responseDoc = $.parseHTML(response);
        let systemMetadata;

        for (let i = 0; i < responseDoc.length; i += 1) {
          if (
            responseDoc[i].nodeType === 1 &&
            responseDoc[i].localName.indexOf("systemmetadata") > -1
          )
            systemMetadata = responseDoc[i];
        }

        // Parse the XML to JSON
        const sysMetaValues = this.toJson(systemMetadata);
        const camelCasedValues = {};
        // Convert the JSON to a camel-cased version, which matches Solr and is
        // easier to work with in code
        _.each(
          Object.keys(sysMetaValues),
          function (key) {
            camelCasedValues[this.sysMetaNodeMap[key]] = sysMetaValues[key];
          },
          this,
        );

        // Set the values on the model
        this.set(camelCasedValues);
      },

      serialize() {
        // Define the namespaces
        const ORE = rdf.Namespace(this.namespaces.ORE);
        // Not used:
        //  - const CITO = rdf.Namespace(this.namespaces.CITO);

        // Get the pid of this package - depends on whether we are updating or
        // creating a resource map
        const pid = this.get("id");
        const oldPid = this.get("oldPid");
        const updating = !!oldPid;

        // Update the pids in the RDF graph only if we are updating the resource
        // map with a new pid
        if (updating) {
          // Find the identifier statement in the resource map
          const idNode = rdf.lit(oldPid);
          const idStatement = this.dataPackageGraph.statementsMatching(
            undefined,
            undefined,
            idNode,
          );

          // Get the CN Resolve Service base URL from the resource map (mostly
          // important in dev environments where it will not always be
          // cn.dataone.org)
          const cnResolveUrl = idStatement[0].subject.value.substring(
            0,
            idStatement[0].subject.value.indexOf(oldPid),
          );
          this.dataPackageGraph.cnResolveUrl = cnResolveUrl;

          // Create variations of the resource map ID using the resolve URL so
          // we can always find it in the RDF graph
          const oldPidVariations = [
            oldPid,
            encodeURIComponent(oldPid),
            cnResolveUrl + encodeURIComponent(oldPid),
          ];

          // Get all the isAggregatedBy statements
          const aggregationNode = rdf.sym(
            `${cnResolveUrl + encodeURIComponent(oldPid)}#aggregation`,
          );
          const aggByStatements = this.dataPackageGraph.statementsMatching(
            undefined,
            ORE("isAggregatedBy"),
          );

          // Using the isAggregatedBy statements, find all the DataONE object
          // ids in the RDF graph
          const idsFromXML = [];
          _.each(
            aggByStatements,
            (statement) => {
              // Check if the resource map ID is the old existing id, so we
              // don't collect ids that are not about this resource map
              if (
                _.find(
                  oldPidVariations,
                  (oldPidV) =>
                    `${oldPidV}#aggregation` === statement.object.value,
                )
              ) {
                const statementID = statement.subject.value;
                idsFromXML.push(statementID);

                // Add variations of the ID so we make sure we account for all
                // the ways they exist in the RDF XML
                if (statementID.indexOf(cnResolveUrl) > -1)
                  idsFromXML.push(
                    statementID.substring(statementID.lastIndexOf("/") + 1),
                  );
                else
                  idsFromXML.push(
                    cnResolveUrl + encodeURIComponent(statementID),
                  );
              }
            },
            this,
          );

          // Get all the ids from this model
          const idsFromModel = _.invoke(this.get("members"), "get", "id");

          // Find the difference between the model IDs and the XML IDs to get a
          // list of added members
          const addedIds = _.without(
            _.difference(idsFromModel, idsFromXML),
            oldPidVariations,
          );
          // Create variations of all these ids too
          const allMemberIds = idsFromModel;
          _.each(idsFromModel, (id) => {
            allMemberIds.push(cnResolveUrl + encodeURIComponent(id));
          });

          // Remove any other isAggregatedBy statements that are not listed as
          // members of this model
          _.each(
            aggByStatements,
            (statement) => {
              if (!_.contains(allMemberIds, statement.subject.value))
                this.removeFromAggregation(statement.subject.value);
              else if (
                _.find(
                  oldPidVariations,
                  (oldPidV) =>
                    `${oldPidV}#aggregation` === statement.object.value,
                )
              ) {
                const statementRef = statement;
                statementRef.object.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
              }
            },
            this,
          );

          // Change all the statements in the RDF where the aggregation is the
          // subject, to reflect the new resource map ID
          const aggregationSubjStatements =
            this.dataPackageGraph.statementsMatching(aggregationNode);
          _.each(aggregationSubjStatements, (statement) => {
            const statementRef = statement;
            statementRef.subject.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
          });

          // Change all the statements in the RDF where the aggregation is the
          // object, to reflect the new resource map ID
          const aggregationObjStatements =
            this.dataPackageGraph.statementsMatching(
              undefined,
              undefined,
              aggregationNode,
            );
          _.each(aggregationObjStatements, (statement) => {
            const statementRef = statement;
            statementRef.object.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
          });

          // Change all the resource map subject nodes in the RDF graph
          const rMapNode = rdf.sym(cnResolveUrl + encodeURIComponent(oldPid));
          const rMapStatements =
            this.dataPackageGraph.statementsMatching(rMapNode);
          _.each(rMapStatements, (statement) => {
            const statementRef = statement;
            statementRef.subject.value = cnResolveUrl + encodeURIComponent(pid);
          });

          // Change the idDescribedBy statement
          const isDescribedByStatements =
            this.dataPackageGraph.statementsMatching(
              undefined,
              ORE("isDescribedBy"),
              rdf.sym(oldPid),
            );
          if (isDescribedByStatements[0])
            isDescribedByStatements[0].object.value = pid;

          // Add nodes for new package members
          _.each(
            addedIds,
            function (id) {
              this.addToAggregation(id);
            },
            this,
          );

          // Change all the resource map identifier literal node in the RDF
          // graph
          if (idStatement[0]) idStatement[0].object.value = pid;
        }

        // Now serialize the RDF XML
        const serializer = rdf.Serializer();
        serializer.store = this.dataPackageGraph;

        const xmlString = serializer.statementsToXML(
          this.dataPackageGraph.statements,
        );

        return xmlString;
      },

      serializeSysMeta() {
        // Get the system metadata XML that currently exists in the system
        const xml = $(this.get("sysMetaXML"));

        // Update the system metadata values
        xml.find("serialversion").text(this.get("serialVersion") || "0");
        xml.find("identifier").text(this.get("newPid") || this.get("id"));
        xml.find("formatid").text(this.get("formatId"));
        xml.find("size").text(this.get("size"));
        xml.find("checksum").text(this.get("checksum"));
        xml
          .find("submitter")
          .text(
            this.get("submitter") || MetacatUI.appUserModel.get("username"),
          );
        xml
          .find("rightsholder")
          .text(
            this.get("rightsHolder") || MetacatUI.appUserModel.get("username"),
          );
        xml.find("archived").text(this.get("archived"));
        xml
          .find("dateuploaded")
          .text(this.get("dateUploaded") || new Date().toISOString());
        xml
          .find("datesysmetadatamodified")
          .text(
            this.get("dateSysMetadataModified") || new Date().toISOString(),
          );
        xml
          .find("originmembernode")
          .text(
            this.get("originMemberNode") ||
              MetacatUI.nodeModel.get("currentMemberNode"),
          );
        xml
          .find("authoritativemembernode")
          .text(
            this.get("authoritativeMemberNode") ||
              MetacatUI.nodeModel.get("currentMemberNode"),
          );

        if (this.get("obsoletes"))
          xml.find("obsoletes").text(this.get("obsoletes"));
        else xml.find("obsoletes").remove();

        if (this.get("obsoletedBy"))
          xml.find("obsoletedby").text(this.get("obsoletedBy"));
        else xml.find("obsoletedby").remove();

        // Write the access policy
        let accessPolicyXML = "<accessPolicy>\n";
        _.each(this.get("accesspolicy"), (policy, policyType, all) => {
          const fullPolicy = all[policyType];

          _.each(fullPolicy, (policyPart) => {
            accessPolicyXML += `\t<${policyType}>\n`;

            accessPolicyXML += `\t\t<subject>${policyPart.subject}</subject>\n`;

            const permissions = Array.isArray(policyPart.permission)
              ? policyPart.permission
              : [policyPart.permission];
            _.each(permissions, (perm) => {
              accessPolicyXML += `\t\t<permission>${perm}</permission>\n`;
            });

            accessPolicyXML += `\t</${policyType}>\n`;
          });
        });
        accessPolicyXML += "</accessPolicy>";

        // Replace the old access policy with the new one
        xml.find("accesspolicy").replaceWith(accessPolicyXML);

        let xmlString = $(document.createElement("div"))
          .append(xml.clone())
          .html();

        // Camel case the nodes using the sysMetaNodeMap
        Object.entries(this.sysMetaNodeMap).forEach(
          ([original, camelCased]) => {
            const openingTagRegex = new RegExp(`<${original}`, "g");
            const closingTagRegex = new RegExp(`${original}>`, "g");
            xmlString = xmlString.replace(openingTagRegex, `<${camelCased}`);
            xmlString = xmlString.replace(closingTagRegex, `${camelCased}>`);
          },
        );

        xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");

        return xmlString;
      },

      /**
       * Adds a new object to the resource map RDF graph
       * @param {string} id - The id of the object to add
       */
      addToAggregation(id) {
        let fullID;
        let modifiedId = id;
        if (id.indexOf(this.dataPackageGraph.cnResolveUrl) < 0)
          fullID = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
        else {
          fullID = id;
          modifiedId = id.substring(
            this.dataPackageGraph.cnResolveUrl.lastIndexOf("/") + 1,
          );
        }

        // Initialize the namespaces
        const ORE = rdf.Namespace(this.namespaces.ORE);
        const DCTERMS = rdf.Namespace(this.namespaces.DCTERMS);
        const XML = rdf.Namespace(this.namespaces.XML);
        const CITO = rdf.Namespace(this.namespaces.CITO);

        // Create a node for this object, the identifier, the resource map, and
        // the aggregation
        const objectNode = rdf.sym(fullID);
        rdf.sym(
          this.dataPackageGraph.cnResolveUrl +
            encodeURIComponent(this.get("id")),
        );
        const aggNode = rdf.sym(
          `${
            this.dataPackageGraph.cnResolveUrl +
            encodeURIComponent(this.get("id"))
          }#aggregation`,
        );
        const idNode = rdf.literal(modifiedId, undefined, XML("string"));

        // Add the statement: this object isAggregatedBy the resource map
        // aggregation
        this.dataPackageGraph.addStatement(
          rdf.st(objectNode, ORE("isAggregatedBy"), aggNode),
        );
        // Add the statement: The resource map aggregation aggregates this
        // object
        this.dataPackageGraph.addStatement(
          rdf.st(aggNode, ORE("aggregates"), objectNode),
        );
        // Add the statement: This object has the identifier {id}
        this.dataPackageGraph.addStatement(
          rdf.st(objectNode, DCTERMS("identifier"), idNode),
        );

        // Find the metadata doc that describes this object
        const model = _.find(
          this.get("members"),
          (m) => m.get("id") === modifiedId,
        );
        const isDocBy = model.get("isDocumentedBy");

        // If this object is documented by any metadata...
        if (isDocBy) {
          // Get the ids of all the metadata objects in this package
          const metadataInPackage = _.compact(
            _.map(this.get("members"), (m) => {
              if (m.get("formatType") === "METADATA") return m.get("id");
              return null;
            }),
          );
          // Find the metadata IDs that are in this package that also documents
          // this data object
          const metadataIds = Array.isArray(isDocBy)
            ? _.intersection(metadataInPackage, isDocBy)
            : _.intersection(metadataInPackage, [isDocBy]);

          // For each metadata that documents this object, add a
          // CITO:isDocumentedBy and CITO:documents statement
          _.each(
            metadataIds,
            function (metaId) {
              // Create the named nodes and statements
              const memberNode = rdf.sym(
                this.dataPackageGraph.cnResolveUrl +
                  encodeURIComponent(modifiedId),
              );
              const metadataNode = rdf.sym(
                this.dataPackageGraph.cnResolveUrl + encodeURIComponent(metaId),
              );
              const isDocByStatement = rdf.st(
                memberNode,
                CITO("isDocumentedBy"),
                metadataNode,
              );
              const documentsStatement = rdf.st(
                metadataNode,
                CITO("documents"),
                memberNode,
              );
              // Add the statements
              this.dataPackageGraph.addStatement(isDocByStatement);
              this.dataPackageGraph.addStatement(documentsStatement);
            },
            this,
          );
        }
      },

      removeFromAggregation(id) {
        let modifiedId = id;
        if (!modifiedId.indexOf(this.dataPackageGraph.cnResolveUrl))
          modifiedId =
            this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);

        const removedObjNode = rdf.sym(modifiedId);
        const statements = _.union(
          this.dataPackageGraph.statementsMatching(
            undefined,
            undefined,
            removedObjNode,
          ),
          this.dataPackageGraph.statementsMatching(removedObjNode),
        );

        this.dataPackageGraph.removeStatements(statements);
      },

      getParentMetadata() {
        const rMapIds = this.get("resourceMap");

        // Create a query that searches for any resourceMap with an id matching
        // one of the parents OR an id that matches one of the parents. This
        // will return all members of the parent resource maps AND the parent
        // resource maps themselves
        let rMapQuery = "";
        let idQuery = "";
        if (Array.isArray(rMapIds) && rMapIds.length > 1) {
          _.each(rMapIds, (id, i, ids) => {
            // At the begininng of the list of ids
            if (!rMapQuery.length) {
              rMapQuery += "resourceMap:(";
              idQuery += "id:(";
            }

            // The id
            rMapQuery += `%22${encodeURIComponent(id)}%22`;
            idQuery += `%22${encodeURIComponent(id)}%22`;

            // At the end of the list of ids
            if (i + 1 === ids.length) {
              rMapQuery += ")";
              idQuery += ")";
            }
            // In-between each id
            else {
              rMapQuery += " OR ";
              idQuery += " OR ";
            }
          });
        } else {
          // When there is just one parent, the query is simple
          const rMapId = Array.isArray(rMapIds) ? rMapIds[0] : rMapIds;
          rMapQuery += `resourceMap:%22${encodeURIComponent(rMapId)}%22`;
          idQuery += `id:%22${encodeURIComponent(rMapId)}%22`;
        }
        const query =
          `fl=title,id,obsoletedBy,resourceMap` +
          `&wt=json` +
          `&group=true&group.field=formatType&group.limit=-1` +
          `&q=((formatType:METADATA AND ${rMapQuery}) OR ${idQuery})`;

        const model = this;
        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data) {
            const results = data.grouped.formatType.groups;
            const resourceMapGroup = _.where(results, {
              groupValue: "RESOURCE",
            })[0];
            const rMapList = resourceMapGroup ? resourceMapGroup.doclist : null;
            const rMaps = rMapList ? rMapList.docs : [];
            const resMapIds = _.pluck(rMaps, "id");
            const parents = [];
            const parentIds = [];

            // As long as this map isn't obsoleted by another map in our results
            // list, we will show it
            _.each(rMaps, (map) => {
              if (
                !(map.obsoletedBy && _.contains(resMapIds, map.obsoletedBy))
              ) {
                parents.push(map);
                parentIds.push(map.id);
              }
            });

            const metadataList = _.where(results, {
              groupValue: "METADATA",
            })[0];
            const metadata =
              metadataList && metadataList.doclist
                ? metadataList.doclist.docs
                : [];
            const metadataModels = [];

            // As long as this map isn't obsoleted by another map in our results
            // list, we will show it
            _.each(metadata, (m) => {
              // Find the metadata doc that obsoletes this one
              const isObsoletedBy = _.findWhere(metadata, {
                id: m.obsoletedBy,
              });

              // If one isn't found, then this metadata doc is the most recent
              if (!isObsoletedBy) {
                // If this metadata doc is in one of the filtered parent
                // resource maps
                if (_.intersection(parentIds, m.resourceMap).length) {
                  // Create a SolrResult model and add to an array
                  metadataModels.push(new SolrResult(m));
                }
              }
            });

            model.set("parentPackageMetadata", metadataModels);
            model.trigger("change:parentPackageMetadata");
          },
        };

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      // Create the URL string that is used to download this package
      getURL() {
        let url = null;

        // If we haven't set a packageServiceURL upon app initialization and we
        // are querying a CN, then the packageServiceURL is dependent on the MN
        // this package is from
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

        this.set("url", url);
        return url;
      },

      createNestedPackages() {
        const parentPackage = this;
        const nestedPackages = this.getNestedPackages();
        const numNestedPackages = nestedPackages.length;
        let numComplete = 0;

        _.each(nestedPackages, (nestedPackage) => {
          // Flag the parent model as complete when all the nested package info
          // is ready
          nestedPackage.on("complete", () => {
            numComplete += 1;

            // This is the last package in this package - finish up details and
            // flag as complete
            if (numNestedPackages === numComplete) {
              const sorted = _.sortBy(parentPackage.get("members"), (p) =>
                p.get("id"),
              );
              parentPackage.set("members", sorted);
              parentPackage.flagComplete();
            }
          });

          // Only look one-level deep at all times to avoid going down a rabbit
          // hole
          if (
            nestedPackage.get("parentPackage") &&
            nestedPackage.get("parentPackage").get("parentPackage")
          ) {
            nestedPackage.flagComplete();
          } else {
            // Get the members of this nested package
            nestedPackage.getMembers();
          }
        });
      },

      getNestedPackages() {
        return _.where(this.get("members"), { type: "Package" });
      },

      downloadWithCredentials() {
        // Get info about this object
        const url = this.get("url");
        const model = this;

        // Create an XHR
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        // When the XHR is ready, create a link with the raw data (Blob) and
        // click the link to download
        xhr.onload = function () {
          // Get the file name from the Content-Disposition header
          let filename = xhr.getResponseHeader("Content-Disposition");

          // As a backup, use the system metadata file name or the id
          if (!filename) {
            filename = model.get("filename") || model.get("id");
          }

          // Add a ".zip" extension if it doesn't exist
          if (
            filename.indexOf(".zip") < 0 ||
            filename.indexOf(".zip") !== filename.length - 4
          ) {
            filename += ".zip";
          }

          // For IE, we need to use the navigator API
          if (navigator && navigator.msSaveOrOpenBlob) {
            navigator.msSaveOrOpenBlob(xhr.response, filename);
          } else {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(xhr.response); // xhr.response is a blob
            a.download = filename; // Set the file name.
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            a.remove();
          }

          model.trigger("downloadComplete");

          // Track this event
          MetacatUI.analytics?.trackEvent(
            "download",
            "Download Package",
            model.get("id"),
          );
        };

        xhr.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            model.set("downloadPercent", percent);
          }
        };

        xhr.onerror = (_e) => {
          model.trigger("downloadError");

          // Track this event
          MetacatUI.analytics?.trackEvent(
            "download",
            "Download Package",
            model.get("id"),
          );
        };
        // Open and send the request with the user's auth token
        xhr.open("GET", url);
        xhr.responseType = "blob";
        xhr.setRequestHeader(
          "Authorization",
          `Bearer ${MetacatUI.appUserModel.get("token")}`,
        );
        xhr.send();
      },

      /* Returns the SolrResult that represents the metadata doc */
      getMetadata() {
        const members = this.get("members");
        for (let i = 0; i < members.length; i += 1) {
          if (members[i].get("formatType") === "METADATA") return members[i];
        }

        // If there are no metadata objects in this package, make sure we have
        // searched for them already
        if (!this.complete && !this.pending) this.getMembers();

        return false;
      },

      // Check authority of the Metadata SolrResult model instead
      checkAuthority() {
        // Call the auth service
        const authServiceUrl = MetacatUI.appModel.get("authServiceUrl");
        if (!authServiceUrl) return;

        const model = this;

        const requestSettings = {
          url: `${
            authServiceUrl + encodeURIComponent(this.get("id"))
          }?action=write`,
          type: "GET",
          success() {
            model.set("isAuthorized", true);
            model.trigger("change:isAuthorized");
          },
          error() {
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

      flagComplete() {
        this.complete = true;
        this.pending = false;
        this.trigger("complete", this);
      },

      /*
       * function xmlToJson - A utility function for converting XML to JSON
       *
       * @param xml {DOM Element} - An XML or HTML DOM element to convert to
       * json @returns {object} - A literal JS object that represents the given
       * XML
       */
      toJson(xml) {
        // Create the return object
        let obj = {};

        // do children
        if (xml.hasChildNodes()) {
          for (let i = 0; i < xml.childNodes.length; i += 1) {
            const item = xml.childNodes.item(i);

            // If it's an empty text node, skip it
            if (item.nodeType === 3 && !item.nodeValue.trim()) continue;

            // Get the node name
            const nodeName = item.localName;

            // If it's a new container node, convert it to JSON and add as a new
            // object attribute
            if (!obj[nodeName] && item.nodeType === 1) {
              obj[nodeName] = this.toJson(item);
            }
            // If it's a new text node, just store the text value and add as a
            // new object attribute
            else if (!obj[nodeName] && item.nodeType === 3) {
              obj = item.nodeValue;
            }
            // If this node name is already stored as an object attribute...
            else if (obj[nodeName]) {
              // Cache what we have now
              let old = obj[nodeName];
              if (!Array.isArray(old)) old = [old];

              // Create a new object to store this node info
              let newNode = {};
              let newArray = [];

              // Add the new node info to the existing array we have now
              if (item.nodeType === 1) {
                newNode = this.toJson(item);
                newArray = old.concat(newNode);
              } else if (item.nodeType === 3) {
                newNode = item.nodeValue;
                newArray = old.concat(newNode);
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
       * Calculates and sets the total size of the package in bytes by summing
       * up the sizes of all members.
       * @returns {number} - The total size of the package in bytes.
       */
      getTotalSize() {
        // Return cached totalSize if already calculated
        const cachedTotalSize = this.get("totalSize");
        if (cachedTotalSize || cachedTotalSize === 0) {
          return cachedTotalSize;
        }

        // Ensure members exist and are valid
        const members = this.get("members") || [];
        if (!Array.isArray(members) || members.length === 0) {
          this.set("totalSize", 0);
          return 0;
        }

        // Calculate the total size
        const totalSize = members.reduce((sum, member) => {
          const memberSize = member?.get("size") || 0;
          return sum + memberSize;
        }, 0);

        // Cache the calculated total size
        this.set("totalSize", totalSize);
        return totalSize;
      },
    },
  );
  return PackageModel;
});
