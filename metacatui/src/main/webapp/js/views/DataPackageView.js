/* global define */
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/DataPackage',
    'models/DataONEObject',
    'models/metadata/ScienceMetadata',
    'models/metadata/eml211/EML211', 'views/DataItemView',
    'text!templates/dataPackage.html',
    'text!templates/loading.html'], 
    function($, _, Backbone, DataPackage, DataONEObject, ScienceMetadata, EML211, DataItemView, 
    		DataPackageTemplate) {
        'use strict';
        
        /*
         *  The main view of a Data Package in the editor.  The view is
         *  composed of a citation section at the top, a file/folder browser
         *  below it, followed by a metadata viewer below that, which has a nav
         *  sidebar, and a metadata content section.
         */
        var DataPackageView = Backbone.View.extend({
                        
            tagName: "table",
            
            className: "table table-striped table-hover table-condensed",
            
            id: "data-package-table",
            
            subviews: [],
            
            template: _.template(DataPackageTemplate),
            
            // Models waiting for their parent folder to be rendered, hashed by parent id:
            // {'parentid': [model1, model2, ...]}
            delayedModels: {},
            
            initialize: function(options) {
                // listen for  add events because models are being merged
                this.listenTo(MetacatUI.rootDataPackage, 'add', this.addOne); // render new items
                //this.listenTo(MetacatUI.rootDataPackage, 'complete', this.addAll); // render all items
                
                return this;
                
            },
            
            /*
             *  Render the DataPackage HTML
             */
            render: function() {

                this.$el.append(this.template({
                	loading: MetacatUI.appView.loadingTemplate({msg: "Loading files table... "})
                }));
                
                return this;
            },
            
            /*
             * Add a single DataItemView row to the DataPackageView
             */
            addOne: function(item) {
                console.log("DataPackageView.addOne called for " + item.id);
                
                var dataItemView = new DataItemView({model: item});
                
                if ( Array.isArray(this.subviews) ) {
                    this.subviews.push(dataItemView); // keep track of all views
                    
                }
                var scimetaParent = item.get("isDocumentedBy");
                if ( typeof scimetaParent !== "undefined" ) {
                    scimetaParent = scimetaParent[0];
                    
                }
                var parentRow, delayed_models;
                if ( typeof scimetaParent !== "undefined" ) {
                    
                    if ( scimetaParent !== null ) {
                        
                        // Using DOM methods is easier than escaping special chars
                        // !"#$%&'()*+,./:;<=>?@[\]^`{|}~ in jquery $('selector')
                        parentRow = document.getElementById(scimetaParent);
                    
                        if ( typeof parentRow !== undefined && parentRow != null ) {
                            // This is a data row, insert below it's metadata parent folder
                            parentRow.insertAdjacentElement("afterend", dataItemView.render().el);
                            
                            // Remove it from the delayedModels list if necessary
                            if ( _.contains(Object.keys(this.delayedModels), scimetaParent) ) {
                                delayed_models = this.delayedModels[scimetaParent];
                                var index = _.indexOf(delayed_models, item);
                                delayed_models = delayed_models.splice(index, 1);
                                
                                // Put the shortened array back if delayed models remains
                                if ( delayed_models.length > 0 ) {
                                    this.delayedModels[scimetaParent] = delayed_models;
                                    
                                } else {
                                    this.delayedModels[scimetaParent] = undefined;
                                    
                                }
                            }
                        } else {
                            console.log("Couldn't render " + item.id + "Delayed until parent is rendered.");
                            // Postpone the data row until the parent is rendered
                            delayed_models = this.delayedModels[scimetaParent];
                            
                            // Delay the model rendering if it isn't already delayed
                            if ( typeof delayed_models !== "undefined" ) {
                                
                                if ( ! _.contains(delayed_models, item) ) {
                                    delayed_models.push(item);
                                    this.delayedModels[scimetaParent] = delayed_models;
                                    
                                }
                                
                            } else {
                                delayed_models = [];
                                delayed_models.push(item);
                                this.delayedModels[scimetaParent] = delayed_models;
                            }                        
                        }
                        
                    } else {
                        // Not sure we ever get here - still append metadata folder row
                        $('#data-package-table-body').append(dataItemView.render().el);
                        
                    }
                } else {
                    // This is a metadata folder row, append it to the table
                    $('#data-package-table-body').append(dataItemView.render().el);
                    
                    // Render any delayed models if this is the parent
                    if ( _.contains(Object.keys(this.delayedModels), dataItemView.id) ) {
                        
                        delayed_models = this.delayedModels[dataItemView.id];
                        _.each(delayed_models, this.addOne, this);
                        
                    }
                }
                
            },
            
            /*
             * Add all rows to the DataPackageView
             */
            addAll: function() {
                $('#data-package-table-body').html(''); // clear the table first
                MetacatUI.rootDataPackage.sort();
                MetacatUI.rootDataPackage.each(this.addOne, this);
                
            },
            
            /*
             * Close subviews as needed
             */
            onClose: function() {
                // Close each subview
                _.each(this.subviews, function(i, subview) {
    				subview.onClose();
                
                });
            
                this.subviews = [];
                
            }
            
        });
        return DataPackageView;
});