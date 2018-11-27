define(["jquery",
    "underscore",
    "backbone",
    "showdown",
    "highlight",
    "text!templates/markdown.html"], function($, _, Backbone, showdown, highlight, markdownTemplate){

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

                this.markdown = options.markdown         || "";

            }
        },

        /* Render the view */
        render: function() {

            /* convert markdown to HTML */
            var htmlFromMD = this.convertMarkdown(this.markdown);

            /* append converted markdown to the template. */
            /* highlightStyle = the name of the code syntax highlight style we want to use */
            /* all options can be viewed in src/components/highlight/styles/... */
            /* TODO: determine if the highlight style should be changed in each/some themes */
            this.$el.append(this.template({ markdown: htmlFromMD,
                                            highlightStyle: "github-gist"}));
            return this;
        },

        convertMarkdown: function(markdown) {

            // === CUSTOM SHOWDOWN EXTENSIONS === //

            /* -- Extension: HighlightJS -- */
            /* from: https://stackoverflow.com/questions/21785658/showdown-highlightjs-extension */
            showdown.extension('codehighlight', function() {
                function htmlunencode(text) {
                    return (
                      text
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                      );
                }
                return [
                    {
                      type: 'output',
                      filter: function (text, converter, options) {
                        // use shodown's regexp engine to conditionally parse codeblocks
                        var left  = '<pre><code\\b[^>]*>',
                            right = '</code></pre>',
                            flags = 'g',
                            replacement = function (wholeMatch, match, left, right) {
                              // unescape match to prevent double escaping
                              match = htmlunencode(match);
                              return left + hljs.highlightAuto(match).value + right;
                            };
                        return showdown.helper.replaceRecursiveRegExp(text, replacement, left, right, flags);
                      }
                    }
                ];
            });

            var converter  = new showdown.Converter({
                                    metadata: true,
                                    simplifiedAutoLink:true,
                                    customizedHeaderId:true,
                                    tables:true,
                                    strikethrough: true,
                                    tasklists: true,
                                    emoji: true,
                                    extensions: ['codehighlight']//, bindings]
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
