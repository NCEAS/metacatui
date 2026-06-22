"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder.html",
  "views/maps/viewfinder/SearchView",
  "views/maps/viewfinder/ViewfinderCardsListView",
  "views/maps/ExpansionPanelView",
  "models/maps/ExpansionPanelsModel",
  "models/maps/viewfinder/ViewfinderModel",
], (
  _,
  Backbone,
  Template,
  SearchView,
  ViewfinderCardsListView,
  ExpansionPanelView,
  ExpansionPanelsModel,
  ViewfinderModel,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    searchView: `${BASE_CLASS}__search`,
    viewfinderCardsView: `${BASE_CLASS}__zoom-presets`,
  };

  /**
   * @class ViewfinderView
   * @classdesc ViewfinderView allows a user to search for
   * a latitude and longitude in the map view, and find suggestions
   * for places related to their search terms.
   * @classcategory Views/Maps
   * @name ViewfinderView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ViewfinderView.png
   * @since 2.28.0
   * @constructs ViewfinderView
   */
  const ViewfinderView = Backbone.View.extend(
    /** @lends ViewfinderView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ViewfinderView",

      /**
       * The HTML class to use for this view's outermost element.
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * Values meant to be used by the rendered HTML template.
       */
      templateVars: {
        classNames: CLASS_NAMES,
      },

      /**
       * Initialize the ViewfinderView.
       * @param {object} options - The options for the view.
       * @param {Map} options.model - The map model to use for this view.
       */
      initialize({ model: mapModel }) {
        this.viewfinderModel = new ViewfinderModel({ mapModel });
        this.panelsModel = new ExpansionPanelsModel({ isMulti: true });
        this.viewfinderCardsListViews = [];

        // When the visualization overlay closes, reset active button states
        // on all preset cards so none appears stuck in an active state.
        this.listenTo(
          mapModel,
          "change:activeVisualizationUrl",
          (model, url) => {
            if (!url) {
              this.viewfinderCardsListViews.forEach((listView) => {
                listView.children?.forEach((child) => child.resetActiveState());
              });
            }
          },
        );
      },

      /**
       * Get the ViewfinderCardsView element.
       * @returns {JQuery} The ViewfinderCardsView element.
       * @since 2.29.0
       */
      getViewfinderCards() {
        return this.$el.find(`.${CLASS_NAMES.viewfinderCardsView}`);
      },

      /**
       * Get the ViewfinderCardsView panel for a given category, if it exists.
       * @param {ViewfinderCardCategory} category The category of viewfinder
       * cards to get the panel for.
       * @returns {JQuery} The ViewfinderCardsView panel element, or an empty
       * jQuery object if it doesn't exist.
       * @since 2.35.0
       */
      getViewfinderCardsPanel(category) {
        return this.$el.find(`#${category.cid}`);
      },

      /**
       * Determine where to place a ViewfinderCardsView for a given category,
       * based on the order of categories in the collection.
       * @param {ViewfinderCardCategory} category The category of viewfinder
       * cards to determine placement for.
       * @returns {string|object} "prepend" to add to the beginning of the list,
       * "append" to add to the end of the list, or { after: JQueryElement } to
       * add after a specific existing element.
       * @since 2.35.0
       */
      getViewfinderCardsPlacement(category) {
        const categories = this.viewfinderModel.get("viewfinderCards");
        const index = categories.indexOf(category);
        if (index === 0) return "prepend";
        const previousCategory = categories.at(index - 1);
        const previousPanel = this.getViewfinderCardsPanel(previousCategory);
        if (previousPanel?.length) return { after: previousPanel };
        return "append";
      },

      /**
       * Remove the ViewfinderCardsView panel for a given category, if it
       * exists.
       * @param {ViewfinderCardCategory} category The category of viewfinder
       * cards to remove the panel for.
       * @since 2.35.0
       */
      removeViewfinderCardsCategory(category) {
        const panel = this.getViewfinderCardsPanel(category);
        if (panel?.length) panel.remove();
      },

      /**
       * Get the SearchView element.
       * @returns {JQuery} The SearchView element.
       */
      getSearch() {
        return this.$el.find(`.${CLASS_NAMES.searchView}`);
      },

      /**
       * Helper function to focus input on the search query input and ensure
       * that the cursor is at the end of the text (as opposed to the beginning
       * which appears to be the default jQuery behavior).
       * @since 2.29.0
       */
      focusInput() {
        this.searchView.focusInput();
      },

      /**
       * Render child ViewfinderCardsListView and append to DOM.
       * @param {ViewfinderCardCategory} category The category of viewfinder
       * cards to render.
       * @since 2.29.0
       */
      renderViewfinderCardsView(category) {
        const viewfinderCards = category.get("viewfinderCards");
        if (!viewfinderCards.length && viewfinderCards.url) {
          viewfinderCards.fetch({
            success: () => this.renderViewfinderCardsView(category),
            error: () => this.removeViewfinderCardsCategory(category),
          });
          return;
        }

        const viewfinderCardsListView = new ViewfinderCardsListView({
          viewfinderCards,
          selectViewfinderCard: (card) => {
            this.viewfinderModel.selectViewfinderCard(card);
          },
          openVisualization: (url) => {
            this.viewfinderModel.openVisualization(url);
          },
          closeVisualization: () => {
            this.viewfinderModel.closeVisualization();
          },
          onActivate: (activeView) => {
            this.viewfinderCardsListViews.forEach((lv) => {
              lv.children?.forEach((child) => {
                if (child !== activeView) child.resetActiveState();
              });
            });
          },
        });
        viewfinderCardsListView.categoryCid = category.cid;
        this.viewfinderCardsListViews = this.viewfinderCardsListViews.filter(
          (lv) => lv.categoryCid !== category.cid,
        );
        this.viewfinderCardsListViews.push(viewfinderCardsListView);
        const expansionPanel = new ExpansionPanelView({
          contentViewInstance: viewfinderCardsListView,
          icon: category.get("icon"),
          panelsModel: this.panelsModel,
          title: category.get("label"),
          startOpen: category.get("expanded") === true,
          id: category.cid,
          variants: ["title"],
          isSvgIcon: category.get("isSvgIcon") === true,
        });
        expansionPanel.render();

        const existingPanel = this.getViewfinderCardsPanel(category);
        if (existingPanel?.length) {
          existingPanel.replaceWith(expansionPanel.el);
          return;
        }
        // otherwise, add it where it belongs according to collection order
        const placement = this.getViewfinderCardsPlacement(category);

        if (placement === "prepend") {
          this.getViewfinderCards().prepend(expansionPanel.el);
        } else if (placement === "append") {
          this.getViewfinderCards().append(expansionPanel.el);
        } else if (placement.after) {
          placement.after.after(expansionPanel.el);
        }
      },

      /** Render child SearchView and append to DOM. */
      renderSearchView() {
        this.searchView = new SearchView({
          viewfinderModel: this.viewfinderModel,
        });
        this.searchView.render();

        this.getSearch().append(this.searchView.el);
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       */
      render() {
        this.el.innerHTML = _.template(Template)(this.templateVars);

        this.renderSearchView();

        const categories = this.viewfinderModel.get("viewfinderCards");
        categories?.each((category) =>
          this.renderViewfinderCardsView(category),
        );
      },
    },
  );

  return ViewfinderView;
});
