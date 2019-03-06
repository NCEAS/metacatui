define(["jquery",
    "underscore",
    "backbone",
    "text!templates/tableOfContentsLiSub.html",
    "text!templates/tableOfContentsLi.html",
    "text!templates/tableOfContentsUL.html"], 
    function($, _, Backbone, TOCTemplateLiSub, TOCTemplateLi, TOCUl){

    /*
        The Table of Contents View is a vertical navigation menu that links to other
        sections within the same view.

        The TOC can have 2 levels of content. The top level is referred to as 'topLevelItem'. 
        Second level items are referred to as 'h2' (they come from 'h2' tags). H1s get passed 
        in when the TOC view is instantiated (see `ProjectHomeView.js` for an example). If 
        there are 'h2' tags within the 'topLevelItem' containers, these will be listed under 
        the 'topLevelItem'.
    */
    var TOCView = Backbone.View.extend({

        type: "TOC",

        /* Renders the compiled template into HTML */
        templateUL: _.template(TOCUl),
        templateLI: _.template(TOCTemplateLi),
        templateLIsub: _.template(TOCTemplateLiSub),
        templateInvisibleH1: _.template(
            '<h1 id="<%=linkDisplay%>" style="display: inline"></h1>'
        ),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance  */
        initialize: function(options) {
            if(typeof options !== "undefined"){
                this.topLevelItems = options.topLevelItems                   || "";
                this.linkedEl = options.linkedEl         || "";
            }
        },

        truncateCleanly: function(str, nCharacters) {
            if ( !nCharacters ) {
                var nCharacters = 10;
            }
            var re = new RegExp("^(.{" + nCharacters + "}[^\\s]*).*");
            return str.replace(re, "$1...");
        },

        /* Render the view */
        render: function() {
            var nCharacters = 15;
            var truncateCleanly = this.truncateCleanly;
            var liSubTemplate = this.templateLIsub;
            var liTemplate = this.templateLI;
            var h1Template = this.templateInvisibleH1;
            var ul = this.$el.html(this.templateUL()).find("#toc-ul");
            // Render the top level items that have been passed in
            _.each(this.topLevelItems, function(topLevelItem) {
                // Create a link to display based on the text of the TOC item
                topLevelItem.linkDisplay = topLevelItem.text.replace(/[\W_]+/g, '-').toLowerCase().replace(/^[\W_]+/g, '');
                // Make an invisible (empty) H1 tag and stick it into the el
                // that's the target of the TOC
                $(topLevelItem.link).prepend(h1Template({linkDisplay: topLevelItem.linkDisplay}));
                
                // Render the top level item
                ul.append(liTemplate({"tocItem": topLevelItem}));
                // Within each top level item, look for h2 tags and
                // render them as second level TOC items
                var h2s = $(topLevelItem.link).find("h2");
                if(typeof topLevelItem.showH2s == "undefined" || topLevelItem.showH2s == true) {
                    _.each(h2s, function(h2) {
                        var h2Text = $(h2).text();
                        // if TOC item text is longer than `nCharacters`, then truncate
                        // after the end of the word and add `...` to the end.
                        if (h2Text.length > nCharacters) {
                            var truncated = truncateCleanly(h2Text, nCharacters);
                            // only use the truncated version if it's shorter than the
                            // original (might be longer because of addition of `...`)
                            if (truncated.length < h2Text.length) {
                                h2Text = truncated;
                            }
                        }
                        var tocItem = {
                            "link": "#" + $(h2).attr("id"),
                            "text": h2Text
                        };
                        ul.append(liSubTemplate({"tocItem": tocItem}));
                    });
                }
            });
            // Hide / show TOC when tabs are changed
            var linkedEl = this.linkedEl;
            var tocEl = this.$el;
            $('a[data-toggle="tab"]').on('shown', function (e) {
                if ($(linkedEl).is(":visible")) {
                //   console.log("turn TOC on");
                  tocEl.css("visibility", "visible");
                } else {
                //   console.log("turn TOC off");
                  tocEl.css("visibility", "hidden");
                }
            });
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return TOCView;
});
