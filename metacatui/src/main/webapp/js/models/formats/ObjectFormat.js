/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone'], function($, _, Backbone) {
    
    /*
     * An ObjectFormat represents a V2 DataONE object format
     * See https://purl.dataone.org/architecture/apis/Types2.html#v2_0.Types.ObjectFormat
     */
    var ObjectFormat = Backbone.Model.extend({
        
        /* The default object format fields */
        defaults: function() {
            return {
                formatId: null,
                formatName: null,
                formatType: null,
                mediaType: null,
                extension: null
            };
        },
        
        /* Constructs a new instance */
        initialize: function(attrs, options) {
            console.log("ObjectFormat.initialize() called.");
            
        },
        
        /* 
         * The constructed URL of the model
         * (/cn/v2/formats/{formatId})
         */
        url: function() {
            if( ! this.get("formatId") ) return "";
            
            return MetacatUI.appModel.get("formatsServiceUrl") + 
                (encodeURIComponent(this.get("formatId")));
        },
        
        /* No op - Formats are read only */
        save: function() {
            console.log("Object format is read only. Not implemented");
            
            return false;
        }
    });
    
    return ObjectFormat;
});