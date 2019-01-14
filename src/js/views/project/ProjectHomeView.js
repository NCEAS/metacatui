define(["jquery",
    "underscore",
    "backbone",
    "collections/Search",
    "views/project/ProjectSectionView",
    "views/DataCatalogViewWithFilters",
    "views/filters/FilterGroupsView",
    "views/MarkdownView",
    "views/TOCView",
    "text!templates/project/projectHome.html"],
    function($, _, Backbone, Search, ProjectSectionView, DataCatalogView, FilterGroupsView,
      MarkdownView, TOCView, ProjectHomeTemplate){

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

          //Render the filters
          var filterGroupsView = new FilterGroupsView({
            filterGroups: this.model.get("filterGroups"),
            el: "#project-filters"
          });

          filterGroupsView.render();
          filterGroupsView.$el.addClass(filterGroupsView.className)

          //Create a MarkdownView
          var sectionMarkdownView = new MarkdownView({
            markdown: this.model.get("overview").get("markdown"),
            citations: this.model.get("literatureCited"),
            el: "#project-description-container"
          });

          //Render the table of contents view
          var h1s = [
            {
              "text": "Top",
              "icon": "icon-arrow-up",
              "link": "#metacatui-app",
              "showH2s": false
            },
            {
              "text": "Datasets",
              "icon": "icon-hdd",
              "link": filterGroupsView.el
            },
            {
              "text": "Project Description",
              "icon": "icon-file-text-alt",
              "link": sectionMarkdownView.el
            },
          ];
          this.tocView = new TOCView({
            h1s: h1s,
            el: "#project-toc-container"
          });
          //Set TOC to render after the Markdown section, so it
          // can get the rendered h2 tags
          this.tocView.stopListening();
          this.tocView.listenTo(sectionMarkdownView, "mdRendered", this.tocView.render);

          //Render the view
          sectionMarkdownView.render();
        }

     });

     return ProjectHomeView;
});
