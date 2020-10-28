define(["jquery",
    "underscore",
    "backbone",
    'gmaps',
    'nGeohash',
    "text!templates/maps.html"],
    function($, _, Backbone, gmaps, nGeohash, mapsTemplate){

    /*
     * @class MapsView
     * @classdesc The mapsView is the area where the the geographic coverage of the datasets that comprise the portal
     * are displayed. The mapsView will update to match the search results when they are filtered.
     * @classcategory Views
     */
    var mapsView = Backbone.View.extend({

        /* The Portal Logos Element */
        el: "#maps",

        /* TODO: Decide if we need this */
        type: "maps",

        /* Renders the compiled template into HTML */
        template: _.template(mapsTemplate),

        /* The events that this view listens to */
        events: {

        },

        /* Construct a new instance of mapsView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return mapsView;
});
