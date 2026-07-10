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
   * of the viewfinder cards in 0.0.0. It now has wires through the functions
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
       * @property {ViewfinderCards} viewfinderCards The collection of
       * viewfinder cards
       * @property {Function} selectViewfinderCard The callback function for
       * selecting a viewfinder card (zoom + toggle layers).
       * @property {Function} [openVisualization] Called with (url) to open
       * the visualization overlay.
       * @property {Function} [closeVisualization] Called to close the
       * visualization overlay.
       * @property {Function} [onActivate] Called when a viewfinder card is
       * activated.
       * @since 0.0.0
       */

      /**
       * @param {ViewfinderCardsListViewOptions} options Options for this view.
       */
      initialize({
        viewfinderCards,
        selectViewfinderCard,
        openVisualization,
        closeVisualization,
        onActivate,
          onActionActivated,
      }) {
        this.children = [];
        this.viewfinderCards = viewfinderCards;
        this.selectViewfinderCard = selectViewfinderCard;
        this.openVisualization =
          typeof openVisualization === "function"
            ? openVisualization
            : () => {};
        this.closeVisualization =
          typeof closeVisualization === "function"
            ? closeVisualization
            : () => {};
        this.onActivate =
          typeof onActivate === "function" ? onActivate : () => {};
        this.onActionActivated =
          typeof onActionActivated === "function"
            ? onActionActivated
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
            selectCallback: (action) => {
              this.selectViewfinderCard(card, action);
            },
            ctaCallback: (url) => {
              this.openVisualization(url);
            },
            closeVisualizationCallback: () => {
              this.closeVisualization();
            },
            onActivate: (activeView) => {
              this.children.forEach((child) => {
                if (child !== activeView) child.resetActiveState();
              });
              this.onActivate(activeView);
            },
            onActionActivated: (action) => {
              this.onActionActivated(card, action);
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
