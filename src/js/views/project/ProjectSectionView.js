define(["jquery",
    "underscore",
    "Backbone",
    "text!templates/project/project-section.html"], function($, _, Backbone, ProjectSectionTemplate){

    /* The ProjectSectionView is a generic view to render
     * project sections, with a default rendering of a
     * MarkdownView
     */
     var ProjectSectionView = Backbone.View.extend({

        /* The Project Section Element*/
        el: "#project-section",

        /* TODO: Decide if we need this */
        type: "ProjectSection",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectSectionTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectSectionView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return ProjectSectionView;
});
