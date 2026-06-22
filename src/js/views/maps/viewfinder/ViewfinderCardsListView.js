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
   * @classdesc Allow user to zoom to a preset location with certain data
   * layers enabled.
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
      },

      /**
       * Render the view by updating the HTML of the element.
       */
      render() {
        this.el.innerHTML = "";
        this.children = this.viewfinderCards?.models?.map((card) => {
          const view = new ViewfinderCardView({
            preset: card,
            selectCallback: () => {
              this.selectViewfinderCard(card);
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
