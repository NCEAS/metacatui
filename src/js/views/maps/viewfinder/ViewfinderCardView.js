"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder-card.html",
], (_, Backbone, Template) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-card";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    active: `${BASE_CLASS}--active`,
    actions: `${BASE_CLASS}__actions`,
    card: `${BASE_CLASS}__card`,
    ctaButton: `${BASE_CLASS}__cta-button`,
    ctaButtonActive: `${BASE_CLASS}__cta-button--active`,
    description: `${BASE_CLASS}__description`,
    header: `${BASE_CLASS}__header`,
    headerNoImage: `${BASE_CLASS}__header--no-image`,
    headerSimple: `${BASE_CLASS}__header--simple`,
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

  /**
   * Handler registry: maps a ViewfinderCardAction `type` string to a function
   * that carries out the action. Add entries here to support new action types
   * without modifying ViewfinderCardView itself.
   * @type {Object<string, function(ViewfinderCardAction, ViewfinderCardView): void>}
   */
  const CTA_HANDLERS = {
    /**
     * Opens the URL in the full-screen visualization overlay.
     * @param {ViewfinderCardAction} action
     * @param {ViewfinderCardView} view
     */
    iframe(action, view) {
      view.ctaCallback(action.url);
    },
    /**
     * Opens the URL in a new browser tab.
     * @param {ViewfinderCardAction} action
     */
    tab(action) {
      if (action.url) {
        window.open(action.url, "_blank", "noopener,noreferrer");
      }
    },
    /**
     * Zooms the map and enables layers. Delegates to the view's
     * selectCallback so the model handles the navigation logic.
     * @param {ViewfinderCardAction} action
     * @param {ViewfinderCardView} view
     */
    map(action, view) {
      view.selectCallback(action);
    },
  };

  /**
   * @class ViewfinderCardView
   * @classdesc Shows the title, description, and action buttons for a
   * configured location within a MapView. Action buttons are driven by
   * `ctaActions` on the model; 'map' type actions (secondary ordinality) render
   * as a plain-text "View Layers" style link, while 'iframe'/'tab' type actions
   * (primary ordinality) render as bordered buttons.
   * The card body itself is not interactive — all actions are explicit buttons.
   * @classcategory Views/Maps/Viewfinder
   * @name ViewfinderCardView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ViewfinderCardView.png
   * @since 2.29.0
   * @constructs ViewfinderCardView
   */
  const ViewfinderCardView = Backbone.View.extend(
    /** @lends ViewfinderCardView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ViewfinderCardView",

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
       * Zoom to the card's location and toggle the relevant layers. Closes
       * any open visualization overlay first. When the clicked button carries
       * a `data-cta-index` attribute it is a 'map'-type ctaAction; the
       * corresponding action object is forwarded to `selectCallback` so the
       * model can use its specific coordinates and layerIds.
       * @param {MouseEvent} [e] The click event, if triggered from the DOM.
       */
      selectLayers(e) {
        const btn =
          e?.currentTarget ??
          this.el.querySelector(`.${CLASS_NAMES.viewLayersButton}`);
        const ctaIndex = btn?.dataset?.ctaIndex;
        const action =
          ctaIndex !== undefined
            ? this.preset.get("ctaActions")[Number(ctaIndex)]
            : undefined;
        this.onActivate(this);
        this.closeVisualizationCallback();
        this.setActive(btn);
        this.selectCallback(action);
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
          .querySelectorAll(`.${CLASS_NAMES.viewLayersButton}`)
          .forEach((btn) => {
            btn.classList.toggle(
              CLASS_NAMES.viewLayersButtonActive,
              btn === buttonEl,
            );
          });
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
          .querySelectorAll(`.${CLASS_NAMES.viewLayersButton}`)
          .forEach((btn) =>
            btn.classList.remove(CLASS_NAMES.viewLayersButtonActive),
          );
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
       * @param {ViewfinderCardModel} options.preset - The metadata associated
       * with this viewfinder card.
       * @param {Function} [options.selectCallback] Called when "View Layers" is
       * clicked. Should zoom to the card location and toggle layers.
       * @param {Function} [options.ctaCallback] Called with (url) when
       * "Explore in App" is clicked. Should open the visualization overlay.
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
        this.el.innerHTML = _.template(Template)(this.templateVars);
      },
    },
  );

  return ViewfinderCardView;
});
