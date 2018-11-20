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

        /* The list of subview instances contained in this view
        subviews: { // Question: I can't seem to make this work -JK
            headerView: new ProjectHeaderView(),
            tocView: new TOCView(),
            sectionView: new ProjectHomeView()
        }, // Could be a literal object {} */

        /* Renders the compiled template into HTML */
        template: _.template(ProjectTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /*
        * Construct a new instance of ProjectView
        */
        initialize: function() {

        },

        /*
        * Renders the ProjectView
        *
        * @return {ProjectView} Returns itself for easy function stacking in the app
        */
        render: function() {

            this.$el.html(this.template());

            //Render the header view
            this.headerView = new ProjectHeaderView();
            this.renderSub(this.headerView);

            //Render the table of contents view
            this.tocView = new TOCView();
            this.renderSub(this.tocView);

            //Render section view, this will be replaced by
            // actual sections (which subclass section view)
            this.sectionHomeView = new ProjectHomeView();
            this.renderSub(this.sectionHomeView);

            this.sectionMembersView = new ProjectMembersView();
            this.renderSub(this.sectionMembersView);

            this.sectionMarkdownView = new MarkdownView();
            this.renderSub(this.sectionMarkdownView);

            // temporary ugly line just to show header container
            this.$("#project-header-container").css('border', 'solid');

            //Create a new Project model
            this.model = new Project({
              id: MetacatUI.appModel.get("projectId")
            });

            //Fetch the Project model
            this.getModel();

            return this;
        },

        /*
        * Fetches the Project model for this view
        */
        getModel: function(){
          this.model.fetch();
        },

        /*
        * Renders the given view inside of this view
        *
        * @param {Backbone.View} subView - The Backbone View to render inside this view
        */
        renderSub: function( subView ) {

          //Render the sub view
          subView.render();

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
