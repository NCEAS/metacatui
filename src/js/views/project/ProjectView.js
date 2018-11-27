define(["jquery",
    "underscore",
    "backbone",
    "models/ProjectModel",
    "text!templates/project/project.html",
    "views/project/ProjectHeaderView",
    "views/TOCView",
    "views/project/ProjectHomeView",
    "views/project/ProjectMembersView",
    "views/project/ProjectMetricsView",
    "views/MarkdownView"],
    function($, _, Backbone, Project, ProjectTemplate, ProjectHeaderView, TOCView,
      ProjectHomeView, ProjectMembersView, ProjectMetricsView, MarkdownView){
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

        },

        initialize: function() {

        },

        /*
        * Renders the ProjectView
        *
        * @return {ProjectView} Returns itself for easy function stacking in the app
        */
        render: function() {

          //Create a new Project model
          this.model = new Project({
            id: MetacatUI.appModel.get("projectId")
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
          this.$el.html(this.template({
            hideMetrics: this.model.get("hideMetrics"),
            hideHome:    this.model.get("hideHome"),
            hidePeople:  this.model.get("hidePeople")
          }));

          //Render the header view
          this.headerView = new ProjectHeaderView({ model: this.model });
          this.subviews.push(this.headerView);

          //Render the table of contents view
          this.tocView = new TOCView({ model: this.model });
          this.subviews.push(this.tocView);

          //Render the Home section
          this.sectionHomeView = new ProjectHomeView({ model: this.model });
          this.subviews.push(this.sectionHomeView);

          //Render the Metrics section
          this.sectionMetricsView = new ProjectMetricsView({ model: this.model });
          this.subviews.push(this.sectionMetricsView);

          //Render the members section
          this.sectionMembersView = new ProjectMembersView({ model: this.model });
          this.subviews.push(this.sectionMembersView);

          //TODO: Incorporate this into the actual view it will live in (Home view)
          //Render the markdown view
          this.sectionMarkdownView = new MarkdownView({markdown:this.model.get("overview").get("markdown")});
          this.subviews.push(this.sectionMarkdownView);

          _.invoke(this.subviews, 'render');

        },

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
