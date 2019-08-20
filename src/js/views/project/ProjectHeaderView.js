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
          var templateInfo = {
            label: this.model.get("label"),
            description: this.model.get("description"),
            name: this.model.get("name")
          }

          if( this.model.get("logo") ){
            templateInfo.imageURL = this.model.get("logo").get("imageURL");
          }
          else{
            templateInfo.imageURL = "";
          }

          this.$el.append(this.template(templateInfo));

          return this;
        }

     });

     return ProjectHeaderView;
});
