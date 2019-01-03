define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectLogos.html",
    "text!templates/project/projectLogo.html"], 
    function($, _, Backbone, ProjectLogosTemplate, ProjectLogoTemplate){

    /* The ProjectLogosView is the area where the the logos of the organizations
     * associated with each project will be displayed.
     */
    var ProjectLogosView = Backbone.View.extend({

        /* The Project Logos Element */
        el: "#ProjectLogos",

        /* TODO: Decide if we need this */
        type: "ProjectLogos",

        /* Renders the compiled template into HTML */
        template: _.template(ProjectLogoTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of ProjectLogosView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {
            var plTemp = this.template;
            var theEl = this.$el;
            var nlogos = this.model.length;
            var spanX = "span";
            // Determine the correct bootstrap fluid row span width to use
            if (nlogos < 5) {
                spanN = 12 / nlogos;
                spanX = spanX + spanN;
            } else {
                // If there are more than 4 logos, use span3 and multiple
                // rows.
                spanX = "span3";
            }
            var logoDiv = {};
            _.each(this.model, function(logo, i) {
                if (i % 4 == 0) {
                    // create a row for each multiple of 4
                    logoDiv = theEl.append(ProjectLogosTemplate).find("div.logo-row").last();
                }
                logoDiv.append(plTemp({logoURL: logo, spanX: spanX}));
            });
        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return ProjectLogosView;
});
