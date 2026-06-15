"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder.html",
  "views/maps/viewfinder/SearchView",
  "views/maps/viewfinder/ZoomPresetsListView",
  "views/maps/ExpansionPanelView",
  "models/maps/ExpansionPanelsModel",
  "models/maps/viewfinder/ViewfinderModel",
], (
  _,
  Backbone,
  Template,
  SearchView,
  ZoomPresetsListView,
  ExpansionPanelView,
  ExpansionPanelsModel,
  ViewfinderModel,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    searchView: `${BASE_CLASS}__search`,
    zoomPresetsView: `${BASE_CLASS}__zoom-presets`,
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
       * @param {object} options.model - The map model to use for this view.
       */
      initialize({ model: mapModel }) {
        this.viewfinderModel = new ViewfinderModel({ mapModel });
        this.panelsModel = new ExpansionPanelsModel({ isMulti: true });
        this.zoomPresetsListViews = [];

        // When the visualization overlay closes, reset active button states
        // on all preset cards so none appears stuck in an active state.
        this.listenTo(
          mapModel,
          "change:activeVisualizationUrl",
          (model, url) => {
            if (!url) {
              this.zoomPresetsListViews.forEach((listView) => {
                listView.children?.forEach((child) => child.resetActiveState());
              });
            }
          },
        );
      },

      /**
       * Get the ZoomPresetsView element.
       * @returns {JQuery} The ZoomPresetsView element.
       * @since 2.29.0
       */
      getZoomPresets() {
        return this.$el.find(`.${CLASS_NAMES.zoomPresetsView}`);
      },

      /**
       * Get the ZoomPresetsView panel for a given category, if it exists.
       * @param {ZoomPresetCategory} category The category of zoom presets to
       * get the panel for.
       * @returns {JQuery} The ZoomPresetsView panel element, or an empty jQuery
       * object if it doesn't exist.
       * @since 2.35.0
       */
      getZoomPresetsPanel(category) {
        return this.$el.find(`#${category.cid}`);
      },

      /**
       * Determine where to place a ZoomPresetsView for a given category, based
       * on the order of categories in the collection.
       * @param {ZoomPresetCategory} category The category of zoom presets to
       * determine placement for.
       * @returns {string|object} "prepend" to add to the beginning of the list,
       * "append" to add to the end of the list, or { after: JQueryElement } to
       * add after a specific existing element.
       * @since 2.35.0
       */
      getZoomPresetsPlacement(category) {
        const categories = this.viewfinderModel.get("zoomPresets");
        const index = categories.indexOf(category);
        if (index === 0) return "prepend";
        const previousCategory = categories.at(index - 1);
        const previousPanel = this.getZoomPresetsPanel(previousCategory);
        if (previousPanel?.length) return { after: previousPanel };
        return "append";
      },

      /**
       * Remove the ZoomPresetsView panel for a given category, if it exists.
       * @param {ZoomPresetCategory} category The category of zoom presets to
       * remove the panel for.
       * @since 2.35.0
       */
      removeZoomPresetsCategory(category) {
        const panel = this.getZoomPresetsPanel(category);
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
       * Render child ZoomPresetsView and append to DOM.
       * @param {ZoomPresetCategory} category The category of zoom presets to
       * render.
       * @since 2.29.0
       */
      renderZoomPresetsView(category) {
        const zoomPresets = category.get("zoomPresets");
        if (!zoomPresets.length && zoomPresets.url) {
          zoomPresets.fetch({
            success: () => this.renderZoomPresetsView(category),
            error: () => this.removeZoomPresetsCategory(category),
          });
          return;
        }

        const zoomPresetsListView = new ZoomPresetsListView({
          zoomPresets,
          selectZoomPreset: (preset) => {
            this.viewfinderModel.selectZoomPreset(preset);
          },
          openVisualization: (url, permissions) => {
            this.viewfinderModel.openVisualization(url, permissions);
          },
          closeVisualization: () => {
            this.viewfinderModel.closeVisualization();
          },
          onActivate: (activeView) => {
            this.zoomPresetsListViews.forEach((lv) => {
              lv.children?.forEach((child) => {
                if (child !== activeView) child.resetActiveState();
              });
            });
          },
        });
        zoomPresetsListView.categoryCid = category.cid;
        this.zoomPresetsListViews = this.zoomPresetsListViews.filter(
          (lv) => lv.categoryCid !== category.cid,
        );
        this.zoomPresetsListViews.push(zoomPresetsListView);
        const expansionPanel = new ExpansionPanelView({
          contentViewInstance: zoomPresetsListView,
          icon: category.get("icon"),
          panelsModel: this.panelsModel,
          title: category.get("label"),
          startOpen: category.get("expanded") === true,
          id: category.cid,
          variants: ["title"],
          isSvgIcon: category.get("isSvgIcon") === true,
        });
        expansionPanel.render();

        const existingPanel = this.getZoomPresetsPanel(category);
        if (existingPanel?.length) {
          existingPanel.replaceWith(expansionPanel.el);
          return;
        }
        // otherwise, add it where it belongs according to collection order
        const placement = this.getZoomPresetsPlacement(category);

        if (placement === "prepend") {
          this.getZoomPresets().prepend(expansionPanel.el);
        } else if (placement === "append") {
          this.getZoomPresets().append(expansionPanel.el);
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

        const categories = this.viewfinderModel.get("zoomPresets");
        categories?.each((category) => this.renderZoomPresetsView(category));
      },
    },
  );

  return ViewfinderView;
});
