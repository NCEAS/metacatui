define(["jquery",
    "underscore",
    "backbone",
    "text!templates/project/projectLogo.html"],
    function($, _, Backbone, ProjectLogoTemplate){

    /* The ProjectLogosView is the area where the the logos of the organizations
     * associated with each project will be displayed.
     */
    var ProjectLogosView = Backbone.View.extend({

        /* The Project Logos Element */
        tagName: "div",

        className: "project-logos-view",

        type: "ProjectLogos",

        //@type Array - An array of logo URLs to display
        logos: [],

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
            var spanX = "span";

            // Determine the correct bootstrap fluid row span width to use
            if (this.logos.length < 5) {
                spanN = 12 / this.logos.length;
                spanX = spanX + spanN;
            } else {
                // If there are more than 4 logos, use span3 and multiple
                // rows.
                spanX = "span3";
            }

            var row;

            //Remove any logos that don't have a URL
            var logos = _.reject(this.logos, function(logo){
              return !logo || !logo.get("imageURL");
            });

            _.each(logos, function(logo, i) {

                if (i % 4 == 0) {
                    // create a row for each multiple of 4
                    row = $(document.createElement("div")).addClass("logo-row row-fluid");
                    this.$el.append(row);
                }

                var templateVars = logo.toJSON();
                templateVars.spanX = spanX;

                row.append(this.template(templateVars));

            }, this);

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return ProjectLogosView;
});
