define(["jquery",
    "underscore",
    "backbone",
    "views/DataCatalogView",
    "text!templates/datacatalog.html"],
    function($, _, Backbone, DataCatalogView, template){

    var DataCatalogViewWithFilters = DataCatalogView.extend({

      template: _.template(template),

      /*
      * Either hides or shows the "clear all filters" button
      */
      toggleClearButton: function(){

        var currentFilters = this.searchModel.getCurrentFilters();

        if(currentFilters && currentFilters.length > 0){
          this.showClearButton();
        }
        else{
          this.hideClearButton();
        }
      }

    });

    return DataCatalogViewWithFilters;

});
