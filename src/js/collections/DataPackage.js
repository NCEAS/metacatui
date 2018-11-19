/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone', 'rdflib', "uuid", "md5",
        'models/DataONEObject', 'models/metadata/ScienceMetadata', 'models/metadata/eml211/EML211'],
    function($, _, Backbone, rdf, uuid, md5, DataONEObject, ScienceMetadata, EML211) {

      /*
       A DataPackage represents a hierarchical collection of
       packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
       TODO: incorporate Backbone.UniqueModel
      */
      var DataPackage = Backbone.Collection.extend({

        //The name of this type of collection
        type: "DataPackage",

        // The package identifier
        id: null,

        // The type of the object (DataPackage, Metadata, Data)
        // Simple queue to enqueue file transfers. Use push() and shift()
        // to add and remove items. If this gets to large/slow, possibly
        // switch to http://code.stephenmorley.org/javascript/queues/
        transferQueue: [],

        // A flag ued for the package's edit status. Can be
        // set to false to 'lock' the package
        editable: true,

        // The RDF graph representing this data package
        dataPackageGraph: null,

        //A DataONEObject representing the resource map itself
        packageModel: null,

        // The science data identifiers associated with this
        // data package (from cito:documents), mapped to the science metadata
        // identifier that documents it
        // Not to be changed after initial fetch - this is to keep track of the relationships in their original state
        originalIsDocBy: {},

        // An array of ids that are aggregated in the resource map on the server.
        // Taken from the original RDF XML that was fetched from the server.
        // Used for comparing the original aggregation with the aggregation of this collection.
        originalMembers: [],

        // Keep the collection sorted by model "sortOrder".  The three model types
        // are ordered as:
        //  Metadata: 1
        //  Data: 2
        //  DataPackage: 3
        // See getMember(). We do this so that Metadata get rendered first, and Data are
        // rendered as DOM siblings of the Metadata rows of the DataPackage table.
        comparator: "sortOrder",

        // The nesting level in a data package hierarchy
        nodeLevel: 0,

        //Define the namespaces used in the RDF XML
        namespaces: {
          RDF:     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          FOAF:    "http://xmlns.com/foaf/0.1/",
          OWL:     "http://www.w3.org/2002/07/owl#",
          DC:      "http://purl.org/dc/elements/1.1/",
          ORE:     "http://www.openarchives.org/ore/terms/",
          DCTERMS: "http://purl.org/dc/terms/",
          CITO:    "http://purl.org/spar/cito/",
          XSD:     "http://www.w3.org/2001/XMLSchema#",
          PROV:    "http://www.w3.org/ns/prov#",
          PROVONE: "http://purl.dataone.org/provone/2015/01/15/ontology#"
        },

        sources: [],
        derivations: [],
        provenanceFlag: null,
        sourcePackages: [],
        derivationPackages: [],
        relatedModels: [],
        provEdits: [],    // Contains provenance relationships added or deleted to this DataONEObject.
        // Each entry is [<operation ('add' or 'delete'), <prov field name>, <object id>], i.e. ['add', 'prov_used', 'urn:uuid:5678']

        // Constructor: Initialize a new DataPackage
        initialize: function(models, options) {
            if(typeof options == "undefined")
              var options = {};

            // Create an rdflib reference
            this.rdf = rdf;

            // Create an initial RDF graph
            this.dataPackageGraph = this.rdf.graph();

            //Set the id or create a new one
            this.id = options.id || "urn:uuid:" + uuid.v4();

            // Create a DataONEObject to represent this resource map
            this.packageModel = new DataONEObject({
                formatType: "RESOURCE",
                type: "DataPackage",
                formatId: "http://www.openarchives.org/ore/terms",
                childPackages: {},
                id: this.id,
                latestVersion: this.id
            });

            if ( typeof options.packageModel !== "undefined" ) {
                // use the given package model
              this.packageModel = new DataONEObject(options.packageModel);

            }
            this.id = this.packageModel.id;

            this.on("add", this.handleAdd);
            this.on("add", this.triggerComplete);
            this.on("successSaving", this.updateRelationships);

            return this;
          },

          // Build the DataPackage URL based on the MetacatUI.appModel.objectServiceUrl
          // and id or seriesid
          url: function(options) {

            if(options && options.update){
              return MetacatUI.appModel.get("objectServiceUrl") +
                  (encodeURIComponent(this.packageModel.get("oldPid")) || encodeURIComponent(this.packageModel.get("seriesid")));
            }
            else{
              //URL encode the id or seriesId
              var encodedId = encodeURIComponent(this.packageModel.get("id")) || encodeURIComponent(this.packageModel.get("seriesid"));
                //Use the object service URL if it is available (when pointing to a MN)
                if(MetacatUI.appModel.get("objectServiceUrl")){
                  return MetacatUI.appModel.get("objectServiceUrl") + encodedId;
                }
                //Otherwise, use the resolve service URL (when pointing to a CN)
                else{
                  return MetacatUI.appModel.get("resolveServiceUrl") + encodedId;
                }
            }
          },

          /*
           * The DataPackage collection stores DataPackages and
           * DataONEObjects, including Metadata nad Data objects.
           * Return the correct model based on the type
           */
          model: function (attrs, options) {

            switch ( attrs.formatid ) {

                case "http://www.openarchives.org/ore/terms":
                    return new DataPackage(null, {packageModel: attrs}); // TODO: is this correct?

                case "eml://ecoinformatics.org/eml-2.0.0":
                    return new EML211(attrs, options);

                case "eml://ecoinformatics.org/eml-2.0.1":
                    return new EML211(attrs, options);

                case "eml://ecoinformatics.org/eml-2.1.0":
                    return new EML211(attrs, options);

                case "eml://ecoinformatics.org/eml-2.1.1":
                    return new EML211(attrs, options);

                case "eml://ecoinformatics.org/eml-2.1.1":
                    return new EML211(attrs, options);

                case "-//ecoinformatics.org//eml-access-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-access-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-entity-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-entity-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-literature-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-literature-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-party-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-party-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-physical-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-physical-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-project-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-project-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-resource-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-resource-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-software-2.0.0beta4//EN":
                    return new ScienceMetadata(attrs, options);

                case "-//ecoinformatics.org//eml-software-2.0.0beta6//EN":
                    return new ScienceMetadata(attrs, options);

                case "FGDC-STD-001-1998":
                    return new ScienceMetadata(attrs, options);

                case "FGDC-STD-001.1-1999":
                    return new ScienceMetadata(attrs, options);

                case "FGDC-STD-001.2-1999":
                    return new ScienceMetadata(attrs, options);

                case "INCITS-453-2009":
                    return new ScienceMetadata(attrs, options);

                case "ddi:codebook:2_5":
                    return new ScienceMetadata(attrs, options);

                case "http://datacite.org/schema/kernel-3.0":
                    return new ScienceMetadata(attrs, options);

                case "http://datacite.org/schema/kernel-3.1":
                    return new ScienceMetadata(attrs, options);

                case "http://datadryad.org/profile/v3.1":
                    return new ScienceMetadata(attrs, options);

                case "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd":
                    return new ScienceMetadata(attrs, options);

                case "http://ns.dataone.org/metadata/schema/onedcx/v1.0":
                    return new ScienceMetadata(attrs, options);

                case "http://purl.org/dryad/terms/":
                    return new ScienceMetadata(attrs, options);

                case "http://purl.org/ornl/schema/mercury/terms/v1.0":
                    return new ScienceMetadata(attrs, options);

                case "http://rs.tdwg.org/dwc/xsd/simpledarwincore/":
                    return new ScienceMetadata(attrs, options);

                case "http://www.cuahsi.org/waterML/1.0/":
                    return new ScienceMetadata(attrs, options);

                case "http://www.cuahsi.org/waterML/1.1/":
                    return new ScienceMetadata(attrs, options);

                case "http://www.esri.com/metadata/esriprof80.dtd":
                    return new ScienceMetadata(attrs, options);

                case "http://www.icpsr.umich.edu/DDI":
                    return new ScienceMetadata(attrs, options);

                case "http://www.isotc211.org/2005/gmd":
                    return new ScienceMetadata(attrs, options);

                case "http://www.isotc211.org/2005/gmd-noaa":
                    return new ScienceMetadata(attrs, options);

                case "http://www.loc.gov/METS/":
                    return new ScienceMetadata(attrs, options);

                case "http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2":
                    return new ScienceMetadata(attrs, options);

                default:
                    return new DataONEObject(attrs, options);

              }
          },

          /*
           *  Overload fetch calls for a DataPackage
           */
          fetch: function(options) {

              //Fetch the system metadata for this resource map
              this.packageModel.fetch();

              //Set some custom fetch options
              var fetchOptions = _.extend({dataType: "text"}, options);

              //Add the authorization options
              fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

              //Fetch the resource map RDF XML
              return Backbone.Collection.prototype.fetch.call(this, fetchOptions);
          },

          /*
           * Deserialize a Package from OAI-ORE RDF XML
           */
          parse: function(response, options) {

              //Save the raw XML in case it needs to be used later
              this.objectXML = response;

              var RDF =     this.rdf.Namespace(this.namespaces.RDF),
                  FOAF =    this.rdf.Namespace(this.namespaces.FOAF),
                  OWL =     this.rdf.Namespace(this.namespaces.OWL),
                  DC =      this.rdf.Namespace(this.namespaces.DC),
                  ORE =     this.rdf.Namespace(this.namespaces.ORE),
                  DCTERMS = this.rdf.Namespace(this.namespaces.DCTERMS),
                  CITO =    this.rdf.Namespace(this.namespaces.CITO),
                  XSD =     this.rdf.Namespace(this.namespaces.XSD);

              var memberStatements = [],
                  memberURIParts,
                  memberPIDStr,
                  memberPID,
                  memberPIDs = [],
                  memberModel,
                  documentsStatements,
                  scimetaID, // documentor
                  scidataID, // documentee
                  models = []; // the models returned by parse()

              try {

                //First, make sure we are only using one CN Base URL in the RDF or the RDF parsing will fail.
                var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';
                response = response.replace(/cn-\S+.test.dataone.org\/cn\/v\d\/resolve/g, "cn.dataone.org/cn/v2/resolve");

                this.rdf.parse(response, this.dataPackageGraph, this.url(), 'application/rdf+xml');

                // List the package members
                memberStatements = this.dataPackageGraph.statementsMatching(
                      undefined, ORE("aggregates"), undefined, undefined);

                // Get system metadata for each member to eval the formatId
                _.each(memberStatements, function(memberStatement){
                    memberURIParts = memberStatement.object.value.split("/");
                    memberPIDStr = _.last(memberURIParts);
                    memberPID = decodeURIComponent(memberPIDStr);

                    if ( memberPID )
                        memberPIDs.push(memberPID);

                    //TODO: Test passing merge:true when adding a model and this if statement may not be necessary
                    //Create a DataONEObject model to represent this collection member and add to the collection
                    if(!_.contains(this.pluck("id"), memberPID)){

                       memberModel = this.add(new DataONEObject({
                        id: memberPID,
                        resourceMap: [this.packageModel.get("id")],
                        collections: [this]
                      }), { silent: true });

                    }
                    //If the model already exists, add this resource map ID to it's list of resource maps
                    else{
                      memberModel = this.get(memberPID);
                      var rMaps = memberModel.get("resourceMap");
                      if(rMaps && Array.isArray(rMaps) && !_.contains(rMaps, this.packageModel.get("id"))) rMaps.push(this.packageModel.get("id"));
                      else if(rMaps && !Array.isArray(rMaps)) rMaps = [rMaps, this.packageModel.get("id")];
                      else rMaps = [this.packageModel.get("id")];
                    }

                }, this);

                //Save the list of original ids
                this.originalMembers = memberPIDs;

                // Get the isDocumentedBy relationships
                documentsStatements = this.dataPackageGraph.statementsMatching(
                    undefined, CITO("documents"), undefined, undefined);

                var sciMetaPids = [];

                _.each(documentsStatements, function(documentsStatement) {

                  // Extract and URI-decode the metadata pid
                  scimetaID = decodeURIComponent(
                        _.last(documentsStatement.subject.value.split("/")));

                  sciMetaPids.push(scimetaID);

                  // Extract and URI-decode the data pid
                  scidataID = decodeURIComponent(
                      _.last(documentsStatement.object.value.split("/")));

                  // Store the isDocumentedBy relationship
                  if(typeof this.originalIsDocBy[scidataID] == "undefined")
                       this.originalIsDocBy[scidataID] = [scimetaID];
                  else if(Array.isArray(this.originalIsDocBy[scidataID]) && !_.contains(this.originalIsDocBy[scidataID], scimetaID))
                    this.originalIsDocBy[scidataID].push(scimetaID);
                  else
                    this.originalIsDocBy[scidataID] = _.uniq([this.originalIsDocBy[scidataID], scimetaID]);

                  //Find the model in this collection for this data object
                  var dataObj = this.get(scidataID);

                  if(dataObj){
                    //Get the isDocumentedBy field
                     var isDocBy = dataObj.get("isDocumentedBy");
                    if(isDocBy && Array.isArray(isDocBy) && !_.contains(isDocBy, scimetaID)) isDocBy.push(scimetaID);
                    else if(isDocBy && !Array.isArray(isDocBy)) isDocBy = [isDocBy, scimetaID];
                    else isDocBy = [scimetaID];

                    //Set the isDocumentedBy field
                    dataObj.set("isDocumentedBy", isDocBy);
                  }
                }, this);

                //Save the list of science metadata pids
                this.sciMetaPids = sciMetaPids;

                //Put the science metadata pids first
                memberPIDs = _.difference(memberPIDs, sciMetaPids);
                _.each(_.uniq(sciMetaPids), function(id){ memberPIDs.unshift(id); });

                //Retrieve the model for each member
                _.each(memberPIDs, function(pid){

                  memberModel = this.get(pid);

                  var collection = this;

                  memberModel.fetch();
                  memberModel.once("sync",
                    function(oldModel){

                      //Get the right model type based on the model values
                      var newModel = collection.getMember(oldModel);

                      //If the model type has changed, then mark the model as unsynced, since there may be custom fetch() options for the new model
                      if(oldModel.type != newModel.type){

                        // DataPackages shouldn't be fetched until we support nested packages better in the UI
                        if(newModel.type == "DataPackage"){
                          //Trigger a replace event so other parts of the app know when a model has been replaced with a different type
                          oldModel.trigger("replace", newModel);
                        }
                        else{
                          newModel.set("synced", false);

                          newModel.fetch();
                          newModel.once("sync", function(fetchedModel){
                              fetchedModel.set("synced", true);
                              collection.add(fetchedModel, { merge: true });

                              //Trigger a replace event so other parts of the app know when a model has been replaced with a different type
                              oldModel.trigger("replace", newModel);

                              if(newModel.type == "EML")
                                collection.trigger("add:EML");
                            });
                        }
                      }
                      else{
                        newModel.set("synced", true);
                        collection.add(newModel, { replace: true });

                        if(newModel.type == "EML")
                      collection.trigger("add:EML");
                      }
                    });

                  }, this);

              } catch (error) {
                   console.log(error);
              }

              return models;
          },

          /* Parse the provenance relationships from the RDF graph, after all DataPackage members
           have been fetched, as the prov info will be stored in them.
           */
          parseProv: function() {

            try {
              /* Now run the SPARQL queries for the provenance relationships */
              var provQueries = [];
              /* result: pidValue, wasDerivedFromValue (prov_wasDerivedFrom) */
              provQueries["prov_wasDerivedFrom"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_wasDerivedFrom \n"+
                "WHERE { \n"+
                    "?derived_data       prov:wasDerivedFrom ?primary_data . \n"+
                    "?derived_data       dcterms:identifier  ?pid . \n"+
                    "?primary_data       dcterms:identifier  ?prov_wasDerivedFrom . \n"+
                    "} \n"+
                 "]]>";

              /* result: pidValue, generatedValue (prov_generated) */
              provQueries["prov_generated"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_generated \n"+
                "WHERE { \n"+
                    "?result         prov:wasGeneratedBy       ?activity . \n"+
                    "?activity       prov:qualifiedAssociation ?association . \n"+
                    "?association    prov:hadPlan              ?program . \n"+
                    "?result         dcterms:identifier        ?prov_generated . \n"+
                    "?program        dcterms:identifier        ?pid . \n"+
                    "} \n"+
                 "]]>";

              /* result: pidValue, wasInformedByValue (prov_wasInformedBy) */
              provQueries["prov_wasInformedBy"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_wasInformedBy \n"+
                "WHERE { \n"+
                    "?activity               prov:wasInformedBy  ?previousActivity . \n"+
                    "?activity               dcterms:identifier  ?pid . \n"+
                    "?previousActivity       dcterms:identifier  ?prov_wasInformedBy . \n"+
                    "} \n"+
                 "]]> \n"

              /* result: pidValue, usedValue (prov_used) */
              provQueries["prov_used"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_used \n"+
                "WHERE { \n"+
                    "?activity       prov:used                 ?data . \n"+
                    "?activity       prov:qualifiedAssociation ?association . \n"+
                    "?association    prov:hadPlan              ?program . \n"+
                    "?program        dcterms:identifier        ?pid . \n"+
                    "?data           dcterms:identifier        ?prov_used . \n"+
                    "} \n"+
                 "]]> \n"

                /* result: pidValue, programPidValue (prov_generatesByProgram) */
                provQueries["prov_generatedByProgram"] = "<![CDATA[ \n"+
                  "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                  "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                  "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                  "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                  "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                  "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                  "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                  "SELECT ?pid ?prov_generatedByProgram \n"+
                  "WHERE { \n"+
                      "?derived_data prov:wasGeneratedBy ?execution . \n"+
                      "?execution prov:qualifiedAssociation ?association . \n"+
                      "?association prov:hadPlan ?program . \n"+
                      "?program dcterms:identifier ?prov_generatedByProgram . \n"+
                      "?derived_data dcterms:identifier ?pid . \n"+
                  "} \n"+
                "]]> \n"

              /* result: pidValue, executionPidValue */
              provQueries["prov_generatedByExecution"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_generatedByExecution \n"+
                "WHERE { \n"+
                    "?derived_data prov:wasGeneratedBy ?execution . \n"+
                    "?execution dcterms:identifier ?prov_generatedByExecution . \n"+
                    "?derived_data dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              /* result: pidValue, pid (prov_generatedByProgram) */
              provQueries["prov_generatedByUser"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_generatedByUser \n"+
                "WHERE { \n"+
                    "?derived_data prov:wasGeneratedBy ?execution . \n"+
                    "?execution prov:qualifiedAssociation ?association . \n"+
                    "?association prov:agent ?prov_generatedByUser . \n"+
                    "?derived_data dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, programPidValue (prov_usedByProgram) */
              provQueries["prov_usedByProgram"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_usedByProgram \n"+
                "WHERE { \n"+
                    "?execution prov:used ?primary_data . \n"+
                    "?execution prov:qualifiedAssociation ?association . \n"+
                    "?association prov:hadPlan ?program . \n"+
                    "?program dcterms:identifier ?prov_usedByProgram . \n"+
                    "?primary_data dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, executionIdValue (prov_usedByExecution) */
              provQueries["prov_usedByExecution"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_usedByExecution \n"+
                "WHERE { \n"+
                    "?execution prov:used ?primary_data . \n"+
                    "?primary_data dcterms:identifier ?pid . \n"+
                    "?execution dcterms:identifier ?prov_usedByExecution . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, pid (prov_usedByUser) */
              provQueries["prov_usedByUser"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_usedByUser \n"+
                "WHERE { \n"+
                    "?execution prov:used ?primary_data . \n"+
                    "?execution prov:qualifiedAssociation ?association . \n"+
                    "?association prov:agent ?prov_usedByUser . \n"+
                    "?primary_data dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"
              /* results: pidValue, executionIdValue (prov_wasExecutedByExecution) */
              provQueries["prov_wasExecutedByExecution"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_wasExecutedByExecution \n"+
                "WHERE { \n"+
                    "?execution prov:qualifiedAssociation ?association . \n"+
                    "?association prov:hadPlan ?program . \n"+
                    "?execution dcterms:identifier ?prov_wasExecutedByExecution . \n"+
                    "?program dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, pid (prov_wasExecutedByUser) */
              provQueries["prov_wasExecutedByUser"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_wasExecutedByUser \n"+
                "WHERE { \n"+
                    "?execution prov:qualifiedAssociation ?association . \n"+
                    "?association prov:hadPlan ?program . \n"+
                    "?association prov:agent ?prov_wasExecutedByUser . \n"+
                    "?program dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, derivedDataPidValue (prov_hasDerivations) */
              provQueries["prov_hasDerivations"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "PREFIX cito:    <http://purl.org/spar/cito/> \n"+
                "SELECT ?pid ?prov_hasDerivations \n"+
                "WHERE { \n"+
                    "?derived_data prov:wasDerivedFrom ?source_data . \n"+
                    "?source_data dcterms:identifier ?pid . \n"+
                    "?derived_data dcterms:identifier ?prov_hasDerivations . \n"+
                "} \n"+
              "]]> \n"

              /* results: pidValue, pid (prov_instanceOfClass) */
              provQueries["prov_instanceOfClass"] = "<![CDATA[ \n"+
                "PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n"+
                "PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#> \n"+
                "PREFIX owl:     <http://www.w3.org/2002/07/owl#> \n"+
                "PREFIX prov:    <http://www.w3.org/ns/prov#> \n"+
                "PREFIX provone: <http://purl.dataone.org/provone/2015/01/15/ontology#> \n"+
                "PREFIX ore:     <http://www.openarchives.org/ore/terms/> \n"+
                "PREFIX dcterms: <http://purl.org/dc/terms/> \n"+
                "SELECT ?pid ?prov_instanceOfClass \n"+
                "WHERE { \n"+
                    "?subject rdf:type ?prov_instanceOfClass . \n"+
                    "?subject dcterms:identifier ?pid . \n"+
                "} \n"+
              "]]> \n"

              // These are the provenance fields that are currently searched for in the provenance queries, but
              // not all of these fields are displayed by any view.
              // Note: this list is different than the prov list returned by MetacatUI.appSearchModel.getProvFields()
              this.provFields = ["prov_wasDerivedFrom", "prov_generated", "prov_wasInformedBy", "prov_used",
                                 "prov_generatedByProgram", "prov_generatedByExecution", "prov_generatedByUser",
                                 "prov_usedByProgram", "prov_usedByExecution", "prov_usedByUser", "prov_wasExecutedByExecution",
                                 "prov_wasExecutedByUser", "prov_hasDerivations", "prov_instanceOfClass" ];

              // Process each SPARQL query
              var keys = Object.keys(provQueries);
              this.queriesToRun = keys.length;

              //Bind the onResult and onDone functions to the model so they can be called out of context
              this.onResult = _.bind(this.onResult, this);
              this.onDone   = _.bind(this.onDone, this);

              /* Run queries for all provenance fields.
              Each query may have multiple solutions and  each solution will trigger a callback
              to the 'onResult' function. When each query has completed, the 'onDone' function
              is called for that query.
               */
              for (var iquery = 0; iquery < keys.length; iquery++) {

                var eq = rdf.SPARQLToQuery(provQueries[keys[iquery]], false, this.dataPackageGraph);
                this.dataPackageGraph.query(eq, this.onResult, this.url(), this.onDone);

              }

            } catch (error) {

                console.log(error);

            }
          },

          // The return values have to be extracted from the result.
          getValue: function(result, name) {
              var res = result[name];
              // The result is of type 'NamedNode', just return the string value
              if (res) {
                  return res.value;
              } else
              return " ";
          },

          /* This callback is called for every query solution of the SPARQL queries. One
             query may result in multple queries solutions and calls to this function.
              Each query result returns two pids, i.e. pid: 1234 prov_generated: 5678,
              which corresponds to the RDF triple '5678 wasGeneratedBy 1234', or the
              DataONE solr document for pid '1234', with the field prov_generated: 5678.

             The result can look like this:
              [?pid: t, ?prov_wasDerivedFrom: t, ?primary_data: t, ?derived_data: t]
               ?derived_data : t {termType: "NamedNode", value: "https://cn-stage.test.dataone.org/cn/v2/resolve/urn%3Auuid%3Adbbb9a2e-af64-452a-b7b9-122861a5dbb2"}
              ?pid : t {termType: "Literal", value: "urn:uuid:dbbb9a2e-af64-452a-b7b9-122861a5dbb2", datatype: t}
              ?primary_data : t {termType: "NamedNode", value: "https://cn-stage.test.dataone.org/cn/v2/resolve/urn%3Auuid%3Aaae9d025-a331-4c3a-b399-a8ca0a2826ef"}
              ?prov_wasDerivedFrom : t {termType: "Literal", value: "urn:uuid:aae9d025-a331-4c3a-b399-a8ca0a2826ef", datatype: t}]
          */
          onResult: function(result) {

            var currentPid = this.getValue(result, "?pid");
            var resval;
            var provFieldResult;
            var provFieldValues;

            // If there is a solution for this query, assign the value
            // to the prov field attribute (e.g. "prov_generated") of the package member (a DataONEObject)
            // with id = '?pid'
            if(typeof currentPid !== 'undefined' && currentPid !== " ") {
              var currentMember = null;
              var provFieldValues;
              var fieldName = null;
              var vals = [];
              var resultMember = null;
              currentMember = this.find(function(model) { return model.get('id') === currentPid});

              if(typeof currentMember === 'undefined') {
                console.log("Package member undefined for pid: " + currentPid);
                return;
              }
              // Search for a provenenace field value (i.e. 'prov_wasDerivedFrom') that was
              // returned from the query. The current prov queries all return one prov field each
              // (see this.provFields).
              // Note: dataPackage.provSources and dataPackage.provDerivations are accumulators for
              // the entire DataPackage. member.sources and member.derivations are accumulators for
              // each package member, and are used by functions such as ProvChartView().
              for (var iFld = 0; iFld < this.provFields.length; iFld++) {
                fieldName = this.provFields[iFld];
                resval = "?" + fieldName;
                // The pid corresponding to the object of the RDF triple, with the predicate
                // of 'prov_generated', 'prov_used', etc.
                // getValue returns a string value.
                provFieldResult = this.getValue(result, resval);
                if(provFieldResult != " ") {
                  // Find the Datapacakge member for the result 'pid' and add the result
                  // prov_* value to it. This is the package member that is the 'subject' of the
                  // prov relationship.
                  // The 'resultMember' could be in the current package, or could be in another 'related' package.
                  resultMember = this.find(function(model) { return model.get('id') === provFieldResult});

                  if (typeof resultMember !== 'undefined') { // If this prov field is a 'source' field, add it to 'sources'

                    if(currentMember.isSourceField(fieldName)) {
                      // Get the package member that the id of the prov field is associated with
                      if (_.findWhere(this.sources, {id: provFieldResult}) == null) {
                        this.sources.push(resultMember);
                      }
                      // Only add the result member if it has not already been added.
                      if (_.findWhere(currentMember.get("provSources"), {id: provFieldResult}) == null) {
                        vals = currentMember.get("provSources");
                        vals.push(resultMember);
                        currentMember.set("provSources", vals);
                      }
                    }
                    else if (currentMember.isDerivationField(fieldName)) {
                      // If this prov field is a 'derivation' field, add it to 'derivations'
                      if (_.findWhere(this.derivations, {id: provFieldResult}) == null) {
                        this.derivations.push(resultMember);
                      }

                      if (_.findWhere(currentMember.get("provDerivations"), {id: provFieldResult}) == null) {
                        vals = currentMember.get("provDerivations");
                        vals.push(resultMember);
                        currentMember.set("provDerivations", vals);
                      }
                   }

                    // Get the existing values for this prov field in the package member
                    vals = currentMember.get(fieldName);

                    // Push this result onto the prov file list if it is not there, i.e.
                    if(!_.contains(vals, resultMember)) {
                      vals.push(resultMember);
                      currentMember.set(fieldName, vals);
                    }

                    //provFieldValues = _.uniq(provFieldValues);
                    // Add the current prov valid (a pid) to the current value in the member
                    //currentMember.set(fieldName, provFieldValues);
                    //this.add(currentMember, { merge: true });
                }
                else {
                  // The query result field is not the identifier of a packge member, so it may be the identifier
                  // of another 'related' package, or it may be a string value that is the object of a prov relationship,
                  // i.e. for 'prov_instanceOfClass' == 'http://purl.dataone.org/provone/2015/01/15/ontology#Data',
                  // so add the value to the current member.
                  vals = currentMember.get(fieldName);
                  if(!_.contains(vals, provFieldResult)) {
                    vals.push(provFieldResult);
                    currentMember.set(fieldName, vals);
                  }
               }

              }
             }
           }
         },

          /* This callback is called when all queries have finished. */
          onDone: function() {
              if(this.queriesToRun > 1) {
                this.queriesToRun--;
              } else {
                // Signal that all prov queries have finished
                this.provenanceFlag = "complete";
                this.trigger("queryComplete");
              }
          },

          /*
           * Use the DataONEObject parseSysMeta() function
           */
          parseSysMeta: function(){
            return DataONEObject.parseSysMeta.call(this, arguments[0]);
          },

          /*
           * Overwrite the Backbone.Collection.sync() function to set custom options
           */
          save: function(options){

            if(!options) var options = {};

            this.packageModel.set("uploadStatus", "p");

            //Get the system metadata first if we haven't retrieved it yet
            if(!this.packageModel.get("sysMetaXML")){
              var collection = this;
              this.packageModel.fetch({
                success: function(){
                  collection.save(options);
                }
              });
              return;
            }

            //If we want to update the system metadata only,
            // then update via the DataONEObject model and exit
            if(options.sysMetaOnly){
              this.packageModel.save(null, options);
              return;
            }

            //Sort the models in the collection so the metadata is saved first
            var metadataModels   = this.where({ type: "Metadata" });
            var dataModels       = _.difference(this.models, metadataModels);
            var sortedModels     = _.union(metadataModels, dataModels);
            var modelsInProgress = _.filter(sortedModels, function(m){ return m.get("uploadStatus") == "p" });
            var modelsToBeSaved  = _.filter(sortedModels, function(m){
              //Models should be saved if they are in the save queue, had an error saving earlier,
              //or they are Science Metadata model that is NOT already in progress
              return (m.get("uploadStatus") == "q" ||
                  //m.get("uploadStatus") == "e" ||
                  (m.get("type") == "Metadata" &&
                      m.get("uploadStatus") != "p" &&
                      m.get("uploadStatus") != "c" &&
                      m.get("uploadStatus") != "e" &&
                      m.get("uploadStatus") !== null))
              });

            //First quickly validate all the models before attempting to save any
            var allValid = _.every(modelsToBeSaved, function(m) {

            if( m.isValid() ){
              m.trigger("valid");
              return true;
            }
            else{
              return false;
            }

          });

          // If at least once model to be saved is invalid,
          // or the metadata failed to save, cancel the save.
          if ( ! allValid || _.contains(_.map(metadataModels, function(model) {
                return model.get("uploadStatus");
              } ), "e") ) {

            this.packageModel.set("changed", false);
            this.packageModel.set("uploadStatus", "q");
            this.trigger("cancelSave");
            return;

          }

          //First save all the models of the collection, if needed
          _.each(modelsToBeSaved, function(model){
            //If the model is saved successfully, start this save function again
            this.stopListening(model, "successSaving", this.save);
            this.listenToOnce(model, "successSaving", this.save);

            //If the model fails to save, start this save function
            this.stopListening(model, "errorSaving", this.save);
            this.listenToOnce(model, "errorSaving", this.save);

            //If the model fails to save, start this save function
            this.stopListening(model, "cancelSave", this.save);
            this.listenToOnce(model,  "cancelSave", this.save);

            //Save the model and watch for fails
            model.save();

            //Add it to the list of models in progress
            modelsInProgress.push(model);

          }, this);

          //If there are still models in progress of uploading, then exit. (We will return when they are synced to upload the resource map)
          if(modelsInProgress.length) return;

          //Do we need to update this resource map?
          if(!this.needsUpdate()) return;

          var requestType;

          //Set a new id and keep our old id
          if(this.packageModel.isNew()){
            requestType = "POST";
          }
          else{
            //Update the identifier for this object
            this.packageModel.updateID();
            requestType = "PUT";
          }

          //Create a FormData object to send data with the XHR
          var formData = new FormData();

          //Add the identifier to the XHR data
          if(this.packageModel.isNew()){
            formData.append("pid", this.packageModel.get("id"));
          }
          else{
            //Add the ids to the form data
            formData.append("newPid", this.packageModel.get("id"));
            formData.append("pid", this.packageModel.get("oldPid"));
          }

          try {
            //Create the resource map XML
            var mapXML = this.serialize();
          }
          catch (serializationException) {

            //If serialization failed, revert back to our old id
            this.packageModel.resetID();

            this.trigger("errorSaving");

            return;
          }

          var mapBlob = new Blob([mapXML], {type : 'application/xml'});
          formData.append("object", mapBlob);

          //Get the size of the new resource map
          this.packageModel.set("size", mapBlob.size);

          //Get the new checksum of the resource map
          var checksum = md5(mapXML);
          this.packageModel.set("checksum", checksum);
          this.packageModel.set("checksumAlgorithm", "MD5");

          //Set the file name based on the id
          this.packageModel.set("fileName", "resourceMap_" + this.packageModel.get("id") + ".rdf.xml");

          //Create the system metadata
          var sysMetaXML = this.packageModel.serializeSysMeta();

          //Send the system metadata
          var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});
          formData.append("sysmeta", xmlBlob, "sysmeta");

          var collection = this;
          var requestSettings = {
              url: this.packageModel.isNew()? this.url() : this.url({ update: true }),
              type: requestType,
              cache: false,
              contentType: false,
              processData: false,
              data: formData,
              success: function(response){

                //Update the object XML
                collection.objectXML = mapXML;
                collection.packageModel.set("sysMetaXML", collection.packageModel.serializeSysMeta());

                //Reset the upload status for all members
                _.each(collection.where({ uploadStatus: "c" }), function(m){
                  m.set("uploadStatus", m.defaults().uploadStatus);
                });

                //Reset the upload status for the package
                collection.packageModel.set("uploadStatus", collection.packageModel.defaults().uploadStatus);

                // Reset the content changes status
                collection.packageModel.set("hasContentChanges", false);

                collection.trigger("successSaving", collection);

                collection.packageModel.fetch({merge: true});

              },
              error: function(data){

                //Reset the id back to its original state
                collection.packageModel.resetID();

                //Reset the upload status for all members
                _.each(collection.where({ uploadStatus: "c" }), function(m){
                  m.set("uploadStatus", m.defaults().uploadStatus);
                });

                //Send this exception to Google Analytics
                if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
                  ga("send", "exception", {
                    "exDescription": "DataPackage save error: " + errorMsg +
                      " | Id: " + collection.packageModel.get("id") + " | v. " + MetacatUI.metacatUIVersion,
                    "exFatal": true
                  });
                }

                //When there is no network connection (status == 0), there will be no response text
                if( data.status == 408 || data.status == 0 ){
                  var parsedResponse = "There was a network issue that prevented this file from uploading. " +
                           "Make sure you are connected to a reliable internet connection.";
                }
                else {
                  var parsedResponse = $(data.responseText).not("style, title").text();
                }

                //Save the error message in the model
                collection.packageModel.set("errorMessage", parsedResponse);

                //Reset the upload status for the package
                collection.packageModel.set("uploadStatus", "e");

                collection.trigger("errorSaving", parsedResponse);
              }
          }
          $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
        },

        /*
         * When a data package member updates, we evaluate it for its formatid,
         * and update it appropriately if it is not a data object only
         */
        getMember: function(context, args) {
          var memberModel = {};

          switch ( context.get("formatId") ) {

            case "http://www.openarchives.org/ore/terms":
                context.attributes.id = context.id;
                context.attributes.type = "DataPackage";
                context.attributes.childPackages = {};
                memberModel = new DataPackage(null, {packageModel: context.attributes});
                this.packageModel.get("childPackages")[memberModel.packageModel.id] = memberModel;
                break;

            case "eml://ecoinformatics.org/eml-2.0.0":
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new EML211(context.attributes);
                break;

            case "eml://ecoinformatics.org/eml-2.0.1":
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new EML211(context.attributes);
                break;

            case "eml://ecoinformatics.org/eml-2.1.0":
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new EML211(context.attributes);
                break;

            case "eml://ecoinformatics.org/eml-2.1.1":
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new EML211(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-access-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-access-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-entity-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-entity-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-literature-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-literature-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-party-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-party-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-physical-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-physical-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-project-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-project-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-resource-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-resource-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-software-2.0.0beta4//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "-//ecoinformatics.org//eml-software-2.0.0beta6//EN" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "FGDC-STD-001-1998" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "FGDC-STD-001.1-1999" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "FGDC-STD-001.2-1999" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "INCITS-453-2009" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "ddi:codebook:2_5" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://datacite.org/schema/kernel-3.0" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://datacite.org/schema/kernel-3.1" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://datadryad.org/profile/v3.1" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://ns.dataone.org/metadata/schema/onedcx/v1.0" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://purl.org/dryad/terms/" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://purl.org/ornl/schema/mercury/terms/v1.0" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://rs.tdwg.org/dwc/xsd/simpledarwincore/" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.cuahsi.org/waterML/1.0/" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.cuahsi.org/waterML/1.1/" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.esri.com/metadata/esriprof80.dtd" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.icpsr.umich.edu/DDI" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.isotc211.org/2005/gmd" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.isotc211.org/2005/gmd-noaa" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.loc.gov/METS/" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            case "http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2" :
                context.set({type: "Metadata", sortOrder: 1});
                memberModel = new ScienceMetadata(context.attributes);
                break;

            default:
                // For other data formats, keep just the DataONEObject sysmeta
                context.set({type: "Data", sortOrder: 2});
                memberModel = context;

          }

          if ( memberModel.type == "DataPackage" ) {
              // We have a nested collection
              memberModel.packageModel.set("nodeLevel", this.packageModel.get("nodeLevel") + 1);
          }
          else{
            // We have a model
            memberModel.set("nodeLevel", this.packageModel.get("nodeLevel")); // same level for all members
          }

          return memberModel;

        },

        triggerComplete: function(model){
          //Check if the collection is done being retrieved
          var notSynced = this.reject(function(m){
            return (m.get("synced") || m.get("id") == model.get("id"));
          });

          //If there are any models that are not synced yet, the collection is not complete
          if( notSynced.length > 0 )
              return;

          //If the number of models in this collection does not equal the number of objects referenced in the RDF XML, the collection is not complete
          if(this.originalMembers.length > this.length)
            return;

          this.sort();
          this.trigger("complete", this);

        },

        /* Accumulate edits that are made to the provenance relationships via the ProvChartView. these
           edits are accumulated here so that they are available to any package member or view.
        */
        recordProvEdit: function(operation, subject, predicate, object) {

          if (!this.provEdits.length) {

            this.provEdits = [[operation, subject, predicate, object]];

          } else {
            // First check if the edit already exists in the list. If yes, then
            // don't add it again! This could occur if an edit icon was clicked rapidly
            // before it is dismissed.
            var editFound = _.find(this.provEdits, function(edit) {
                return(edit[0] == operation &&
                    edit[1] == subject &&
                    edit[2] == predicate &&
                    edit[3] == object);
            });

            if(typeof editFound != "undefined") {
                return;
            }

            // If this is a delete operation, then check if a matching operation
            // is in the edit list (i.e. the user may have changed their mind, and
            // they just want to cancel an edit). If yes, then just delete the
            // matching add edit request
            var editListSize = this.provEdits.length;
            var oppositeOp = (operation == "delete") ? "add" : "delete";

            this.provEdits = _.reject(this.provEdits, function(edit) {
                var editOperation = edit[0];
                var editSubjectId = edit[1];
                var editPredicate = edit[2];
                var editObject = edit[3];
                if (editOperation == oppositeOp
                    && editSubjectId == subject
                    && editPredicate == predicate
                    && editObject == object) {

                    return true;
                }
            });

            // If we cancelled out edit containing inverse of the current edit
            // then the edit list will now be one edit shorter. Test for this
            // and only save the current edit if we didn't remove the inverse.
            if(editListSize >= this.provEdits.length) {
                this.provEdits.push([operation, subject, predicate, object]);
            }
          }
        },

        // Return true if the prov edits list is not empty
        provEditsPending: function() {
            if(this.provEdits.length) return true;
            return false;
        },

        /* If provenance relationships have been modified by the provenance editor (in ProvChartView), then
        update the ORE Resource Map and save it to the server.
        */
        saveProv: function() {
          var rdf = this.rdf;
          var graph = this.dataPackageGraph;

          var provEdits = this.provEdits;
          if(!provEdits.length) {
              return;
          }
          var RDF = rdf.Namespace(this.namespaces.RDF),
              PROV =    rdf.Namespace(this.namespaces.PROV),
              PROVONE = rdf.Namespace(this.namespaces.PROVONE),
              DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
              CITO =    rdf.Namespace(this.namespaces.CITO),
              XSD =     rdf.Namespace(this.namespaces.XSD);

          var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';

          /* Check if this package member had provenance relationships added
              or deleted by the provenance editor functionality of the ProvChartView
          */
          _.each(provEdits, function(edit) {
            var operation, subject, predicate, object;
            var provStatements;
            operation = edit[0];
            subject = edit[1];
            predicate = edit[2];
            object = edit[3];

            // The predicates of the provenance edits recorded by the ProvChartView
            // indicate which W3C PROV relationship has been recorded.
            // First check if this relationship alread exists in the RDF graph.
            // See DataPackage.parseProv for a description of how relationships from an ORE resource map
            // are parsed and stored in DataONEObjects. Here we are reversing the process, so may need
            // The representation of the PROVONE data model is simplified in the ProvChartView, to aid
            // legibility for users not familiar with the details of the PROVONE model. In this simplification,
            // a provone:Program has direct inputs and outputs. In the actual model, a prov:Execution has
            // inputs and outputs and is connected to a program via a prov:association. We must 'expand' the
            // simplified provenance updates recorded by the editor into the fully detailed representation
            // of the actual model.
            var executionId, executionURI, executionNode;
            var programId, programURI, programNode;
            var dataId, dataURI, dataNode;
            var derivedDataURI, derivedDataNode;
            var lastRef = false;
            //var graph = this.dataPackageGraph;

            switch (predicate) {
                case "prov_wasDerivedFrom":
                    derivedDataNode = rdf.sym(cnResolveUrl + encodeURIComponent(subject));
                    dataNode = rdf.sym(cnResolveUrl + encodeURIComponent(object));
                    if(operation == "add") {
                        this.addToGraph(dataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(derivedDataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(derivedDataNode, PROV("wasDerivedFrom"), dataNode);
                    } else {
                        graph.removeMatches(derivedDataNode, PROV("wasDerivedFrom"), dataNode);
                        this.removeIfLastProvRef(dataNode, RDF("type"), PROVONE("Data"));
                        this.removeIfLastProvRef(derivedDataNode, RDF("type"), PROVONE("Data"));
                    }
                    break;
                case "prov_generatedByProgram":
                    programId = object;
                    dataNode = rdf.sym(cnResolveUrl + encodeURIComponent(subject));
                    var removed = false;
                    if(operation == "add") {
                        // 'subject' is the program id, which is a simplification of the PROVONE model for display.
                        // In the PROVONE model, execution 'uses' and input, and is associated with a program.
                        executionId = this.addProgramToGraph(programId);
                        //executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                        executionNode = this.getExecutionNode(executionId);
                        this.addToGraph(dataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(dataNode, PROV("wasGeneratedBy"), executionNode);
                    } else {
                        executionId = this.getExecutionId(programId);
                        executionNode = this.getExecutionNode(executionId);

                        graph.removeMatches(dataNode, PROV("wasGeneratedBy"), executionNode);
                        removed = this.removeProgramFromGraph(programId);
                        this.removeIfLastProvRef(dataNode, RDF("type"), PROVONE("Data"));
                    }
                    break;
                case "prov_usedByProgram":
                    programId = object;
                    dataNode = rdf.sym(cnResolveUrl + encodeURIComponent(subject));
                    if(operation == "add") {
                        // 'subject' is the program id, which is a simplification of the PROVONE model for display.
                        // In the PROVONE model, execution 'uses' and input, and is associated with a program.
                        executionId = this.addProgramToGraph(programId)
                        //executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                        executionNode = this.getExecutionNode(executionId);
                        this.addToGraph(dataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(executionNode, PROV("used"), dataNode);
                    } else {
                        executionId = this.getExecutionId(programId);
                        executionNode = this.getExecutionNode(executionId);

                        graph.removeMatches(executionNode, PROV("used"), dataNode)
                        removed = this.removeProgramFromGraph(programId);
                        this.removeIfLastProvRef(dataNode, RDF("type"), PROVONE("Data"));
                    }
                    break;
                case "prov_hasDerivations":
                    dataNode = rdf.sym(cnResolveUrl + encodeURIComponent(subject));
                    derivedDataNode = rdf.sym(cnResolveUrl + encodeURIComponent(object));
                    if(operation == "add") {
                        this.addToGraph(dataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(derivedDataNode, RDF("type"), PROVONE("Data"));
                        this.addToGraph(derivedDataNode, PROV("wasDerivedFrom"), dataNode);
                    } else {
                        graph.removeMatches(derivedDataNode, PROV("wasDerivedFrom"), dataNode);
                        this.removeIfLastProvRef(dataNode, RDF("type"), PROVONE("Data"));
                        this.removeIfLastProvRef(derivedDataNode, RDF("type"), PROVONE("Data"));
                    }
                    break;
                case "prov_instanceOfClass":
                    var entityNode = rdf.sym(cnResolveUrl + encodeURIComponent(subject));
                    var classNode = PROVONE(object);
                    if(operation == "add") {
                        this.addToGraph(entityNode, RDF("type"), classNode);
                    } else {
                        // Make sure there are no other references to this
                        this.removeIfLastProvRef(entityNode, RDF("type"), classNode);
                    }
                    break;
                default:
                // Print error if predicate for prov edit not found.
              }
            }, this);

            // Since the provenance editor is run from the MetadataView, only
            // the resource map will have to be updated (with the new prov rels),
            // as no other editing is possible. Therefor we have to manually set
            // the resource maps' new id so that the serialize() function will treat
            // this as an update, not a new resource map.
            //var oldId = this.dataPackage.packageModel.get("id");
            //var newId = "resource_map_" + "urn:uuid:" + uuid.v4();
            //this.dataPackage.packageModel.set("oldPid", oldId);
            //this.dataPackage.packageModel.set("id", newId);
            this.save();

          },

            /* Add the specified relationship to the RDF graph only if it
            has not already been added. */
            addToGraph: function(subject, predicate, object) {
                var graph = this.dataPackageGraph;
                var statements = graph.statementsMatching(subject, predicate, object);

                if(!statements.length) {
                    graph.add(subject, predicate, object);
                }
            },

        /* Remove the statement fromn the RDF graph only if the subject of this
           relationship is not referenced by any other provenance relationship, i.e.
           for example, the prov relationship "id rdf:type provone:data" is only
           needed if the subject ('id') is referenced in another relationship.
           Also don't remove it if the subject is in any other prov statement,
           meaning it still references another prov object.
        */
        removeIfLastProvRef: function(subjectNode, predicateNode, objectNode) {
          var graph = this.dataPackageGraph;
          var stillUsed = false;
          var PROV    = rdf.Namespace(this.namespaces.PROV);
          var PROVONE = rdf.Namespace(this.namespaces.PROVONE);
          // PROV namespace value, used to identify PROV statements
          var provStr    = PROV("").value;
          // PROVONE namespace value, used to identify PROVONE statements
          var provoneStr = PROVONE("").value;
          // Get the statements from the RDF graph that reference the subject of the
          // statement to remove.
          var statements = graph.statementsMatching(undefined, undefined, subjectNode);

          var found = _.find(statements, function(statement) {
            if(statement.subject == subjectNode &&
                statement.predicate == predicateNode &&
                statement.object == objectNode) return false;

            var pVal = statement.predicate.value;

            // Now check if the subject is referenced in a prov statement
            // There is another statement that references the subject of the
            // statement to remove, so it is still being used and don't
            // remove it.
            if(pVal.indexOf(provStr) != -1) return true;
            if(pVal.indexOf(provoneStr) != -1) return true;
            return false;
          }, this);

          // IF not found in the first test, keep looking.
          if(typeof found == "undefined") {
            // Get the statements from the RDF where
            var statements = graph.statementsMatching(subjectNode, undefined, undefined);

            found = _.find(statements, function(statement) {
                if(statement.subject == subjectNode &&
                    statement.predicate == predicateNode &&
                    statement.object == objectNode) return false;
                var pVal = statement.predicate.value;

                // Now check if the subject is referenced in a prov statement
                if(pVal.indexOf(provStr) != -1) return true;
                if(pVal.indexOf(provoneStr) != -1) return true;
                // There is another statement that references the subject of the
                // statement to remove, so it is still being used and don't
                // remove it.
                return false
            }, this);
          }

          // The specified statement term isn't being used for prov, so remove it.
          if(typeof found == "undefined") {
              graph.removeMatches(subjectNode, predicateNode, objectNode, undefined);
          }
        },

        /* Get the execution identifier that is associated with a program id.
           This will either be in the 'prov_wasExecutedByExecution' of the package member
           for the program script, or available by tracing backward in the RDF graph from
           the program node, through the assocation to the related execution.
         */
        getExecutionId: function(programId) {
          var rdf = this.rdf;
          var graph = this.dataPackageGraph;
          var stmts = null;
          var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';
          var RDF = rdf.Namespace(this.namespaces.RDF),
              DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
              PROV    = rdf.Namespace(this.namespaces.PROV),
              PROVONE = rdf.Namespace(this.namespaces.PROVONE);

          var member = this.get(programId);
          var executionId = member.get("prov_wasExecutedByExecution");
          if(executionId.length > 0) {
              return(executionId[0]);
          } else {
            var programNode = rdf.sym(cnResolveUrl + encodeURIComponent(programId));
            // Get the executionId from the RDF graph
            // There can be only one plan for an association
            stmts = graph.statementsMatching(undefined, PROV("hadPlan"), programNode);
            if(typeof stmts == "undefined") return null;
            var associationNode = stmts[0].subject;
            // There should be only one execution for this assocation.
            stmts = graph.statementsMatching(undefined, PROV("qualifiedAssociation"), associationNode);
            if(typeof stmts == "undefined") return null;
            return(stmts[0].subject)
        }
        },

        /* Get the RDF node for an execution that is associated with the execution identifier.
           The execution may have been created in the resource map as a 'bare' urn:uuid
           (no resolveURI), or as a resolve URL, so check for both until the id is
           found.
        */
        getExecutionNode: function(executionId) {
            var rdf = this.rdf;
            var graph = this.dataPackageGraph;
            var stmts = null;
            var testNode = null;
            var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';

            // First see if the execution exists in the RDF graph as a 'bare' idenfier, i.e.
            // a 'urn:uuid'.
            stmts = graph.statementsMatching(rdf.sym(executionId), undefined, undefined);
            if(typeof stmts == "undefined" || !stmts.length) {
                // The execution node as urn was not found, look for fully qualified version.
                testNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                stmts = graph.statementsMatching(rdf.sym(executionId), undefined, undefined);
                if(typeof stmts == "undefined") {
                    // Couldn't find the execution, return the standard RDF node value
                    executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                    return executionNode;
                } else {
                    return testNode;
                }
            } else {
                // The executionNode was found in the RDF graph as a urn
                var executionNode = stmts[0].subject;
                return executionNode;
            }
          },

            addProgramToGraph: function(programId) {
                var rdf = this.rdf;
                var graph = this.dataPackageGraph;
                var RDF = rdf.Namespace(this.namespaces.RDF),
                DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
                PROV    = rdf.Namespace(this.namespaces.PROV),
                PROVONE = rdf.Namespace(this.namespaces.PROVONE),
                XSD     = rdf.Namespace(this.namespaces.XSD);
                var member = this.get(programId);
                var executionId = member.get("prov_wasExecutedByExecution");
                var executionNode = null;
                var programNode = null;
                var associationId = null;
                var associationNode = null;
                var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';

                if(!executionId.length) {
                    // This is a new execution, so create new execution and association ids
                    executionId = "urn:uuid:" + uuid.v4();
                    member.set("prov_wasExecutedByExecution", [executionId]);
                    // Blank node id. RDF validator doesn't like ':' so don't use in the id
                    //executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                    executionNode = this.getExecutionNode(executionId);
                    //associationId = "_" + uuid.v4();
                    associationNode = graph.bnode();
                } else {
                    executionId = executionId[0];
                    // Check if an association exists in the RDF graph for this execution id
                    //executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                    executionNode = this.getExecutionNode(executionId);
                    // Check if there is an association id for this execution.
                    // If this execution is newly created (via the editor (existing would
                    // be parsed from the resmap), then create a new association id.
                    var stmts = graph.statementsMatching(executionNode,
                        PROV("qualifiedAssociation"), undefined);
                    // IF an associati on was found, then use it, else geneate a new one
                    // (Associations aren't stored in the )
                    if(stmts.length) {
                        associationNode = stmts[0].object;
                        //associationId = stmts[0].object.value;
                    } else {
                        //associationId = "_" + uuid.v4();
                        associationNode = graph.bnode();
                    }
                }
                //associationNode = graph.bnode(associationId);
                //associationNode = graph.bnode();
                programNode = rdf.sym(cnResolveUrl + encodeURIComponent(programId));
                try {
                    this.addToGraph(executionNode, PROV("qualifiedAssociation"), associationNode);
                    this.addToGraph(executionNode, RDF("type"), PROVONE("Execution"));
                    this.addToGraph(executionNode, DCTERMS("identifier"), rdf.literal(executionId, undefined, XSD("string")));
                    this.addToGraph(associationNode, PROV("hadPlan"), programNode);
                    this.addToGraph(programNode, RDF("type"), PROVONE("Program"));
                } catch (error) {
                    console.log(error);
                }
                return executionId;
            },

            // Remove a program identifier from the RDF graph and remove associated
            // linkage between the program id and the exection, if the execution is not
            // being used by any other statements.
            removeProgramFromGraph: function(programId) {
                var graph = this.dataPackageGraph;
                var rdf = this.rdf;
                var stmts = null;
                var cnResolveUrl = MetacatUI.appModel.get('d1CNBaseUrl') + MetacatUI.appModel.get('d1CNService') +  '/resolve/';
                var RDF = rdf.Namespace(this.namespaces.RDF),
                DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
                PROV    = rdf.Namespace(this.namespaces.PROV),
                PROVONE = rdf.Namespace(this.namespaces.PROVONE),
                XSD     = rdf.Namespace(this.namespaces.XSD);
                var associationNode = null;

                var executionId = this.getExecutionId(programId);
                if(executionId == null) return false;

                //var executionNode = rdf.sym(cnResolveUrl + encodeURIComponent(executionId));
                var executionNode = this.getExecutionNode(executionId);
                var programNode = rdf.sym(cnResolveUrl + encodeURIComponent(programId));

                // In order to remove this program from the graph, we have to first determine that
                // nothing else is using the execution that is associated with the program (the plan).
                // There may be additional 'used', 'geneated', 'qualifiedGeneration', etc. items that
                // may be pointing to the execution. If yes, then don't delete the execution or the
                // program (the execution's plan).
                try {
                    // Is the program in the graph? If the program is not in the graph, then
                    // we don't know how to remove the proper execution and assocation.
                    stmts = graph.statementsMatching(undefined, undefined, programNode);
                    if(typeof(stmts) == "undefined" || !stmts.length) return(false);

                    // Is anything else linked to this execution?
                    stmts = graph.statementsMatching(executionNode, PROV("used"));
                    if(!typeof(stmts) == "undefined" || stmts.length) return(false);
                    stmts = graph.statementsMatching(undefined, PROV("wasGeneratedBy"), executionNode);
                    if(!typeof(stmts) == "undefined" || stmts.length) return(false);
                    stmts = graph.statementsMatching(executionNode, PROV("qualifiedGeneration"), undefined);
                    if(!typeof(stmts) == "undefined" || stmts.length) return(false);
                    stmts = graph.statementsMatching(undefined, PROV("wasInformedBy"), executionNode);
                    if(!typeof(stmts) == "undefined" || stmts.length) return(false);
                    stmts = graph.statementsMatching(undefined, PROV("wasPartOf"), executionNode);
                    if(!typeof(stmts) == "undefined" || stmts.length) return(false);

                    // get association
                    stmts = graph.statementsMatching(undefined, PROV("hadPlan"), programNode);
                    associationNode = stmts[0].subject;
                } catch (error) {
                    console.log(error);
                }

                // The execution isn't needed any longer, so remove it and the program.
                try {
                    graph.removeMatches(programNode, RDF("type"), PROVONE("Program"));
                    graph.removeMatches(associationNode, PROV("hadPlan"), programNode);
                    graph.removeMatches(associationNode, RDF("type"), PROV("Association"));
                    graph.removeMatches(associationNode, PROV("Agent"), undefined);
                    graph.removeMatches(executionNode, RDF("type"), PROVONE("Execution"));
                    graph.removeMatches(executionNode, DCTERMS("identifier"), rdf.literal(executionId, undefined, XSD("string")));
                    graph.removeMatches(executionNode, PROV("qualifiedAssociation"), associationNode);
                } catch (error) {
                    console.log(error);
                }
                return(true)
            },

            /*
             * Serialize the DataPackage to OAI-ORE RDF XML
             */
            serialize: function() {
              //Create an RDF serializer
              var serializer = this.rdf.Serializer(),
                    cnResolveUrl,
                    idNode,
                    idStatements,
                    idStatement,
                    oldPidVariations,
                    aggregationNode,
                    aggByStatements,
                    modifiedDate,
                    subjectClone,
                    predicateClone,
                    objectClone;

                    serializer.store = this.dataPackageGraph;


              //Define the namespaces
                var ORE  = this.rdf.Namespace(this.namespaces.ORE),
                  CITO = this.rdf.Namespace(this.namespaces.CITO),
                    DC = this.rdf.Namespace(this.namespaces.DC),
                    DCTERMS = this.rdf.Namespace(this.namespaces.DCTERMS),
                    FOAF = this.rdf.Namespace(this.namespaces.FOAF),
                    RDF = this.rdf.Namespace(this.namespaces.RDF),
                    XSD = this.rdf.Namespace(this.namespaces.XSD);

              //Get the pid of this package - depends on whether we are updating or creating a resource map
                var pid = this.packageModel.get("id"),
                    oldPid = this.packageModel.get("oldPid");

                //Get a list of the models that are not in progress or failed uploading
                var modelsToAggregate = this.reject(function(packageMember){
                      return (packageMember.get("uploadStatus") == "p" || packageMember.get("uploadStatus") == "e")
                    }),
                    //Get all the ids of all those models
                    idsFromModel = _.pluck(modelsToAggregate, "id");

                this.idsToAggregate = idsFromModel;

                //Update the pids in the RDF graph only if we are updating the resource map with a new pid
                if( !this.packageModel.isNew() ) {

                  //Find the identifier statement in the resource map
                  idNode =  this.rdf.lit(oldPid);
                  idStatements = this.dataPackageGraph.statementsMatching(undefined, undefined, idNode);
                  idStatement = idStatements[0];

                  // Remove all describes/isDescribedBy statements (they'll be rebuilt)
                  this.dataPackageGraph.removeMany(undefined, ORE("describes"), undefined, undefined, undefined);
                  this.dataPackageGraph.removeMany(undefined, ORE("isDescribedBy"), undefined, undefined, undefined);

                  //Get the CN Resolve Service base URL from the resource map
                  // (mostly important in dev environments where it will not always be cn.dataone.org)
                  if ( typeof this.dataPackageGraph.cnResolveUrl !== "undefined" ) {
                    cnResolveUrl = this.dataPackageGraph.cnResolveUrl;

                  } else if ( typeof idStatement !== "undefined" ) {
                    cnResolveUrl =
                            idStatement.subject.value.substring(0, idStatement.subject.value.indexOf(oldPid)) ||
                            idStatement.subject.value.substring(0, idStatement.subject.value.indexOf(encodeURIComponent(oldPid)));

                  }

                  this.dataPackageGraph.cnResolveUrl = cnResolveUrl;

                  //Create variations of the resource map ID using the resolve URL so we can always find it in the RDF graph
                  oldPidVariations = [oldPid, encodeURIComponent(oldPid), cnResolveUrl + oldPid, cnResolveUrl+ encodeURIComponent(oldPid)];

                  //Get all the isAggregatedBy statements
                  aggregationNode =  this.rdf.sym(cnResolveUrl + encodeURIComponent(oldPid) + "#aggregation");
                  aggByStatements =  $.extend(true, [],
                        this.dataPackageGraph.statementsMatching(undefined, ORE("isAggregatedBy")));

                  //Using the isAggregatedBy statements, find all the DataONE object ids in the RDF graph
                  var idsFromXML = [];
                  _.each(aggByStatements, function(statement){

                    //Check if the resource map ID is the old existing id, so we don't collect ids that are not about this resource map
                    if(_.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) })){
                      var statementID = statement.subject.value;
                      idsFromXML.push(statementID);

                      //Add variations of the ID so we make sure we account for all the ways they exist in the RDF XML
                      if(statementID.indexOf(cnResolveUrl) > -1) {
                        idsFromXML.push(statementID.substring(statementID.lastIndexOf("/") + 1));
                                // Allow for ids that are simple URIs, e.g. "urn:uuid:1234..."
                        idsFromXML.push(decodeURIComponent(statementID.substring(statementID.lastIndexOf("/") + 1)));
                      } else
                        idsFromXML.push(cnResolveUrl + encodeURIComponent(statementID));
                    }

                  }, this);

                //Get all the child package ids
                var childPackages = this.packageModel.get("childPackages");
                if( typeof childPackages == "object" ){
                  idsFromModel = _.union( idsFromModel, Object.keys(childPackages) );
                }

                //Find the difference between the model IDs and the XML IDs to get a list of added members
                  var addedIds  = _.without(_.difference(idsFromModel, idsFromXML), oldPidVariations);
                  //Create variations of all these ids too
                  var allMemberIds = idsFromModel;
                    // Don't remove documents/documentedBy statements if this is a resource map update only
                    // (because of provenance relationship edits), i.e. no new package members are being added.
                    // Remove all documents and isDocumentedBy statements (they're rebuilt from the collection)
            /*        if(!this.provEdits.length) {
                        this.dataPackageGraph.removeMany(undefined, CITO("documents"), undefined, undefined, undefined);
                        this.dataPackageGraph.removeMany(undefined, CITO("isDocumentedBy"), undefined, undefined, undefined);
                    }
*/
                  _.each(idsFromModel, function(id){
                    allMemberIds.push(cnResolveUrl + encodeURIComponent(id));
                   });

                    // Remove any other isAggregatedBy statements that are not listed as members of this model
                    _.each(aggByStatements, function(statement) {
                        if( !_.contains(allMemberIds, statement.subject.value) ) {
                            this.removeFromAggregation(statement.subject.value);
                        }
                    }, this);

                  // Change all the statements in the RDF where the aggregation is the subject, to reflect the new resource map ID
                    var aggregationSubjStatements = this.dataPackageGraph.statementsMatching(aggregationNode);
                    _.each(aggregationSubjStatements, function(statement){
                        subjectClone = this.cloneNode(statement.subject);
                        subjectClone.value = cnResolveUrl + encodeURIComponent(pid) + "#aggregation";
                        predicateClone = this.cloneNode(statement.predicate);
                        objectClone = this.cloneNode(statement.object);
                        this.dataPackageGraph.add(subjectClone, predicateClone, objectClone);
                    }, this);

                    if(aggregationSubjStatements.length) {
                        this.dataPackageGraph.removeMany(aggregationNode);
                    }

                  // Change all the statements in the RDF where the aggregation is the object, to reflect the new resource map ID
                  var aggregationObjStatements = this.dataPackageGraph.statementsMatching(undefined, undefined, aggregationNode);
                  _.each(aggregationObjStatements, function(statement) {
                        subjectClone = this.cloneNode(statement.subject);
                        predicateClone = this.cloneNode(statement.predicate);
                        objectClone = this.cloneNode(statement.object);
                        objectClone.value = cnResolveUrl + encodeURIComponent(pid) + "#aggregation";
                        this.dataPackageGraph.add(subjectClone, predicateClone, objectClone);
                  }, this);

                    if(aggregationObjStatements.length) {
                        this.dataPackageGraph.removeMany(undefined, undefined, aggregationNode);
                    }

                    // Get a fresh copy of the 'isAggregatedBy' statements (as some may have been
                    // removed above), and check for any that contain an object that is not the
                    // aggregation.
                    aggByStatements =  $.extend(true, [],
                        this.dataPackageGraph.statementsMatching(undefined, ORE("isAggregatedBy")));

                    // Remove any other isAggregatedBy statements for the old pid.
                    _.each(aggByStatements, function(statement) {
                        if ( _.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) }) ) {
                            try {
                                this.dataPackageGraph.remove(statement);
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    }, this)

              //Change all the resource map identifier literal node in the RDF graph
            if ( typeof idStatement != "undefined" ) {
                        try {
                            this.dataPackageGraph.remove(idStatement);
                        } catch (error) {
                            console.log(error);
                        }
                        idStatement.object.value = pid;
                        this.dataPackageGraph.add(idStatement);

                    }

            // Change all the resource map subject nodes in the RDF graph
            var rMapNode =  this.rdf.sym(cnResolveUrl + encodeURIComponent(oldPid));
              var rMapStatements = $.extend(true, [], this.dataPackageGraph.statementsMatching(rMapNode));

                    // By first removing all statements by resource map subject
                    try {
                        this.dataPackageGraph.removeMany(rMapNode, undefined, undefined, undefined);
                    } catch (error) {
                        console.log(error);
                    }

                    // then repopulate them with correct values
                    _.each(rMapStatements, function(statement) {
                        subjectClone = this.rdf.Node.fromValue(statement.subject);
                        predicateClone = this.rdf.Node.fromValue(statement.predicate);
                        objectClone = this.rdf.Node.fromValue(statement.object);

                        // In the case of modified date, reset it to now()
                        if ( predicateClone.value === DC("modified") ) {
                            objectClone.value = new Date().toISOString();
                        }
                        subjectClone.value = cnResolveUrl + encodeURIComponent(pid);
                        this.dataPackageGraph.add(subjectClone, predicateClone, objectClone);
                    }, this);

                    // Add the describes/isDescribedBy statements back in
                    this.dataPackageGraph.add(
                        this.rdf.sym(cnResolveUrl + encodeURIComponent(pid)),
                        ORE("describes"),
                        this.rdf.sym(cnResolveUrl + encodeURIComponent(pid) + "#aggregation")
                    );
                    this.dataPackageGraph.add(
                        this.rdf.sym(cnResolveUrl + encodeURIComponent(pid) + "#aggregation"),
                        ORE("isDescribedBy"),
                        this.rdf.sym(cnResolveUrl + encodeURIComponent(pid))
                    );

                  //Add nodes for new package members
                  _.each(addedIds, function(id) {
                    this.addToAggregation(id);
                  }, this);


                } else {

                  // Create the OAI-ORE graph from scratch
                    this.dataPackageGraph = this.rdf.graph();
                    cnResolveUrl = MetacatUI.appModel.get("resolveServiceUrl") || "https://cn.dataone.org/cn/v2/resolve/";
                    this.dataPackageGraph.cnResolveUrl = cnResolveUrl;
                    rMapNode = this.rdf.sym(cnResolveUrl + encodeURIComponent(this.packageModel.id));
                    aggregationNode = this.rdf.sym(cnResolveUrl + encodeURIComponent(this.packageModel.id) + "#aggregation");
                    modifiedDate = this.rdf.lit(new Date().toISOString(), "", XSD("dateTime"));

                    // Describe the resource map
                    // With a Creator
                    var creatorNode = this.rdf.blankNode();
                    var creatorName = this.rdf.lit(MetacatUI.appUserModel.get("firstName") +
                        " " +
                        MetacatUI.appUserModel.get("lastName"),
                        "",
                        XSD("string"));
                    this.dataPackageGraph.add(creatorNode, FOAF("name"), creatorName);
                    this.dataPackageGraph.add(creatorNode, RDF("type"), DCTERMS("Agent"));
                    this.dataPackageGraph.add(rMapNode, DC("creator"), creatorNode);

                    // Set the modified date
                    this.dataPackageGraph.add(rMapNode, DCTERMS("modified"), modifiedDate);

                    this.dataPackageGraph.add(rMapNode, RDF("type"), ORE("ResourceMap"));
                    this.dataPackageGraph.add(rMapNode, ORE("describes"), aggregationNode);
                    var idLiteral = this.rdf.lit(this.packageModel.id, "", XSD("string"));
                    this.dataPackageGraph.add(rMapNode, DCTERMS("identifier"), idLiteral);

                    // Describe the aggregation
                    this.dataPackageGraph.add(aggregationNode, ORE("isDescribedBy"), rMapNode);

                    // Aggregate each package member
                    _.each(idsFromModel, function(id) {
                        this.addToAggregation(id);

                    }, this);
                }

                var xmlString = serializer.statementsToXML(this.dataPackageGraph.statements);

              return xmlString;
            },

            // Clone an rdflib.js Node by creaing a new node based on the
            // original node RDF term type and data type.
            cloneNode: function(nodeToClone) {
                switch(nodeToClone.termType) {
                    case "NamedNode":
                        return(this.rdf.sym(nodeToClone.value));
                        break;
                    case "Literal":
                        // Check for the datatype for this literal value, e.g. http://www.w3.org/2001/XMLSchema#string"
                        if(typeof nodeToClone.datatype !== "undefined") {
                            return(this.rdf.literal(nodeToClone.value, undefined, nodeToClone.datatype));
                        } else {
                            return(this.rdf.literal(nodeToClone.value));
                        }
                        break;
                    case "BlankNode":
                        return(this.rdf.bnode(nodeToClone.value));
                        break;
                    case "Collection":
                        // TODO: construct a list of nodes for this term type.
                        return(this.rdf.list(nodeToClone.value));
                        break;
                    default:
                        console.log("ERROR: unknown node type to clone: " + nodeToClone.termType);
                }
            },

            // Adds a new object to the resource map RDF graph
            addToAggregation: function(id){
              if(id.indexOf(this.dataPackageGraph.cnResolveUrl) < 0)
                var fullID = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
              else{
                var fullID = id;
                id = id.substring(this.dataPackageGraph.cnResolveUrl.lastIndexOf("/") + 1);
              }

              // Initialize the namespaces
              var ORE     = this.rdf.Namespace(this.namespaces.ORE),
                DCTERMS = this.rdf.Namespace(this.namespaces.DCTERMS),
                XSD     = this.rdf.Namespace(this.namespaces.XSD),
                CITO    = this.rdf.Namespace(this.namespaces.CITO);

              // Create a node for this object, the identifier, the resource map, and the aggregation
              var objectNode = this.rdf.sym(fullID),
                mapNode    = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.packageModel.get("id"))),
                aggNode    = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.packageModel.get("id")) + "#aggregation"),
                idNode     = this.rdf.literal(id, undefined, XSD("string")),
                    idStatements = [],
                    aggStatements = [],
                    aggByStatements = [],
                    documentsStatements = [],
                    isDocumentedByStatements = [];

              // Add the statement: this object isAggregatedBy the resource map aggregation
                aggByStatements = this.dataPackageGraph.statementsMatching(objectNode, ORE("isAggregatedBy"), aggNode);
                if ( aggByStatements.length < 1 ) {
              this.dataPackageGraph.add(objectNode, ORE("isAggregatedBy"), aggNode);

                }
          // Add the statement: The resource map aggregation aggregates this object
                aggStatements = this.dataPackageGraph.statementsMatching(aggNode, ORE("aggregates"), objectNode);
                if ( aggStatements.length < 1 ) {
              this.dataPackageGraph.add(aggNode, ORE("aggregates"), objectNode);

                }
          // Add the statement: This object has the identifier {id} if it isn't present
                idStatements = this.dataPackageGraph.statementsMatching(objectNode, DCTERMS("identifier"), idNode);
                if ( idStatements.length < 1 ) {
              this.dataPackageGraph.add(objectNode, DCTERMS("identifier"), idNode);

                }

          // Find the metadata doc that describes this object
          var model   = _.find(this.models, function(m){ return m.get("id") == id }),
            isDocBy = model.get("isDocumentedBy"),
            documents = model.get("documents");

                // Deal with Solr indexing bug where metadata-only packages must "document" themselves
                if ( isDocBy.length === 0 && documents.length === 0 ) {
                    documents.push(model.get("id"));

                }

          // If this object is documented by any metadata...
          if(isDocBy && isDocBy.length){
            // Get the ids of all the metadata objects in this package
            var  metadataInPackage = _.compact(_.map(this.models, function(m){ if(m.get("formatType") == "METADATA") return m.get("id"); }));

            // Find the metadata IDs that are in this package that also documents this data object
            var metadataIds = Array.isArray(isDocBy)? _.intersection(metadataInPackage, isDocBy) : _.intersection(metadataInPackage, [isDocBy]);

            // If this data object is not documented by one of these metadata docs,
            // then we should check if it's documented by an obsoleted pid. If so,
            // we'll want to change that so it's documented by a current metadata.
            if( metadataIds.length == 0 ){

              for(var i=0; i < metadataInPackage.length; i++){

                //If the previous version of this metadata documents this data,
                if( _.contains(isDocBy, metadataInPackage[i].get("obsoletes")) ){
                  //Save the metadata id for serialization
                  metadataIds = [metadataInPackage[i].get("id")];

                  //Exit the for loop
                  break;
                }
              }

            }

            // For each metadata that documents this object, add a CITO:isDocumentedBy and CITO:documents statement
            _.each(metadataIds, function(metaId){
              //Create the named nodes and statements
              var dataNode         = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id)),
                metadataNode     = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(metaId)),
                isDocByStatement = this.rdf.st(dataNode, CITO("isDocumentedBy"), metadataNode),
                documentsStatement = this.rdf.st(metadataNode, CITO("documents"), dataNode);

                        // Add the statements
                        documentsStatements = this.dataPackageGraph.statementsMatching(metadataNode, CITO("documents"), dataNode);
                        if ( documentsStatements.length < 1 ) {
                            this.dataPackageGraph.add(documentsStatement);
                        }
                        isDocumentedByStatements = this.dataPackageGraph.statementsMatching(dataNode, CITO("isDocumentedBy"), metadataNode);
                        if ( isDocumentedByStatements.length < 1 ) {
                            this.dataPackageGraph.add(isDocByStatement);
                        }
            }, this);
          }

          // If this object documents a data object
          if(documents && documents.length){
            // Create a literal node for it
            var metadataNode = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id));

            _.each(documents, function(dataID){

              //Make sure the id is one that will be aggregated
              if( _.contains(this.idsToAggregate, dataID) ){
                // Create a named node for the data object
                var dataNode = this.rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(dataID)),
                // Create a statement: This metadata documents this data
                documentsStatement = this.rdf.st(metadataNode, CITO("documents"), dataNode),
                // Create a statement: This data is documented by this metadata
                isDocByStatement = this.rdf.st(dataNode, CITO("isDocumentedBy"), metadataNode);

                // Add the statements
                documentsStatements = this.dataPackageGraph.statementsMatching(metadataNode, CITO("documents"), dataNode);
                if ( documentsStatements.length < 1 ) {
                    this.dataPackageGraph.add(documentsStatement);
                }
                isDocumentedByStatements = this.dataPackageGraph.statementsMatching(dataNode, CITO("isDocumentedBy"), metadataNode);
                if ( isDocumentedByStatements.length < 1 ) {
                    this.dataPackageGraph.add(isDocByStatement);
                }
              }
            }, this);
          }
            },

            /*
             * Removes an object from the aggregation in the RDF graph
             */
            removeFromAggregation: function(id){
                if ( id.indexOf(this.dataPackageGraph.cnResolveUrl) == -1 ) {
                    id = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
                }

              // Create a literal node for the removed object
              var removedObjNode = this.rdf.sym(id),
              // Get the statements from the RDF where the removed object is the subject or object
                statements = $.extend(true, [],
                        _.union(this.dataPackageGraph.statementsMatching(undefined, undefined, removedObjNode),
                        this.dataPackageGraph.statementsMatching(removedObjNode)));

              // Remove all the statements mentioning this object
                try {
                    this.dataPackageGraph.remove(statements);

                } catch (error) {
                    console.log(error);
                }
            },

            /*
             * Checks if this resource map has had any changes that requires an update
             */
            needsUpdate: function(){
              //Check for changes to the list of aggregated members
              var ids = this.pluck("id");
              if(this.originalMembers.length != ids.length || _.intersection(this.originalMembers, ids).length != ids.length)
                return true;

              // If the provenance relationships have been updated, then the resource map
              // needs to be updated.
              if(this.provEdits.length) return true;
              //Check for changes to the isDocumentedBy relationships
              var isDifferent = false,
                i = 0;

              //Keep going until we find a difference
              while(!isDifferent && i<this.length){
                //Get the original isDocBy relationships from the resource map, and the new isDocBy relationships from the models
                var isDocBy = this.models[i].get("isDocumentedBy"),
                  id = this.models[i].get("id"),
                  origIsDocBy = this.originalIsDocBy[id];

                //Make sure they are both formatted as arrays for these checks
                isDocBy = _.compact(Array.isArray(isDocBy)? isDocBy : [isDocBy]);
                origIsDocBy = _.compact(Array.isArray(origIsDocBy)? origIsDocBy : [origIsDocBy]);

                //Remove the id of this object so metadata can not be "isDocumentedBy" itself
                isDocBy = _.without(isDocBy, id);

                //Simply check if they are the same
                if(origIsDocBy === isDocBy){
                  i++;
                  continue;
                }
                //Are the number of relationships different?
                else if(isDocBy.length != origIsDocBy.length)
                  isDifferent = true;
                //Are the arrays the same?
                else if(_.intersection(isDocBy, origIsDocBy).length != origIsDocBy.length)
                  isDifferent = true;

                i++;
              }

              return isDifferent;
            },

            /*
             * Returns an array of the models that are in the queue or in progress of uploading
             */
            getQueue: function(){
              return this.filter(function(m){ return m.get("uploadStatus") == "q" || m.get("uploadStatus") == "p" });
            },

            /*
            *  Adds a DataONEObject model to this DataPackage collection
            */
            addNewModel: function(model){

              //Check that this collection doesn't already contain this model
              if( !this.contains(model) ){
                this.add(model);

                //Mark this data package as changed
                this.packageModel.set("changed", true);
                this.packageModel.trigger("change:changed");
              }

            },

            handleAdd: function(dataONEObject){
              var metadataModel = this.find(function(m){ return m.get("type") == "Metadata" });

              // Append to or create a new documents list
              if(metadataModel){
                if( !Array.isArray(metadataModel.get("documents")) ) {
                  metadataModel.set("documents", [dataONEObject.id]);

                } else {
                  if( !_.contains( metadataModel.get("documents"), dataONEObject.id ) )
                     metadataModel.get("documents").push(dataONEObject.id);
                }

                // Create an EML Entity for this DataONE Object if there isn't one already
                if(metadataModel.type == "EML" && !dataONEObject.get("metadataEntity") && dataONEObject.type != "EML"){
                  metadataModel.createEntity(dataONEObject);
                  metadataModel.set("uploadStatus", "q");
                }

              }

              this.saveReference(dataONEObject);

              //Save a reference to this DataPackage
              // If the collections attribute is an array
/*              if( Array.isArray(dataONEObject.get("collections")) ){
                //Add this DataPackage to the collections list if it's not already in the array
                if( !_.contains(dataONEObject.get("collections"), this) ){
                  dataONEObject.get("collections").push(this);
                }
              }
              //If the collections attribute is not an array but there is a value,
              else if(dataONEObject.get("collections")){

                //And if the value is not this DataPackage or it's pid, then set it on the model
                if( dataONEObject.get("collections") != this && dataONEObject.get("collections") != this.get("id") ){
                  dataONEObject.set("collections", [dataONEObject.get("collections"), this] );
                }
                //Otherwise, set the collections attribute to this DataPackage in an array
                else {
                  dataONEObject.set("collections", [this]);
                }

              }
              // If there is no value set on the collections attribute, then set it to
              // this DataPackage in an array
              else{
                dataONEObject.set("collections", [this]);
              }
*/

            },

            /*
             * Update the relationships in this resource map when its been udpated
             */
            updateRelationships: function(){
              //Get the old id
              var oldId = this.packageModel.get("oldPid");

              if(!oldId) return;

              //Update the resource map list
              this.each(function(m){
                var updateRMaps = _.without(m.get("resourceMap"), oldId);
                updateRMaps.push(this.packageModel.get("id"));

                m.set("resourceMap", updateRMaps);
              }, this);
            },

            saveReference: function(model){
              //Save a reference to this collection in the model
              var currentCollections = model.get("collections");
              if(currentCollections.length > 0){
                currentCollections.push(this);
                  model.set("collections", _.uniq(currentCollections));
              }
              else
                model.set("collections", [this]);
            }

        });

        return DataPackage;
    }
);
