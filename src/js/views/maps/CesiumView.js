define(['underscore',
        'jquery',
        'backbone',
        "cesium",
        "text!templates/maps/cesium.html"],
function(_, $, Backbone, Cesium, Template){

  /**
  * @class CesiumView
  * @classdesc A Cesium map
  * @classcategory Views/Maps
  * @extends Backbone.View
  * @constructor
  */
  var CesiumView = Backbone.View.extend(
    /** @lends CesiumView.prototype */
    {

    /**
    * The type of View this is
    * @type {string}
    */
    type: "CesiumView",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "cesium-view",

    /**
    * The html template that contains the Cesium map. HTML files are converted to Underscore.js templates
    * @type {Underscore.Template}
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new CesiumView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders this view
    */
    render: function(){

      //If Cesium features are disabled in the AppConfig, then exit without rendering anything.
      if( !MetacatUI.appModel.get("enableCesium") ){
        return;
      }

      //Add the Cesium template
      this.$el.html(this.template());

      // Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
      const viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: Cesium.createWorldTerrain()
      });   

    }
  });

  return CesiumView;
});
