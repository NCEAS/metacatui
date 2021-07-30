define(["jquery",
    "underscore",
    "backbone",
    "text!templates/portals/portalVisualizations.html",
    "views/portals/PortalSectionView"],
    function($, _, Backbone, PortalVisualizationsTemplate, PortalSectionView){

    /**
     * @class PortalVisualizationsView
     * @classdesc The PortalVisualizationsView is a view to render the
     * portal visualizations tab (within PortalSectionView)
     * @classcategory Views/Portals
     */
     var PortalVisualizationsView = PortalSectionView.extend(
       /** @lends PortalVisualizationsView.prototype */{

       /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
        className: "portal-viz-section-view tab-pane portal-section-view",

        /**
        * The type of View this is
        * @type {string}
        */
        type: "PortalVisualizations",

        /**
        * The PortalVizSectionModel
        * @type {PortalVizSectionModel}
        */
        model: null,

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /**
        * Renders the compiled template into HTML
        * @type {Underscore.Template}
        */
        template: _.template(PortalVisualizationsTemplate),

        /**
        * Construct a new instance of PortalVisualizationsView
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize: function(options) {
          // Get all the options and apply them to this view
          if( typeof options == "object" ) {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                  this[key] = options[key];
              }, this);
          }
        },

        /**
        * Renders the view
        */
        render: function() {

          //Attach this view to the DOM element
          this.$el.data("view", this);

          if( this.model.get("visualizationType") == "fever" ){
            this.renderFEVer();
          }
          else if( this.model.get("visualizationType") == "cesium" ){
            this.renderMap();
          }

        },

        /**
        * Renders a FEVer visualizattion in this view
        */
        renderFEVer: function(){

          //Exit if FEVer is disabled
          if( !MetacatUI.appModel.get("enableFeverVisualizations") ){
            return;
          }

          //Insert the FEVer visualization into the page
          var iframe = $(document.createElement("iframe"))
                        .attr("src", MetacatUI.appModel.get("feverUrl"))
                        .css("width", "100%");
          this.$el.html(iframe);

        },

        /**
        * Renders a {@link MapView} and inserts into this view
        */
        renderMap: function(){

          //Exit if Cesium is disabled
          if( !MetacatUI.appModel.get("enableCesium") ){
            return;
          }

          let thisView = this;

          //Create a MapView and render it in this view
          require(["views/maps/MapView"], function(MapView){
            let mapView = new MapView();
            thisView.$el.html(mapView.el);
            mapView.render();
          });

        },

        postRender: function(){

          if( this.model.get("visualizationType") == "fever" ){
            $(window).resize(this.adjustVizHeight);
            $(".auto-height-member").resize(this.adjustVizHeight);

            //Get the height of the visible part of the page for the iframe
            this.adjustVizHeight();
          }

        },

        adjustVizHeight: function(){
          // Get the heights of the header, navbar, and footer
          var otherHeight = 0;
          $(".auto-height-member").each(function(i, el) {
              if ($(el).css("display") != "none" && !$(el).is("#Footer") ) {
                  otherHeight += $(el).outerHeight(true);
              }
          });

          // Get the remaining height left based on the window size
          var remainingHeight = $(window).outerHeight(true) - otherHeight;
          if (remainingHeight < 0){
            remainingHeight = $(window).outerHeight(true) || 600;
          }
          else if (remainingHeight <= 120){
            remainingHeight = ($(window).outerHeight(true) - remainingHeight) || 600;
          }

          this.$("iframe").css("height", remainingHeight + "px");
        },

        onClose: function() {
          $(window).removeListener("resize", this.adjustVizHeight);
        }

     });

     return PortalVisualizationsView;
});
