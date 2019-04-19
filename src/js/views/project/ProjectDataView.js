define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "views/project/ProjectSectionView",
    "views/DataCatalogViewWithFilters",
    "views/filters/FilterGroupsView"],
    function($, _, Backbone, Filters, ProjectSectionView, DataCatalogView, FilterGroupsView){

    /* The ProjectDataView is a view to render the
     * project data tab (within ProjectView) to display all the datasets related to this project.
     */
      var ProjectDataView = ProjectSectionView.extend({

        tagName: "div",

        // @type {ProjectModel} - The Project associated with this view
        model: null,

        render: function(){

          if( this.id ){
            this.$el.attr("id", this.id);
          }

          var searchResults;
          var searchModel = this.model.get("searchModel");

          //Set some options on the searchResults
          searchResults = this.model.get("searchResults");
          //Get the documents values as a facet so we can get all the data object IDs
          searchResults.facet = ["documents", "id"];
          //Retrieve only 5 result rows
          searchResults.rows = 5;

          //Render the filters
          var filterGroupsView = new FilterGroupsView({
            filterGroups: this.model.get("filterGroups"),
            filters: this.model.get("searchModel").get("filters")
          });

          filterGroupsView.render();
          this.$el.append(filterGroupsView.el);

          //Create a DataCatalogView
          var dataCatalogView = new DataCatalogView({
            mode: "map",
            searchModel: this.model.get("searchModel"),
            searchResults: searchResults,
            mapModel: this.model.get("mapModel"),
            isSubView: true,
            filters: false
          });

          dataCatalogView.render();
          this.$el.append(dataCatalogView.el);

        }

     });

     return ProjectDataView;
});
