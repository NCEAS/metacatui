'use strict';
define(
  [
    'backbone',
    'views/maps/viewfinder/PredictionView',
    'models/maps/viewfinder/ViewfinderModel',
  ],
  (Backbone, PredictionView, ViewfinderModel) => {
    // The base classname to use for this View's template elements.
    const BASE_CLASS = 'viewfinder-predictions';

    /**
     * @class PredictionsListView
     * @classdesc PredictionsListView manages a list of autocomplete
     * predictions that can be selected by the user.
     * @classcategory Views/Maps
     * @name PredictionsListView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/PredictionsListView.png
     * @since x.x.x
     * @constructs PredictionsListView
     */
    var PredictionsListView = Backbone.View.extend({
      /**
       * The type of View this is
       * @type {string}
       */
      type: 'PredictionsListView',

      /**
       * The HTML class to use for this view's outermost element.
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The HTML element to use for this view's outermost element.
       * @type {string}
       */
      tagName: 'ul',

      /**
       * @typedef {Object} ViewfinderViewOptions
       * @property {ViewfinderModel} The model associated with the parent view.
       */
      initialize({ viewfinderModel }) {
        this.children = [];
        this.viewfinderModel = viewfinderModel;

        this.setupListeners();
      },

      /** Setup all event listeners on ViewfinderModel. */
      setupListeners() {
        this.listenTo(this.viewfinderModel, 'change:predictions', () => {
          this.render();
        });

        this.listenTo(this.viewfinderModel, 'selection-made', (newQuery) => {
          if (this.viewfinderModel.get('query') === newQuery) return;

          this.clear();
        });
      },

      /**
       * Remove all child view elements and destroy their Backbone.View.
       */
      clear() {
        while (this.children.length) {
          this.children.pop().remove();
        }
      },

      /**
       * Render the Prediction sub-views, tracking
       * them so they can be removed and their event listeners
       * cleaned up. 
       */
      render() {
        this.clear();
        this.children = this.viewfinderModel.get('predictions').map((prediction, index) => {
          const view = new PredictionView({
            index,
            predictionModel: prediction,
            viewfinderModel: this.viewfinderModel,
          });
          view.render();
          return view;
        });

        this.$el.html(this.children.map(view => view.el));
      },
    });

    return PredictionsListView;
  });