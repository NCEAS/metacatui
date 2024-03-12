'use strict';

define(
  [
    'underscore',
    'backbone',
    'text!templates/maps/viewfinder/viewfinder.html',
    'views/maps/viewfinder/SearchView',
    'views/maps/viewfinder/ZoomPresetsListView',
    'views/maps/viewfinder/ExpansionPanelView',
    'models/maps/viewfinder/ExpansionPanelsModel',
    'models/maps/viewfinder/ViewfinderModel',
  ],
  (
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
    const BASE_CLASS = 'viewfinder';

    /**
     * @class ViewfinderView
     * @classdesc ViewfinderView allows a user to search for
     * a latitude and longitude in the map view, and find suggestions
     * for places related to their search terms.
     * @classcategory Views/Maps
     * @name ViewfinderView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/ViewfinderView.png
     * @since x.x.x
     * @constructs ViewfinderView
     */
    var ViewfinderView = Backbone.View.extend({
      /**
       * The type of View this is
       * @type {string}
       */
      type: 'ViewfinderView',

      /**
       * The HTML class to use for this view's outermost element.
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The HTML classes to use for this view's HTML elements.
       * @type {Object<string,string>}
       */
      classNames: {
        searchView: `${BASE_CLASS}__search`,
        zoomPresetsView: `${BASE_CLASS}__zoom-presets`,
      },

      /** 
       * Values meant to be used by the rendered HTML template.
       */
      templateVars: {
        classNames: {},
      },

      /**
       * @typedef {Object} ViewfinderViewOptions
       * @property {Map} The Map model associated with this view allowing control
       * of panning to different locations on the map. 
       */
      initialize({ model: mapModel }) {
        this.templateVars.classNames = this.classNames;
        // TODO(ianguerin): remove this 
        // so now we have mapmodel which has layers on it, and those layers can be turned on or off.
        this.viewfinderModel = new ViewfinderModel({ mapModel });
        this.panelsModel = new ExpansionPanelsModel();
      },

      getZoomPresets() {
        return this.$el.find(`.${this.classNames.zoomPresetsView}`);
      },

      getSearch() {
        return this.$el.find(`.${this.classNames.searchView}`);
      },

      /** Render child ZoomPresetsView and append to DOM. */
      renderZoomPresetsView() {
        const zoomPresetsListView = new ZoomPresetsListView({
          viewfinderModel: this.viewfinderModel,
        });
        const expansionPanel = new ExpansionPanelView({
          contentViewInstance: zoomPresetsListView,
          icon: 'plane',
          panelsModel: this.panelsModel,
          title:'Zoom to...',
        });
        expansionPanel.render();

        this.getZoomPresets().append(expansionPanel.el);
      },

      /** Render child SearchView and append to DOM. */
      renderSearchView() {
        const searchView = new SearchView({
          viewfinderModel: this.viewfinderModel,
        });
        searchView.render();

        this.getSearch().append(searchView.el);
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render() {
        this.el.innerHTML = _.template(Template)(this.templateVars);

        this.renderSearchView();
        this.renderZoomPresetsView();
      },
    });

    return ViewfinderView;
  });