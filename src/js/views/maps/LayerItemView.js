
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
    'text!templates/maps/layer-item.html'
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerItemView
    * @classdesc One item in a Layer List: shows some basic information about the Layer,
    * including label and icon. Also has a button that changes the visibility of the Layer
    * of the map (by updating the 'visibility' attribute in the Layer model). Clicking on
    * the Layer Item opens the Layer Details panel (by setting the 'selected' attribute to
    * true in the Layer model.)
    * @classcategory Views/Maps
    * @name LayerItemView
    * @extends Backbone.View
    * @screenshot maps/LayerItemView.png // TODO: add screenshot
    * @constructs
    */
    var LayerItemView = Backbone.View.extend(
      /** @lends LayerItemView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerItemView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-item',

        /**
        * The model that this view uses
        * @type {Layer}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * Classes that are used to identify the HTML elements that comprise this view.
         * @type {Object}
         * @property {string} title The element that contains the layer's name/label
         */
        classes: {
          label: 'layer-item__label',
          selected: 'layer-item--selected'
        },

        /**
        * A function that gives the events this view will listen to and the associated
        * function to call.
        * @returns {Object} Returns an object with events in the format 'event selector':
        * 'function'
        */
        events: function () {
          try {
            var events = {}
            events['click .' + this.classes.label] = 'toggleSelectionAttr';
            return events
          }
          catch (error) {
            console.log(
              'There was an error setting the events object in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
        * Executed when a new LayerItemView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A LayerItemView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerItemView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({
              label: this.model.get('label')
            }));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // When the Layer is selected, highlight this item in the Layer List. When
            // it's no longer selected, then make sure it's no longer highlighted. Set a
            // listener because the 'selected' attribute can be changed within this view,
            // from the parent Layers collection, or from the Layer Details View.
            this.stopListening(this.model, 'change:selected')
            this.listenTo(this.model, 'change:selected', this.toggleHighlighting)

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Sets the Layer model's 'selected' status attribute to true if it's false, and
         * to false if it's true. Executed when a user clicks on this Layer Item in a
         * Layer List view.
         */
        toggleSelectionAttr : function(){
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('selected');
            if (currentStatus === true) {
              layerModel.set('selected', false);
            } else {
              layerModel.set('selected', true);
            }
          }
          catch (error) {
            console.log(
              'There was an error selecting or unselecting a layer in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Highlight/emphasize this item in the Layer List when it is selected (i.e. when
         * the Layer model's 'selected' attribute is set to true). If it is not selected,
         * then remove any highlighting. This function is executed whenever the model's
         * 'selected' attribute changes. It can be changed from within this view (with the
         * toggleSelectionAttr function), from the parent Layers collection, or from the
         * Layer Details View.
         */
        toggleHighlighting: function () {
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('selected');
            if (currentStatus === true) {
              this.el.classList.add(this.classes.selected)
            } else {
              this.el.classList.remove(this.classes.selected)
            }
          }
          catch (error) {
            console.log(
              'There was an error changing the highlighting in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return LayerItemView;

  }
);
