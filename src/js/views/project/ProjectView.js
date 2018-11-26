define(["jquery",
    "underscore",
    "backbone",
    "models/ProjectModel",
    "text!templates/project/project.html",
    "views/project/ProjectHeaderView",
    "views/TOCView",
    "views/project/ProjectHomeView",
    "views/project/ProjectMembersView",
    "views/MarkdownView"],
    function($, _, Backbone, Project, ProjectTemplate, ProjectHeaderView, TOCView,
      ProjectHomeView, ProjectMembersView, MarkdownView){
    'use_strict';
    /* The ProjectView is a generic view to render
     * projects, it will hold project sections
     */
     var ProjectView = Backbone.View.extend({

        /* The Project Element*/
        el: "#Content",

        /* TODO: Decide if we need this */
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

          this.$el.html(this.template());

          //Create a new Project model
          this.model = new Project({
            id: MetacatUI.appModel.get("projectId")
          });

          //When the model has been synced, render the results
          this.stopListening();
          this.listenTo(this.model, "sync", this.renderResults);

          //Fetch the model
          this.model.fetch();

          // temporary ugly line just to show header container
          this.$("#project-header-container").css('border', 'solid');

          return this;
        },

        renderResults: function(){

            //Render the header view
            this.headerView = new ProjectHeaderView();
            this.subviews.push(this.headerView);

            //Render the table of contents view
            this.tocView = new TOCView();
            this.subviews.push(this.tocView);

            //Render section view, this will be replaced by
            // actual sections (which subclass section view)
            this.sectionHomeView = new ProjectHomeView();
            this.subviews.push(this.sectionHomeView);

            this.sectionMembersView = new ProjectMembersView();
            this.subviews.push(this.sectionMembersView);

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
        }

     });

     return ProjectView;
});
