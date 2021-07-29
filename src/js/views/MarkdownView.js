define([    "jquery", "underscore", "backbone",
            "showdown",
            "text!templates/markdown.html",
            "text!templates/loading.html"
        ],

    function($, _, Backbone,
        showdown,
        markdownTemplate,
        LoadingTemplate ){

    /**
    * @class MarkdownView
    * @classdesc A view of markdown content rendered into HTML with optional table of contents
    * @classcategory Views
    * @extends Backbone.View
    * @constructor
    */
    var MarkdownView = Backbone.View.extend(
      /** @lends MarkdownView.prototype */{

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: "markdown",

        /**
        * The type of View this is
        * @type {string}
        * @readonly
        */
        type: "markdown",

        /**
         * Renders the compiled template into HTML
         * @type {UnderscoreTemplate}
         */
        template: _.template(markdownTemplate),
        loadingTemplate: _.template(LoadingTemplate),

        /**
        * Markdown to render into HTML
        * @type {string}
        */
        markdown: "",

        /**
        * An array of literature cited
        * @type {Array}
        */
        citations: [],

        /**
        * Indicates whether or not to render a table of contents for this view.
        * If set to true, a table of contents will be shown if there two or more
        * top-level headers are rendered from the markdown.
        * @type {boolean}
        */
        showTOC: false,

        /**
        * The events this view will listen to and the associated function to
        * call.
        * @type {Object}
        */
        events: {
        },

        /**
        * Initialize is executed when a new MarkdownView is created.
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize: function (options) {

            // highlightStyle = the name of the code syntax highlight style we
            // want to use for showdown's highlight extension.
            this.highlightStyle = "atom-one-light";

            if(typeof options !== "undefined"){
                this.markdown  = options.markdown  || "";
                this.citations = options.citations || [];
                this.showTOC   = options.showTOC   || false;
            }
        },

        /**
         * render - Renders the MarkdownView; converts markdown to HTML and
         * displays it.
         */
        render: function() {

            // Show a loading message while we render the markdown to HTML
            this.$el.html(this.loadingTemplate({
              msg: "Retrieving content..."
            }));

            // Once required extensions are tested for and loaded, convert and
            // append markdown
            this.stopListening();
            this.listenTo(this, "requiredExtensionsLoaded", function(SDextensions){

                var converter  = new showdown.Converter({
                            metadata: true,
                            simplifiedAutoLink:true,
                            customizedHeaderId:true,
                            parseImgDimension: true,
                            tables:true,
                            tablesHeaderId:true,
                            strikethrough: true,
                            tasklists: true,
                            emoji: true,
                            extensions: SDextensions
                });

                // If there are citations in the markdown text, add it to the markdown
                // so it gets rendered.
                if( _.contains(SDextensions, "showdown-citation") && this.citations.length ){
                  // Put the bibtex into the markdown so it can be processed by
                  // the showdown-citations extension.
                  this.markdown = this.markdown + "\n<bibtex>" + this.citations + "</bibtex>";
                }

                try{
                  // Use the Showdown converter to make HTML from the Markdown string
                  htmlFromMD = converter.makeHtml( this.markdown );
                }
                // If there was a Showdown error, show an error message instead of the Markdown preview.
                catch(e){
                  //Create a temporary div to hold the error message
                  var errorMsgTempContainer = document.createElement("div");
                  //Create the error message
                  MetacatUI.appView.showAlert("This content can't be displayed.",
                    "alert-error",
                    errorMsgTempContainer,
                    {
                      remove: false
                    });
                  // Get the inner HTML of the temporary div
                  htmlFromMD = errorMsgTempContainer.innerHTML;
                }

                this.$el.html(this.template({ markdown: htmlFromMD }));

                if( this.showTOC ){
                  this.listenToOnce(this, "TOCRendered", function(){
                    this.trigger("mdRendered");
                    this.postRender();
                  });
                  this.renderTOC();
                } else {
                  this.trigger("mdRendered");
                  this.postRender();
                }

            });

            // Detect which extensions we'll need
            this.listRequiredExtensions( this.markdown );

            return this;

        },

        postRender: function(){
          if(this.tocView){
            this.tocView.postRender();
          } else {
            this.listenToOnce(this, "TOCRendered", function(){
              this.tocView.postRender();
            });
          }
        },

        /**
         * listRequiredExtensions - test which extensions are needed, then load
         * them
         *
         * @param  {string} markdown - The markdown string before it's converted
         * into HTML
         */
        listRequiredExtensions: function(markdown){

            var view = this;

            // SDextensions lists the desired order* of all potentailly required showdown extensions (* order matters! )
            var SDextensions = ["xssfilter", "katex", "highlight", "docbook",
                                "showdown-htags", "bootstrap", "footnotes",
                                "showdown-citation", "showdown-images"];

            var numTestsTodo = SDextensions.length;

            // Each time an extension is tested for (and loaded if required),
            // updateExtensionList is called. When all tests are completed
            // (numTestsTodo == 0), an event is triggered. When this event is
            // triggered, markdown is converted and appended (see render)
            var updateExtensionList = function(extensionName, required){

                numTestsTodo = numTestsTodo - 1;

                if(required == false){
                    var n = SDextensions.indexOf(extensionName);
                    SDextensions.splice(n, 1);
                }

                if(numTestsTodo == 0){
                    view.trigger("requiredExtensionsLoaded", SDextensions);
                }
            };

            // ================================================================
            // Regular expressions used to test whether showdown
            // extensions are required.
            // NOTE: These expressions test the *markdown* and *not* the HTML

            var regexHighlight  = new RegExp("`.*`"), // too general?
                regexDocbook    = new RegExp("<(title|citetitle|emphasis|para|ulink|literallayout|itemizedlist|orderedlist|listitem|subscript|superscript).*>"),
                regexFootnotes1     = /^\[\^([\d\w]+)\]:( |\n)((.+\n)*.+)$/m,
                regexFootnotes2     = /^\[\^([\d\w]+)\]:\s*((\n+(\s{2,4}|\t).+)+)$/m,
                regexFootnotes3     = /\[\^([\d\w]+)\]/m,
                // test for all of the math/katex delimiters
                regexKatex      = new RegExp("\\$\\$.*\\$\\$|\\~.*\\~|\\$.*\\$|```asciimath.*```|```latex.*```"),
                regexCitation   = /\[@.+\]/;
                // test for any <h.> tags
                regexHtags      = new RegExp('#\\s'),
                regexImages     = /!\[.*\]\(\S+\)/;

            // ================================================================
            // Test for and load each as required each showdown extension

            // --- Test for XSS --- //

            // There is no test for the xss filter because it should always be
            // included. It's included via the updateExtensionList function for
            // consistency with the other, optional extensions.
            require(["showdownXssFilter"], function(showdownKatex){
                updateExtensionList("xssfilter", required=true);
            })

            // --- Test for katex --- //

            if( regexKatex.test(markdown) ){

                require([
                  "showdownKatex",
                  "text!" + MetacatUI.root + "/components/showdown/extensions/showdown-katex/katex.min.css",
                ], function(showdownKatex, showdownKatexCss){
                    // custom config needed for katex
                    var katex = showdownKatex({
                        delimiters: [
                            { left: "$", right: "$", display: false },
                            { left: "$$", right: "$$", display: false},
                            { left: '~', right: '~', display: false }
                        ]
                    });
                    // Add CSS required to render katex math symbols correctly
                    MetacatUI.appModel.addCSS(showdownKatexCss, "showdownKatex");
                    // Because custom config, register katex with showdown
                    showdown.extension("katex", katex);
                    updateExtensionList("katex", required=true);
                });

            } else {
                updateExtensionList("katex", required=false);
            };


            // --- Test for highlight --- //

            if( regexHighlight.test(markdown) ){
                require([
                  "showdownHighlight",
                  "text!" + MetacatUI.root + "/components/showdown/extensions/showdown-highlight/styles/atom-one-light.css"
                ],
                function(showdownHighlight, showdownHighlightCss){
                  updateExtensionList("highlight", required=true);
                  // CSS needed for highlight
                  MetacatUI.appModel.addCSS(showdownHighlightCss, "showdownHighlight");
                });
            } else {
                updateExtensionList("highlight", required=false);
            };

            // --- Test for docbooks --- //

            if( regexDocbook.test(markdown) ){
                require(["showdownDocbook"], function(showdownDocbook){
                  updateExtensionList("docbook", required=true);
                });
            } else {
                updateExtensionList("docbook", required=false);
            };

            // --- Test for htag --- //

            if( regexHtags.test(markdown) ){
                require(["showdownHtags"], function(showdownHtags){
                   updateExtensionList("showdown-htags", required=true);
                });
            } else {
                updateExtensionList("showdown-htags", required=false);
            };


            // --- Test for bootstrap --- //
            // The custom bootstrap library is small and only adds some classes
            // for tables and images, and maybe other HTML elements in the future.
            // Testing for tables in markdown using regular expressions isn't
            // straight forward. Better to just load this extension whether or
            // not it's required.
            require(["showdownBootstrap"], function(showdownBootstrap){
                updateExtensionList("bootstrap", required=true);
            });

            // --- Test for footnotes --- //

            if( regexFootnotes1.test(markdown) || regexFootnotes2.test(markdown) || regexFootnotes3.test(markdown) ){
                require(["showdownFootnotes"], function(showdownFootnotes){
                    updateExtensionList("footnotes", required=true);
                });
            } else {
                updateExtensionList("footnotes", required=false);
            };

            // --- Test for citations --- //

            // showdownCitation throws error...
            if( regexCitation.test(markdown) ){
                    require(["showdownCitation"], function(showdownCitation){
                        updateExtensionList("showdown-citation", required=true);
                    });
                } else {
                    updateExtensionList("showdown-citation", required=false);
            };

            // --- Test for images --- //
            if( regexImages.test(markdown) ){
                require(["showdownImages"], function(showdownImages){
                    updateExtensionList("showdown-images", required=true);
                });
            } else {
                updateExtensionList("showdown-images", required=false);
            };

        },


        /**
        * Renders a table of contents (a TOCView) that links to different sections of the MarkdownView
        */
        renderTOC: function(){

          if(this.showTOC === false){
            return
          }

          var view = this;

          require(["views/TOCView"], function(TOCView){

            //Create a table of contents view
            view.tocView = new TOCView({
              contentEl: view.el,
              className: "toc toc-view",
              addScrollspy: true,
              affix: true
            });

            view.tocView.render();

            // If more than one link was created in the TOCView, add it to this
            // view. Limit to `.desktop` items (i.e. exclude .mobile items) so
            // that the length isn't doubled
            if( view.tocView.$el.find(".desktop li").length > 1){
              ($(view.tocView.el)).insertBefore(view.$el);
              // Make a two-column layout
              view.tocView.$el.addClass("span3");
              view.$el.addClass("span9");
            }

            view.trigger("TOCRendered");

          });

        },


        /**
         * onClose - Close and destroy the view
         */
        onClose: function() {
            // Remove for the DOM, stop listening
            this.remove();
            // Remove appended html
            this.$el.html("");
        }

    });

    return MarkdownView;
});
