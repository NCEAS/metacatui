/* global define */
define([
    'jquery',
    'underscore',
    'backbone',
    'models/DataPackage',
    'models/DataONEObject',
    'models/metadata/ScienceMetadata',
    'models/metadata/eml211/EML211',
    'views/EML211View',
    'models/UserModel'], 
    function($, _, Backbone, DataPackage, DataONEObject, ScienceMetadata, EML211, EML211View, UserModel) {
        'use strict';
        
        /*
            The main view of a Data Package in the editor.  The view is
            composed of a citation section at the top, a file/folder browser
            below it, followed by a metadata viewer below that, which has a nav
            sidebar, and a metadata content section.
        */
        var DataPackageView = Backbone.View.extend({
            
            el: "#Content",
            
            dataPackage: null,
            
            initialize: function(options) {
                
            },
            
            
        });
        return DataPackageView;
});