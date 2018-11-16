define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectSection.html",
    "text!templates/project/projectSectionTab.html"], 
    function($, _, Backbone, ProjectSectionTemplate, SectionTabTemplate){

    /* The ProjectSectionView is a generic view to render
     * project sections, with a default rendering of a
     * MarkdownView
     */
     var ProjectSectionView = Backbone.View.extend({

        /* The Project Section Elements*/
        el: "#project-tabs",
        tabs_el: "#project-section-tabs",

        /* TODO: Decide if we need this */
        type: "ProjectSection",

        /* Tab label and section name */
        tabInfo: {
            // title displayed on tab in ui
            tab_title: "Section Title", 
            // value of data-section and data-target id
            section_name: "data-section-value", 
            // should the tab be active when first loaded
            active_by_default: true,
        },

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(ProjectSectionTemplate),
        tabTemplate: _.template(SectionTabTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of ProjectSectionView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {
            $(this.tabs_el).append(this.tabTemplate(this.tabInfo));

            this.tabInfo.html_content = "<h2>" + this.tabInfo.tab_title + "</h2>";
            this.$el.append(this.template(this.tabInfo));
        },

        onClose: function() {

        }

     });

     return ProjectSectionView;
});
