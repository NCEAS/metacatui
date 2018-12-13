define(["jquery",
    "underscore",
    "backbone",
    "collections/Search",
    "views/project/ProjectSectionView",
    "views/DataCatalogViewWithFilters",
    "text!templates/project/projectHome.html",
    "views/MarkdownView"],
    function($, _, Backbone, Search, ProjectSectionView, DataCatalogView, 
      ProjectHomeTemplate, MarkdownView){

    /* The ProjectHomeView is a view to render the
     * project home tab (within ProjectSectionView)
     * with a project TOC, ProjectFiltersView,
     * SearchResultsView, ProjectMapView, MarkdownView,
     * ProjectMembersView, and ProjectLogosView.
     */
      var ProjectHomeView = ProjectSectionView.extend({

        // @type {ProjectModel} - The Project associated with this view
        model: null,

        template: _.template(ProjectHomeTemplate),

        render: function(){

          this.$el.html(this.template());

          //Set some options on the searchResults
          var searchResults = this.model.get("searchResults");
          searchResults.rows = 5;

          //Create a DataCatalogView
          var dataCatalogView = new DataCatalogView({
            mode: "map",
            searchModel: this.model.get("search"),
            searchResults: searchResults,
            mapModel: this.model.get("mapModel"),
            el: "#project-search-results",
            isSubView: true
          });

          dataCatalogView.render();

          var sectionMarkdownView = new MarkdownView({
            markdown: this.model.get("overview").get("markdown"),
            el: "#project-description-container"
          });
          sectionMarkdownView.render();
        }

     });

     return ProjectHomeView;
});
