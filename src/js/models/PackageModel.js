define([
  "jquery",
  "underscore",
  "backbone",
  "uuid",
  "md5",
  "rdflib",
  "models/SolrResult",
], ($, _, Backbone, uuid, md5, rdf, SolrResult) => {
  // Package Model
  // ------------------
  var PackageModel = Backbone.Model.extend(
    /** @lends PackageModel.prototype */ {
      // This model contains information about a package/resource map
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
          // If true, when the member objects are retrieved, archived content will be included
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
        dateuploaded: "dateUploaded",
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

      initialize(options) {
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

      /* Retrieve the id of the resource map/package that this id belongs to */
      getMembersByMemberID(id) {
        this.pending = true;

        if (typeof id === "undefined" || !id) var id = this.memberId;

        const model = this;

        // Get the id of the resource map for this member
        const provFlList = `${MetacatUI.appSearchModel.getProvFlList()}prov_instanceOfClass,`;
        const query =
          `fl=resourceMap,fileName,read:read_count_i,obsoletedBy,size,formatType,formatId,id,datasource,title,origin,pubDate,dateUploaded,isPublic,isService,serviceTitle,serviceEndpoint,serviceOutput,serviceDescription,${provFlList}&rows=1` +
          `&q=id:%22${encodeURIComponent(id)}%22` +
          `&wt=json`;

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data, textStatus, xhr) {
            // There should be only one response since we searched by id
            if (typeof data.response.docs !== "undefined") {
              const doc = data.response.docs[0];

              // Is this document a resource map itself?
              if (doc.formatId == "http://www.openarchives.org/ore/terms") {
                model.set("id", doc.id); // this is the package model ID
                model.set("members", new Array()); // Reset the member list
                model.getMembers();
              }
              // If there is no resource map, then this is the only document to in this package
              else if (
                typeof doc.resourceMap === "undefined" ||
                !doc.resourceMap
              ) {
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

      /* Get all the members of a resource map/package based on the id attribute of this model.
       * Create a SolrResult model for each member and save it in the members[] attribute of this model. */
      getMembers(options) {
        this.pending = true;

        const model = this;
        const members = [];
        const pids = []; // Keep track of each object pid

        //* ** Find all the files that are a part of this resource map and the resource map itself
        const provFlList = MetacatUI.appSearchModel.getProvFlList();
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
          success(data, textStatus, xhr) {
            // Separate the resource maps from the data/metadata objects
            _.each(data.response.docs, (doc) => {
              if (doc.id == model.get("id")) {
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

                if (doc.formatType == "RESOURCE") {
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
      fetch(options) {
        if (!options) var options = {};

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
      parse(response, options) {
        // Save the raw XML in case it needs to be used later
        this.set("objectXML", $.parseHTML(response));

        // Define the namespaces
        const RDF = rdf.Namespace(this.namespaces.RDF);
        const FOAF = rdf.Namespace(this.namespaces.FOAF);
        const OWL = rdf.Namespace(this.namespaces.OWL);
        const DC = rdf.Namespace(this.namespaces.DC);
        const ORE = rdf.Namespace(this.namespaces.ORE);
        const DCTERMS = rdf.Namespace(this.namespaces.DCTERMS);
        const CITO = rdf.Namespace(this.namespaces.CITO);

        let memberStatements = [];
        let memberURIParts;
        let memberPIDStr;
        let memberPID;
        let memberModel;
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
          const model = this;

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
                  (m) => m.get("id") == decodeURIComponent(memberPID),
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
              const dataObj = _.find(members, (m) => m.get("id") == dataPid);
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
      save(attrs, options) {
        if (!options) var options = {};

        // Get the system metadata first
        if (!this.get("hasSystemMetadata")) {
          const model = this;
          var requestSettings = {
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

        // Create a new pid if we are updating the object
        if (!options.sysMetaOnly) {
          // Set a new id
          var oldPid = this.get("id");
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

          var requestSettings = {
            url: MetacatUI.appModel.get("metaServiceUrl"),
            type: "PUT",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            success(response) {},
            error(data) {
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

          var requestSettings = {
            url: MetacatUI.appModel.get("objectServiceUrl"),
            type: "PUT",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            success(response) {},
            error(data) {
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
        const prependXML = "";
        const appendXML = "";

        for (let i = 0; i < responseDoc.length; i++) {
          if (
            responseDoc[i].nodeType == 1 &&
            responseDoc[i].localName.indexOf("systemmetadata") > -1
          )
            systemMetadata = responseDoc[i];
        }

        // Parse the XML to JSON
        const sysMetaValues = this.toJson(systemMetadata);
        const camelCasedValues = {};
        // Convert the JSON to a camel-cased version, which matches Solr and is easier to work with in code
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
        // Create an RDF serializer
        var serializer = rdf.Serializer();
        serializer.store = this.dataPackageGraph;

        // Define the namespaces
        const ORE = rdf.Namespace(this.namespaces.ORE);
        const CITO = rdf.Namespace(this.namespaces.CITO);

        // Get the pid of this package - depends on whether we are updating or creating a resource map
        const pid = this.get("id");
        const oldPid = this.get("oldPid");
        const updating = !!oldPid;

        // Update the pids in the RDF graph only if we are updating the resource map with a new pid
        if (updating) {
          // Find the identifier statement in the resource map
          const idNode = rdf.lit(oldPid);
          const idStatement = this.dataPackageGraph.statementsMatching(
            undefined,
            undefined,
            idNode,
          );

          // Get the CN Resolve Service base URL from the resource map (mostly important in dev environments where it will not always be cn.dataone.org)
          const cnResolveUrl = idStatement[0].subject.value.substring(
            0,
            idStatement[0].subject.value.indexOf(oldPid),
          );
          this.dataPackageGraph.cnResolveUrl = cnResolveUrl;

          // Create variations of the resource map ID using the resolve URL so we can always find it in the RDF graph
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

          // Using the isAggregatedBy statements, find all the DataONE object ids in the RDF graph
          const idsFromXML = [];
          _.each(
            aggByStatements,
            (statement) => {
              // Check if the resource map ID is the old existing id, so we don't collect ids that are not about this resource map
              if (
                _.find(
                  oldPidVariations,
                  (oldPidV) =>
                    `${oldPidV}#aggregation` == statement.object.value,
                )
              ) {
                const statementID = statement.subject.value;
                idsFromXML.push(statementID);

                // Add variations of the ID so we make sure we account for all the ways they exist in the RDF XML
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

          // Find the difference between the model IDs and the XML IDs to get a list of added members
          const addedIds = _.without(
            _.difference(idsFromModel, idsFromXML),
            oldPidVariations,
          );
          // Create variations of all these ids too
          const allMemberIds = idsFromModel;
          _.each(idsFromModel, (id) => {
            allMemberIds.push(cnResolveUrl + encodeURIComponent(id));
          });

          // Remove any other isAggregatedBy statements that are not listed as members of this model
          _.each(
            aggByStatements,
            function (statement) {
              if (!_.contains(allMemberIds, statement.subject.value))
                this.removeFromAggregation(statement.subject.value);
              else if (
                _.find(
                  oldPidVariations,
                  (oldPidV) =>
                    `${oldPidV}#aggregation` == statement.object.value,
                )
              )
                statement.object.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
            },
            this,
          );

          // Change all the statements in the RDF where the aggregation is the subject, to reflect the new resource map ID
          const aggregationSubjStatements =
            this.dataPackageGraph.statementsMatching(aggregationNode);
          _.each(aggregationSubjStatements, (statement) => {
            statement.subject.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
          });

          // Change all the statements in the RDF where the aggregation is the object, to reflect the new resource map ID
          const aggregationObjStatements =
            this.dataPackageGraph.statementsMatching(
              undefined,
              undefined,
              aggregationNode,
            );
          _.each(aggregationObjStatements, (statement) => {
            statement.object.value = `${cnResolveUrl + encodeURIComponent(pid)}#aggregation`;
          });

          // Change all the resource map subject nodes in the RDF graph
          const rMapNode = rdf.sym(cnResolveUrl + encodeURIComponent(oldPid));
          const rMapStatements =
            this.dataPackageGraph.statementsMatching(rMapNode);
          _.each(rMapStatements, (statement) => {
            statement.subject.value = cnResolveUrl + encodeURIComponent(pid);
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

          // Change all the resource map identifier literal node in the RDF graph
          if (idStatement[0]) idStatement[0].object.value = pid;
        }

        // Now serialize the RDF XML
        var serializer = rdf.Serializer();
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

        // Now camel case the nodes
        _.each(
          Object.keys(this.sysMetaNodeMap),
          function (name, i, allNodeNames) {
            var regEx = new RegExp(`<${name}`, "g");
            xmlString = xmlString.replace(
              regEx,
              `<${this.sysMetaNodeMap[name]}`,
            );
            var regEx = new RegExp(`${name}>`, "g");
            xmlString = xmlString.replace(
              regEx,
              `${this.sysMetaNodeMap[name]}>`,
            );
          },
          this,
        );

        xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");

        return xmlString;
      },

      // Adds a new object to the resource map RDF graph
      addToAggregation(id) {
        if (id.indexOf(this.dataPackageGraph.cnResolveUrl) < 0)
          var fullID =
            this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
        else {
          var fullID = id;
          id = id.substring(
            this.dataPackageGraph.cnResolveUrl.lastIndexOf("/") + 1,
          );
        }

        // Initialize the namespaces
        const ORE = rdf.Namespace(this.namespaces.ORE);
        const DCTERMS = rdf.Namespace(this.namespaces.DCTERMS);
        const XML = rdf.Namespace(this.namespaces.XML);
        const CITO = rdf.Namespace(this.namespaces.CITO);

        // Create a node for this object, the identifier, the resource map, and the aggregation
        const objectNode = rdf.sym(fullID);
        const mapNode = rdf.sym(
          this.dataPackageGraph.cnResolveUrl +
            encodeURIComponent(this.get("id")),
        );
        const aggNode = rdf.sym(
          `${
            this.dataPackageGraph.cnResolveUrl +
            encodeURIComponent(this.get("id"))
          }#aggregation`,
        );
        const idNode = rdf.literal(id, undefined, XML("string"));

        // Add the statement: this object isAggregatedBy the resource map aggregation
        this.dataPackageGraph.addStatement(
          rdf.st(objectNode, ORE("isAggregatedBy"), aggNode),
        );
        // Add the statement: The resource map aggregation aggregates this object
        this.dataPackageGraph.addStatement(
          rdf.st(aggNode, ORE("aggregates"), objectNode),
        );
        // Add the statement: This object has the identifier {id}
        this.dataPackageGraph.addStatement(
          rdf.st(objectNode, DCTERMS("identifier"), idNode),
        );

        // Find the metadata doc that describes this object
        const model = _.find(this.get("members"), (m) => m.get("id") == id);
        const isDocBy = model.get("isDocumentedBy");

        // If this object is documented by any metadata...
        if (isDocBy) {
          // Get the ids of all the metadata objects in this package
          const metadataInPackage = _.compact(
            _.map(this.get("members"), (m) => {
              if (m.get("formatType") == "METADATA") return m.get("id");
            }),
          );
          // Find the metadata IDs that are in this package that also documents this data object
          const metadataIds = Array.isArray(isDocBy)
            ? _.intersection(metadataInPackage, isDocBy)
            : _.intersection(metadataInPackage, [isDocBy]);

          // For each metadata that documents this object, add a CITO:isDocumentedBy and CITO:documents statement
          _.each(
            metadataIds,
            function (metaId) {
              // Create the named nodes and statements
              const memberNode = rdf.sym(
                this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id),
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
        if (!id.indexOf(this.dataPackageGraph.cnResolveUrl))
          id = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);

        const removedObjNode = rdf.sym(id);
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

        // Create a query that searches for any resourceMap with an id matching one of the parents OR an id that matches one of the parents.
        // This will return all members of the parent resource maps AND the parent resource maps themselves
        let rMapQuery = "";
        let idQuery = "";
        if (Array.isArray(rMapIds) && rMapIds.length > 1) {
          _.each(rMapIds, (id, i, ids) => {
            // At the begininng of the list of ids
            if (rMapQuery.length == 0) {
              rMapQuery += "resourceMap:(";
              idQuery += "id:(";
            }

            // The id
            rMapQuery += `%22${encodeURIComponent(id)}%22`;
            idQuery += `%22${encodeURIComponent(id)}%22`;

            // At the end of the list of ids
            if (i + 1 == ids.length) {
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
          success(data, textStatus, xhr) {
            const results = data.grouped.formatType.groups;
            const resourceMapGroup = _.where(results, {
              groupValue: "RESOURCE",
            })[0];
            const rMapList = resourceMapGroup ? resourceMapGroup.doclist : null;
            const rMaps = rMapList ? rMapList.docs : [];
            const rMapIds = _.pluck(rMaps, "id");
            const parents = [];
            const parentIds = [];

            // As long as this map isn't obsoleted by another map in our results list, we will show it
            _.each(rMaps, (map) => {
              if (!(map.obsoletedBy && _.contains(rMapIds, map.obsoletedBy))) {
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

            // As long as this map isn't obsoleted by another map in our results list, we will show it
            _.each(metadata, (m) => {
              // Find the metadata doc that obsoletes this one
              const isObsoletedBy = _.findWhere(metadata, {
                id: m.obsoletedBy,
              });

              // If one isn't found, then this metadata doc is the most recent
              if (typeof isObsoletedBy === "undefined") {
                // If this metadata doc is in one of the filtered parent resource maps
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

        this.set("url", url);
        return url;
      },

      createNestedPackages() {
        const parentPackage = this;
        const nestedPackages = this.getNestedPackages();
        const numNestedPackages = nestedPackages.length;
        let numComplete = 0;

        _.each(nestedPackages, (nestedPackage, i, nestedPackages) => {
          // Flag the parent model as complete when all the nested package info is ready
          nestedPackage.on("complete", () => {
            numComplete++;

            // This is the last package in this package - finish up details and flag as complete
            if (numNestedPackages == numComplete) {
              const sorted = _.sortBy(parentPackage.get("members"), (p) =>
                p.get("id"),
              );
              parentPackage.set("members", sorted);
              parentPackage.flagComplete();
            }
          });

          // Only look one-level deep at all times to avoid going down a rabbit hole
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

      getMemberNames() {
        const metadata = this.getMetadata();
        if (!metadata) return false;

        // Load the rendered metadata from the view service
        const viewService =
          MetacatUI.appModel.get("viewServiceUrl") +
          encodeURIComponent(metadata.get("id"));
        const requestSettings = {
          url: viewService,
          success(data, response, xhr) {
            if (solrResult.get("formatType") == "METADATA")
              entityName = solrResult.get("title");
            else {
              const container = viewRef.findEntityDetailsContainer(
                solrResult.get("id"),
              );
              if (container && container.length > 0) {
                var entityName = $(container)
                  .find(".entityName")
                  .attr("data-entity-name");
                if (typeof entityName === "undefined" || !entityName) {
                  entityName = $(container)
                    .find(
                      ".control-label:contains('Entity Name') + .controls-well",
                    )
                    .text();
                  if (typeof entityName === "undefined" || !entityName)
                    entityName = null;
                }
              } else entityName = null;
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

      /*
       * Will query for the derivations of this package, and sort all entities in the prov trace
       * into sources and derivations.
       */
      getProvTrace() {
        const model = this;

        // See if there are any prov fields in our index before continuing
        if (!MetacatUI.appSearchModel.getProvFields()) return this;

        // Start keeping track of the sources and derivations
        let sources = new Array();
        let derivations = new Array();

        // Search for derivations of this package
        const derivationsQuery = `${MetacatUI.appSearchModel.getGroupedQuery(
          "prov_wasDerivedFrom",
          _.map(this.get("members"), (m) => m.get("id")),
          "OR",
        )}%20-obsoletedBy:*`;

        const requestSettings = {
          url:
            `${MetacatUI.appModel.get(
              "queryServiceUrl",
            )}&q=${derivationsQuery}&wt=json&rows=1000` +
            `&fl=id,resourceMap,documents,isDocumentedBy,prov_wasDerivedFrom`,
          success(data) {
            _.each(data.response.docs, (result) => {
              derivations.push(result.id);
            });

            // Make arrays of unique IDs of objects that are sources or derivations of this package.
            _.each(model.get("members"), (member, i) => {
              if (member.type == "Package") return;

              if (member.hasProvTrace()) {
                sources = _.union(sources, member.getSources());
                derivations = _.union(derivations, member.getDerivations());
              }
            });

            // Save the arrays of sources and derivations
            model.set("sources", sources);
            model.set("derivations", derivations);

            // Now get metadata about all the entities in the prov trace not in this package
            model.getExternalProvTrace();
          },
        };
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      getExternalProvTrace() {
        const model = this;

        // Compact our list of ids that are in the prov trace by combining the sources and derivations and removing ids of members of this package
        const externalProvEntities = _.difference(
          _.union(this.get("sources"), this.get("derivations")),
          this.get("memberIds"),
        );

        // If there are no sources or derivations, then we do not need to find resource map ids for anything
        if (!externalProvEntities.length) {
          // Save this prov trace on a package-member/document/object level.
          if (this.get("sources").length || this.get("derivations").length)
            this.setMemberProvTrace();

          // Flag that the provenance trace is complete
          this.set("provenanceFlag", "complete");

          return this;
        }
        // Create a query where we retrieve the ID of the resource map of each source and derivation
        const idQuery = MetacatUI.appSearchModel.getGroupedQuery(
          "id",
          externalProvEntities,
          "OR",
        );

        // Create a query where we retrieve the metadata for each source and derivation
        const metadataQuery = MetacatUI.appSearchModel.getGroupedQuery(
          "documents",
          externalProvEntities,
          "OR",
        );

        // TODO: Find the products of programs/executions

        // Make a comma-separated list of the provenance field names
        let provFieldList = "";
        _.each(
          MetacatUI.appSearchModel.getProvFields(),
          (fieldName, i, list) => {
            provFieldList += fieldName;
            if (i < list.length - 1) provFieldList += ",";
          },
        );

        // Combine the two queries with an OR operator
        if (idQuery.length && metadataQuery.length)
          var combinedQuery = `${idQuery}%20OR%20${metadataQuery}`;
        else return this;

        // the full and final query in Solr syntax
        const query = `q=${combinedQuery}&fl=id,resourceMap,documents,isDocumentedBy,formatType,formatId,dateUploaded,rightsHolder,datasource,prov_instanceOfClass,${provFieldList}&rows=100&wt=json`;

        // Send the query to the query service
        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data, textStatus, xhr) {
            // Do any of our docs have multiple resource maps?
            const hasMultipleMaps = _.filter(
              data.response.docs,
              (doc) =>
                typeof doc.resourceMap !== "undefined" &&
                doc.resourceMap.length > 1,
            );
            // If so, we want to find the latest version of each resource map and only represent that one in the Prov Chart
            if (typeof hasMultipleMaps !== "undefined") {
              const allMapIDs = _.uniq(
                _.flatten(_.pluck(hasMultipleMaps, "resourceMap")),
              );
              if (allMapIDs.length) {
                const query =
                  `q=+-obsoletedBy:*+${MetacatUI.appSearchModel.getGroupedQuery(
                    "id",
                    allMapIDs,
                    "OR",
                  )}&fl=obsoletes,id` + `&wt=json`;
                const requestSettings = {
                  url: MetacatUI.appModel.get("queryServiceUrl") + query,
                  success(mapData, textStatus, xhr) {
                    // Create a list of resource maps that are not obsoleted by any other resource map retrieved
                    const resourceMaps = mapData.response.docs;

                    model.obsoletedResourceMaps = _.pluck(
                      resourceMaps,
                      "obsoletes",
                    );
                    model.latestResourceMaps = _.difference(
                      resourceMaps,
                      model.obsoletedResourceMaps,
                    );

                    model.sortProvTrace(data.response.docs);
                  },
                };
                $.ajax(
                  _.extend(
                    requestSettings,
                    MetacatUI.appUserModel.createAjaxSettings(),
                  ),
                );
              } else model.sortProvTrace(data.response.docs);
            } else model.sortProvTrace(data.response.docs);
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

      sortProvTrace(docs) {
        const model = this;

        // Start an array to hold the packages in the prov trace
        const sourcePackages = new Array();
        const derPackages = new Array();
        const sourceDocs = new Array();
        const derDocs = new Array();
        const sourceIDs = this.get("sources");
        const derivationIDs = this.get("derivations");

        // Separate the results into derivations and sources and group by their resource map.
        _.each(docs, (doc, i) => {
          const docModel = new SolrResult(doc);
          const mapIds = docModel.get("resourceMap");

          if (
            (typeof mapIds === "undefined" || !mapIds) &&
            docModel.get("formatType") == "DATA" &&
            (typeof docModel.get("isDocumentedBy") === "undefined" ||
              !docModel.get("isDocumentedBy"))
          ) {
            // If this object is not in a resource map and does not have metadata, it is a "naked" data doc, so save it by itself
            if (_.contains(sourceIDs, doc.id)) sourceDocs.push(docModel);
            if (_.contains(derivationIDs, doc.id)) derDocs.push(docModel);
          } else if (
            (typeof mapIds === "undefined" || !mapIds) &&
            docModel.get("formatType") == "DATA" &&
            docModel.get("isDocumentedBy")
          ) {
            // If this data doc does not have a resource map but has a metadata doc that documents it, create a blank package model and save it
            const p = new PackageModel({
              members: new Array(docModel),
            });
            // Add this package model to the sources and/or derivations packages list
            if (_.contains(sourceIDs, docModel.get("id")))
              sourcePackages[docModel.get("id")] = p;
            if (_.contains(derivationIDs, docModel.get("id")))
              derPackages[docModel.get("id")] = p;
          } else if (mapIds.length) {
            // If this doc has a resource map, create a package model and SolrResult model and store it
            const id = docModel.get("id");

            // Some of these objects may have multiple resource maps
            _.each(mapIds, (mapId, i, list) => {
              if (!_.contains(model.obsoletedResourceMaps, mapId)) {
                let documentsSource;
                let documentsDerivation;
                if (docModel.get("formatType") == "METADATA") {
                  if (
                    _.intersection(docModel.get("documents"), sourceIDs).length
                  )
                    documentsSource = true;
                  if (
                    _.intersection(docModel.get("documents"), derivationIDs)
                      .length
                  )
                    documentsDerivation = true;
                }

                // Is this a source object or a metadata doc of a source object?
                if (_.contains(sourceIDs, id) || documentsSource) {
                  // Have we encountered this source package yet?
                  if (!sourcePackages[mapId] && mapId != model.get("id")) {
                    // Now make a new package model for it
                    var p = new PackageModel({
                      id: mapId,
                      members: new Array(docModel),
                    });
                    // Add to the array of source packages
                    sourcePackages[mapId] = p;
                  }
                  // If so, add this member to its package model
                  else if (mapId != model.get("id")) {
                    var memberList = sourcePackages[mapId].get("members");
                    memberList.push(docModel);
                    sourcePackages[mapId].set("members", memberList);
                  }
                }

                // Is this a derivation object or a metadata doc of a derivation object?
                if (_.contains(derivationIDs, id) || documentsDerivation) {
                  // Have we encountered this derivation package yet?
                  if (!derPackages[mapId] && mapId != model.get("id")) {
                    // Now make a new package model for it
                    var p = new PackageModel({
                      id: mapId,
                      members: new Array(docModel),
                    });
                    // Add to the array of source packages
                    derPackages[mapId] = p;
                  }
                  // If so, add this member to its package model
                  else if (mapId != model.get("id")) {
                    var memberList = derPackages[mapId].get("members");
                    memberList.push(docModel);
                    derPackages[mapId].set("members", memberList);
                  }
                }
              }
            });
          }
        });

        // Transform our associative array (Object) of packages into an array
        const newArrays = new Array();
        _.each(
          new Array(sourcePackages, derPackages, sourceDocs, derDocs),
          (provObject) => {
            const newArray = new Array();
            let key;
            for (key in provObject) {
              newArray.push(provObject[key]);
            }
            newArrays.push(newArray);
          },
        );

        // We now have an array of source packages and an array of derivation packages.
        model.set("sourcePackages", newArrays[0]);
        model.set("derivationPackages", newArrays[1]);
        model.set("sourceDocs", newArrays[2]);
        model.set("derivationDocs", newArrays[3]);

        // Save this prov trace on a package-member/document/object level.
        model.setMemberProvTrace();

        // Flag that the provenance trace is complete
        model.set("provenanceFlag", "complete");
      },

      setMemberProvTrace() {
        const model = this;
        const relatedModels = this.get("relatedModels");
        const relatedModelIDs = new Array();

        // Now for each doc, we want to find which member it is related to
        _.each(this.get("members"), (member, i, members) => {
          if (member.type == "Package") return;

          // Get the sources and derivations of this member
          const memberSourceIDs = member.getSources();
          const memberDerIDs = member.getDerivations();

          // Look through each source package, derivation package, source doc, and derivation doc.
          _.each(model.get("sourcePackages"), (pkg, i) => {
            _.each(pkg.get("members"), (sourcePkgMember, i) => {
              // Is this package member a direct source of this package member?
              if (_.contains(memberSourceIDs, sourcePkgMember.get("id")))
                // Save this source package member as a source of this member
                member.set(
                  "provSources",
                  _.union(member.get("provSources"), [sourcePkgMember]),
                );

              // Save this in the list of related models
              if (!_.contains(relatedModelIDs, sourcePkgMember.get("id"))) {
                relatedModels.push(sourcePkgMember);
                relatedModelIDs.push(sourcePkgMember.get("id"));
              }
            });
          });
          _.each(model.get("derivationPackages"), (pkg, i) => {
            _.each(pkg.get("members"), (derPkgMember, i) => {
              // Is this package member a direct source of this package member?
              if (_.contains(memberDerIDs, derPkgMember.get("id")))
                // Save this derivation package member as a derivation of this member
                member.set(
                  "provDerivations",
                  _.union(member.get("provDerivations"), [derPkgMember]),
                );

              // Save this in the list of related models
              if (!_.contains(relatedModelIDs, derPkgMember.get("id"))) {
                relatedModels.push(derPkgMember);
                relatedModelIDs.push(derPkgMember.get("id"));
              }
            });
          });
          _.each(model.get("sourceDocs"), (doc, i) => {
            // Is this package member a direct source of this package member?
            if (_.contains(memberSourceIDs, doc.get("id")))
              // Save this source package member as a source of this member
              member.set(
                "provSources",
                _.union(member.get("provSources"), [doc]),
              );

            // Save this in the list of related models
            if (!_.contains(relatedModelIDs, doc.get("id"))) {
              relatedModels.push(doc);
              relatedModelIDs.push(doc.get("id"));
            }
          });
          _.each(model.get("derivationDocs"), (doc, i) => {
            // Is this package member a direct derivation of this package member?
            if (_.contains(memberDerIDs, doc.get("id")))
              // Save this derivation package member as a derivation of this member
              member.set(
                "provDerivations",
                _.union(member.get("provDerivations"), [doc]),
              );

            // Save this in the list of related models
            if (!_.contains(relatedModelIDs, doc.get("id"))) {
              relatedModels.push(doc);
              relatedModelIDs.push(doc.get("id"));
            }
          });
          _.each(members, (otherMember, i) => {
            // Is this other package member a direct derivation of this package member?
            if (_.contains(memberDerIDs, otherMember.get("id")))
              // Save this other derivation package member as a derivation of this member
              member.set(
                "provDerivations",
                _.union(member.get("provDerivations"), [otherMember]),
              );
            // Is this other package member a direct source of this package member?
            if (_.contains(memberSourceIDs, otherMember.get("id")))
              // Save this other source package member as a source of this member
              member.set(
                "provSources",
                _.union(member.get("provSources"), [otherMember]),
              );

            // Is this other package member an indirect source or derivation?
            if (
              otherMember.get("type") == "program" &&
              _.contains(
                member.get("prov_generatedByProgram"),
                otherMember.get("id"),
              )
            ) {
              const indirectSources = _.filter(members, (m) =>
                _.contains(otherMember.getInputs(), m.get("id")),
              );
              indirectSourcesIds = _.each(indirectSources, (m) => m.get("id"));
              member.set(
                "prov_wasDerivedFrom",
                _.union(member.get("prov_wasDerivedFrom"), indirectSourcesIds),
              );
              // otherMember.set("prov_hasDerivations", _.union(otherMember.get("prov_hasDerivations"), [member.get("id")]));
              member.set(
                "provSources",
                _.union(member.get("provSources"), indirectSources),
              );
            }
            if (
              otherMember.get("type") == "program" &&
              _.contains(
                member.get("prov_usedByProgram"),
                otherMember.get("id"),
              )
            ) {
              const indirectDerivations = _.filter(members, (m) =>
                _.contains(otherMember.getOutputs(), m.get("id")),
              );
              indirectDerivationsIds = _.each(indirectDerivations, (m) =>
                m.get("id"),
              );
              member.set(
                "prov_hasDerivations",
                _.union(
                  member.get("prov_hasDerivations"),
                  indirectDerivationsIds,
                ),
              );
              // otherMember.set("prov_wasDerivedFrom", _.union(otherMember.get("prov_wasDerivedFrom"), [member.get("id")]));
              member.set(
                "provDerivations",
                _.union(member.get("provDerivations"), indirectDerivationsIds),
              );
            }
          });

          // Add this member to the list of related models
          if (!_.contains(relatedModelIDs, member.get("id"))) {
            relatedModels.push(member);
            relatedModelIDs.push(member.get("id"));
          }

          // Clear out any duplicates
          member.set("provSources", _.uniq(member.get("provSources")));
          member.set("provDerivations", _.uniq(member.get("provDerivations")));
        });

        // Update the list of related models
        this.set("relatedModels", relatedModels);
      },

      downloadWithCredentials() {
        // Get info about this object
        const url = this.get("url");
        const model = this;

        // Create an XHR
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        // When the XHR is ready, create a link with the raw data (Blob) and click the link to download
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
            filename.indexOf(".zip") != filename.length - 4
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

        xhr.onprogress = function (e) {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            model.set("downloadPercent", percent);
          }
        };

        xhr.onerror = function (e) {
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
        for (let i = 0; i < members.length; i++) {
          if (members[i].get("formatType") == "METADATA") return members[i];
        }

        // If there are no metadata objects in this package, make sure we have searched for them already
        if (!this.complete && !this.pending) this.getMembers();

        return false;
      },

      // Check authority of the Metadata SolrResult model instead
      checkAuthority() {
        // Call the auth service
        const authServiceUrl = MetacatUI.appModel.get("authServiceUrl");
        if (!authServiceUrl) return false;

        const model = this;

        const requestSettings = {
          url: `${
            authServiceUrl + encodeURIComponent(this.get("id"))
          }?action=write`,
          type: "GET",
          success(data, textStatus, xhr) {
            model.set("isAuthorized", true);
            model.trigger("change:isAuthorized");
          },
          error(xhr, textStatus, errorThrown) {
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
       * @param xml {DOM Element} - An XML or HTML DOM element to convert to json
       * @returns {object} - A literal JS object that represents the given XML
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
              obj = item.nodeValue;
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

      // Sums up the byte size of each member
      getTotalSize() {
        if (this.get("totalSize")) return this.get("totalSize");

        if (this.get("members").length == 1) {
          var totalSize = this.get("members")[0].get("size");
        } else {
          var totalSize = _.reduce(this.get("members"), (sum, member) => {
            if (typeof sum === "object") sum = sum.get("size");

            return sum + member.get("size");
          });
        }

        this.set("totalSize", totalSize);
        return totalSize;
      },
    },
  );
  return PackageModel;
});
