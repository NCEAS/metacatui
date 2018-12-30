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
                this.targetEl = options.targetEl         || "";
                this.h1s = options.h1s                   || "";
            }
        },

        /* Render the view */
        render: function() {
            var liSubTemplate = this.templateLIsub;
            var liTemplate = this.templateLI;
            var ul = this.$el.html(this.templateUL()).find("#toc-ul");
            _.each(this.h1s, function(h1) {
                ul.append(liTemplate({"tocItem": h1}));
            });
            var h2s = $(this.targetEl).find("h2");
            _.each(h2s, function(h2) {
                var tocItem = {
                    "link": "#" + $(h2).attr("id"),
                    "text": $(h2).text()
                };
                ul.append(liSubTemplate({"tocItem": tocItem}));
            });
            return this;
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return TOCView;
});
