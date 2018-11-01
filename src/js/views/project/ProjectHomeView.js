define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/projectHome.html",
    "views/project/ProjectSectionView.js"], 
    function($, _, Backbone, ProjectHomeTemplate, ProjectSectionView){

    /* The ProjectHomeView is a view to render the
     * project home tab (within ProjectSectionView) 
     * with a project TOC, ProjectFiltersView,
     * SearchResultsView, ProjectMapView, MarkdownView,
     * ProjectMembersView, and ProjectLogosView. 
     */
     var ProjectHomeView = ProjectSectionView.extend({

        /* The Project Home Element*/
        el: "#project-home",

        /* TODO: Decide if we need this */
        type: "ProjectHome",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectHomeTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectHomeView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return ProjectHomeView;
});
