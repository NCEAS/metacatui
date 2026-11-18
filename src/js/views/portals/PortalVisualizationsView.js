define([
  "jquery",
  "views/portals/PortalSectionView",
  "common/TrustedContentUtilities",
], ($, PortalSectionView, TrustedContentUtilities) => {
  const CLASS_NAMES = {
    ALERT: "alert",
    WARNING: "alert-warning",
    SECTION_LINKS: "section-links-container",
  };
  const VISUALIZATION_TYPES = {
    FEVER: "fever",
    CESIUM: "cesium",
    IFRAME: "iframe",
  };
  const UNTRUSTED_IFRAME_MESSAGE =
    "This visualization has not been approved for inclusion on this site. Please contact support for assistance.";
  const PANELS_LAYOUT = "panels";
  const MIN_MAP_HEIGHT = "var(--max-map-toolbar-link-height)";
  const MIN_IFRAME_HEIGHT = 300;

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

      /**
       * The parent portal, if provided
       * @type {Portal|null}
       */
      portalModel: null,

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

      /** Render the portal's iframe using the site's embed policy */
      renderIframe() {
        const url = this.model.get("iframeUrl");
        const iframe = document.createElement("iframe");
        if (!TrustedContentUtilities.configureTrustedIframe(iframe, url)) {
          const message = document.createElement("p");
          message.className = `${CLASS_NAMES.ALERT} ${CLASS_NAMES.WARNING}`;
          message.textContent = UNTRUSTED_IFRAME_MESSAGE;
          this.$el.html(message);
          return;
        }

        iframe.title = this.model.get("label");
        iframe.src = new URL(url).href;
        iframe.style.display = "block";
        iframe.style.width = "100%";
        this.$el.html(iframe);
      },

      /**
       * Renders a {@link MapView} and inserts into this view
       */
      renderMap: function () {
        const mapConfigError = this.model.get("mapConfigError");
        if (mapConfigError) {
          const message = document.createElement("p");
          message.className = `${CLASS_NAMES.ALERT} ${CLASS_NAMES.WARNING}`;
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
          if (!this.hasRendered) {
            switch (this.model.get("visualizationType")) {
              case VISUALIZATION_TYPES.FEVER:
                this.renderFEVer();
                break;
              case VISUALIZATION_TYPES.IFRAME:
                this.renderIframe();
                break;
              case VISUALIZATION_TYPES.CESIUM:
                this.renderMap();
                break;
              default:
                return;
            }
            this.hasRendered = true;
          }

          if (!this.resizeObserver) {
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

      /** Adjusts height of the viz based on the available viewport height */
      adjustVizHeight: function () {
        const vizType = this.model.get("visualizationType");
        const isCesium = vizType === VISUALIZATION_TYPES.CESIUM;
        const isIframe = vizType === VISUALIZATION_TYPES.IFRAME;
        if (isCesium && this.portalModel?.get("layout") === PANELS_LAYOUT) {
          return;
        }

        if (isIframe || isCesium) {
          const tabs = this.$el
            .parent()
            .siblings(`.${CLASS_NAMES.SECTION_LINKS}`);
          const fixedTabsHeight =
            tabs.css("position") === "fixed" ? tabs.outerHeight(true) : 0;
          const height =
            $(window).outerHeight(true) -
            this.$el.offset().top -
            fixedTabsHeight;
          if (isIframe) {
            // Leave room to scroll past the fixed tabs in short viewports.
            this.$("iframe").css({
              height: Math.max(MIN_IFRAME_HEIGHT, height),
              marginBottom: fixedTabsHeight,
            });
          } else {
            // Keep room for map controls in short windows.
            this.$el.css("min-height", `max(${height}px, ${MIN_MAP_HEIGHT})`);
          }
          return;
        }

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
