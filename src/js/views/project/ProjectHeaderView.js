define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectHeader.html"], function($, _, Backbone, ProjectHeaderTemplate){

    /* The ProjectHeaderView is the view at the top of project pages
     * that shows the project's title, synopsis, and logo
     */
     var ProjectHeaderView = Backbone.View.extend({

        /* The Project Header Element */
        el: "#project-header-container",

        type: "ProjectHeader",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectHeaderTemplate),

        /* Render the view */
        render: function() {
            this.$el.append(this.template({
              label: this.model.get("label"),
              description: this.model.get("description"),
              logo: this.model.get("logo")
            }));
            return this;
        }

     });

     return ProjectHeaderView;
});
