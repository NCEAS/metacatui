/* global define */
"use strict";
define(['jquery', 'underscore', 'backbone', 'models/UserModel'],
    function($, _, Backbone, UserModel){
  
        /* 
         A DataONEObject represents a DataONE object that has a format
         type of DATA, METADATA, or RESOURCE.  It stores the system
         metadata attributes for the object at a minimum.
         TODO: incorporate Backbone.UniqueModel
        */
        var DataONEObject = Backbone.Model.extend({
            
            type: null,
            serialVersion: null,
            id: null,
            formatId: null,
            formatType: null,
            size: null,
            checksum: null,
            checksumAlgorithm: null,
            submitter: null,
            rightsHolder : null,
            accessPolicy: [],
            replicationPolicy: [],
            obsoletes: null,
            obsoletedBy: null,
            archived: null,
            dateUploaded: null,
            dateSysMetadataModified: null,
            originMemberNode: null,
            authoritativeMemberNode: null,
            replica: [],
            seriesId: null,
            mediaType: null,
            fileName: null,
            nodeLevel: null,
            uploadStatus: null,
            uploadFile: null,
            
            /* Returns the serialized SystemMetadata for the object */
            getSystemMetadata: function() {
                var sysmeta = "";
                
                return sysmeta;
            },
            
            /* Updates the SystemMetadata for the object using MN.updateSystemMetadata() */
            updateSystemMetadata: function(sysmeta) {
                
                return this.id;
            },
            
            /* Validates the objects attributes on set() */
            validate: function() {
                var valid = false;
                
                return valid;
                
            },
            
            /* 
             Deserializes the incoming XML from the /meta REST endpoint
             and converts it into a DataONEObject.
            */
            parse: function(object) {
               
                return this; 
            },
            
            /*
             Serializes the DataONEObject into a SystemMetadata document.
            */
            toXML: function() {
                var sysmeta = "";
                
                return sysmeta;
            }
            
                    
        }); 
        
        return DataONEObject; 
    }
);