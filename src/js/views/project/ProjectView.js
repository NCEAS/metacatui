define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/project.html",
    "views/project/ProjectHeaderView",
    "views/TOCView"], 
    function($, _, Backbone, ProjectTemplate, ProjectHeaderView, TOCView){
    'use_strict';
    /* The ProjectView is a generic view to render
     * projects, it will hold project sections
     */
     var ProjectView = Backbone.View.extend({

        /* The Project Element*/
        el: "#Content",

        /* TODO: Decide if we need this */
        type: "Project",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectView */
        initialize: function() {
            
        },

        /* Render the view */
        render: function() {
            this.$el.html(this.template());
            this.headerView = new ProjectHeaderView();
            this.tocView = new TOCView();
            this.renderSub(this.headerView);
            this.renderSub(this.tocView);
            // this.$el.append(this.headerView.$el);
            // this.$el.append(this.tocView.$el);
            // this.tocView.setElement('#project-view').render();
            // this.headerView.setElement('#project-header-container').render();
            this.$("#project-header-container").css('border', 'solid');
            return this;
        },

        renderSub: function( subView ) {
            subView.render();
            // console.log(subView.render())
            // this.$el.append(subView.el);
            return this;
        },

        onClose: function() {

        }

     });

     return ProjectView;
});