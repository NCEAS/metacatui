define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "views/project/ProjectSectionView",
    "views/DataCatalogViewWithFilters",
    "views/filters/FilterGroupsView",
    "views/MarkdownView",
    "views/TOCView",
    "text!templates/project/projectHome.html"],
    function($, _, Backbone, Filters, ProjectSectionView, DataCatalogView, FilterGroupsView,
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
          var searchResults;
          var searchModel = this.model.get("searchModel");
          this.$el.html(this.template());

          //Set some options on the searchResults
          searchResults = this.model.get("searchResults");
          searchResults.rows = 5;

          //Create a DataCatalogView
          var dataCatalogView = new DataCatalogView({
            mode: "map",
            searchModel: this.model.get("searchModel"),
            searchResults: searchResults,
            mapModel: this.model.get("mapModel"),
            el: "#project-search-results",
            isSubView: true
          });

          dataCatalogView.render();

          //Render the filters
          var filterGroupsView = new FilterGroupsView({
            filterGroups: this.model.get("filterGroups"),
            el: "#project-filters",
            filters: this.model.get("searchModel").get("filters")
          });

          filterGroupsView.render();
          filterGroupsView.$el.addClass(filterGroupsView.className);

          //Save a reference to the filter groups view
          dataCatalogView.filterGroupsView = filterGroupsView;

          //Render the table of contents view
          var topLevelItems = [
            {
              "text": "Top",
              "icon": "icon-arrow-up",
              "link": "#metacatui-app",
              "showH2s": false
            },
            {
              "text": "Datasets",
              "icon": "icon-hdd",
              "link": filterGroupsView.el,
            }
          ];

          //If this project model has an overview, create a MarkdownView for it
          if( this.model.get("overview") ){

            //Create a MarkdownView
            var sectionMarkdownView = new MarkdownView({
              markdown: this.model.get("overview").get("markdown"),
              citations: this.model.get("literatureCited"),
              el: "#project-description-container"
            });

            //Add a table of contents link to the project description
            topLevelItems.push(
            {
              "text": "Project Description",
              "icon": "icon-file-text-alt",
              "link": sectionMarkdownView.el,
            });

            //Listen to the markdown view and when it is rendered, format the rendered markdown
            this.listenTo(sectionMarkdownView, "mdRendered", this.formatProjectDescription);

            //Render the view
            sectionMarkdownView.render();
          }

          //Create a table of contents view
          var tocView = new TOCView({
            topLevelItems: topLevelItems,
            el: "#project-toc-container",
            linkedEl: this.el
          });

          //If there is no MarkdownView, render the table of contents now
          if( typeof sectionMarkdownView == "undefined" ){
            tocView.render();
          }
          //If there is a MarkdownView, render it later
          else{
            //Set TOC to render after the Markdown section, so it
            // can get the rendered h2 tags
            tocView.stopListening();
            tocView.listenTo(sectionMarkdownView, "mdRendered", tocView.render);

          }


        },

        /*
        * When the project description is rendered in a MarkdownView, format the
        * resulting HTML as needed for this view
        */
        formatProjectDescription: function(){

          this.$("#project-description-container img").addClass("thumbnail").after("<div class='clear'></div>");
          this.$("#project-description-container").append("<div class='clear'></div>");

        }

     });

     return ProjectHomeView;
});
