define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/projectLogos.html"], function($, _, Backbone, ProjectLogosTemplate){

    /* The ProjectLogosView is the area where the the logos of the organizations
     * associated with each project will be displayed.
     */
    var ProjectLogosView = Backbone.View.extend({

        /* The Project Logos Element */
        el: "#ProjectLogos",

        /* TODO: Decide if we need this */
        type: "ProjectLogos",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectLogosTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of ProjectLogosView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return ProjectLogosView;
});
