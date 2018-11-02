define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/ProjectFilters.html"], function($, _, Backbone, ProjectFiltersTemplate){

    /* The ProjectFiltersView is the view that will hold the project's individual filters
     */
     var ProjectFiltersView = Backbone.View.extend({

        /* The Project Filter Element */
        el: "#ProjectFilters",

        /* TODO: Decide if we need this */
        type: "ProjectFilters",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectFiltersTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of ProjectFiltersView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        /* Close and destroy the view */
        onClose: function() {

        }

     });

     return ProjectFiltersView;
});
