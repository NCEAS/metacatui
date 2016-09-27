/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone'],
  function($, _, Backbone) {
    
    /* 
     A DataPackage represents a hierarchical collection of 
     packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
     TODO: incorporate Backbone.UniqueModel
    */
    var DataPackage = Backbone.Collection.extend({
      
      // Default properties of the DataPackage
      defaults: function(){
        return {
            // none yet
        }
      },
      
      // The type of the object (Package, Metadata, Data)
      type: 'Package',
      
      // Simple queue to enqueue file transfers. Use push() and shift()
      // to add and remove items. If this gets to large/slow, possibly
      // switch to http://code.stephenmorley.org/javascript/queues/
      transferQueue: [],
      
      // The array of child packagISO-8859-1dit status of the package. Can be 
      // set to false to 'lock' the package
      editable: true,
      
      // Constructor: Initialize a new DataPackage
      initialize: function() {
      
        return this;  
      },
      
      /* 
       * The DataPackage collection stores DataPackages and 
       * DataONEObjects, including Metadata nad Data objects.
       * Return the correct model based on the type
       */
      model: function (attrs, options) {
        switch (attrs.type) {
          
        case 'DataPackage' :
          return new DataPackage(attrs, options);
          
        case 'Data':
          return new DataONEObject(attrs, options);
          
        case 'Metadata':
          return new ScienceMetadata(attrs, options);
          
        case 'EML211':
          return new EML211(attrs, options);
          
        default:
          return new DataONEObject(attrs, options);
        }
      },
      
      /* 
       * Deserialize a Package from OAI-ORE RDF XML
       */
      parse: function() {
        var dataPackage;
        
        return dataPackage;
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