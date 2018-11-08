define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectHeader.html"], function($, _, Backbone, ProjectHeaderTemplate){

    /* The ProjectHeaderView is the view at the top of project pages
     * that shows the project's title, synopsis, and logo
     */
     var ProjectHeaderView = Backbone.View.extend({

        /* The Project Header Element */
        el: "#project-header-container",

        /* TODO: Decide if we need this */
        type: "ProjectHeader",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectHeaderTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of ProjectHeaderView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {
            this.$el.html(this.template());
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

     });

     return ProjectHeaderView;
});
