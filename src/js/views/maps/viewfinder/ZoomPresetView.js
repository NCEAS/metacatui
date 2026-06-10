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
  // Maximum character length for the rendered author list before truncating.
  const MAX_AUTHORS_LENGTH = 30;

  /**
   * Truncates an authors array to fit within MAX_AUTHORS_LENGTH characters.
   * If the full joined string exceeds the limit, authors are added one at a
   * time until the next name would exceed the limit, then "+N more..." is
   * appended for the remaining count.
   * @param {string[]} authors Array of author name strings.
   * @returns {string} The display string, possibly truncated.
   */
  function truncateAuthors(authors) {
    if (!authors || !authors.length) return "";
    const full = authors.join(", ");
    if (full.length <= MAX_AUTHORS_LENGTH) return full;
    let display = "";
    let count = 0;
    for (let i = 0; i < authors.length; i += 1) {
      const candidate = i === 0 ? authors[i] : `${display}, ${authors[i]}`;
      if (candidate.length > MAX_AUTHORS_LENGTH) break;
      display = candidate;
      count += 1;
    }
    const remaining = authors.length - count;
    return remaining > 0 ? `${display}, +${remaining} more...` : display;
  }

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
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(CLASS_NAMES.viewLayersButton);
        this.selectCallback();
      },

      /**
       * Open the preset's tabUrl in a new browser tab. Closes any open
       * visualization overlay first. Uses noopener,noreferrer for security.
       */
      openTab() {
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(CLASS_NAMES.openTabButton);
        const url = this.preset.get("tabUrl");
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },

      /**
       * Open the preset's iframeUrl in the full-screen visualization overlay.
       * Closes any existing overlay first, then invokes the CTA callback.
       */
      selectVisualization() {
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(CLASS_NAMES.ctaButton);
        const url = this.preset.get("iframeUrl");
        const permissions = this.preset.get("iframePermissions");
        this.ctaCallback(url, permissions);
      },

      /**
       * Mark this card as active and highlight the specific clicked button.
       * @param {string} buttonClass The CLASS_NAMES value of the button clicked.
       */
      setActive(buttonClass) {
        this.el.classList.add(CLASS_NAMES.active);
        const buttonClasses = [
          CLASS_NAMES.viewLayersButton,
          CLASS_NAMES.openTabButton,
          CLASS_NAMES.ctaButton,
        ];
        buttonClasses.forEach((cls) => {
          const btn = this.el.querySelector(`.${cls}`);
          if (btn)
            btn.classList.toggle(CLASS_NAMES.active, cls === buttonClass);
        });
      },

      /**
       * Remove the active state from this card and all its buttons.
       */
      resetActiveState() {
        this.el.classList.remove(CLASS_NAMES.active);
        [
          CLASS_NAMES.viewLayersButton,
          CLASS_NAMES.openTabButton,
          CLASS_NAMES.ctaButton,
        ].forEach((cls) => {
          this.el
            .querySelector(`.${cls}`)
            ?.classList.remove(CLASS_NAMES.active);
        });
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
       * @param options.onActivate
       */
      initialize({
        preset,
        selectCallback,
        ctaCallback,
        closeVisualizationCallback,
        onActivate,
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
        this.onActivate = typeof onActivate === "function" ? onActivate : noop;
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       */
      render() {
        this.templateVars.preset = this.preset.toJSON();
        this.templateVars.preset.authorsDisplay = truncateAuthors(
          this.templateVars.preset.authors,
        );
        this.el.innerHTML = _.template(Template)(this.templateVars);
      },
    },
  );

  return ZoomPresetView;
});
