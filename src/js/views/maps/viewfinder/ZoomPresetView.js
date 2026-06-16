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
    ctaButtonActive: `${BASE_CLASS}__cta-button--active`,
    date: `${BASE_CLASS}__date`,
    description: `${BASE_CLASS}__description`,
    header: `${BASE_CLASS}__header`,
    headerNoImage: `${BASE_CLASS}__header--no-image`,
    image: `${BASE_CLASS}__image`,
    layer: `${BASE_CLASS}__layer`,
    layerContent: `${BASE_CLASS}__layer-content`,
    layers: `${BASE_CLASS}__layers`,
    layersActive: `${BASE_CLASS}--layers-active`,
    layersInner: `${BASE_CLASS}__layers-inner`,
    meta: `${BASE_CLASS}__meta`,
    title: `${BASE_CLASS}__title`,
    viewLayersButton: `${BASE_CLASS}__view-layers-button`,
    viewLayersButtonActive: `${BASE_CLASS}__view-layers-button--active`,
  };
  // A function that does nothing. Can be safely called as a default callback.
  const noop = () => {};
  // Maximum character length for the rendered author list before truncating.
  const MAX_AUTHORS_LENGTH = 50;

  /**
   * Handler registry: maps a ZoomPresetAction `type` string to a function that
   * carries out the action. Add entries here to support new action types
   * without modifying ZoomPresetView itself.
   * @type {Object<string, function(ZoomPresetAction, ZoomPresetView): void>}
   */
  const CTA_HANDLERS = {
    /**
     * Opens the URL in the full-screen visualization overlay.
     * @param {ZoomPresetAction} action
     * @param {ZoomPresetView} view
     */
    iframe(action, view) {
      const permissions =
        action.permissions ?? "allow-scripts allow-same-origin";
      view.ctaCallback(action.url, permissions);
    },
    /**
     * Opens the URL in a new browser tab.
     * @param {ZoomPresetAction} action
     */
    tab(action) {
      if (action.url) {
        window.open(action.url, "_blank", "noopener,noreferrer");
      }
    },
  };

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
    if (count === 0) {
      return `${authors[0].slice(0, MAX_AUTHORS_LENGTH - 3)}...`;
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
          [`click .${CLASS_NAMES.ctaButton}`]: "handleCtaClick",
        };
      },

      /**
       * Zoom to the preset's location and toggle the relevant layers. Closes
       * any open visualization overlay first.
       */
      selectLayers() {
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(
          this.el.querySelector(`.${CLASS_NAMES.viewLayersButton}`),
        );
        this.selectCallback();
      },

      /**
       * Dispatch a CTA button click to the registered handler for the action
       * type. Closes any open visualization overlay first.
       * @param {MouseEvent} e The click event from a `.cta-button` element.
       */
      handleCtaClick(e) {
        const btn = e.currentTarget;
        const index = Number(btn.dataset.ctaIndex);
        const action = this.preset.get("ctaActions")[index];
        if (!action) return;
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(btn);
        CTA_HANDLERS[action.type]?.(action, this);
      },

      /**
       * Mark this card as active and highlight the specific clicked button.
       * @param {HTMLElement} buttonEl The button element that was activated.
       */
      setActive(buttonEl) {
        this.el.classList.add(CLASS_NAMES.active);
        const isLayersButton =
          buttonEl?.classList.contains(CLASS_NAMES.viewLayersButton) ?? false;
        this.el.classList.toggle(CLASS_NAMES.layersActive, isLayersButton);
        this.el
          .querySelector(`.${CLASS_NAMES.viewLayersButton}`)
          ?.classList.toggle(
            CLASS_NAMES.viewLayersButtonActive,
            isLayersButton,
          );
        this.el.querySelectorAll(`.${CLASS_NAMES.ctaButton}`).forEach((btn) => {
          btn.classList.toggle(CLASS_NAMES.ctaButtonActive, btn === buttonEl);
        });
      },

      /**
       * Remove the active state from this card and all its buttons.
       */
      resetActiveState() {
        this.el.classList.remove(CLASS_NAMES.active, CLASS_NAMES.layersActive);
        this.el
          .querySelector(`.${CLASS_NAMES.viewLayersButton}`)
          ?.classList.remove(CLASS_NAMES.viewLayersButtonActive);
        this.el.querySelectorAll(`.${CLASS_NAMES.ctaButton}`).forEach((btn) => {
          btn.classList.remove(CLASS_NAMES.ctaButtonActive);
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
       * @param {Function} [options.onActivate] Called when this card is
       * activated, so sibling cards can reset their active state.
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
        if (!this.templateVars.preset.image) {
          const header = this.el.querySelector(`.${CLASS_NAMES.header}`);
          if (header) header.classList.add(CLASS_NAMES.headerNoImage);
        }
      },
    },
  );

  return ZoomPresetView;
});
