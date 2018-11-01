define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/projectMetrics.html",
    "views/project/ProjectSectionView.js"], 
    function($, _, Backbone, ProjectMetricsTemplate, ProjectSectionView){

    /* The ProjectMetricsView is a view to render the
     * project metrics tab (within ProjectSectionView) 
     */
     var ProjectMetricsView = ProjectSectionView.extend({

        /* The Project Metrics Element*/
        el: "#project-metrics",

        /* TODO: Decide if we need this */
        type: "ProjectMetrics",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectMetricsTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectMetricsView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return ProjectMetricsView;
});
