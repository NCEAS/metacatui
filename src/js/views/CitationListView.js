/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/Citations', 'views/CitationView'],
    function($, _, Backbone, Citations, CitationView) {
    'use strict';

    var CitationListView = Backbone.View.extend({

        id: 'table',
        className: 'table',
        citationsCollection: null,
        emptyCitations: null,
        citationsForDataCatalogView: null,

        events: {

        },

        initialize: function(options) {
            if((typeof options == "undefined")){
                var options = {};
                this.emptyCitations = true;
                this.citationsForDataCatalogView = false;
            }

            if(options.citations === "undefined") {
                this.emptyCitations = true;
            }

            if( options.citationsForDataCatalogView !== "undefined" ) {
                this.citationsForDataCatalogView = options.citationsForDataCatalogView;
            }
            else {
                this.citationsForDataCatalogView = false;
            }
            
            // Initializing the Citation collection
            this.citationsCollection = options.citations;
            
        },


        // retrun the DOM object to the calling view.
        render: function() {
            this.renderView();
            return this;
        },


        // The renderView funciton creates a Citation table and appends every
        // citation found in the citations collection object.
        renderView: function() {
            var self = this;

            if (this.emptyCitations) {
                var $emptyList = $(document.createElement("div"))
                                            .addClass("empty-citation-list");

                if ( self.citationsForDataCatalogView ) {
                    var emptyString = `To report a citation of this dataset,
                        send the citation information to our support team at ` + 
                        MetacatUI.appModel.get("emailContact") + ".";
                }
                else {
                    var emptyString = `To report a citation of one of these datasets,
                        send the citation information to our support team at ` + 
                        MetacatUI.appModel.get("emailContact") + ".";
                }
                
                var $emptyDataElement = $(document.createElement("p"))
                                        .text(emptyString)
                                        .addClass("empty-citation-list-text");

                $emptyList.append($emptyDataElement);
                this.$el.append($emptyList);
            }
            else {

                var $table = $(document.createElement("table"))
                                            .addClass("metric-table table table-striped table-condensed");

                var $tableBody = $(document.createElement("tbody"));

                this.citationsCollection.each(
                    function(model) {
                        var citationView = new CitationView({model:model});
                        citationView.createLink = true;
                        var $tableRow = $(document.createElement("tr"));
                        var $tableCell = $(document.createElement("td"));
                        $tableCell.append(citationView.render().$el);
                        $tableRow.append($tableCell);
                        $tableBody.append($tableRow);
                    }
                );

                $table.append($tableBody);
                this.$el.append($table);
            }

        }
    });

     return CitationListView;
  });
