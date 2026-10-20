define(["jquery", "views/portals/PortalSectionView"], (
  $,
  PortalSectionView,
) => {
  /**
   * @class PortalVisualizationsView
   * @classdesc The PortalVisualizationsView is a view to render the
   * portal visualizations tab (within PortalSectionView)
   * @classcategory Views/Portals
   * @extends PortalSectionView
   */
  var PortalVisualizationsView = PortalSectionView.extend(
    /** @lends PortalVisualizationsView.prototype */ {
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
       * Construct a new instance of PortalVisualizationsView
       * @param {Object} options - A literal object with options to pass to the view
       */
      initialize: function (options) {
        PortalSectionView.prototype.initialize.call(this, options);
        this.adjustVizHeight = this.adjustVizHeight.bind(this);
      },

      /**
       * Renders the view
       */
      render: function () {
        //Attach this view to the DOM element
        this.$el.data("view", this);

        // To speed up the portal load times, visualization content is rendered in the
        // postRender function. This function is called only when a section is active.
        this.hasRendered = false;
      },

      /**
       * Renders a FEVer visualizattion in this view
       */
      renderFEVer: function () {
        //Exit if FEVer is disabled
        if (!MetacatUI.appModel.get("enableFeverVisualizations")) {
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
      renderMap: function () {
        const mapConfigError = this.model.get("mapConfigError");
        if (mapConfigError) {
          const message = document.createElement("p");
          message.className = "alert alert-warning";
          message.textContent = mapConfigError;
          this.$el.html(message);
          return;
        }
        //Exit if Cesium is disabled
        if (!MetacatUI.appModel.get("enableCesium")) {
          return;
        }

        this.$el.addClass("portal-map-section-view");
        const thisView = this;

        //Create a MapView and render it in this view
        require(["views/maps/MapView", "models/maps/Map"], function (
          MapView,
          Map,
        ) {
          let mapModel = thisView.model.get("mapModel");
          if (!mapModel) {
            mapModel = new Map();
            thisView.model.set("mapModel", mapModel);
          }
          const mapView = new MapView({
            model: mapModel,
            isPortalMap: true,
          });
          thisView.$el.html(mapView.el);
          mapView.render();
        });
      },

      /**
       * Function called by the PortalView when the section that contains this
       * visualization becomes active (e.g. the user clicks on the section tab). Render
       * the visualization and size it to the available viewport height.
       */
      postRender: function () {
        try {
          const vizType = this.model.get("visualizationType");
          if (vizType !== "fever" && vizType !== "cesium") return;

          if (!this.hasRendered) {
            if (vizType === "fever") {
              this.renderFEVer();
            } else {
              this.renderMap();
            }
            this.hasRendered = true;
          }

          // The cesium map is sized entirely by CSS (see the
          // `.portal-map-active`/`.portal-panels-map-active` rules), so only
          // FEVer's iframe needs JS to recompute its height on resize.
          if (vizType === "fever" && !this.resizeObserver) {
            $(window).on("resize", this.adjustVizHeight);
            this.resizeObserver = new ResizeObserver(this.adjustVizHeight);
            $(".auto-height-member:not(#Footer)").each((i, el) => {
              this.resizeObserver.observe(el);
            });
          }

          this.adjustVizHeight();
        } catch (error) {
          console.log(
            "Failed to render the visualization in the PortalVisualizationsView " +
              "postRender function. Error details: " +
              error,
          );
        }
      },

      /** Adjusts height of the FEVer iframe based on the available viewport height */
      adjustVizHeight: function () {
        // The cesium map's height is computed entirely by CSS; nothing to do here.
        if (this.model.get("visualizationType") === "cesium") return;

        // Get the heights above the visualization, excluding the footer
        let otherHeight = 0;
        $(".auto-height-member").each(function (i, el) {
          if ($(el).css("display") != "none" && !$(el).is("#Footer")) {
            otherHeight += $(el).outerHeight(true);
          }
        });

        // Get the remaining height left based on the window size
        let remainingHeight = $(window).outerHeight(true) - otherHeight;
        if (remainingHeight < 0) {
          remainingHeight = $(window).outerHeight(true) || 600;
        } else if (remainingHeight <= 120) {
          remainingHeight =
            $(window).outerHeight(true) - remainingHeight || 600;
        }

        this.$("iframe").css("height", remainingHeight + "px");
      },

      /**
       * Clean up
       */
      onClose: function () {
        $(window).off("resize", this.adjustVizHeight);
        this.resizeObserver?.disconnect();
      },
    },
  );

  return PortalVisualizationsView;
});
