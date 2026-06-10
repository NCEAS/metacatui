"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder-zoom-preset.html",
], (_, Backbone, Template) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-zoom-preset";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    active: `${BASE_CLASS}--active`,
    actions: `${BASE_CLASS}__actions`,
    authors: `${BASE_CLASS}__authors`,
    card: `${BASE_CLASS}__card`,
    ctaButton: `${BASE_CLASS}__cta-button`,
    date: `${BASE_CLASS}__date`,
    description: `${BASE_CLASS}__description`,
    header: `${BASE_CLASS}__header`,
    image: `${BASE_CLASS}__image`,
    layer: `${BASE_CLASS}__layer`,
    layerContent: `${BASE_CLASS}__layer-content`,
    layers: `${BASE_CLASS}__layers`,
    meta: `${BASE_CLASS}__meta`,
    openTabButton: `${BASE_CLASS}__open-tab-button`,
    title: `${BASE_CLASS}__title`,
    viewLayersButton: `${BASE_CLASS}__view-layers-button`,
  };
  // A function that does nothing. Can be safely called as a default callback.
  const noop = () => {};

  /**
   * @class ZoomPresetView
   * @classdesc Shows the title, description, optional metadata, and action
   * buttons for a configured location within a MapView. Card variants:
   * - Basic: "View Layers" button zooms and toggles relevant layers.
   * - Virtual Tour: adds "Open in Browser" button opening `tabUrl` in a new
   *   tab.
   * - Visualization App: adds "Explore in App" button opening `iframeUrl` in
   *   a full-screen overlay above the map.
   * The card body itself is not interactive — all actions are explicit buttons.
   * @classcategory Views/Maps/Viewfinder
   * @name ZoomPresetView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ZoomPresetView.png
   * @since 2.29.0
   * @constructs ZoomPresetView
   */
  const ZoomPresetView = Backbone.View.extend(
    /** @lends ZoomPresetView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ZoomPresetView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events() {
        return {
          [`click .${CLASS_NAMES.viewLayersButton}`]: "selectLayers",
          [`click .${CLASS_NAMES.openTabButton}`]: "openTab",
          [`click .${CLASS_NAMES.ctaButton}`]: "selectVisualization",
        };
      },

      /**
       * Zoom to the preset's location and toggle the relevant layers. Closes
       * any open visualization overlay first.
       */
      selectLayers() {
        this.closeVisualizationCallback();
        this.selectCallback();
        this.setActiveButton(CLASS_NAMES.viewLayersButton);
      },

      /**
       * Open the preset's tabUrl in a new browser tab. Closes any open
       * visualization overlay first. Uses noopener,noreferrer for security.
       */
      openTab() {
        this.closeVisualizationCallback();
        const url = this.preset.get("tabUrl");
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        this.setActiveButton(CLASS_NAMES.openTabButton);
      },

      /**
       * Open the preset's iframeUrl in the full-screen visualization overlay.
       * Closes any existing overlay first, then invokes the CTA callback.
       */
      selectVisualization() {
        this.closeVisualizationCallback();
        const url = this.preset.get("iframeUrl");
        const permissions = this.preset.get("iframePermissions");
        this.ctaCallback(url, permissions);
        this.setActiveButton(CLASS_NAMES.ctaButton);
      },

      /**
       * Mark one button as active and remove active state from the others.
       * @param {string} activeClass The CLASS_NAMES value of the button to
       * mark active.
       */
      setActiveButton(activeClass) {
        const buttonClasses = [
          CLASS_NAMES.viewLayersButton,
          CLASS_NAMES.openTabButton,
          CLASS_NAMES.ctaButton,
        ];
        buttonClasses.forEach((cls) => {
          const btn = this.el.querySelector(`.${cls}`);
          if (!btn) return;
          btn.classList.toggle(CLASS_NAMES.active, cls === activeClass);
        });
      },

      /**
       * Remove the active state from all buttons in this card.
       */
      resetActiveState() {
        this.setActiveButton(null);
      },

      /** Values meant to be used by the rendered HTML template. */
      templateVars: {
        classNames: CLASS_NAMES,
        preset: {},
      },

      /**
       * Initialize the view with the given options.
       * @param {object} options - The view options.
       * @param {ZoomPresetModel} options.preset - The metadata associated with
       * this zoom preset card.
       * @param {Function} [options.selectCallback] Called when "View Layers" is
       * clicked. Should zoom to the preset location and toggle layers.
       * @param {Function} [options.ctaCallback] Called with (url, permissions)
       * when "Explore in App" is clicked. Should open the visualization overlay.
       * @param {Function} [options.closeVisualizationCallback] Called before
       * any button action to dismiss any currently open overlay.
       */
      initialize({
        preset,
        selectCallback,
        ctaCallback,
        closeVisualizationCallback,
      }) {
        this.preset = preset;
        this.selectCallback =
          typeof selectCallback === "function" ? selectCallback : noop;
        this.ctaCallback =
          typeof ctaCallback === "function" ? ctaCallback : noop;
        this.closeVisualizationCallback =
          typeof closeVisualizationCallback === "function"
            ? closeVisualizationCallback
            : noop;
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       */
      render() {
        this.templateVars.preset = this.preset.toJSON();
        this.el.innerHTML = _.template(Template)(this.templateVars);
      },
    },
  );

  return ZoomPresetView;
});
