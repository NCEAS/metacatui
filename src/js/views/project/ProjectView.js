define(["jquery",
        "underscore",
        "backbone",
        "models/ProjectModel",
        "models/Search",
        "models/Stats",
        "text!templates/alert.html",
        "text!templates/project/project.html",
        "views/project/ProjectHeaderView",
        "views/project/ProjectHomeView",
        "views/project/ProjectMembersView",
        "views/StatsView",
        "views/project/ProjectLogosView"
    ],
    function($, _, Backbone, Project, SearchModel, StatsModel, AlertTemplate, ProjectTemplate, ProjectHeaderView,
        ProjectHomeView, ProjectMembersView, StatsView, ProjectLogosView) {
        "use_strict";
        /* The ProjectView is a generic view to render
         * projects, it will hold project sections
         */
        var ProjectView = Backbone.View.extend({

            /* The Project Element*/
            el: "#Content",

            type: "Project",

            subviews: new Array(), // Could be a literal object {} */

            // @type {Project} - A Project Model is associated with this view and gets created during render()
            model: null,

            /* Renders the compiled template into HTML */
            template: _.template(ProjectTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),

            /* The events that this view listens to*/
            events: {
                "click #project-metrics-tab": "renderMetricsView"
            },

            initialize: function(options) {
                // Set the current ProjectView properties
                this.projectId = options.projectId ? options.projectId : undefined;
                this.projectName = options.projectName ? options.projectName : undefined;
                this.projectSection = options.projectSection ? options.projectSectrion : undefined;
            },

            /*
             * Renders the ProjectView
             *
             * @return {ProjectView} Returns itself for easy function stacking in the app
             */
            render: function() {

                // Create a new Project model
                this.model = new Project({
                    id: this.projectId
                });

                // When the model has been synced, render the results
                this.stopListening();
                this.listenTo(this.model, "sync", this.renderProject);

                //If the project isn't found, display a 404 message
                this.listenToOnce(this.model, "notFound", this.showNotFound);

                //Fetch the model
                this.model.fetch();

                return this;
            },

            renderProject: function() {

                // Insert the overall project template
                this.$el.html(this.template(this.model.toJSON()));

                //Render the header view
                this.headerView = new ProjectHeaderView({
                    model: this.model
                });
                this.subviews.push(this.headerView);

                // Create a Filters collection in the search model for all search constraints in this view
                this.model.get("searchModel").set("filters", this.model.createFilters());

                // Cache this model for later use
                MetacatUI.projects = MetacatUI.projects || {};
                MetacatUI.projects[this.model.get("id")] = this.model.clone();

                // Render the Home section
                if (!this.model.get("hideHome")) {
                    this.sectionHomeView = new ProjectHomeView({
                        model: this.model,
                        el: "#project-home"
                    });
                    this.subviews.push(this.sectionHomeView);
                }

                // Render the members section
                if (!this.model.get("hideMembers")) {
                    this.sectionMembersView = new ProjectMembersView({
                        model: this.model,
                        el: "#project-members"
                    });
                    this.subviews.push(this.sectionMembersView);
                }
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                this.logosView = new ProjectLogosView();
                this.logosView.logos = ackLogos;
                this.subviews.push(this.logosView);

                _.invoke(this.subviews, 'render');

                this.$(".project-view").append(this.logosView.el);

            },

            /*
            * Render the metrics section
            */
            renderMetricsView: function() {

              if( this.model.get("hideMetrics") ) {
                return;
              }

              //If this subview is already rendered, exit
              if( this.sectionMetricsView ){
                return;
              }

              //If the search results haven't been fetched yet, wait. We need the
              // facet counts for the metrics view.
              if( !this.model.get("searchResults").models.length ){
                this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetricsView );
                return;
              }

              //Get all the facet counts from the search results collection
              var facetCounts = this.model.get("searchResults").facetCounts,
                  //Get the id facet counts
                  idFacets = facetCounts? facetCounts.id : [],
                  //Get the documents facet counts
                  documentsFacets = facetCounts? facetCounts.documents : [],
                  //Start an array to hold all the ids
                  allIDs = [];

              //If there are resource map facet counts, get all the ids
              if( idFacets && idFacets.length ){

                //Merge the id and documents arrays
                var allFacets = idFacets.concat(documentsFacets);

                //Get all the ids, which should be every other element in the
                // facets array
                for( var i=0; i < allFacets.length; i+=2 ){
                  allIDs.push( allFacets[i] );
                }

                //Create a search model that filters by all the data object Ids
                var statsSearchModel = new SearchModel({
                  idOnly: allIDs,
                  formatType: [],
                  exclude: []
                });

                //Create a StatsModel
                var statsModel = new StatsModel({
                  query: statsSearchModel.getQuery(),
                  searchModel: statsSearchModel,
                  supportDownloads: false
                });

              }

              // add a stats view
              this.sectionMetricsView = new StatsView({
                  title: "Statistics and Figures",
                  description: "A summary of all datasets from " + this.model.get("label"),
                  el: "#project-metrics",
                  model: statsModel
              });

              this.sectionMetricsView.render();
              this.subviews.push(this.sectionMetricsView);

            },

            /*
            * If the given project doesn't exist, display a Not Found message.
            */
            showNotFound: function(){

              var notFoundMessage = "The project \"" + (this.projectName || this.projectId) +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

            },

            /*
             * This function is called when the app navigates away from this view.
             * Any clean-up or housekeeping happens at this time.
             */
            onClose: function() {
                //Remove each subview from the DOM and remove listeners
                _.invoke(this.subviews, "remove");

                this.subviews = new Array();

                delete this.sectionMetricsView;
            }
        });

        return ProjectView;
    });
