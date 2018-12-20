define(["jquery",
    "underscore",
    "backbone",
    "models/ProjectModel",
    "text!templates/project/project.html",
    "views/project/ProjectHeaderView",
    "views/project/ProjectHomeView",
    "views/project/ProjectMembersView",
    "views/project/ProjectMetricsView",
    'views/StatsView',
    "views/MarkdownView"],
    function($, _, Backbone, Project, ProjectTemplate, ProjectHeaderView, 
      ProjectHomeView, ProjectMembersView, ProjectMetricsView, StatsView, MarkdownView){
    'use_strict';
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

          //Create a new Project model
          this.model = new Project({
            id: this.projectId
          });

          //When the model has been synced, render the results
          this.stopListening();
          this.listenTo(this.model, "sync", this.renderProject);

          //Fetch the model
          this.model.fetch();

          // temporary ugly line just to show header container
          this.$("#project-header-container").css('border', 'solid');

          return this;
        },

        renderProject: function(){

          //Insert the overall project template
          this.$el.html(this.template(this.model.toJSON()));

          //Render the header view
          this.headerView = new ProjectHeaderView({ model: this.model });
          this.subviews.push(this.headerView);

          //Create a Search collection for all search events in this view
          this.search = this.model.createSearch();

          //Render the Home section
          if( !this.model.get("hideHome") ){
            this.sectionHomeView = new ProjectHomeView({
              model: this.model,
              el: "#project-home"
            });
            this.subviews.push(this.sectionHomeView);
          }

          //Render the members section
          if( !this.model.get("hideMembers") ){
            this.sectionMembersView = new ProjectMembersView({
              model: this.model,
              el: "#project-members"
            });
            this.subviews.push(this.sectionMembersView);
         }

          _.invoke(this.subviews, 'render');

        },

        // render the metrics section
        renderMetricsView: _.once(function() {

            if( !this.model.get("hideMetrics") ){

                var statsSearchModel = this.model.get("search").clone();
    			MetacatUI.statsModel.set("query", statsSearchModel.getQuery());
                MetacatUI.statsModel.set("searchModel", statsSearchModel);

                // add a stats view
                this.sectionMetricsView = new StatsView({
        			title: "Statistics and Figures",
        			description: "A summary of all datasets from the " + this.model.get("label") + " group",
        			el: "#project-metrics"
        		});

                this.sectionMetricsView.render();
                this.subviews.push(this.sectionMetricsView);

            }


        }),

        /*
        * This function is called when the app navigates away from this view.
        * Any clean-up or housekeeping happens at this time.
        */
        onClose: function() {
          //Remove each subview from the DOM and remove listeners
          _.invoke(this.subviews, "remove");

          this.subviews = new Array();
        }

     });

     return ProjectView;
});
