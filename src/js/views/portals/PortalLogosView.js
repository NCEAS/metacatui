define(["jquery",
    "underscore",
    "backbone",
    "text!templates/portals/portalLogo.html"],
    function($, _, Backbone, PortalLogoTemplate){

    /**
     * @class PortalLogosView
     * @classdesc The PortalLogosView is the area where the the logos of the organizations
     * associated with each portal will be displayed.
     * @classcategory Views/Portals
     * @extends Backbone.View
     * @screenshot views/portals/PortalLogosView.png
     */
    var PortalLogosView = Backbone.View.extend(
      /** @lends PortalLogosView.prototype */{

        /**
         * The HTML element type for this view
         * @type {string}
         */
        tagName: "div",
        /**
         * The HTML classes for this view
         * @type {string}
         */
        className: "portal-logos-view",
        /**
         * The name of this View type
         * @type {string}
         */
        type: "PortalLogos",

        /**
        * An array of PortalImages to display in this view
        * @type {PortalImage[]}
        */
        logos: [],

        /**
        * Renders the compiled template into HTML
        * @type {UnderscoreTemplate}
        */
        template: _.template(PortalLogoTemplate),

        /**
        * Renders the view
        */
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

        /**
         * Close and destroy the view
         */
        onClose: function() {

        }

    });

    return PortalLogosView;
});
