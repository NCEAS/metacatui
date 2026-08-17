"use strict";

define(["underscore", "backbone", "views/maps/viewfinder/ViewfinderCardView"], (
  _,
  Backbone,
  ViewfinderCardView,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-cards";

  /**
   * @class ViewfinderCardsListView
   * @classdesc This component was extended from ZoomPresetsListView
   * and was renamed for clarity when zoom presets were deprecated in favor
   * of the viewfinder cards in 2.37.0. It now has wires through the functions
   * to open and close the visualization overlay, and to handle activation of
   * a viewfinder card.
   * @classcategory Views/Maps/Viewfinder
   * @name ViewfinderCardsListView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ViewfinderCardsListView.png
   * @since 2.29.0
   * @constructs ViewfinderCardsListView
   */
  const ViewfinderCardsListView = Backbone.View.extend(
    /** @lends ViewfinderCardsListView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ViewfinderCardsListView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * @typedef {object} ViewfinderCardsListViewOptions
       * @property {ViewfinderCards} viewfinderCards The collection of viewfinder cards.
       * @property {Function} onMapAction Callback for map actions from a viewfinder card (zoom + toggle layers).
       * @property {Function} [onIframeAction] Called when an iframe action is activated and should open the visualization overlay.
       * @property {Function} [onRequestCloseVisualization] Called to close the visualization overlay.
       * @property {Function} [onActionUiActivated] Called after a card action button is activated in the UI.
       * @property {Function} [onActivate] Called when a viewfinder card is activated.
       * @since 2.37.0
       */

      /**
       * @param {ViewfinderCardsListViewOptions} options Options for this view.
       */
      initialize({
        viewfinderCards,
        onMapAction,
        onIframeAction,
        onRequestCloseVisualization,
        onActivate,
        onActionUiActivated,
      }) {
        this.children = [];
        this.viewfinderCards = viewfinderCards;
        this.onMapAction =
          typeof onMapAction === "function" ? onMapAction : () => {};
        this.onIframeAction =
          typeof onIframeAction === "function" ? onIframeAction : () => {};
        this.onRequestCloseVisualization =
          typeof onRequestCloseVisualization === "function"
            ? onRequestCloseVisualization
            : () => {};
        this.onActivate =
          typeof onActivate === "function" ? onActivate : () => {};
        this.onActionUiActivated =
          typeof onActionUiActivated === "function"
            ? onActionUiActivated
            : () => {};
      },

      /**
       * Render the view by updating the HTML of the element.
       */
      render() {
        this.el.innerHTML = "";
        this.children = this.viewfinderCards?.models?.map((card) => {
          const view = new ViewfinderCardView({
            preset: card,
            onMapAction: (action) => {
              this.onMapAction(card, action);
            },
            onIframeAction: (action) => {
              this.onIframeAction(action);
            },
            onRequestCloseVisualization: () => {
              this.onRequestCloseVisualization();
            },
            onActivate: (activeView) => {
              this.children.forEach((child) => {
                if (child !== activeView) child.resetActiveState();
              });
              this.onActivate(activeView);
            },
            onActionUiActivated: (action) => {
              this.onActionUiActivated(card, action);
            },
          });
          view.render();
          this.el.appendChild(view.el);
          return view;
        });
      },
    },
  );

  return ViewfinderCardsListView;
});
