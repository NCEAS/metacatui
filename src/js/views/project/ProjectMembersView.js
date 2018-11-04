define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/projectMembers.html",
    "views/project/ProjectSectionView.js"], 
    function($, _, Backbone, ProjectMembersTemplate, ProjectSectionView){

    /* The ProjectMembersView is a view to render the
     * project members tab (within ProjectSectionView) 
     */
     var ProjectMembersView = ProjectSectionView.extend({

        /* The Project Members Element*/
        el: "#project-members",

        /* TODO: Decide if we need this */
        type: "ProjectMembers",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectMembersTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectMembersView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return ProjectMembersView;
});
