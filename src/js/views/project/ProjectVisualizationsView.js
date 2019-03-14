define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectVisualizations.html",
    "views/project/ProjectSectionView.js"], 
    function($, _, Backbone, ProjectVisualizationsTemplate, ProjectSectionView){

    /* The ProjectVisualizationsView is a view to render the
     * project visualizations tab (within ProjectSectionView) 
     */
     var ProjectVisualizationsView = ProjectSectionView.extend({

        /* The Project Visualizations Element*/
        el: "#project-visualizations",

        /* TODO: Decide if we need this */
        type: "ProjectVisualizations",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectVisualizationsTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectVisualizationsView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return ProjectVisualizationsView;
});
