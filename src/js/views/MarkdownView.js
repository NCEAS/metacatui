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
        initialize: function (options) {

            if(typeof options !== "undefined"){

                this.markdown = options.markdown         || "#testmarkdown";    // TODO: figure out how to set the model on this view

            }
        },

        /* Render the view */
        render: function() {
            this.$el.append(this.template({markdown:this.markdown}));
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return markdownView;
});
