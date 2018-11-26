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

                this.markdown = options.markdown         || "#testmarkdown";

            }
        },

        /* Render the view */
        render: function() {
            var htmlFromMD = this.convertMarkdown(this.markdown);

            this.$el.append(this.template({markdown:htmlFromMD}));
            return this;
        },

        convertMarkdown: function(markdown) {

            // --- TODO: add custom extensions here -- //

            var converter  = new showdown.Converter({
                                    metadata: true,
                                    simplifiedAutoLink:true,
                                    customizedHeaderId:true,
                                    tables:true,
                                    strikethrough: true,
                                    tasklists: true,
                                    emoji: true
                                    // TODO: extensions: ['codehighlight', bindings]
                              });

            var htmlFromMD = converter.makeHtml(markdown);

            return htmlFromMD;

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return markdownView;
});
