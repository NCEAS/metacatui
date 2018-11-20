define(["jquery",
    "underscore",
    "backbone",
    "showdown",
    "text!templates/markdown.html"], function($, _, Backbone, showdown, markdownTemplate){

    /* The markdownView is a view that will retrieve and parse markdown */
    var markdownView = Backbone.View.extend({
//     "showdown",
        /* The markdown Element */
        el: ".markdown",

        /* TODO: Decide if we need this */
        type: "markdown",

        /* Renders the compiled template into HTML */
        template: _.template(markdownTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of markdownView */
        initialize: function() {
            this.$el.append(this.template());
            return this;
        },

        /* Render the view */
        render: function() {

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return markdownView;
});
