define(['underscore',
        'jquery',
        'backbone'],
function(_, $, Backbone){

  var ColorPaletteView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ColorPalette",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "color-palette",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new ColorPaletteView
    * @constructs ColorPaletteView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders this view
    */
    render: function(){


    }

  });

  return ColorPaletteView;

});
