define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "views/portals/PortalSectionView",
    "views/DataCatalogViewWithFilters",
    "views/filters/FilterGroupsView"],
    function($, _, Backbone, Filters, PortalSectionView, DataCatalogView, FilterGroupsView){

    /**
    * @class PortalDataView
    * @classdesc The PortalDataView is a view to render the
     * portal data tab (within PortalView) to display all the datasets related to this portal.
     * @classcategory Views/Portals
     * @extends PortalSectionView
     * @constructor
     */
      var PortalDataView = PortalSectionView.extend(
        /** @lends PortalDataView.prototype */{

        tagName: "div",

        /**
        * The Portal associated with this view
        * @type {PortalModel}
        */
        model: null,

        /**
        * An array of subviews in this view
        * @type {Backbone.View[]}
         */
        subviews: [],

        /**
        * The display name for this Section
        * @type {string}
        */
        uniqueSectionLabel: "Data",

        render: function(){

          if( this.id ){
            this.$el.attr("id", this.id);
          }

          var searchResults;
          var searchModel = this.model.get("searchModel");

          //Set some options on the searchResults
          searchResults = this.model.get("searchResults");

          //If Solr joins are disabled, get the documents and id facets for the PortalMetricsView
          if( !MetacatUI.appModel.get("enableSolrJoins") ){
            //Get the documents values as a facet so we can get all the data object IDs
            searchResults.facet = ["documents", "id"];
          }

          //Retrieve only 5 result rows
          searchResults.rows = 25;

          //Hide the Filters that are part of the Collection definition.
          var searchFilters = this.model.get("searchModel").get("filters");
          searchFilters.each(function(searchFilter){
            //Check if this Filter model is also part of the definition filters collection
            if( this.model.get("definitionFilters").contains(searchFilter) ){
              searchFilter.set("isInvisible", true);
            }
          }, this);

          //Render the filters
          var filterGroupsView = new FilterGroupsView({
            filterGroups: this.model.get("filterGroups"),
            filters: this.model.get("searchModel").get("filters")
          });

          this.$el.append(filterGroupsView.el);
          filterGroupsView.render();
          this.subviews.push(filterGroupsView);

          //Create a DataCatalogView
          var dataCatalogView = new DataCatalogView({
            mode: "map",
            searchModel: this.model.get("searchModel"),
            searchResults: searchResults,
            mapModel: this.model.get("mapModel"),
            isSubView: true,
            filters: false,
            fixedHeight: true,
            filterGroupsView: filterGroupsView
          });

          this.dataCatalogView = dataCatalogView;
          var view = this;

          this.$el.append(dataCatalogView.el);
          this.$el.data("view", this);

          dataCatalogView.render();

          // Listener to handle the semantic annotation search
          this.listenTo( filterGroupsView, "updateDataCatalogView", function(event, item){
            view.dataCatalogView.updateTextFilters(event, item);
            view.dataCatalogView.triggerSearch();
          });

        }

     });

     return PortalDataView;
});
