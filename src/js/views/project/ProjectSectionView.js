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
        tabsEl: "#project-section-tabs",

        /* TODO: Decide if we need this */
        type: "ProjectSection",

        /* Tab label and section name */
        tabInfo: {
            // title displayed on tab in ui
            tabTitle: "Section Title",
            // value of data-section and data-target id
            sectionName: "data-section-value",
            // should the tab be active when first loaded
            activeByDefault: true,
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
            $(this.tabsEl).append(this.tabTemplate(this.tabInfo));

            this.tabInfo.htmlContent = "<h2>" + this.tabInfo.tabTitle + "</h2>";
            this.$el.append(this.template(this.tabInfo));
        },

        onClose: function() {

        }

     });

     return ProjectSectionView;
});
