define(["jquery",
        "underscore",
        "backbone",
        "views/DataCatalogView",
        "text!templates/datacatalog.html"
    ],
    function($, _, Backbone, DataCatalogView, template) {

        /**
         * A DataCatalogView that uses the Search collection
         * and the Filter models for managing queries rather than the
         * Search model and the filter literal objects used in the
         * parent DataCatalogView.  This accommodates custom project filters.
         */
        var DataCatalogViewWithFilters = DataCatalogView.extend({

            template: _.template(template),

            /*
             * Either hides or shows the "clear all filters" button
             */
            toggleClearButton: function() {

                var currentFilters = this.searchModel.getCurrentFilters();

                if (currentFilters && currentFilters.length > 0) {
                    this.showClearButton();
                } else {
                    this.hideClearButton();
                }
            }
        });
        return DataCatalogViewWithFilters;

    });