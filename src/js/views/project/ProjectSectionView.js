define(["jquery",
    "underscore",
    "backbone"],
    function($, _, Backbone){

    /* The ProjectSectionView is a generic view to render
     * project sections, with a default rendering of a
     * MarkdownView
     */
     var ProjectSectionView = Backbone.View.extend({

        type: "ProjectSection",

        //The properties of this view's element
        tagName: "div",
        className: "tab-pane",
        id: this.id,

        // @type {boolean} - Specifies if this section is active or not
        active: false,

        /* Renders the compiled template into HTML */
        template: _.template(""),

        /* Render the view */
        render: function() {

          //Add the active class to the element
          if( this.active ){
            this.$el.addClass("active");
          }

          //Add the id attribute to the element
          this.$el.attr("id", this.id);

          //Insert the template into this element
          this.$el.html(this.template());
        }

     });

     return ProjectSectionView;
});
