'use strict';
define(
  ['backbone', 'text!templates/maps/viewfinder/viewfinder-prediction.html'],
  (Backbone, Template) => {
    // The base classname to use for this View's template elements.
    const BASE_CLASS = 'viewfinder-prediction';

    /**
     * @class PredictionView
     * @classdesc PredictionView shows an autocomplete suggestion
     * for the user when they are searching for a place on a map.
     * @classcategory Views/Maps
     * @name PredictionView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/PredictionView.png
     * @since 2.28.0
     * @constructs PredictionView
     */
    const PredictionView = Backbone.View.extend({
      /**
       * The type of View this is
       * @type {string}
       */
      type: 'PredictionView',

      /**
       * The HTML class to use for this view's outermost element.
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The HTML element to use for this view's outermost element.
       * @type {string}
       */
      tagName: 'li',

      /**
       * The HTML classes to use for this view's HTML elements.
       * @type {Object<string,string>}
       */
      classNames: {
        content: `${BASE_CLASS}__content`,
      },

      /**
      * The events this view will listen to and the associated function to call.
      * @type {Object}
      */
      events: { click: 'select' },

      /** 
       * Values meant to be used by the rendered HTML template.
       */
      templateVars: {
        classNames: {},
        isFocused: false,
      },

      /**
       * @typedef {Object} PredictionViewOptions
       * @property {Prediction} The Prediction model associated with this
       * autocompletion prediction.
       * @property {ViewfinderModel} The model associated with the parent view.
       * @property {number} The position of this prediction within the parent's
       * full list of predictions.
       */
      initialize({ index, predictionModel, viewfinderModel }) {
        this.predictionModel = predictionModel;
        this.viewfinderModel = viewfinderModel;
        this.index = index;

        this.templateVars = {
          ...this.templateVars,
          classNames: this.classNames,
          description: this.predictionModel.get('description'),
        };

        this.setupListeners();
      },

      /**
       * Setup all event listeners on ViewfinderModel.
       */
      setupListeners() {
        this.listenTo(this.viewfinderModel, 'change:focusIndex', () => {
          this.render();
        });
      },

      /**
       * Event handler function that selects this element, deselecting any other 
       * sibling list elements.
       */
      select(event) {
        this.viewfinderModel.selectPrediction(this.predictionModel);
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render() {
        const focusIndex = this.viewfinderModel.get('focusIndex');
        this.templateVars.isFocused = focusIndex === this.index;

        this.el.innerHTML = _.template(Template)(this.templateVars);
      },
    });

    return PredictionView;
  });
