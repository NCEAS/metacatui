define(["jquery","underscore","backbone",

        "showdown",
        "showdownKatex",
    //    "showdownHighlight",
        "showdownFootnotes",
        "showdownBootstrap",
        "showdownDocbook",
        "showdownCitation",

        "text!templates/markdown.html"
],
    function($, _, Backbone,

                showdown,
                showdownKatex,
        //        showdownHighlight,
                showdownFootnotes,
                showdownBootstrap,
                showdownDocbook,
                showdownCitation,

                markdownTemplate
    ){

    /* The markdownView is a view that will retrieve and parse markdown */
    var markdownView = Backbone.View.extend({

        /* element: The markdown div */
        el: ".markdown",

        type: "markdown",

        /* Renders the compiled template into HTML */
        template: _.template(markdownTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of markdownView */
        initialize: function (options) {

            /* highlightStyle = the name of the code syntax highlight style we want to use */
            this.highlightStyle = "atom-one-light";

            if(typeof options !== "undefined"){
                this.markdown = options.markdown         || "";
            }

        },

        /* Render the view */
        render: function() {

            // detect which extensions we'll need, return vector of extensions
            var extensions = this.listRequiredExtensions(this.markdown);

            // make an instance of showdown conveter with our custom config
            var converter  = new showdown.Converter({
                        metadata: true,
                        simplifiedAutoLink:true,
                        customizedHeaderId:true,
                        tables:true,
                        strikethrough: true,
                        tasklists: true,
                        emoji: true,
                        extensions: extensions
            });

            // use the converter to make html
            var htmlFromMD = converter.makeHtml(this.markdown);

            // append converted markdown to the template
            this.$el.append(this.template({ markdown: htmlFromMD
                                            }));
            return this;
        },

        // test which extensions are needed, then load them
        // TODO: using require() here doesn't work
        listRequiredExtensions: function(markdown){

            var extensions = new Array;

            var regexHighlight  = new RegExp("`.*`"),
                regexDocbook    = new RegExp("<(title|citetitle|emphasis|para|ulink|literallayout|itemizedlist|orderedlist|listitem|subscript|superscript).*>"),

                // for bootstrap: test for tables, directly from showdown/src/subParsers/makehtml/tables.js
                // if we add more bootstrap classes, this will become more complicated since we have to test the markdown before the initial parse
                regexTable1        = /^ {0,3}\|?.+\|.+\n {0,3}\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*(?:[-=]){2,}[\s\S]+?(?:\n\n|¨0)/gm,
                regexTable2        = /^ {0,3}\|.+\|[ \t]*\n {0,3}\|[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*\n( {0,3}\|.+\|[ \t]*\n)*(?:\n|¨0)/gm;

                regexFootnotes1     = /^\[\^([\d\w]+)\]:( |\n)((.+\n)*.+)$/mg,
                regexFootnotes2     = /^\[\^([\d\w]+)\]:\s*((\n+(\s{2,4}|\t).+)+)$/mg,
                regexFootnotes3     = /\[\^([\d\w]+)\]/m,

                // test for all of the math/katex delimiters (this might be too general)
                regexKatex      = new RegExp("\\[.*\\]|\\(.*\\)|~.*~|&&.*&&"),

                regexCitation   = /\^\[.*\]/g;

            if( regexKatex.test(markdown) ){
                // require(["showdownKatex"]);
                var katex = showdownKatex({
                    delimiters: [
                        { left: "$",    right: "$",      display: false,    asciimath: true },
                        { left: "\\[",  right: "\\]",    display: true,     asciimath: true },
                        { left: "\\(",  right: "\\)",    display: false,    asciimath: true },
                        { left: '~',    right: '~',      display: false,    asciimath: true },
                        { left: '&&',   right: '&&',     display: true,     asciimath: true },
                    ],
                });
                extensions.push(katex);
                this.$el.append("<link href='"+ MetacatUI.root + "/components/showdown/extensions/showdown-katex/katex.min.css' rel='stylesheet' type='text/css'>");
            };

            if( regexHighlight.test(markdown) ){
              var markdownView = this;

              //Require showdown highlight
              require(["showdownHighlight"], function(showdownHighlight){
                //Save a reference to this extension (may not actually need this - not sure if it is ever used somewhere else)
                markdownView.showdownHighlight = showdownHighlight;

                //Push the extension
                extensions.push("highlight");
              });

              this.$el.append("<link href='" + MetacatUI.root + "/components/showdown/extensions/showdown-highlight/styles/" + "atom-one-light" + ".css' rel='stylesheet' type='text/css'>");
            };

            if( regexDocbook.test(markdown) ){
                // require(["showdownDocbook"]);
                extensions.push("docbook");
            };

            if( regexTable1.test(markdown) | regexTable2.test(markdown) ){
                // require(["showdownDocbook"]);
                extensions.push("bootstrap");
            };

            if( regexFootnotes1.test(markdown) | regexFootnotes2.test(markdown) | regexFootnotes3.test(markdown) ){
                // require(["showdownFootnotes"]);
                extensions.push("footnotes");
            };

            // showdownCitation throws error...
            if( regexCitation.test(markdown) ){
                // require(["showdownCitation"])
                //extensions.push("citation.js") // does not work
            };

            return extensions

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return markdownView;
});
