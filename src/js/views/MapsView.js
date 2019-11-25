define(["jquery",
    "underscore",
    "backbone",
    'gmaps', //? <- used in dataCatalogView
    'nGeohash', // ? <- used in dataCatalogView
    "text!templates/maps.html"], // <- maps.html exists outside of portal folder
    function($, _, Backbone, gmaps, nGeohash, mapsTemplate){

    /* The mapsView is the area where the the geographic coverage of the datasets that comprise the portal
     * are displayed. The mapsView will update to match the search results when they are filtered.
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
