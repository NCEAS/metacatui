define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/projectMembers.html"], function($, _, Backbone, ProjectMembersTemplate){

    /* The Project Members View lists the name, organization, contact information,
     * as well as the role in the project for each of the project's members.
     */
    var ProjectMembersView = Backbone.View.extend({

        /* The Project Members Element */
        el: "#ProjectMembers",

        /* TODO: Decide if we need this */
        type: "ProjectMembers",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectMembersTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of ProjectMembersView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return ProjectMembersView;
});
