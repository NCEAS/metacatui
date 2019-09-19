define([    "jquery", "underscore", "backbone",
            "showdown",
            "text!templates/markdown.html" ],

    function($, _, Backbone,
        showdown,
        markdownTemplate ){

    /* The markdownView is a view that will retrieve and parse markdown */
    var markdownView = Backbone.View.extend({

        className: "markdown",

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
                this.citations = options.citations       || [];
            }
        },

        /* Render the view */
        render: function() {

            // once required extensions are tested for and loaded, convert and append markdown
            this.stopListening();
            this.listenTo(this, "requiredExtensionsLoaded", function(SDextensions){

                var converter  = new showdown.Converter({
                            metadata: true,
                            simplifiedAutoLink:true,
                            customizedHeaderId:true,
                            tables:true,
                            strikethrough: true,
                            tasklists: true,
                            emoji: true,
                            extensions: SDextensions
                });

                //If there are citations in the markdown text, add it to the markdown
                // so it gets rendered.
                if( _.contains(SDextensions, "showdown-citation") && this.citations.length ){
                  // put the bibtex into the markdown so it can be processed by
                  // the showdown-citations extension.
                  this.markdown = this.markdown + "\n<bibtex>" + this.citations + "</bibtex>";
                }

                htmlFromMD = converter.makeHtml( this.markdown ); //
                this.$el.append(this.template({ markdown: htmlFromMD }));
                this.trigger("mdRendered");
            });

            // detect which extensions we'll need
            this.listRequiredExtensions( this.markdown);
            return this;
        },

        // test which extensions are needed, then load them
        listRequiredExtensions: function(markdown){

            var markdownView = this;

            // SDextensions lists the desired order* of all potentailly required showdown extensions (* order matters! )
            var SDextensions = ["xssfilter", "katex", "highlight", "docbook",
                                "showdown-htags", "bootstrap", "footnotes",
                                "showdown-citation", "showdown-images"];
            var numTestsTodo = SDextensions.length;

            // each time an extension is tested for (and loaded if required), updateExtensionList is called.
            // when all tests are completed (numTestsTodo == 0), an event is triggered.
            // when this event is triggered, markdown is converted and appended (see render)
            var updateExtensionList = function(extensionName, required){

                numTestsTodo = numTestsTodo - 1;

                if(required == false){
                    var n = SDextensions.indexOf(extensionName);
                    SDextensions.splice(n, 1);
                }

                if(numTestsTodo == 0){
                    markdownView.trigger("requiredExtensionsLoaded", SDextensions);
                }
            };

            // ===== the regular expressions used to test whether showdown extensions are required ===== //
            // note: these expressions test the *markdown* and *not* the html

            var regexHighlight  = new RegExp("`.*`"), // too general?
                regexDocbook    = new RegExp("<(title|citetitle|emphasis|para|ulink|literallayout|itemizedlist|orderedlist|listitem|subscript|superscript).*>"),
                // for bootstrap: test for tables, directly from showdown/src/subParsers/makehtml/tables.js
                // if we add more bootstrap classes, this will become more complicated since we have to test the markdown before the initial parse
                regexTable1        = /^ {0,3}\|?.+\|.+\n {0,3}\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*(?:[-=]){2,}[\s\S]+?(?:\n\n|¨0)/gm,
                regexTable2        = /^ {0,3}\|.+\|[ \t]*\n {0,3}\|[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*\n( {0,3}\|.+\|[ \t]*\n)*(?:\n|¨0)/gm;
                regexFootnotes1     = /^\[\^([\d\w]+)\]:( |\n)((.+\n)*.+)$/mg,
                regexFootnotes2     = /^\[\^([\d\w]+)\]:\s*((\n+(\s{2,4}|\t).+)+)$/mg,
                regexFootnotes3     = /\[\^([\d\w]+)\]/m,
                // test for all of the math/katex delimiters
                regexKatex      = new RegExp("\\[.*\\]|\\(.*\\)|~.*~|$.*$|```asciimath.*```|```latex.*```"),
                regexCitation   = /\[@.+\]/g;
                // test for any <h.> tags
                regexHtags      = new RegExp('#\\s'),
                regexImages     = /!\[.*\]\(\S+\)/;

            // ====== test for and load each as required each showdown extension ====== //

            // --- xss --- //

            // there is no test for the xss filter because it should always be included.
            // it's included via the updateExtensionList function for consistency with the other, optional extensions
            require(["showdownXssFilter"], function(showdownKatex){
                updateExtensionList("xssfilter", required=true);
            })

            // --- katex test --- //

            if( regexKatex.test(markdown) ){

                require(["showdownKatex"], function(showdownKatex){
                    // custom config needed for katex
                    var katex = showdownKatex({
                        delimiters: [
                            { left: "$", right: "$", display: false },
                            { left: "$$", right: "$$", display: false},
                            { left: '~', right: '~', display: false }
                        ]
                    });
                    // because custom config, register katex with showdown
                    showdown.extension("katex", katex);
                    updateExtensionList("katex", required=true);
                });
                // css needed for katex
                markdownView.$el.append("<link href='"+ MetacatUI.root + "/components/showdown/extensions/showdown-katex/katex.min.css' rel='stylesheet' type='text/css'>");

            } else {
                updateExtensionList("katex", required=false);
            };


            // --- highlight test --- //

            if( regexHighlight.test(markdown) ){
                require(["showdownHighlight"], function(showdownHighlight){
                    updateExtensionList("highlight", required=true);
                });
                // css needed for highlight
                this.$el.append("<link href='" + MetacatUI.root + "/components/showdown/extensions/showdown-highlight/styles/" + "atom-one-light" + ".css' rel='stylesheet' type='text/css'>");
            } else {
                updateExtensionList("highlight", required=false);
            };

            // --- docbooks test --- //

            if( regexDocbook.test(markdown) ){
                require(["showdownDocbook"], function(showdownDocbook){
                    updateExtensionList("docbook", required=true);
                });
            } else {
                updateExtensionList("docbook", required=false);
            };

            // --- htag test --- //

            if( regexHtags.test(markdown) ){
                require(["showdownHtags"], function(showdownHtags){
                   updateExtensionList("showdown-htags", required=true);
                });
            } else {
                updateExtensionList("showdown-htags", required=false);
            };


            // --- bootstrap test --- //

            if( regexTable1.test(markdown) || regexTable2.test(markdown) ){
                require(["showdownBootstrap"], function(showdownBootstrap){
                    updateExtensionList("bootstrap", required=true);
                });
            } else {
                updateExtensionList("bootstrap", required=false);
            };

            // --- footnotes test --- //

            if( regexFootnotes1.test(markdown) || regexFootnotes2.test(markdown) || regexFootnotes3.test(markdown) ){
                require(["showdownFootnotes"], function(showdownFootnotes){
                    updateExtensionList("footnotes", required=true);
                });
            } else {
                updateExtensionList("footnotes", required=false);
            };

            // --- citation test --- //

            // showdownCitation throws error...
            if( regexCitation.test(markdown) ){
                    require(["showdownCitation"], function(showdownCitation){
                        updateExtensionList("showdown-citation", required=true);
                    });
                } else {
                    updateExtensionList("showdown-citation", required=false);
            };

            // --- images test --- //
            if( regexImages.test(markdown) ){
                require(["showdownImages"], function(showdownImages){
                    updateExtensionList("showdown-images", required=true);
                });
            } else {
                updateExtensionList("showdown-images", required=false);
            };

        },

        /* Close and destroy the view */
        onClose: function() {
            this.remove(); // remove for the DOM, stop listening
            this.$el.html("");   // remove appended html
        }

    });

    return markdownView;
});
