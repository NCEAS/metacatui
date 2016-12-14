/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone', 'rdflib', "uuid",
    'models/DataONEObject', 'models/metadata/ScienceMetadata', 'models/metadata/eml211/EML211'],
    function($, _, Backbone, rdf, uuid, DataONEObject, ScienceMetadata, EML211) {
    
        /* 
         A DataPackage represents a hierarchical collection of 
         packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
         TODO: incorporate Backbone.UniqueModel
        */
        var DataPackage = Backbone.Collection.extend({
                        
            // The package identifier
            id: null,
            
            // The type of the object (DataPackage, Metadata, Data)
            type: 'DataPackage',
            
            // The map of nested child data package members of this data package
            childPackages: {},
            
            // Simple queue to enqueue file transfers. Use push() and shift()
            // to add and remove items. If this gets to large/slow, possibly
            // switch to http://code.stephenmorley.org/javascript/queues/
            transferQueue: [],
            
            // A flag ued for the package's edit status. Can be 
            // set to false to 'lock' the package
            editable: true,
            
            // The RDF graph representing this data package
            dataPackageGraph: null,
            
            // The science data identifiers associated with this 
            // data package (from cito:documents), mapped to the science metadata
            // identifier that documents it
            scienceMetadataMap: {},
                  
            // Keep the collection sorted by model "order".  The three model types
            // are ordered as:
            //  Metadata: 1
            //  Data: 2
            //  DataPackage: 3
            // See getMember(). We do this so that Metadata get rendered first, and Data are
            // rendered as DOM siblings of the Metadata rows of the DataPackage table.
            comparator: "order",
            
            // The nesting level in a data package hierarchy
            nodelevel: 0,
            
            // Constructor: Initialize a new DataPackage
            initialize: function(models, options) {
                
                // Create an initial RDF graph 
                this.dataPackageGraph = rdf.graph();
                
                if ( typeof options === "undefined" || 
                     typeof options === null || 
                     typeof options.id === "undefined") {
                    this.id = "urn:uuid:" + uuid.v4();
                
                // Otherwise fetch it by id, and populate it    
                } else {
                    // use the given id
                    this.id = options.id;
                    
                }
                
                return this;  
            },
            
            // Build the DataPackage URL based on the MetacatUI.appModel.objectServiceUrl 
            // and id or seriesid
            url: function() {
                              
                return MetacatUI.appModel.get("objectServiceUrl") + 
                    (encodeURIComponent(this.id) || encodeURIComponent(this.seriesid));
                
            },
            
            /* 
             * The DataPackage collection stores DataPackages and 
             * DataONEObjects, including Metadata nad Data objects.
             * Return the correct model based on the type
             */
            model: function (attrs, options) {
                  
                        //if(!attrs.formatid) return;
                                                
                switch ( attrs.formatid ) {
                
                    case "http://www.openarchives.org/ore/terms":
                        return new DataPackage(null, attrs); // TODO: is this correct?
                        
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
                console.log("DataPackage: fetch() called.");
                
                var fetchOptions = _.extend({dataType: "text"}, options);
                
                //Add the authorization options 
                fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());
                
                
                return Backbone.Collection.prototype.fetch.call(this, fetchOptions);
            },
            
            /* 
             * Deserialize a Package from OAI-ORE RDF XML
             */
            parse: function(response, options) {
                console.log("DataPackage: parse() called.")
                
                if ( typeof response !== "string" ) {
                    console.log("RDF is not a string. Skipping.");
                    return;
                }
                
                var RDF =     rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
                    FOAF =    rdf.Namespace("http://xmlns.com/foaf/0.1/"),
                    OWL =     rdf.Namespace("http://www.w3.org/2002/07/owl#"),
                    DC =      rdf.Namespace("http://purl.org/dc/elements/1.1/"),
                    ORE =     rdf.Namespace("http://www.openarchives.org/ore/terms/"),
                    DCTERMS = rdf.Namespace("http://purl.org/dc/terms/"),
                    CITO =    rdf.Namespace("http://purl.org/spar/cito/");
                    
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
                    rdf.parse(response, this.dataPackageGraph, this.url(), 'application/rdf+xml');
                    
                    // List the metadata/data relationships and store them in the scienceMetadataMap
                    documentsStatements = this.dataPackageGraph.statementsMatching(
                        undefined, CITO("documents"), undefined, undefined);
                        
                    _.each(documentsStatements, function(documentsStatement) {
                    
                          // Extract and URI-decode the metadata pid
                          scimetaID = decodeURIComponent(
                                _.last(documentsStatement.subject.value.split("/")));
                          
                          // Extract and URI-decode the data pid
                          scidataID = decodeURIComponent(
                              _.last(documentsStatement.object.value.split("/")));
                    
                          // Store the relationship
                          this.scienceMetadataMap[scidataID] = scimetaID;
                    
                    }, this);            
                    
                      // List the package members
                      memberStatements = this.dataPackageGraph.statementsMatching(
                          undefined, ORE("aggregates"), undefined, undefined);
                    
                    // Get system metadata for each member to eval the formatId
                    _.each(memberStatements, function(memberStatement){
                        memberURIParts = memberStatement.object.value.split("/");
                        memberPIDStr = _.last(memberURIParts);
                        memberPID = decodeURIComponent(memberPIDStr);   
                        
                        
                        if ( memberPID ) {
                            memberPIDs.push(memberPID);

                        }
                        
                    }, this);
                    
                    //Keep the pids in the collection for easy access later
                    this.pids = memberPIDs;
                    
                    //Retrieve the model for each member 
                    _.each(memberPIDs, function(pid){
                        var isDocumentedBy;
                        if ( typeof this.scienceMetadataMap[pid] !== "undefined") {
                            isDocumentedBy = [this.scienceMetadataMap[pid]];
                        }
                        memberModel = new DataONEObject(
                            {id: pid, 
                             isDocumentedBy: isDocumentedBy,
                             resourceMap: [this.id]}
                        );
                        this.listenTo(memberModel, 'change:formatid', this.getMember);
                        memberModel.fetch();
                        models.push(memberModel.attributes);
                    }, this);

                                        
                } catch (error) {
                    console.log(error);
                    
                }
                return models;
                
            },
            
            /*
             * When a data package member updates, we evaluate it for its formatid,
             * and update it appropriately if it is not a data object only
             */
            getMember: function(context, args) {
                var memberModel = {};
                
                switch ( context.get("formatid") ) {
                    
                    case "http://www.openarchives.org/ore/terms":
                        context.attributes.id = context.id;
                        context.attributes.type = "DataPackage";
                        memberModel = new DataPackage(null, context.attributes);
                        this.childPackages[memberModel.id] = memberModel;
                        break;
                        
                    case "eml://ecoinformatics.org/eml-2.0.0":
                        context.set({type: "Metadata", order: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                        
                    case "eml://ecoinformatics.org/eml-2.0.1":
                        context.set({type: "Metadata", order: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                    
                    case "eml://ecoinformatics.org/eml-2.1.0":
                        context.set({type: "Metadata", order: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                    
                    case "eml://ecoinformatics.org/eml-2.1.1":
                        context.set({type: "Metadata", order: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                        
                    case "-//ecoinformatics.org//eml-access-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-access-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta4//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta6//EN" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001-1998" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001.1-1999" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001.2-1999" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "INCITS-453-2009" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "ddi:codebook:2_5" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datacite.org/schema/kernel-3.0" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datacite.org/schema/kernel-3.1" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datadryad.org/profile/v3.1" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://ns.dataone.org/metadata/schema/onedcx/v1.0" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://purl.org/dryad/terms/" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://purl.org/ornl/schema/mercury/terms/v1.0" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://rs.tdwg.org/dwc/xsd/simpledarwincore/" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.cuahsi.org/waterML/1.0/" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.cuahsi.org/waterML/1.1/" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.esri.com/metadata/esriprof80.dtd" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.icpsr.umich.edu/DDI" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.isotc211.org/2005/gmd" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.isotc211.org/2005/gmd-noaa" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.loc.gov/METS/" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2" :
                        context.set({type: "Metadata", order: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                        
                    default:
                        // For other data formats, keep just the DataONEObject sysmeta
                        context.set({type: "Data", order: 2});
                        memberModel = context;
                                                
                }
                
                if ( memberModel.type !== "DataPackage" ) {
                    // We have a model
                    memberModel.set("nodelevel", this.nodelevel); // same level for all members 
                    memberModel.set("synced", false); // initialize the sync status
                    // When the object is fetched, merge it into the collection
                    this.listenTo(memberModel, 'sync', this.mergeMember);
                
                    memberModel.fetch({merge: true});
                    
                } else {
                    // We have a nested collection
                    memberModel.nodelevel = this.nodelevel + 1;
                    this.listenTo(memberModel, 'sync', this.mergeMember);
                    memberModel.fetch({merge: true});
                }
                
            },
            
            /* Merge package members into the collection as they are fetched */
            mergeMember: function(model, response, options) {
                
                // avoid adding unpopulated members (still an xhr object)
                if ( typeof model.get === "undefined" ) { 
                    return; 
                }
                
                var mergeOptions = _.extend(options, {
                    merge: true,
                    // remove: false
                });
                
                model.set({synced: true});
                this.add(model, mergeOptions);
                this.trigger("added", model, this);
                
                //Check if the collection is done being retrieved
                var notSynced = this.where({synced: false});
                
                if( notSynced.length > 0 ){
                    return;
                    
                } else {
                    this.sort();
                    this.trigger("complete", this);
                    
                }
                
            },
            
            /* 
             * Serialize the DataPackage to OAI-ORE RDF XML
             */
            toRDF: function() {
              var rdfXml;
              
              return rdfXml;
            }
            
        });
        return DataPackage;
    }
);