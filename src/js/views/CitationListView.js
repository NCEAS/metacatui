/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/Citations', 'views/CitationView'],
    function($, _, Backbone, Citations, CitationView) {
    'use strict';

    /**
    * @class CitationListView
    * @classdesc The CitationListView displays a list of Citation models
    * @classcategory Views
    * @extends Backbone.View
    * @constructor
    */
    var CitationListView = Backbone.View.extend(
      /** @lends CitationListView.prototype */{

        id: 'table',
        className: 'table',
        citationsCollection: null,
        emptyCitations: null,
        citationsForDataCatalogView: null,

        /**
        * If true, the "register a citation" tool will display. This can be turned off/on
        * with the {@link AppConfig#displayRegisterCitationTool} app configuration.
        * @type {boolean}
        * @since 2.15.0
        */
        displayRegisterCitationTool: MetacatUI.appModel.get("displayRegisterCitationTool"),

        events: {

        },

        registerCitationTemplate:  _.template("<a class='btn register-citation' >" +
                                                "<i class='icon icon-plus'>" +
                                                "</i> Register Citation</a>"),

        initialize: function(options) {
            if((typeof options == "undefined")){
                var options = {};
                this.emptyCitations = true;
                this.citationsForDataCatalogView = false;
            }

            if(typeof options.citations === "undefined") {
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

            // Get node display name for the message
            var nodeId = MetacatUI.appModel.get("nodeId");
            // get the node Info
            var nodeInfo =  _.find(MetacatUI.nodeModel.get("members"), function(nodeModel) {
                return nodeModel.identifier.toLowerCase() == nodeId.toLowerCase();
            });
            var nodeName = "DataONE"
            if (nodeInfo !== undefined)
                var nodeName = nodeInfo.name;

            if (this.emptyCitations) {
                var $emptyList = $(document.createElement("div"))
                                            .addClass("empty-citation-list");

                // Dataset landing page - metadataview
                if ( self.citationsForDataCatalogView ) {
                    var emptyString = "We couldn't find any citations for this dataset.";

                    if (self.displayRegisterCitationTool)
                        emptyString += " If this dataset has been cited, you can register the citation to " + nodeName + ".";

                    var $emptyDataElement = $(document.createElement("p"))
                        .text(emptyString)
                        .addClass("empty-citation-list-text");

                    if (self.displayRegisterCitationTool)
                        $emptyList.append(this.registerCitationTemplate());

                    $emptyList.append($emptyDataElement);

                }
                else {
                    var emptyString = "We couldn't find any citations for these datasets. " +
                        "To report a citation of one of these datasets, " +
                        "send the citation information to our support team at " ;

                    var $emptyDataElement = $(document.createElement("p"))
                        .text(emptyString)
                        .addClass("empty-citation-list-text");

                    // Adding Email link
                    var $emailLink = $('<a>', {
                        href: 'mailto:' + MetacatUI.appModel.get("emailContact"),
                        text: MetacatUI.appModel.get("emailContact")
                    });
                    $emptyDataElement.append($emailLink);

                    $emptyList.append($emptyDataElement);
                }

                this.$el.append($emptyList);
            }
            else {

                var $table = $(document.createElement("table"))
                                            .addClass("metric-table table table-striped table-condensed");

                var $tableBody = $(document.createElement("tbody"));

                this.citationsCollection.each(
                    function(model) {
                        var citationView = new CitationView({
                            model: model,
                            createLink: true
                        });
                        var $tableRow = $(document.createElement("tr"));
                        var $tableCell = $(document.createElement("td"));
                        $tableCell.append(citationView.render().$el);
                        $tableRow.append($tableCell);
                        $tableBody.append($tableRow);
                    }
                );

                $table.append($tableBody);
                this.$el.append($table);

                // Dataset landing page - metadataview
                if ( self.citationsForDataCatalogView ) {
                    var $emptyList = $(document.createElement("div"))
                                        .addClass("register-citation-element");

                    var registerCitationString = "If this dataset has additional citations, you can now register that citation to " + nodeName + ".";

                    var $registerCitationElement = $(document.createElement("p"))
                        .text(registerCitationString)
                        .addClass("register-citation-text");

                    $emptyList.append($registerCitationElement);
                    $emptyList.append(this.registerCitationTemplate());
                }
                this.$el.append($emptyList);
            }

        }
    });

     return CitationListView;
  });
