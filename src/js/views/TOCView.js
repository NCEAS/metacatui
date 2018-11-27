define(["jquery",
    "underscore",
    "backbone",
    "text!templates/tableOfContents.html"], function($, _, Backbone, TOCTemplate){

    /*
       The Table of Contents View is a vertical navigation menu that links to other
       sections within the same view.
     */
    var TOCView = Backbone.View.extend({

        type: "TOC",

        /* Renders the compiled template into HTML */
        template: _.template(TOCTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance  */
        initialize: function() {

        },

        /* Render the view */
        render: function() {
            this.$el.append(this.template());
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return TOCView;
});
