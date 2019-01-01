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

        The TOC can have 2 levels of content. The top level is referred to as 'h1' 
        (even though it doesn't come from h1 tags). Second level items are referred
        to as 'h2' (these do come from 'h2' tags). H1s get passed in when the TOC
        view is instantiated (see `ProjectHomeView.js` for an example). If there are
        'h2' tags within the 'h1' containers, these will be listed under the 'h1'.
    */
    var TOCView = Backbone.View.extend({

        type: "TOC",

        /* Renders the compiled template into HTML */
        templateUL: _.template(TOCUl),
        templateLI: _.template(TOCTemplateLi),
        templateLIsub: _.template(TOCTemplateLiSub),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance  */
        initialize: function(options) {
            if(typeof options !== "undefined"){
                this.h1s = options.h1s                   || "";
            }
        },

        /* Render the view */
        render: function() {
            var liSubTemplate = this.templateLIsub;
            var liTemplate = this.templateLI;
            var ul = this.$el.html(this.templateUL()).find("#toc-ul");
            // Render the top level items that have been passed in
            _.each(this.h1s, function(h1) {
                // Deal with id-less elements handed in
                h1.link = "#" + $(h1.link).attr("id");
                // Render the top level item
                ul.append(liTemplate({"tocItem": h1}));
                // Within each top level item, look for h2 tags and
                // render them as second level TOC items
                var h2s = $(h1.link).find("h2"); 
                _.each(h2s, function(h2) {
                    var tocItem = {
                        "link": "#" + $(h2).attr("id"),
                        "text": $(h2).text()
                    };
                    ul.append(liSubTemplate({"tocItem": tocItem}));
                });
            });
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return TOCView;
});
